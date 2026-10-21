/** A nonempty, half-open [start, end) range in UTF-16 code units. */
export interface RichTextRange {
  readonly start: number;
  readonly end: number;
}

export interface RichTextSpan extends RichTextRange {
  readonly kind:
    | 'strong'
    | 'emphasis'
    | 'underline'
    | 'strikethrough'
    | 'highlight'
    | 'subscript'
    | 'superscript'
    | 'code'
    | 'link';
  readonly nodeId: string;
  readonly url?: string;
  readonly color?: string;
}

export interface RichTextParagraph extends RichTextRange {
  readonly nodeId: string;
  readonly paragraphId?: string;
  readonly kind: 'paragraph' | 'heading' | 'quote' | 'listItem' | 'code';
  readonly level?: number;
  readonly fontSize?: number;
  readonly lineHeight?: number;
  readonly indent?: number;
  readonly marginTop?: number;
  readonly marginBottom?: number;
}

export interface RichTextDecoration extends RichTextRange {
  readonly id: string;
  readonly nodeId: string;
  readonly kind: 'solid' | 'dashed' | 'dotted' | 'wavy';
  readonly color?: string;
  readonly thickness?: number;
  readonly offset?: number;
  readonly actionId?: string;
}

/** Each attachment occupies exactly one U+FFFC character in the flow. */
export interface RichTextAttachment extends RichTextRange {
  readonly id: string;
  readonly nodeId: string;
  readonly kind: 'image' | 'formula';
  readonly url?: string;
  readonly latex?: string;
  readonly width?: number;
  readonly height?: number;
  readonly baselineOffset?: number;
  readonly alt?: string;
  readonly copyText: string;
}

/** Source offsets refer to semantic text, not raw Markdown or HTML syntax. */
export interface RichTextSourceRange extends RichTextRange {
  readonly nodeId: string;
  readonly paragraphId?: string;
  readonly sourceStart: number;
  readonly sourceEnd: number;
  readonly kind: 'text' | 'synthetic' | 'attachment';
}

/** One UTF-16 text buffer. This release models flows but does not render them. */
export interface RichTextFlow {
  readonly id: string;
  /** Supplied by the caller; change it when the flow's content changes. */
  readonly textVersion: string;
  readonly text: string;
  readonly spans: readonly RichTextSpan[];
  readonly paragraphs: readonly RichTextParagraph[];
  readonly decorations: readonly RichTextDecoration[];
  readonly attachments: readonly RichTextAttachment[];
  readonly sourceMap: readonly RichTextSourceRange[];
}

export interface RichTextSelectionEndpoint {
  readonly nodeId: string;
  readonly paragraphId?: string;
  readonly offset: number;
}

export interface RichTextSelectionMapping {
  readonly text: string;
  readonly start: RichTextSelectionEndpoint;
  readonly end: RichTextSelectionEndpoint;
}

/** The minimal input needed for semantic copying. */
export interface RichTextSelectionSource {
  readonly text: string;
  readonly attachments: readonly Pick<RichTextAttachment, 'start' | 'end' | 'copyText'>[];
}

export interface RichTextMappedSelectionSource extends RichTextSelectionSource {
  readonly sourceMap: readonly RichTextSourceRange[];
}
