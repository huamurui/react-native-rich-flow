/** Offline projection of a single Responses API output_text item for the playground. */
export interface ReplayBatch { delayMs: number; chunks: readonly Uint8Array[] }

// Each entry is an arrival. Nested entries deliver several SSE events together.
const answer: Record<'en' | 'zh-CN', readonly (string | readonly string[])[]> = {
  en: [
    'Group bird sightings by their local date.',
    '\n\n**', 'Count each', [' visit', ' once'], '**, even if', ' the same bird', ' appears twice. ',
    'If your notebook', [' already has', ' one row'], ' per visit, ', 'Python can group', ' them by day.',
    '\n\n``', '`python\n', 'from collections ', 'import Counter', '\n\n',
    'dates = [', '"2026-05-01", ', '"2026-05-01", ', '"2026-05-03"]', '\n',
    'visits = ', 'Counter(dates)', ['\n', 'for day'], ' in sorted', '(visits):\n',
    '    print(', 'day, ', 'visits[day])', '\n```',
    '\n\nThe result is ', '**two visits', ' on May 1', '** and one', ' on May 3. ',
    'May 2 is absent', ' because no visit', ' was recorded; ', 'it says nothing', ' about how many birds', ' were there. 🐦',
    '\n\n- Keep the original', ' observations', ' for later checks.',
    '\n- If your records', [' use timestamps, ', 'convert them'], ' to local time', ' before extracting', ' the date.',
  ],
  'zh-CN': [
    '按观测地的日期给观鸟记录分组。',
    '\n\n**', '每次到访', ['只计', '一次'], '**，即使', '同一只鸟', '来回飞过。',
    '如果笔记里', ['每一行', '代表一次到访'], '，就可以', '用 Python', '按天统计。',
    '\n\n``', '`python\n', 'from collections ', 'import Counter', '\n\n',
    'dates = [', '"2026-05-01", ', '"2026-05-01", ', '"2026-05-03"]', '\n',
    'visits = ', 'Counter(dates)', ['\n', 'for day'], ' in sorted', '(visits):\n',
    '    print(', 'day, ', 'visits[day])', '\n```',
    '\n\n输出是', '**5 月 1 日', '两次', '**，5 月 3 日', '一次。',
    '5 月 2 日', '没有出现在结果里，', '说明当天', '没有到访记录，', '无法据此推断', '那天有多少只鸟。🐦',
    '\n\n- 留下逐条的', '原始记录，', '方便回头核对。',
    '\n- 如果记录里', ['是带时区的', '时间戳，'], '先换成', '当地时间，', '再取日期。',
  ],
};

/** Delays belong to byte arrivals. A single arrival may contain several text deltas. */
export function responseReplayBatches(locale: keyof typeof answer): ReplayBatch[] {
  const encoder = new TextEncoder();
  const item = { item_id: 'msg_demo', output_index: 0, content_index: 0, logprobs: [] };
  let sequence = 0;
  function event(type: string, fields: Record<string, unknown>): string {
    const data = JSON.stringify({ type, sequence_number: ++sequence, ...fields });
    return `event: ${type}\r\ndata: ${data}\r\n\r\n`;
  }
  const groups = answer[locale].map(arrival => typeof arrival === 'string' ? [arrival] : arrival);
  const wires = groups.map(deltas => deltas.map(delta => event('response.output_text.delta', { ...item, delta })).join(''));
  // Include just the response fields consumed here. This fixture omits the other
  // lifecycle events and response metadata that a live model can emit.
  wires.push(event('response.output_text.done', { ...item, text: groups.flat().join('') }) +
    event('response.completed', { response: { id: 'resp_demo', object: 'response', status: 'completed' } }));
  const delays = [95, 560, 85, 140, 70, 125, 470, 60, 150, 80, 110, 120];
  // Break event names across arrivals, CRLF across byte chunks, and a multibyte
  // character across chunks when present. Complete adjacent events can coalesce.
  return wires.map((wire, index) => {
    const begin = index ? 7 : 0;
    const nextPrefix = wires[index + 1]?.slice(0, 7) ?? '';
    const bytes = encoder.encode(wire.slice(begin) + nextPrefix);
    const cr = bytes.indexOf(13) + 1;
    const multibyte = bytes.findIndex(byte => byte >= 0xc0);
    const chunks = [bytes.subarray(0, cr)];
    if (multibyte > cr) chunks.push(bytes.subarray(cr, multibyte + 1), bytes.subarray(multibyte + 1));
    else chunks.push(bytes.subarray(cr));
    return { delayMs: delays[index % delays.length]!, chunks };
  });
}

export interface ServerEvent { event: string; data: string }

/** The UTF-8, event and data fields of the WHATWG event stream format. */
export function createEventReader() {
  const decoder = new TextDecoder();
  let line = '', name = '', afterCR = false;
  let data: string[] = [];
  function read(text: string): ServerEvent[] {
    const events: ServerEvent[] = [];
    for (const char of text) {
      if (afterCR) {
        afterCR = false;
        if (char === '\n') continue;
      }
      if (char !== '\r' && char !== '\n') { line += char; continue; }
      afterCR = char === '\r';
      if (line === '') {
        if (data.length) events.push({ event: name || 'message', data: data.join('\n') });
        data = [];
        name = '';
      } else {
        const colon = line.indexOf(':');
        const field = colon < 0 ? line : line.slice(0, colon);
        const value = colon < 0 ? '' : line.slice(colon + 1).replace(/^ /, '');
        if (field === 'data') data.push(value);
        if (field === 'event') name = value;
      }
      line = '';
    }
    return events;
  }
  return {
    push(bytes: Uint8Array) { return read(decoder.decode(bytes, { stream: true })); },
    finish() {
      const events = read(decoder.decode());
      // Without a terminating blank line, the final event is incomplete.
      data = []; name = ''; line = ''; afterCR = false;
      return events;
    },
  };
}
