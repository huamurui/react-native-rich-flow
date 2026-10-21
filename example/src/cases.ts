import {
  compileDocument,
  type RichFlowDocument,
  type RichTextFlow,
} from 'react-native-rich-flow';
import { BROKEN_IMAGE, ENERGY_FORMULA, LANDSCAPE } from './assets';
import { format, type Locale, translations } from './i18n';
import { createTypographyDocument, type TypographyPreset } from './typography';

export const CASE_IDS = ['selection', 'styles', 'decorations', 'attachments', 'updates', 'scroll', 'locales', 'markdown', 'html'] as const;
export type CaseId = (typeof CASE_IDS)[number];

export function getCases(locale: Locale) {
  return CASE_IDS.map((id) => ({ id, ...translations[locale].cases[id] }));
}

const text = (id: string, value: string) => ({ id, type: 'text' as const, text: value });
const heading = (id: string, value: string) => ({
  id,
  type: 'heading' as const,
  level: 2 as const,
  children: [text(`${id}-text`, value)],
});

function documentFor(id: Exclude<CaseId, 'markdown' | 'html'>, revision: number, dark: boolean, locale: Locale, preset: TypographyPreset): RichFlowDocument {
  const copy = translations[locale].body;
  switch (id) {
    case 'locales':
      return createTypographyDocument(preset, locale);
    case 'selection':
      return {
        id: 'selection-demo',
        blocks: [
          heading('selection-heading', copy.selectionHeading),
          { id: 'paragraph-one', type: 'paragraph', children: [text('first-text', copy.selectionOne)] },
          { id: 'paragraph-two', type: 'paragraph', children: [text('second-text', copy.selectionTwo)] },
          { id: 'paragraph-three', type: 'paragraph', children: [text('third-start', copy.selectionBeforeBold), { id: 'selection-bold', type: 'strong', children: [text('bold-text', copy.selectionBold)] }, text('third-middle', copy.selectionBeforeLink), { id: 'selection-link', type: 'link', url: 'https://github.com/huamurui/react-native-rich-flow', children: [text('link-text', copy.selectionLink)] }, text('third-end', copy.selectionAfterLink)] },
          { id: 'mixed-scripts', type: 'paragraph', children: [text('mixed-scripts-text', copy.multilingual)] },
          { id: 'paragraph-four', type: 'paragraph', children: [text('fourth-text', copy.selectionBoundary)] },
        ],
      };
    case 'styles':
      return {
        id: 'styles-demo',
        blocks: [
          { id: 'h1', type: 'heading', level: 1, children: [text('h1-text', copy.stylesHeading)] },
          heading('h2', copy.stylesSubheading),
          { id: 'style-body', type: 'paragraph', children: [
            { id: 'strong', type: 'strong', children: [text('strong-text', copy.boldAnd), { id: 'nested-emphasis', type: 'emphasis', children: [text('nested-text', copy.boldItalic)] }] },
            text('sep-1', copy.separator), { id: 'emphasis', type: 'emphasis', children: [text('emphasis-text', copy.italic)] },
            text('sep-2', copy.separator), { id: 'underline', type: 'underline', children: [text('underline-text', copy.underline)] },
            text('sep-3', copy.separator), { id: 'strikethrough', type: 'strikethrough', children: [text('strikethrough-text', copy.strike)] },
            text('sep-4', copy.separator), { id: 'highlight', type: 'highlight', color: dark ? '#4c5a36' : '#e4efb0', children: [text('highlight-text', copy.highlight)] },
            text('sep-5', copy.separator), { id: 'inline-code', type: 'code', children: [text('code-text', 'const flow = 1;')] }, text('sep-6', copy.sentenceEnd),
          ] },
          { id: 'scripts', type: 'paragraph', children: [text('sub-prefix', copy.subPrefix), { id: 'sub', type: 'subscript', children: [text('sub-text', '2')] }, text('super-prefix', copy.superPrefix), { id: 'super', type: 'superscript', children: [text('super-text', '2')] }, text('scripts-end', copy.scriptsEnd)] },
          { id: 'quote', type: 'quote', blocks: [
            { id: 'quote-p1', type: 'paragraph', children: [text('quote-t1', copy.quoteOne)] },
            { id: 'quote-p2', type: 'paragraph', children: [text('quote-t2', copy.quoteTwo)] },
          ] },
          { id: 'list', type: 'list', ordered: true, start: 3, items: [
            { id: 'item-one', blocks: [{ id: 'item-p1', type: 'paragraph', children: [text('item-t1', copy.listOne)] }] },
            { id: 'item-two', blocks: [{ id: 'item-p2', type: 'paragraph', children: [text('item-t2', copy.listTwo)] }, { id: 'nested-list', type: 'list', items: [{ id: 'nested-item', blocks: [{ id: 'nested-p', type: 'paragraph', children: [text('nested-t', copy.nestedList)] }] }] }] },
          ] },
          { id: 'code-block', type: 'code', language: 'ts', text: copy.codeBlock },
        ],
      };
    case 'decorations':
      return {
        id: 'decorations-demo',
        blocks: [
          heading('deco-heading', copy.decorationHeading),
          ...(['solid', 'dashed', 'dotted', 'wavy'] as const).map((kind, index) => ({
            id: `deco-p-${kind}`,
            type: 'paragraph' as const,
            children: [{
              id: `deco-${kind}`,
              type: 'decoration' as const,
              kind,
              color: ['#d37c38', '#4489b8', '#8a73bd', '#31927d'][index] ?? '#31927d',
              thickness: 1.5,
              offset: 3,
              actionId: `demo:${kind}`,
              children: [text(`deco-t-${kind}`, format(copy.decorationText, { label: copy[kind], kind }))],
            }],
          })),
          { id: 'cross-decoration-a', type: 'paragraph', children: [text('cross-decoration-text-a', copy.crossDecorationOne)] },
          { id: 'cross-decoration-b', type: 'paragraph', children: [text('cross-decoration-text-b', copy.crossDecorationTwo)] },
        ],
      };
    case 'attachments':
      return {
        id: 'attachments-demo',
        blocks: [
          heading('attachment-heading', copy.attachmentHeading),
          { id: 'image-p', type: 'paragraph', children: [text('image-before', copy.imageBefore), { id: 'landscape', type: 'image', url: LANDSCAPE, width: 72, height: 48, alt: copy.imageAlt, copyText: copy.imageCopy }, text('image-after', copy.imageAfter)] },
          { id: 'formula-p', type: 'paragraph', children: [text('formula-before', copy.formulaBefore), { id: 'energy', type: 'formula', url: ENERGY_FORMULA, latex: 'E = mc^2', width: 116, height: 28, copyText: 'E = mc^2' }, text('formula-after', copy.formulaAfter)] },
          { id: 'repeat-p', type: 'paragraph', children: [text('repeat-before', copy.repeatBefore), { id: 'landscape-again', type: 'image', url: LANDSCAPE, width: 48, height: 32, alt: copy.repeatAlt, copyText: copy.repeatCopy }, text('repeat-after', copy.repeatAfter)] },
          { id: 'broken-p', type: 'paragraph', children: [text('broken-before', copy.brokenBefore), { id: 'broken', type: 'image', url: BROKEN_IMAGE, width: 50, height: 30, alt: copy.brokenAlt, copyText: copy.brokenCopy }, text('broken-after', copy.brokenAfter)] },
          { id: 'latex-p', type: 'paragraph', children: [text('latex-before', copy.latexBefore), { id: 'latex-only', type: 'formula', latex: '\\int_0^1 x^2 dx', copyText: '∫₀¹ x² dx', width: 100, height: 28 }, text('latex-after', copy.latexAfter)] },
        ],
      };
    case 'updates':
      return {
        id: 'updates-demo',
        blocks: [
          heading('update-heading', format(copy.updateHeading, { version: revision + 1 })),
          { id: 'update-p1', type: 'paragraph', children: [text('update-t1', revision % 2 === 0 ? copy.updateOne : copy.updateTwo)] },
          { id: 'update-p2', type: 'paragraph', children: [text('update-t2', copy.updateDetail)] },
          ...Array.from({ length: revision % 3 }, (_, index) => ({ id: `update-extra-${index}`, type: 'paragraph' as const, children: [text(`extra-text-${index}`, copy.updateExtra)] })),
        ],
      };
    case 'scroll':
      return {
        id: 'scroll-demo',
        blocks: [
          heading('scroll-heading', copy.scrollHeading),
          ...Array.from({ length: 24 }, (_, index) => ({
            id: `scroll-p-${index}`,
            type: 'paragraph' as const,
            children: [
              text(`scroll-t-${index}`, format(copy.scrollParagraph, { number: index + 1 })),
              ...(index % 4 === 0 ? [{ id: `scroll-image-${index}`, type: 'image' as const, url: LANDSCAPE, width: 72, height: 48, alt: format(copy.scrollImageAlt, { number: index + 1 }), copyText: format(copy.scrollImageCopy, { number: index + 1 }) }] : []),
            ],
          })),
        ],
      };
  }
}

export function createCaseFlow(
  id: Exclude<CaseId, 'markdown' | 'html'>,
  revision: number,
  fontSize: number,
  dark: boolean,
  locale: Locale = 'en',
  preset: TypographyPreset = 'chinese',
): RichTextFlow {
  const flow = compileDocument(documentFor(id, revision, dark, locale, preset), {
    fontSize,
    lineHeight: Math.round(fontSize * 1.65),
    paragraphSpacing: 14,
  });
  if (id !== 'decorations') return flow;
  const first = flow.paragraphs.find((paragraph) => paragraph.nodeId === 'cross-decoration-a');
  const last = flow.paragraphs.find((paragraph) => paragraph.nodeId === 'cross-decoration-b');
  if (!first || !last) return flow;
  return {
    ...flow,
    decorations: [...flow.decorations, {
      id: 'cross-paragraph-decoration',
      nodeId: 'cross-decoration-a',
      actionId: 'demo:cross-paragraph',
      start: first.start,
      end: last.end,
      kind: 'wavy',
      color: '#4489b8',
      thickness: 1.5,
      offset: 3,
    }],
  };
}
