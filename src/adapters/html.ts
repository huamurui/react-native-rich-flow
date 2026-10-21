import { parseDocument } from 'htmlparser2';
import type {
  RichFlowBlock,
  RichFlowDocument,
  RichFlowInline,
  RichFlowStyle,
} from '../document.js';
import type { ParseOptions } from './options.js';
import { markupUrl } from './url.js';

type HtmlNode = ReturnType<typeof parseDocument>['children'][number];
type HtmlElement = Extract<HtmlNode, { attribs: Record<string, string> }>;

const discarded = new Set([
  'script', 'style', 'iframe', 'object', 'embed', 'head', 'title', 'meta', 'link',
  'template', 'noscript', 'form', 'input', 'button', 'select', 'textarea', 'svg', 'math',
]);
const containers = new Set([
  'html', 'body', 'div', 'section', 'article', 'main', 'header', 'footer', 'aside',
  'figure', 'figcaption', 'details', 'summary', 'address', 'dl', 'dt', 'dd',
]);
const blockTags = new Set([
  ...containers, 'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'ul', 'ol',
  'pre', 'hr', 'table', 'tr', 'thead', 'tbody', 'tfoot',
]);
const styles: Readonly<Record<string, RichFlowStyle['type']>> = {
  b: 'strong', strong: 'strong', i: 'emphasis', em: 'emphasis', u: 'underline',
  s: 'strikethrough', strike: 'strikethrough', del: 'strikethrough', mark: 'highlight',
  sub: 'subscript', sup: 'superscript', code: 'code', kbd: 'code',
};

function element(node: HtmlNode): node is HtmlElement {
  return 'attribs' in node;
}

function depthGuard(depth: number): void {
  if (depth > 128) throw new RangeError('HTML nesting exceeds the supported depth of 128.');
}

function dimension(value: string | undefined): number | undefined {
  if (value === undefined || !/^\d+(?:\.\d+)?$/.test(value)) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

function textContent(nodes: readonly HtmlNode[], depth = 0): string {
  depthGuard(depth);
  return nodes.map((node) => {
    if (node.type === 'text') return node.data;
    if (element(node) && !discarded.has(node.name)) {
      return node.name === 'br' ? '\n' : textContent(node.children, depth + 1);
    }
    return '';
  }).join('');
}

/**
 * Parse common HTML semantics, not browser CSS or a DOM renderer.
 * Source offsets in the resulting flow refer to decoded semantic text nodes.
 */
export function parseHtml(html: string, options: ParseOptions = {}): RichFlowDocument {
  const documentId = options.id ?? 'html';
  let sequence = 0;
  const id = (kind: string): string => `${documentId}:${kind}:${++sequence}`;

  function inlines(nodes: readonly HtmlNode[], depth: number, whitespace = { space: true }): RichFlowInline[] {
    depthGuard(depth);
    const result: RichFlowInline[] = [];
    for (const node of nodes) {
      if (node.type === 'text') {
        let text = node.data.replace(/[\t\n\r\f ]+/g, ' ');
        if (whitespace.space) text = text.replace(/^ /, '');
        if (!text) continue;
        whitespace.space = text.endsWith(' ');
        result.push({ id: id('text'), type: 'text', text });
        continue;
      }
      if (!element(node) || discarded.has(node.name)) continue;
      const name = node.name;
      // Ruby fallback punctuation and reading text are never selectable base text.
      if (name === 'rt' || name === 'rp' || name === 'rtc') continue;
      if (name === 'ruby') {
        let base: HtmlNode[] = [];
        let pendingBases: HtmlNode[][] = [];
        const appendBase = (nodes: readonly HtmlNode[], annotation?: string) => {
          const children = inlines(nodes, depth + 1, whitespace);
          if (!children.length) return;
          if (annotation) {
            result.push({
              id: id('ruby'), type: 'ruby', children, annotation,
              position: node.attribs['data-ruby-position'] === 'under' ? 'under' : 'over',
            });
          } else {
            result.push(...children);
          }
        };
        const flushPendingBases = () => {
          for (const nodes of pendingBases) appendBase(nodes);
          pendingBases = [];
        };
        for (const child of node.children) {
          if (element(child) && child.name === 'rt') {
            if (base.length) {
              // Explicit rb groups pair with successive rt elements; implicit base
              // content remains one reading unit, including nested inline styles.
              pendingBases = base.every((part) => element(part) && part.name === 'rb')
                ? base.map((part) => [part]) : [base];
              base = [];
            }
            const reading = textContent(child.children, depth + 1)
              .replace(/[\t\n\r\f ]+/g, ' ').replace(/^ | $/g, '');
            appendBase(pendingBases.shift() ?? [], reading);
          } else if (element(child) && (child.name === 'rp' || child.name === 'rtc')) {
            continue;
          } else if (child.type === 'text' && /^[\t\n\r\f ]*$/.test(child.data)) {
            // Formatting whitespace between ruby bases/readings is not base text.
            continue;
          } else if (element(child) || child.type === 'text') {
            flushPendingBases();
            base.push(child);
          }
        }
        flushPendingBases();
        appendBase(base);
        continue;
      }
      if (name === 'br') {
        trimEnd(result);
        result.push({ id: id('break'), type: 'break' });
        whitespace.space = true;
        continue;
      }
      const latex = node.attribs['data-latex'];
      if (name === 'img' || latex !== undefined) {
        const source = markupUrl(node.attribs.src ?? node.attribs['data-src'], true, options.baseUrl);
        const width = dimension(node.attribs.width);
        const height = dimension(node.attribs.height);
        const alt = node.attribs.alt;
        const size = {
          ...(width !== undefined ? { width } : {}),
          ...(height !== undefined ? { height } : {}),
          ...(alt !== undefined ? { alt } : {}),
        };
        if (latex !== undefined) {
          result.push({ id: id('formula'), type: 'formula', latex, ...size, ...(source ? { url: source } : {}) });
          whitespace.space = false;
        } else if (source) {
          result.push({ id: id('image'), type: 'image', url: source, ...size });
          whitespace.space = false;
        } else if (alt) {
          result.push({ id: id('text'), type: 'text', text: alt });
          whitespace.space = alt.endsWith(' ');
        }
        continue;
      }
      const children = inlines(node.children, depth + 1, whitespace);
      if (!children.length) continue;
      let content: RichFlowInline[] = children;
      const style = styles[name];
      if (style) {
        content = [{ id: id(style), type: style, children: content }];
      } else if (name === 'a') {
        const url = markupUrl(node.attribs.href, false, options.baseUrl);
        if (url) content = [{ id: id('link'), type: 'link', url, children: content }];
      }
      const kind = node.attribs['data-decoration'];
      if (kind === 'solid' || kind === 'dashed' || kind === 'dotted' || kind === 'wavy') {
        const actionId = node.attribs['data-action-id'];
        content = [{
          id: id('decoration'), type: 'decoration', kind, children: content,
          ...(actionId !== undefined ? { actionId } : {}),
        }];
      }
      const mark = node.attribs['data-text-emphasis'];
      if (mark === 'dot' || mark === 'circle' || mark === 'sesame') {
        content = [{
          id: id('text-emphasis'), type: 'textEmphasis', mark, children: content,
          position: node.attribs['data-emphasis-position'] === 'over' ? 'over' : 'under',
        }];
      }
      result.push(...content);
    }
    return result;
  }

  function trimEnd(nodes: RichFlowInline[]): void {
    for (let index = nodes.length - 1; index >= 0; index -= 1) {
      const node = nodes[index];
      if (!node) continue;
      if (node.type === 'text') {
        const text = node.text.replace(/ +$/, '');
        if (text) { nodes[index] = { ...node, text }; return; }
        nodes.splice(index, 1);
      } else if ('children' in node) {
        const children = [...node.children];
        trimEnd(children);
        if (children.length) { nodes[index] = { ...node, children }; return; }
        nodes.splice(index, 1);
      } else {
        return;
      }
    }
  }

  function paragraphContent(nodes: readonly HtmlNode[], depth: number): RichFlowInline[] {
    const result = inlines(nodes, depth);
    trimEnd(result);
    return result;
  }

  function blocks(nodes: readonly HtmlNode[], depth: number): RichFlowBlock[] {
    depthGuard(depth);
    const result: RichFlowBlock[] = [];
    let pending: HtmlNode[] = [];
    function flush(): void {
      if (!pending.length) return;
      const children = paragraphContent(pending, depth + 1);
      if (children.length) result.push({ id: id('paragraph'), type: 'paragraph', children });
      pending = [];
    }
    for (const node of nodes) {
      if (!element(node)) {
        if (node.type === 'text') pending.push(node);
        continue;
      }
      const name = node.name;
      if (discarded.has(name)) continue;
      if (!blockTags.has(name)) {
        if (node.children.some((child) => element(child) && blockTags.has(child.name))) {
          flush();
          result.push(...blocks(node.children, depth + 1));
        } else {
          pending.push(node);
        }
        continue;
      }
      flush();
      if (name === 'p' || /^h[1-6]$/.test(name)) {
        const children = paragraphContent(node.children, depth + 1);
        result.push(name === 'p'
          ? { id: id('paragraph'), type: 'paragraph', children }
          : { id: id('heading'), type: 'heading', level: Number(name[1]) as 1 | 2 | 3 | 4 | 5 | 6, children });
      } else if (name === 'blockquote') {
        result.push({ id: id('quote'), type: 'quote', blocks: blocks(node.children, depth + 1) });
      } else if (name === 'ul' || name === 'ol') {
        const start = Number(node.attribs.start ?? 1);
        const items = node.children.filter((child): child is HtmlElement => element(child) && child.name === 'li')
          .map((child) => ({ id: id('item'), blocks: blocks(child.children, depth + 1) }));
        result.push({
          id: id('list'), type: 'list', ordered: name === 'ol', items,
          ...(Number.isSafeInteger(start) ? { start } : {}),
        });
      } else if (name === 'pre') {
        const code = node.children.find((child): child is HtmlElement => element(child) && child.name === 'code');
        const language = code?.attribs.class?.match(/(?:^|\s)language-([^\s]+)/)?.[1];
        result.push({
          id: id('code'), type: 'code', text: textContent(node.children),
          ...(language ? { language } : {}),
        });
      } else if (name === 'hr') {
        result.push({ id: id('paragraph'), type: 'paragraph', children: [{ id: id('text'), type: 'text', text: '—' }] });
      } else if (name === 'tr') {
        const cells = node.children.filter((child): child is HtmlElement => element(child) && (child.name === 'td' || child.name === 'th'));
        const children: RichFlowInline[] = [];
        cells.forEach((cell, index) => {
          if (index > 0) children.push({ id: id('text'), type: 'text', text: ' | ' });
          const content = paragraphContent(cell.children, depth + 1);
          children.push(...(cell.name === 'th' ? [{ id: id('strong'), type: 'strong' as const, children: content }] : content));
        });
        if (children.length) result.push({ id: id('paragraph'), type: 'paragraph', children });
      } else {
        result.push(...blocks(node.children, depth + 1));
      }
    }
    flush();
    return result;
  }

  return { id: documentId, blocks: blocks(parseDocument(html, { decodeEntities: true }).children, 0) };
}
