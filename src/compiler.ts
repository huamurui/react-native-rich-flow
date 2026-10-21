import type {
  CompileOptions,
  RichFlowBlock,
  RichFlowDocument,
  RichFlowInline,
} from './document.js';
import type {
  RichTextAnnotation,
  RichTextAttachment,
  RichTextDecoration,
  RichTextFlow,
  RichTextParagraph,
  RichTextSourceRange,
  RichTextSpan,
} from './model.js';
import { isValidTextRange } from './selection.js';

function positive(value: number | undefined, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
    ? value
    : fallback;
}

function nonnegative(value: number | undefined, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
    ? value
    : fallback;
}

/** A compact deterministic identity, not a cryptographic content digest. */
function revision(value: string): string {
  let first = 0x811c9dc5;
  let second = 0x9e3779b9;
  for (let index = 0; index < value.length; index += 1) {
    const unit = value.charCodeAt(index);
    first = Math.imul(first ^ unit, 0x01000193);
    second = Math.imul(second ^ unit, 0x85ebca6b);
  }
  return `rf1-${(first >>> 0).toString(36)}-${(second >>> 0).toString(36)}`;
}

interface Context {
  readonly quoteDepth: number;
  readonly listDepth: number;
  readonly marker?: { text: string; nodeId: string; consumed: boolean };
}

/** Compile one document into one continuous native selection context. */
export function compileDocument(
  document: RichFlowDocument,
  options: CompileOptions = {},
): RichTextFlow {
  if (typeof document.id !== 'string' || document.id.length === 0) {
    throw new TypeError('A document needs a nonempty id.');
  }
  const fontSize = positive(options.fontSize, 17);
  const lineHeight = positive(options.lineHeight, fontSize * 1.5);
  const paragraphSpacing = nonnegative(options.paragraphSpacing, 12);
  const indentSize = nonnegative(options.indentSize, 20);
  const spans: RichTextSpan[] = [];
  const paragraphs: RichTextParagraph[] = [];
  const decorations: RichTextDecoration[] = [];
  const annotations: RichTextAnnotation[] = [];
  const attachments: RichTextAttachment[] = [];
  const sourceMap: RichTextSourceRange[] = [];
  const ids = new Set<string>();
  let text = '';
  let paragraphCount = 0;

  function register(id: string): void {
    if (typeof id !== 'string' || id.length === 0 || ids.has(id)) {
      throw new TypeError('Every document node needs a unique, nonempty id.');
    }
    ids.add(id);
  }

  function append(
    value: string,
    nodeId: string,
    paragraphId: string,
    kind: RichTextSourceRange['kind'],
    sourceLength = value.length,
  ): void {
    if (!value) return;
    const start = text.length;
    text += value;
    sourceMap.push({
      start,
      end: text.length,
      nodeId,
      paragraphId,
      sourceStart: 0,
      sourceEnd: kind === 'synthetic' ? 0 : sourceLength,
      kind,
    });
  }

  function inline(nodes: readonly RichFlowInline[], paragraphId: string, depth = 0): void {
    if (depth > 128) throw new RangeError('Document nesting exceeds the supported depth of 128.');
    for (const node of nodes) {
      register(node.id);
      const start = text.length;
      if (node.type === 'text') {
        append(node.text, node.id, paragraphId, 'text');
      } else if (node.type === 'break') {
        append('\n', node.id, paragraphId, 'text');
      } else if (node.type === 'image' || node.type === 'formula') {
        const copyText = node.copyText ?? (node.type === 'formula' ? node.latex : node.alt ?? '');
        append('\ufffc', node.id, paragraphId, 'attachment', copyText.length);
        attachments.push({
          id: node.id,
          nodeId: node.id,
          kind: node.type,
          start,
          end: text.length,
          copyText,
          ...(node.url !== undefined ? { url: node.url } : {}),
          ...(node.type === 'formula' ? { latex: node.latex } : {}),
          ...(node.alt !== undefined ? { alt: node.alt } : {}),
          ...(node.width !== undefined ? { width: positive(node.width, fontSize) } : {}),
          ...(node.height !== undefined ? { height: positive(node.height, fontSize) } : {}),
          ...(node.baselineOffset !== undefined && Number.isFinite(node.baselineOffset)
            ? { baselineOffset: node.baselineOffset }
            : {}),
        });
      } else {
        const spanIndex = spans.length;
        const decorationIndex = decorations.length;
        const annotationIndex = annotations.length;
        inline(node.children, paragraphId, depth + 1);
        if (start === text.length) continue;
        if (node.type === 'decoration') {
          decorations.splice(decorationIndex, 0, {
            id: node.id,
            nodeId: node.id,
            kind: node.kind,
            start,
            end: text.length,
            ...(node.color !== undefined ? { color: node.color } : {}),
            ...(node.thickness !== undefined ? { thickness: positive(node.thickness, 1) } : {}),
            ...(node.offset !== undefined && Number.isFinite(node.offset) ? { offset: node.offset } : {}),
            ...(node.actionId !== undefined ? { actionId: node.actionId } : {}),
          });
        } else if (node.type === 'textEmphasis' || node.type === 'ruby') {
          // A blank reading is an unannotated base, not extra text or an empty line.
          if (node.type === 'ruby' && !node.annotation.trim()) continue;
          annotations.splice(annotationIndex, 0, {
            id: node.id,
            nodeId: node.id,
            start,
            end: text.length,
            position: node.position ?? (node.type === 'ruby' ? 'over' : 'under'),
            ...(node.color !== undefined ? { color: node.color } : {}),
            ...(node.type === 'ruby'
              ? { kind: 'ruby' as const, text: node.annotation }
              : { kind: 'emphasis' as const, mark: node.mark ?? 'dot' }),
          });
        } else {
          spans.splice(spanIndex, 0, {
            nodeId: node.id,
            kind: node.type,
            start,
            end: text.length,
            ...(node.type === 'link' ? { url: node.url } : {}),
            ...('color' in node && node.color !== undefined ? { color: node.color } : {}),
          });
        }
      }
    }
  }

  function paragraph(
    block: Extract<RichFlowBlock, { type: 'paragraph' | 'heading' | 'code' }>,
    context: Context,
  ): void {
    if (paragraphCount > 0) {
      append('\n', block.id, block.id, 'synthetic');
      const last = paragraphs[paragraphs.length - 1];
      if (last) paragraphs[paragraphs.length - 1] = { ...last, end: text.length };
    }
    paragraphCount += 1;
    const start = text.length;
    if (context.marker && !context.marker.consumed) {
      append(context.marker.text, context.marker.nodeId, block.id, 'synthetic');
      context.marker.consumed = true;
    }
    if (block.type === 'code') {
      append(block.text, block.id, block.id, 'text');
      if (text.length > start) {
        spans.push({ nodeId: block.id, kind: 'code', start, end: text.length });
      }
    } else {
      inline(block.children, block.id);
    }
    if (text.length === start) return;
    const headingScale = block.type === 'heading' ? [2, 1.65, 1.4, 1.2, 1.1, 1][block.level - 1] ?? 1 : 1;
    const kind = context.quoteDepth > 0
      ? 'quote'
      : context.listDepth > 0
        ? 'listItem'
        : block.type;
    paragraphs.push({
      nodeId: block.id,
      paragraphId: block.id,
      kind,
      start,
      end: text.length,
      ...(block.type === 'heading' ? { level: block.level } : {}),
      fontSize: fontSize * headingScale,
      lineHeight: lineHeight * headingScale,
      indent: (context.quoteDepth + context.listDepth) * indentSize,
      marginTop: block.type === 'heading' ? paragraphSpacing * 0.5 : 0,
      marginBottom: paragraphSpacing,
    });
    if (block.type === 'heading') {
      spans.push({ nodeId: block.id, kind: 'strong', start, end: text.length });
    }
  }

  function blocks(nodes: readonly RichFlowBlock[], context: Context, depth = 0): void {
    if (depth > 128) throw new RangeError('Document nesting exceeds the supported depth of 128.');
    for (const block of nodes) {
      register(block.id);
      if (block.type === 'quote') {
        blocks(block.blocks, { ...context, quoteDepth: context.quoteDepth + 1 }, depth + 1);
      } else if (block.type === 'list') {
        // A list nested before its parent's first paragraph must not steal its marker.
        if (context.marker && !context.marker.consumed) {
          paragraph({ id: context.marker.nodeId, type: 'paragraph', children: [] }, context);
        }
        const first = Number.isSafeInteger(block.start) ? block.start ?? 1 : 1;
        block.items.forEach((item, index) => {
          register(item.id);
          const itemContext: Context = {
            ...context,
            listDepth: context.listDepth + 1,
            marker: { text: block.ordered ? `${first + index}. ` : '• ', nodeId: item.id, consumed: false },
          };
          blocks(item.blocks, itemContext, depth + 1);
          if (!itemContext.marker?.consumed) {
            paragraph({ id: item.id, type: 'paragraph', children: [] }, itemContext);
          }
        });
      } else {
        paragraph(block, context);
      }
    }
  }

  blocks(document.blocks, { quoteDepth: 0, listDepth: 0 });
  if (sourceMap.some((range) => !isValidTextRange(text, range.start, range.end))) {
    throw new TypeError('Text nodes must not split a UTF-16 surrogate pair across node boundaries.');
  }
  const content = { id: document.id, text, spans, paragraphs, decorations, annotations, attachments, sourceMap };
  return { ...content, textVersion: options.textVersion ?? revision(JSON.stringify(content)) };
}
