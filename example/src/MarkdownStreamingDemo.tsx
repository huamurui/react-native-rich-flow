import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { RichFlow } from 'react-native-rich-flow/native';
import type { Locale } from './i18n';
import { createMarkdownReplay } from './markdownReplay';

const copy = {
  en: {
    prompt: 'My birding notebook has one row per visit. How can I count visits per day in Python?',
    hint: 'Select the opening sentence. Copy it while the code is still arriving, then paste to check.',
    start: 'Start', pause: 'Pause', resume: 'Resume', restart: 'Restart', done: 'Complete',
    paste: 'Paste to check', deltas: 'events', missing: 'Open a native build to try system selection.',
  },
  'zh-CN': {
    prompt: '我的观鸟笔记每行记一次到访，怎么用 Python 统计每天去了几次？',
    hint: '长按选中开头一句，等代码块开始排版时复制，再粘贴核对。',
    start: '开始', pause: '暂停', resume: '继续', restart: '重新开始', done: '已完成',
    paste: '粘贴核对', deltas: '个事件', missing: '请在原生构建中体验系统选区。',
  },
};

const metrics = { fontSize: 17, lineHeight: 25, paragraphSpacing: 9 };
type Colors = { text: string; muted: string; link: string; accent: string; accentText: string; surface: string; secondary: string; border: string };

export function MarkdownStreamingDemo({ locale, palette }: { locale: Locale; palette: Colors }) {
  const t = copy[locale];
  const session = useRef(1);
  const [replay, setReplay] = useState(() => createMarkdownReplay(locale, 'markdown-' + locale + '-1', metrics));
  const [frame, setFrame] = useState(replay.initial);
  const [running, setRunning] = useState(false);
  const [pasted, setPasted] = useState('');

  useEffect(() => {
    if (!running) return;
    function deliver() {
      const next = replay.next();
      setFrame(next);
      if (next.complete) setRunning(false);
      else timer = setTimeout(deliver, replay.delayMs);
    }
    let timer = setTimeout(deliver, replay.delayMs);
    return () => clearTimeout(timer);
  }, [replay, running]);

  function restart() {
    const next = createMarkdownReplay(locale, 'markdown-' + locale + '-' + ++session.current, metrics);
    setReplay(next);
    setFrame(next.initial);
    setPasted('');
    setRunning(true);
  }

  function button(label: string, action: () => void, primary: boolean, testID: string) {
    return <Pressable testID={testID} accessibilityRole="button" accessibilityLabel={label}
      onPress={action} onAccessibilityTap={action}
      style={[s.button, { backgroundColor: primary ? palette.accent : palette.secondary }]}>
      <Text style={{ color: primary ? palette.accentText : palette.text, fontWeight: '600' }}>{label}</Text>
    </Pressable>;
  }

  return <ScrollView contentContainerStyle={s.content} keyboardDismissMode="on-drag" keyboardShouldPersistTaps="handled">
    <Text style={[s.prompt, { color: palette.text }]}>{t.prompt}</Text>
    <Text style={[s.hint, { color: palette.muted }]}>{t.hint}</Text>
    <View style={s.row}>
      {!frame.complete && button(running ? t.pause : frame === replay.initial ? t.start : t.resume,
        () => setRunning(previous => !previous), true, 'md-stream-start')}
      {button(t.restart, restart, frame.complete, 'md-stream-restart')}
      <Text testID="md-stream-status" style={{ color: palette.muted }}>{frame.complete ? t.done + ' · ' : ''}{frame.eventCount} {t.deltas}</Text>
    </View>
    <TextInput testID="md-stream-paste" accessibilityLabel={t.paste} value={pasted} onChangeText={setPasted}
      placeholder={t.paste} placeholderTextColor={palette.muted}
      style={[s.input, { color: palette.text, backgroundColor: palette.surface, borderColor: palette.border }]} />
    <View testID="md-stream-paper" style={[s.paper, { backgroundColor: palette.surface, borderColor: palette.border }]}>
      <RichFlow flow={frame.flow} preserveSelectionOnUpdate
        config={{ ...metrics, language: locale, textColor: palette.text, secondaryColor: palette.muted, linkColor: palette.link }}
        fallback={<Text style={{ color: palette.muted }}>{t.missing}</Text>} />
    </View>
  </ScrollView>;
}

const s = StyleSheet.create({
  content: { paddingHorizontal: 18, paddingBottom: 48, gap: 10, width: '100%', maxWidth: 860, alignSelf: 'center' },
  prompt: { fontSize: 17, lineHeight: 23, fontWeight: '600' },
  hint: { fontSize: 14, lineHeight: 19 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, alignItems: 'center' },
  button: { paddingHorizontal: 15, paddingVertical: 11, borderRadius: 12 },
  input: { minHeight: 42, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 12, borderRadius: 10 },
  paper: { padding: 14, borderWidth: StyleSheet.hairlineWidth, borderRadius: 14 },
});
