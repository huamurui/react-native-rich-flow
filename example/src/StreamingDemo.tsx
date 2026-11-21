import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { PlainTextStream } from 'react-native-rich-flow/native';
import type { Locale } from './i18n';

const copy = {
  en: {
    start: 'Start', pause: 'Pause', resume: 'Resume', restart: 'Restart', done: 'Complete',
    hint: 'Start the stream, then hold the first sentence and choose Copy. Paste it below while the text keeps growing.',
    paste: 'Paste to check', count: 'characters', prefix: 'Copy this first sentence.',
    parts: [
      'The last train leaves at nine. There is still time to walk to the station and pick up the notebook I left at the café.',
      'The notebook has a blue cover. On the first page is a sketch of the river, and on the next is a list of birds we heard on the way home.',
      'Tomorrow I will take the same path again. If I get there early, I might catch the light on the water before the boats arrive. 🌅',
    ],
  },
  'zh-CN': {
    start: '开始', pause: '暂停', resume: '继续', restart: '重新开始', done: '已完成',
    hint: '点开始，再长按第一句，拖动选区并复制。文字继续生成时，可以在下面粘贴核对。',
    paste: '粘贴核对', count: '字', prefix: '选中这一句，在生成时复制。',
    parts: [
      '末班车九点出发。我们还有时间走到车站，顺路去咖啡店取回落下的笔记本。河边的路远一点，但沿途可以看见水面上的灯。',
      '笔记本是蓝色封面的。第一页画着一座旧桥，第二页记着回家路上听到的鸟鸣。翻到中间，还有一张压平了的车票。',
      '明天我想沿着同一条路再走一次。早一点出门，也许能在渡船靠岸以前，看见第一束落在水上的光。🌅',
    ],
  },
};

type Colors = { text: string; muted: string; surface: string; accent: string; accentText: string; secondary: string; border: string };
export function StreamingDemo({ locale, palette }: { locale: Locale; palette: Colors }) {
  const t = copy[locale];
  const [session, setSession] = useState(1);
  const [running, setRunning] = useState(false);
  const [shown, setShown] = useState(0);
  const [pasted, setPasted] = useState('');
  const [selected, setSelected] = useState('');
  const [tail] = useState(() => Array.from('\n\n' + t.parts.join('\n\n')));
  const finished = shown === tail.length;
  useEffect(() => {
    if (!running || finished) return;
    const timer = setInterval(() => setShown(n => Math.min(tail.length, n + 1)), locale === 'en' ? 95 : 240);
    return () => clearInterval(timer);
  }, [running, finished, tail, locale]);

  const restart = () => {
    setSession(n => n + 1);
    setShown(0);
    setPasted('');
    setSelected('');
    setRunning(true);
  };
  const button = (label: string, action: () => void, primary: boolean, testID: string) =>
    <Pressable testID={testID} accessibilityRole="button" onPress={action} onAccessibilityTap={action} style={[s.button, { backgroundColor: primary ? palette.accent : palette.secondary }]}>
      <Text style={{ color: primary ? palette.accentText : palette.text, fontWeight: '600' }}>{label}</Text>
    </Pressable>;
  return <ScrollView contentContainerStyle={s.content} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
    <Text style={[s.hint, { color: palette.muted }]}>{t.hint}</Text>
    <View style={s.row}>
      {!finished && button(running ? t.pause : shown === 0 ? t.start : t.resume, () => setRunning(!running), true, 'stream-start')}
      {button(t.restart, restart, finished, 'stream-restart')}
      <Text testID="stream-count" style={{ color: palette.muted }}>{finished ? t.done + ' · ' : ''}{Array.from(t.prefix).length + shown} {t.count}</Text>
    </View>
    <TextInput testID="stream-paste" accessibilityLabel={t.paste} value={pasted} onChangeText={setPasted}
      placeholder={t.paste} placeholderTextColor={palette.muted}
      style={[s.input, { color: palette.text, borderColor: palette.border, backgroundColor: palette.surface }]} />
    <View testID="stream-text" style={[s.paper, { backgroundColor: palette.surface, borderColor: palette.border }]}>
      <PlainTextStream documentId={locale + '-' + session} text={t.prefix + tail.slice(0, shown).join('')}
        config={{ fontSize: 18, lineHeight: 29, textColor: palette.text }} onSelectionChange={event => setSelected(event.text)} />
    </View>
    {selected.length > 0 && <Text testID="stream-selection" style={{ color: palette.muted }}>{'“' + selected + '”'}</Text>}
  </ScrollView>;
}
const s = StyleSheet.create({
  content: { paddingHorizontal: 18, paddingBottom: 60, gap: 12, width: '100%', maxWidth: 860, alignSelf: 'center' },
  hint: { fontSize: 14, lineHeight: 20 },
  row: { flexDirection: 'row', gap: 10, alignItems: 'center', flexWrap: 'wrap' },
  button: { paddingHorizontal: 15, paddingVertical: 11, borderRadius: 12 },
  paper: { padding: 16, borderRadius: 14, borderWidth: StyleSheet.hairlineWidth },
  input: { paddingHorizontal: 12, minHeight: 42, borderWidth: StyleSheet.hairlineWidth, borderRadius: 10 },
});
