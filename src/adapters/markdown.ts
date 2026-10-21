import { Marked } from 'marked';
import type { RichFlowDocument } from '../document.js';
import { parseHtml } from './html.js';
import type { ParseOptions } from './options.js';

// An isolated parser avoids changing applications' global Marked extensions.
const parser = new Marked({ async: false, gfm: true });

/** CommonMark/GFM semantics projected into the same document model as HTML. */
export function parseMarkdown(markdown: string, options: ParseOptions = {}): RichFlowDocument {
  const html = parser.parse(markdown, { async: false });
  return parseHtml(html, { ...options, id: options.id ?? 'markdown' });
}
