import type { RichTextDecoration, RichTextSpan } from './model.js';

/** Semantic content, independent of Markdown, HTML, and native view instances. */
export interface RichFlowDocument {
  readonly id: string;
  readonly blocks: readonly RichFlowBlock[];
}

export interface RichFlowText {
  readonly id: string;
  readonly type: 'text';
  readonly text: string;
}

export interface RichFlowBreak {
  readonly id: string;
  readonly type: 'break';
}

export interface RichFlowStyle {
  readonly id: string;
  readonly type: Exclude<RichTextSpan['kind'], 'link'>;
  readonly children: readonly RichFlowInline[];
  /** In this alpha, only highlight uses this color; other style kinds ignore it. */
  readonly color?: string;
}

export interface RichFlowLink {
  readonly id: string;
  readonly type: 'link';
  readonly url: string;
  readonly children: readonly RichFlowInline[];
}

export interface RichFlowDecoration {
  readonly id: string;
  readonly type: 'decoration';
  readonly kind: RichTextDecoration['kind'];
  readonly children: readonly RichFlowInline[];
  readonly color?: string;
  readonly thickness?: number;
  readonly offset?: number;
  readonly actionId?: string;
}

/** Character emphasis marks; distinct from italic `emphasis`. Defaults to under/dot. */
export interface RichFlowTextEmphasis {
  readonly id: string;
  readonly type: 'textEmphasis';
  readonly children: readonly RichFlowInline[];
  readonly mark?: 'dot' | 'circle' | 'sesame';
  readonly position?: 'over' | 'under';
  readonly color?: string;
}

/** Horizontal reading annotation. Use one node per reading unit for exact alignment. */
export interface RichFlowRuby {
  readonly id: string;
  readonly type: 'ruby';
  readonly children: readonly RichFlowInline[];
  readonly annotation: string;
  readonly position?: 'over' | 'under';
  readonly color?: string;
}

interface AttachmentDimensions {
  readonly width?: number;
  readonly height?: number;
  readonly baselineOffset?: number;
  readonly alt?: string;
  readonly copyText?: string;
}

export interface RichFlowImage extends AttachmentDimensions {
  readonly id: string;
  readonly type: 'image';
  readonly url: string;
}

/** Supply a rendered image URL to display TeX; latex alone is semantic fallback. */
export interface RichFlowFormula extends AttachmentDimensions {
  readonly id: string;
  readonly type: 'formula';
  readonly latex: string;
  readonly url?: string;
}

export type RichFlowInline =
  | RichFlowText
  | RichFlowBreak
  | RichFlowStyle
  | RichFlowLink
  | RichFlowDecoration
  | RichFlowTextEmphasis
  | RichFlowRuby
  | RichFlowImage
  | RichFlowFormula;

export interface RichFlowParagraph {
  readonly id: string;
  readonly type: 'paragraph';
  readonly children: readonly RichFlowInline[];
}

export interface RichFlowHeading {
  readonly id: string;
  readonly type: 'heading';
  readonly level: 1 | 2 | 3 | 4 | 5 | 6;
  readonly children: readonly RichFlowInline[];
}

export interface RichFlowQuote {
  readonly id: string;
  readonly type: 'quote';
  readonly blocks: readonly RichFlowBlock[];
}

export interface RichFlowListItem {
  readonly id: string;
  readonly blocks: readonly RichFlowBlock[];
}

export interface RichFlowList {
  readonly id: string;
  readonly type: 'list';
  readonly ordered?: boolean;
  readonly start?: number;
  readonly items: readonly RichFlowListItem[];
}

export interface RichFlowCodeBlock {
  readonly id: string;
  readonly type: 'code';
  readonly text: string;
  readonly language?: string;
}

export type RichFlowBlock =
  | RichFlowParagraph
  | RichFlowHeading
  | RichFlowQuote
  | RichFlowList
  | RichFlowCodeBlock;

export interface CompileOptions {
  /** Logical React Native units; native views apply system font scaling. */
  readonly fontSize?: number;
  readonly lineHeight?: number;
  readonly paragraphSpacing?: number;
  readonly indentSize?: number;
  /** Optional caller-managed revision; otherwise derived from the compiled flow. */
  readonly textVersion?: string;
}
