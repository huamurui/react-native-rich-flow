import type {
  RichTextMappedSelectionSource,
  RichTextSelectionEndpoint,
  RichTextSelectionMapping,
  RichTextSelectionSource,
  RichTextSourceRange,
} from './model.js';

function splitsSurrogate(text: string, offset: number): boolean {
  const previous = text.charCodeAt(offset - 1);
  const current = text.charCodeAt(offset);
  return previous >= 0xd800 && previous <= 0xdbff && current >= 0xdc00 && current <= 0xdfff;
}

/** Validate a nonempty UTF-16 range without splitting a surrogate pair. */
export function isValidTextRange(text: string, start: number, end: number): boolean {
  return (
    typeof text === 'string' &&
    Number.isSafeInteger(start) &&
    Number.isSafeInteger(end) &&
    start >= 0 &&
    end > start &&
    end <= text.length &&
    !splitsSurrogate(text, start) &&
    !splitsSurrogate(text, end)
  );
}

/** Copy a selection, replacing genuine U+FFFC slots with their semantic text. */
export function getRichTextSelectionText(
  flow: RichTextSelectionSource,
  start: number,
  end: number,
): string {
  if (!isValidTextRange(flow.text, start, end)) return '';
  const slots = flow.attachments
    .filter((slot) =>
      isValidTextRange(flow.text, slot.start, slot.end) &&
      slot.end - slot.start === 1 &&
      flow.text[slot.start] === '\ufffc' &&
      typeof slot.copyText === 'string' &&
      slot.start >= start &&
      slot.end <= end,
    )
    .sort((left, right) => left.start - right.start);
  let result = '';
  let cursor = start;
  for (const slot of slots) {
    if (slot.start < cursor) continue;
    result += flow.text.slice(cursor, slot.start) + slot.copyText;
    cursor = slot.end;
  }
  return result + flow.text.slice(cursor, end);
}

function validSourceMap(flow: RichTextMappedSelectionSource): boolean {
  let previousEnd = 0;
  for (const range of flow.sourceMap) {
    if (
      !isValidTextRange(flow.text, range.start, range.end) ||
      range.start < previousEnd ||
      typeof range.nodeId !== 'string' ||
      !range.nodeId ||
      (range.paragraphId !== undefined && typeof range.paragraphId !== 'string') ||
      !Number.isSafeInteger(range.sourceStart) ||
      !Number.isSafeInteger(range.sourceEnd) ||
      range.sourceStart < 0 ||
      range.sourceEnd < range.sourceStart
    ) return false;
    const flowLength = range.end - range.start;
    const sourceLength = range.sourceEnd - range.sourceStart;
    switch (range.kind) {
      case 'text':
        if (flowLength !== sourceLength) return false;
        break;
      case 'synthetic':
        if (sourceLength !== 0) return false;
        break;
      case 'attachment':
        if (flowLength !== 1 || flow.text[range.start] !== '\ufffc') return false;
        break;
      default:
        return false;
    }
    previousEnd = range.end;
  }
  return true;
}

function endpoint(
  range: RichTextSourceRange,
  position: number,
  ending: boolean,
): RichTextSelectionEndpoint {
  const offset = range.kind === 'attachment'
    ? (ending ? range.sourceEnd : range.sourceStart)
    : range.sourceStart + Math.min(Math.max(position - range.start, 0), range.end - range.start);
  return {
    nodeId: range.nodeId,
    ...(range.paragraphId !== undefined ? { paragraphId: range.paragraphId } : {}),
    offset,
  };
}

/** Map a selection to semantic source endpoints; invalid inputs return null. */
export function mapRichTextSelection(
  flow: RichTextMappedSelectionSource,
  start: number,
  end: number,
): RichTextSelectionMapping | null {
  if (!isValidTextRange(flow.text, start, end) || !validSourceMap(flow)) return null;
  const source = flow.sourceMap.filter((range) =>
    range.kind !== 'synthetic' && range.start < end && range.end > start,
  );
  const first = source[0];
  const last = source[source.length - 1];
  if (!first || !last) return null;
  return {
    text: getRichTextSelectionText(flow, start, end),
    start: endpoint(first, start, false),
    end: endpoint(last, end, true),
  };
}
