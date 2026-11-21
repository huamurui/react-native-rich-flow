import { compileDocument, type CompileOptions, type RichTextFlow } from 'react-native-rich-flow';
import { parseMarkdown } from 'react-native-rich-flow/adapters';
import type { Locale } from './i18n';
import { createEventReader, responseReplayBatches } from './responseReplay';

export interface MarkdownReplayFrame {
  readonly markdown: string;
  readonly flow: RichTextFlow;
  readonly complete: boolean;
  readonly eventCount: number;
}

/** A timer-free replay; the caller controls pause, resume and component unmount. */
export function createMarkdownReplay(locale: Locale, documentId: string, options: CompileOptions = {}) {
  const batches = responseReplayBatches(locale);
  const reader = createEventReader();
  let index = 0;
  let frame: MarkdownReplayFrame;
  function next(): MarkdownReplayFrame {
    const batch = batches[index++];
    if (!batch) return frame;
    const events = batch.chunks.flatMap(chunk => reader.push(chunk));
    if (index === batches.length) events.push(...reader.finish());
    let markdown = frame?.markdown ?? '';
    let complete = false;
    for (const event of events) {
      const body: unknown = JSON.parse(event.data);
      if (!body || typeof body !== 'object' || !('type' in body) || body.type !== event.event) continue;
      if (body.type === 'response.completed') {
        complete = true;
      } else if ('output_index' in body && body.output_index === 0 && 'content_index' in body && body.content_index === 0) {
        if (body.type === 'response.output_text.delta' && 'delta' in body && typeof body.delta === 'string') markdown += body.delta;
        if (body.type === 'response.output_text.done' && 'text' in body && typeof body.text === 'string') markdown = body.text;
      }
    }
    // Later Markdown can close a fence or change an earlier block. Compile the
    // accumulated document once per delivery batch, independently of SSE framing.
    const flow = frame && markdown === frame.markdown ? frame.flow
      : compileDocument(parseMarkdown(markdown, { id: documentId }), options);
    frame = { markdown, flow, complete, eventCount: (frame?.eventCount ?? 0) + events.length };
    return frame;
  }
  return { initial: next(), next, get delayMs() { return batches[index]?.delayMs ?? 0; } };
}
