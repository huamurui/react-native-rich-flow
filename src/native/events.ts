import type { RichTextFlow, RichTextSelectionMapping } from '../model.js';
import { getRichTextSelectionText, isValidTextRange, mapRichTextSelection } from '../selection.js';

export interface RichFlowIdentity {
  readonly flowId: string;
  readonly textVersion: string;
}

export interface RichFlowSelectionEvent extends RichFlowIdentity {
  /** A cleared selection uses -1 for both endpoints. */
  readonly start: number;
  readonly end: number;
  readonly text: string;
  readonly mapping: RichTextSelectionMapping | null;
}

export interface RichFlowActionEvent extends RichFlowIdentity {
  readonly kind: 'link' | 'decoration' | 'attachment' | 'attachmentLongPress';
  readonly id: string;
  readonly start: number;
  readonly end: number;
  readonly url?: string;
}

function payload(input: unknown): Record<string, unknown> | null {
  if (!input || typeof input !== 'object') return null;
  if ('nativeEvent' in input) {
    return input.nativeEvent && typeof input.nativeEvent === 'object'
      ? input.nativeEvent as Record<string, unknown> : null;
  }
  return input as Record<string, unknown>;
}

function matches(event: Record<string, unknown>, flow: RichTextFlow): boolean {
  return event.flowId === flow.id && event.textVersion === flow.textVersion;
}

/** Reject events from a previous document before exposing offsets to callers. */
export function readSelectionEvent(input: unknown, flow: RichTextFlow): RichFlowSelectionEvent | null {
  const event = payload(input);
  if (!event || !matches(event, flow)) return null;
  const identity = { flowId: flow.id, textVersion: flow.textVersion };
  if (event.start === -1 && event.end === -1) {
    return { ...identity, start: -1, end: -1, text: '', mapping: null };
  }
  if (typeof event.start !== 'number' || typeof event.end !== 'number' ||
      !isValidTextRange(flow.text, event.start, event.end)) return null;
  return {
    ...identity, start: event.start, end: event.end,
    text: getRichTextSelectionText(flow, event.start, event.end),
    mapping: mapRichTextSelection(flow, event.start, event.end),
  };
}

/** Action events must refer to a currently present span, decoration or attachment. */
export function readActionEvent(input: unknown, flow: RichTextFlow): RichFlowActionEvent | null {
  const event = payload(input);
  if (!event || !matches(event, flow) || typeof event.id !== 'string' ||
      typeof event.start !== 'number' || typeof event.end !== 'number' ||
      !isValidTextRange(flow.text, event.start, event.end)) return null;
  const sameRange = (item: { start: number; end: number }) =>
    item.start === event.start && item.end === event.end;
  let url: string | undefined;
  switch (event.kind) {
    case 'link': {
      const span = flow.spans.find((item) => item.kind === 'link' && item.nodeId === event.id && sameRange(item));
      if (!span) return null;
      url = span.url;
      break;
    }
    case 'decoration':
      if (!flow.decorations.some((item) => item.actionId === event.id && sameRange(item))) return null;
      break;
    case 'attachment':
    case 'attachmentLongPress': {
      const attachment = flow.attachments.find((item) => item.id === event.id && sameRange(item));
      if (!attachment) return null;
      url = attachment.url;
      break;
    }
    default: return null;
  }
  return {
    flowId: flow.id, textVersion: flow.textVersion, kind: event.kind,
    id: event.id, start: event.start, end: event.end,
    ...(url === undefined ? {} : { url }),
  };
}

export function readHeightEvent(input: unknown, flow: RichTextFlow, layoutKey: string): number | null {
  const event = payload(input);
  return event && matches(event, flow) && event.layoutKey === layoutKey &&
    typeof event.height === 'number' && Number.isFinite(event.height) &&
    (event.height > 0 || (event.height === 0 && flow.text.length === 0))
    ? event.height : null;
}

export function serializeNativeFlow(flow: RichTextFlow): string {
  const { sourceMap: _sourceMap, ...native } = flow;
  return JSON.stringify(native);
}

/** A compact identity for the native asynchronous measurement transaction. */
export function createLayoutKey(flowJson: string, configJson: string, width: number): string {
  const value = `${width}:${configJson}:${flowJson}`;
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) hash = Math.imul(hash ^ value.charCodeAt(i), 16777619);
  return `${width}:${value.length}:${(hash >>> 0).toString(36)}`;
}
