import {
  type ComponentProps,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StatusBar,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  useColorScheme,
  View,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { compileDocument } from 'react-native-rich-flow';
import { parseHtml, parseMarkdown } from 'react-native-rich-flow/adapters';
import { isRichFlowAvailable, RichFlow } from 'react-native-rich-flow/native';
import { type CaseId, createCaseFlow, getCases } from './src/cases';
import { format, getInitialLocale, translations } from './src/i18n';
import { createInitialSources, INITIAL_SOURCES, updateSource } from './src/sources';
import { TYPOGRAPHY_CONFIG, TYPOGRAPHY_PRESETS, type TypographyPreset } from './src/typography';

type SelectionEvent = Parameters<NonNullable<ComponentProps<typeof RichFlow>['onSelectionChange']>>[0];
type ActionEvent = Parameters<NonNullable<ComponentProps<typeof RichFlow>['onAction']>>[0];
type Alignment = 'left' | 'center' | 'right' | 'start' | 'end';
type EventKind = 'selection' | ActionEvent['kind'];
type EventRecord = { id: number; kind: EventKind; detail: string };
type Palette = typeof LIGHT;

const LIGHT = {
  background: '#f3f5f0', surface: '#ffffff', secondary: '#edf2eb', text: '#1d302b',
  muted: '#5c6f66', accent: '#176b53', accentText: '#ffffff', border: '#dbe4da',
  warning: '#89561e', warningBackground: '#fff1da', link: '#236bba',
};
const DARK: Palette = {
  background: '#111b18', surface: '#1b2823', secondary: '#23352e', text: '#e7f0e9',
  muted: '#a2b8ab', accent: '#8bd8b5', accentText: '#102a1e', border: '#354b3e',
  warning: '#f3c987', warningBackground: '#3c3020', link: '#8bbdff',
};
const short = (value: string, length = 150) => value.length > length ? `${value.slice(0, length)}…` : value;

function Playground() {
  const systemScheme = useColorScheme();
  const [locale, setLocale] = useState(getInitialLocale);
  const t = translations[locale].ui;
  const cases = getCases(locale);
  const [dark, setDark] = useState(systemScheme === 'dark');
  const palette = dark ? DARK : LIGHT;
  const [caseId, setCaseId] = useState<CaseId>('selection');
  const [fontSize, setFontSize] = useState(17);
  const [alignment, setAlignment] = useState<Alignment>('left');
  const [localAlignment, setLocalAlignment] = useState<Alignment>('start');
  const [typographyPreset, setTypographyPreset] = useState<TypographyPreset>('chinese');
  const activeAlignment = caseId === 'locales' ? localAlignment : alignment;
  const canJustify = activeAlignment === 'left' || activeAlignment === 'start';
  const [justify, setJustify] = useState(false);
  const [selectable, setSelectable] = useState(true);
  const [revision, setRevision] = useState(0);
  const [mountId, setMountId] = useState(0);
  const [showModel, setShowModel] = useState(false);
  const [showEvents, setShowEvents] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const [drafts, setDrafts] = useState(createInitialSources);
  const [sources, setSources] = useState(createInitialSources);
  const [selection, setSelection] = useState<SelectionEvent | null>(null);
  const [action, setAction] = useState<ActionEvent | null>(null);
  const [events, setEvents] = useState<EventRecord[]>([]);
  const [measuredHeight, setMeasuredHeight] = useState<number | null>(null);
  const sequence = useRef(0);
  const scroll = useRef<ScrollView>(null);
  const nativeAvailable = isRichFlowAvailable();
  const activeCase = translations[locale].cases[caseId];
  const editorKind = caseId === 'markdown' || caseId === 'html' ? caseId : null;

  const compiled = useMemo(() => {
    try {
      const flow = caseId === 'markdown' || caseId === 'html'
        ? compileDocument(
          caseId === 'markdown' ? parseMarkdown(sources[locale].markdown, { id: 'markdown-demo' }) : parseHtml(sources[locale].html, { id: 'html-demo' }),
          { fontSize, lineHeight: Math.round(fontSize * 1.65), paragraphSpacing: 14 },
        )
        : createCaseFlow(caseId, revision, fontSize, dark, locale, typographyPreset);
      return { flow, error: null };
    } catch {
      return { flow: null, error: t.parseError };
    }
  }, [caseId, sources, revision, fontSize, dark, locale, t.parseError, typographyPreset]);

  const config = useMemo(() => ({
    fontSize,
    lineHeight: Math.round(fontSize * 1.65),
    paragraphSpacing: 14,
    textColor: palette.text,
    secondaryColor: palette.muted,
    linkColor: palette.link,
    justify,
    textAlign: activeAlignment,
    ...(caseId === 'locales' ? TYPOGRAPHY_CONFIG[typographyPreset] : {
      language: locale === 'en' ? 'en-US' : 'zh-CN', writingDirection: 'auto' as const, hyphenation: 'none' as const,
    }),
  }), [fontSize, palette, justify, activeAlignment, caseId, typographyPreset, locale]);

  const record = useCallback((kind: EventKind, detail: string) => {
    const event = { id: ++sequence.current, kind, detail };
    setEvents((previous) => [event, ...previous].slice(0, 6));
  }, []);

  const onSelectionChange = useCallback((event: SelectionEvent) => {
    setSelection(event);
    if (event.start >= 0) record('selection', `[${event.start}, ${event.end}) · ${short(event.text, 60)}`);
  }, [record]);

  const onAction = useCallback((event: ActionEvent) => {
    setAction(event);
    record(event.kind, `${event.id}${event.url ? ` · ${short(event.url, 70)}` : ''}`);
  }, [record]);

  useEffect(() => {
    setSelection(null);
    setAction(null);
    setMeasuredHeight(null);
  }, [compiled.flow?.id, compiled.flow?.textVersion, mountId]);

  useEffect(() => {
    scroll.current?.scrollTo({ y: 0, animated: false });
    setShowModel(false);
    setPasteText('');
  }, [caseId]);

  const eventLabels: Record<EventKind, string> = {
    selection: t.selection, link: t.linkAction, decoration: t.decorationAction,
    attachment: t.attachmentAction, attachmentLongPress: t.attachmentLongPressAction,
  };

  const switchLocale = () => {
    setLocale((previous) => previous === 'en' ? 'zh-CN' : 'en');
    setEvents([]);
    setSelection(null);
    setAction(null);
  };

  const clearEvents = () => {
    setEvents([]);
    setAction(null);
    setSelection(null);
  };

  const chip = (label: string, selected: boolean, onPress: () => void, accessibilityLabel = label) => (
    <Pressable
      key={label}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [styles.chip, { backgroundColor: selected ? palette.accent : palette.secondary, opacity: pressed ? 0.72 : 1 }]}
    >
      <Text style={[styles.chipText, { color: selected ? palette.accentText : palette.text }]}>{label}</Text>
    </Pressable>
  );

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: palette.background }]} edges={['top', 'bottom', 'left', 'right']}>
      <StatusBar barStyle={dark ? 'light-content' : 'dark-content'} />
      <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.header}>
          <View style={styles.headerTitle}>
            <Text style={[styles.eyebrow, { color: palette.accent }]}>REACT NATIVE · RICHFLOW</Text>
            <Text style={[styles.title, { color: palette.text }]}>{t.title}</Text>
          </View>
          <View style={styles.headerActions}>
            <Pressable accessibilityRole="button" accessibilityLabel={t.languageLabel} onPress={switchLocale} style={[styles.themeButton, { backgroundColor: palette.secondary }]}>
              <Text style={[styles.themeText, { color: palette.accent }]}>{t.languageTarget}</Text>
            </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel={dark ? t.switchLight : t.switchDark} onPress={() => setDark(!dark)} style={[styles.themeButton, { backgroundColor: palette.surface }]}>
            <Text style={[styles.themeText, { color: palette.text }]}>{dark ? t.light : t.dark}</Text>
          </Pressable>
          </View>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.caseList} style={styles.caseBar}>
          {cases.map((item) => chip(item.title, caseId === item.id, () => setCaseId(item.id)))}
        </ScrollView>

        <ScrollView ref={scroll} style={styles.main} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
          {!nativeAvailable && (
            <View accessibilityRole="alert" style={[styles.notice, { backgroundColor: palette.warningBackground }]}>
              <Text style={[styles.noticeTitle, { color: palette.warning }]}>{t.missingTitle}</Text>
              <Text style={[styles.body, { color: palette.warning }]}>{t.missingBody}</Text>
            </View>
          )}

          <View style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.border }]}>
            <View style={styles.sectionHeading}>
              <Text style={[styles.sectionTitle, { color: palette.text }]}>{t.controls}</Text>
              <Text style={[styles.badge, { color: nativeAvailable ? palette.accent : palette.warning }]}>{nativeAvailable ? `${Platform.OS} · ${t.nativeReady}` : t.nativeRequired}</Text>
            </View>
            <View style={styles.controlRow}>
              <Text style={[styles.controlLabel, { color: palette.muted }]}>{t.fontSize}</Text>
              <View style={styles.chips}>{[14, 17, 20, 24].map((size) => chip(String(size), fontSize === size, () => setFontSize(size), format(t.fontSizeLabel, { size })))}</View>
            </View>
            <View style={styles.controlRow}>
              <Text style={[styles.controlLabel, { color: palette.muted }]}>{t.alignment}</Text>
              <View style={styles.chips}>{(['left', 'center', 'right', 'start', 'end'] as const).map((value) => chip({ left: t.left, center: t.center, right: t.right, start: t.start, end: t.end }[value], activeAlignment === value, () => caseId === 'locales' ? setLocalAlignment(value) : setAlignment(value)))}</View>
            </View>
            <View style={styles.switchRow}>
              <Text style={[styles.body, { color: palette.text }]}>{t.selectable}</Text>
              <Switch accessibilityLabel={t.selectable} value={selectable} onValueChange={setSelectable} trackColor={{ true: palette.accent }} />
            </View>
            <View style={styles.switchRow}>
              <Text style={[styles.body, { color: palette.text }]}>{t.justify}{!canJustify ? t.justifyHint : ''}</Text>
              <Switch accessibilityLabel={t.justify} value={justify} onValueChange={setJustify} disabled={!canJustify} trackColor={{ true: palette.accent }} />
            </View>
          </View>

          <View style={styles.introduction}>
            <Text style={[styles.sectionTitle, { color: palette.text }]}>{activeCase.title}</Text>
            <Text style={[styles.body, { color: palette.muted }]}>{activeCase.hint}</Text>
          </View>

          {caseId === 'locales' && (
            <View style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.border }]}>
              <Text style={[styles.sectionTitle, { color: palette.text }]}>{translations[locale].typography.choose}</Text>
              <View style={styles.chips}>
                {TYPOGRAPHY_PRESETS.map((preset) => chip(translations[locale].typography[preset], typographyPreset === preset, () => {
                  setTypographyPreset(preset);
                  setLocalAlignment('start');
                }))}
              </View>
              <Text style={[styles.body, { color: palette.muted }]}>{translations[locale].typography[`${typographyPreset}Hint`]}</Text>
              {(['chinese', 'japanese', 'zhuyin'] as const).some((preset) => preset === typographyPreset) && (
                <>
                  <Text style={[styles.body, { color: palette.muted }]}>{translations[locale].typography.annotationCopy}</Text>
                  <Text style={[styles.body, { color: palette.muted }]}>{translations[locale].typography.annotationLimits}</Text>
                </>
              )}
            </View>
          )}

          {editorKind && (
            <View style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.border }]}>
              <Text style={[styles.label, { color: palette.muted }]}>{format(t.input, { format: editorKind === 'html' ? 'HTML' : 'Markdown' })}</Text>
              <Text style={[styles.body, { color: palette.muted }]}>{t.editorLanguageNote}</Text>
              <TextInput
                accessibilityLabel={format(t.sourceLabel, { format: editorKind === 'html' ? 'HTML' : 'Markdown' })}
                multiline
                autoCapitalize="none"
                autoCorrect={false}
                value={drafts[locale][editorKind]}
                onChangeText={(value) => setDrafts((previous) => updateSource(previous, locale, editorKind, value))}
                style={[styles.sourceInput, { color: palette.text, backgroundColor: palette.secondary }]}
              />
              <View style={styles.chips}>
                {chip(t.apply, true, () => setSources((previous) => updateSource(previous, locale, editorKind, drafts[locale][editorKind])))}
                {chip(t.restore, false, () => {
                  const source = INITIAL_SOURCES[locale][editorKind];
                  setDrafts((previous) => updateSource(previous, locale, editorKind, source));
                  setSources((previous) => updateSource(previous, locale, editorKind, source));
                })}
              </View>
            </View>
          )}

          {caseId === 'updates' && (
            <View style={styles.chips}>
              {chip(t.update, true, () => setRevision((value) => value + 1))}
              {chip(t.remount, false, () => setMountId((value) => value + 1))}
            </View>
          )}

          <View style={[styles.readingCard, { backgroundColor: palette.surface, borderColor: palette.border }]}>
            {compiled.error ? (
              <Text accessibilityRole="alert" style={[styles.body, { color: palette.warning }]}>{compiled.error}</Text>
            ) : compiled.flow ? (
              <>
                <View style={styles.flowMeta}>
                  <Text style={[styles.label, { color: palette.muted }]}>{format(t.flowMeta, { paragraphs: compiled.flow.paragraphs.length, length: compiled.flow.text.length, attachments: compiled.flow.attachments.length })}</Text>
                  <Text style={[styles.label, { color: palette.accent }]}>{t.oneFlow}</Text>
                </View>
                {nativeAvailable ? (
                  <RichFlow
                    key={mountId}
                    flow={compiled.flow}
                    config={config}
                    selectable={selectable}
                    onSelectionChange={onSelectionChange}
                    onAction={onAction}
                    onHeightChange={setMeasuredHeight}
                  />
                ) : (
                  <Text style={[styles.body, { color: palette.muted }]}>{t.notLoaded}</Text>
                )}
                <View style={[styles.readingFooter, { borderColor: palette.border }]}>
                  <Text style={[styles.label, { color: palette.muted }]}>{measuredHeight === null ? t.waitingMeasure : format(t.measuredHeight, { height: Math.round(measuredHeight) })}</Text>
                  <Pressable accessibilityRole="button" onPress={() => setShowModel(!showModel)}><Text style={[styles.link, { color: palette.accent }]}>{showModel ? t.hideModel : t.showModel}</Text></Pressable>
                </View>
              </>
            ) : null}
          </View>

          {showModel && compiled.flow && (
            <View style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.border }]}>
              <Text style={[styles.label, { color: palette.muted }]}>ID · {compiled.flow.id}</Text>
              <Text selectable style={[styles.mono, { color: palette.text }]}>textVersion: {compiled.flow.textVersion}</Text>
              <ScrollView style={styles.modelPanel} nestedScrollEnabled>
                <Text selectable style={[styles.mono, { color: palette.text }]}>{JSON.stringify({ text: compiled.flow.text, spans: compiled.flow.spans, paragraphs: compiled.flow.paragraphs, decorations: compiled.flow.decorations, annotations: compiled.flow.annotations, sourceMap: compiled.flow.sourceMap }, null, 2)}</Text>
              </ScrollView>
            </View>
          )}

          <View style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.border }]}>
            <View style={styles.sectionHeading}>
              <Text style={[styles.sectionTitle, { color: palette.text }]}>{t.pasteTitle}</Text>
              <Pressable accessibilityRole="button" onPress={() => setPasteText('')}><Text style={[styles.link, { color: palette.accent }]}>{t.clear}</Text></Pressable>
            </View>
            <TextInput accessibilityLabel={t.pasteLabel} multiline value={pasteText} onChangeText={setPasteText} placeholder={t.pasteHint} placeholderTextColor={palette.muted} style={[styles.pasteInput, { color: palette.text, backgroundColor: palette.secondary }]} />
          </View>
          <Text style={[styles.footnote, { color: palette.muted }]}>{t.limits}</Text>
        </ScrollView>

        <View style={[styles.eventPanel, { backgroundColor: palette.surface, borderColor: palette.border }]}>
          <Pressable accessibilityRole="button" accessibilityLabel={showEvents ? t.collapseEvents : t.expandEvents} onPress={() => setShowEvents(!showEvents)} style={styles.eventHeading}>
            <Text style={[styles.sectionTitle, { color: palette.text }]}>{t.events}</Text>
            <Text style={[styles.link, { color: palette.accent }]}>{showEvents ? t.collapse : t.expand}</Text>
          </Pressable>
          <Text numberOfLines={2} style={[styles.eventSummary, { color: palette.muted }]}>
            {selection && selection.start >= 0 ? `${t.selection} [${selection.start}, ${selection.end}) · ${short(selection.text, 70)}` : action ? `${eventLabels[action.kind]} · ${action.id}` : t.noEvents}
          </Text>
          {showEvents && (
            <ScrollView style={styles.eventDetails} nestedScrollEnabled keyboardShouldPersistTaps="handled">
              {selection && selection.start >= 0 && (
                <View style={styles.eventItem}>
                  <Text selectable style={[styles.mono, { color: palette.text }]}>{JSON.stringify({ range: [selection.start, selection.end], text: selection.text, textVersion: selection.textVersion, mapping: selection.mapping }, null, 2)}</Text>
                </View>
              )}
              {events.map((event) => <View key={event.id} style={[styles.eventItem, { borderColor: palette.border }]}><Text style={[styles.label, { color: palette.accent }]}>{eventLabels[event.kind]}</Text><Text selectable style={[styles.body, { color: palette.text }]}>{event.detail}</Text></View>)}
              <Pressable accessibilityRole="button" onPress={clearEvents} style={styles.clearEvents}><Text style={[styles.link, { color: palette.accent }]}>{t.clearEvents}</Text></Pressable>
            </ScrollView>
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

export default function App() {
  return <SafeAreaProvider><Playground /></SafeAreaProvider>;
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12, flexDirection: 'row', alignItems: 'center', gap: 12 },
  headerTitle: { flex: 1 },
  eyebrow: { fontSize: 10, letterSpacing: 1.7, fontWeight: '700', marginBottom: 6 },
  title: { fontSize: 27, fontWeight: '700', letterSpacing: -0.6 },
  headerActions: { flexDirection: 'row', gap: 6, alignItems: 'center' },
  themeButton: { borderRadius: 14, paddingHorizontal: 10, paddingVertical: 11 },
  themeText: { fontSize: 13, fontWeight: '600' },
  caseBar: { flexGrow: 0 },
  caseList: { gap: 8, paddingHorizontal: 20, paddingBottom: 14 },
  main: { flex: 1 },
  content: { padding: 16, paddingTop: 2, gap: 16, width: '100%', maxWidth: 860, alignSelf: 'center' },
  card: { borderRadius: 18, padding: 16, borderWidth: StyleSheet.hairlineWidth, gap: 12 },
  sectionHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 },
  sectionTitle: { fontSize: 16, fontWeight: '700' },
  badge: { fontSize: 11, fontWeight: '600' },
  controlRow: { flexDirection: 'row', alignItems: 'center', gap: 14, flexWrap: 'wrap' },
  controlLabel: { fontSize: 13, minWidth: 28 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { minHeight: 38, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 13, justifyContent: 'center' },
  chipText: { fontSize: 13, fontWeight: '600' },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  body: { fontSize: 13, lineHeight: 21, flexShrink: 1 },
  introduction: { gap: 6, paddingHorizontal: 3 },
  label: { fontSize: 11, lineHeight: 17, fontWeight: '600' },
  sourceInput: { minHeight: 160, maxHeight: 260, padding: 12, borderRadius: 12, textAlignVertical: 'top', fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', fontSize: 12, lineHeight: 19 },
  readingCard: { borderRadius: 18, padding: 18, borderWidth: StyleSheet.hairlineWidth, gap: 16 },
  flowMeta: { flexDirection: 'row', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 },
  readingFooter: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 12, flexDirection: 'row', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 },
  link: { fontSize: 12, fontWeight: '600', paddingVertical: 5 },
  mono: { fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', fontSize: 11, lineHeight: 17 },
  modelPanel: { maxHeight: 240 },
  pasteInput: { minHeight: 88, maxHeight: 160, padding: 12, borderRadius: 12, textAlignVertical: 'top', fontSize: 13, lineHeight: 21 },
  footnote: { fontSize: 11, lineHeight: 18, textAlign: 'center', paddingBottom: 8 },
  notice: { borderRadius: 14, padding: 16, gap: 7 },
  noticeTitle: { fontSize: 14, fontWeight: '700' },
  eventPanel: { borderTopWidth: StyleSheet.hairlineWidth, paddingHorizontal: 20, paddingTop: 10, paddingBottom: 10 },
  eventHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  eventSummary: { fontSize: 12, lineHeight: 19, paddingTop: 2 },
  eventDetails: { maxHeight: 180, marginTop: 8 },
  eventItem: { paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth, gap: 4 },
  clearEvents: { alignSelf: 'flex-start', paddingVertical: 5 },
});
