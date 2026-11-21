import { requireNativeViewManager, requireOptionalNativeModule } from 'expo-modules-core';
import { type ComponentType, type ReactNode, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Platform, Text, View, type ViewProps } from 'react-native';
import { isValidTextRange } from '../selection.js';
import type { RichFlowConfig } from './RichFlow.js';

interface Identity { documentId: string; version: number }
interface NativeSelection extends Identity { start: number; end: number }
export interface PlainTextStreamSelection extends NativeSelection { text: string }
export interface PlainTextStreamProps extends ViewProps {
  /** Stable for the life of the message. Changing it starts a new selection context. */
  documentId: string;
  /** The complete plain text received so far. Updates in one frame are coalesced. */
  text: string;
  config?: Pick<RichFlowConfig, 'fontSize' | 'lineHeight' | 'textColor'>;
  selectable?: boolean;
  fallback?: ReactNode;
  onSelectionChange?: (event: PlainTextStreamSelection) => void;
}

interface NativeProps {
  updateJson: string; configJson: string; contentWidth: number; selectable: boolean;
  style: { width: number; height: number };
  onHeightChange: (e: { nativeEvent: Identity & { height: number; contentWidth: number } }) => void;
  onResync: (e: { nativeEvent: Identity }) => void;
  onSelectionChange: (e: { nativeEvent: NativeSelection }) => void;
}
interface Frame extends Identity { source: string; text: string; configJson: string; isAppend: boolean; update: string }

function snapshot({ documentId, version, text }: Identity & { text: string }): string {
  return JSON.stringify({ kind: 'snapshot', documentId, version, text });
}

function advance(previous: Frame | null, documentId: string, input: string, configJson: string): Frame {
  if (!documentId) throw new TypeError('A stream needs a nonempty documentId.');
  // Hold the last high surrogate across frames. Repair other isolated halves
  // before JSON serialization (Swift strings cannot represent them).
  const end = input.charCodeAt(input.length - 1);
  const source = end >= 0xd800 && end <= 0xdbff ? input.slice(0, -1) : input;
  if (previous?.documentId === documentId && previous.source === source && previous.configJson === configJson) return previous;
  const version = (previous?.version ?? 0) + 1;
  const appending = previous?.documentId === documentId && source.startsWith(previous.source);
  const raw = appending ? source.slice(previous.source.length) : source;
  const delta = raw.replace(/[\ud800-\udbff][\udc00-\udfff]|[\ud800-\udfff]/g, part => part.length === 2 ? part : '\ufffd');
  const text = appending ? previous.text + delta : delta;
  const update = appending
    ? JSON.stringify({ kind: 'append', documentId, version, baseVersion: previous.version, text: delta })
    : snapshot({ documentId, version, text });
  return { documentId, version, source, text, configJson, isAppend: appending, update };
}

function loadView() {
  try {
    if ((Platform.OS === 'ios' || Platform.OS === 'android') && requireOptionalNativeModule('RichFlowStream')) {
      return requireNativeViewManager<NativeProps>('RichFlowStream') as ComponentType<NativeProps>;
    }
  } catch { /* The host may have an older native build. */ }
  return null;
}

function metric(value: number | undefined, maximum: number, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? Math.min(maximum, Math.max(8, value)) : fallback;
}

// Newly mounted native views have no base revision, including after a
// temporary zero-width layout. An unmounted view's queued events are obsolete.
function NativeSession({ Native, frame, onHeightChange, onSelectionChange, onResync, ...props }: Omit<NativeProps, 'updateJson' | 'configJson'> & {
  Native: ComponentType<NativeProps>; frame: Frame;
}) {
  const firstVersion = useRef(frame.version).current;
  const mounted = useRef(true);
  useLayoutEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);
  const updateJson = useMemo(() => frame.isAppend && frame.version === firstVersion ? snapshot(frame) : frame.update, [frame, firstVersion]);
  return <Native {...props} updateJson={updateJson} configJson={frame.configJson}
    onHeightChange={e => { if (mounted.current) onHeightChange(e); }}
    onSelectionChange={e => { if (mounted.current) onSelectionChange(e); }}
    onResync={e => { if (mounted.current) onResync(e); }} />;
}

/** A single selectable native text buffer for a growing plain-text message. */
export function PlainTextStream({ documentId, text, config, selectable = true, fallback, onSelectionChange, ...props }: PlainTextStreamProps) {
  const Native = useMemo(loadView, []);
  const fontSize = metric(config?.fontSize, 64, 17);
  const lineHeight = metric(config?.lineHeight, 120, fontSize * 1.55);
  const configJson = JSON.stringify({ fontSize, lineHeight, textColor: config?.textColor ?? '#18212f' });
  const [frame, setFrame] = useState(() => advance(null, documentId, text, configJson));
  const [width, setWidth] = useState(0);
  const [measured, setMeasured] = useState<{ documentId: string; height: number } | null>(null);
  const latest = useRef({ documentId, text, configJson });
  const pending = useRef<number | null>(null);
  const current = useRef({ frame, width, selectable, onSelectionChange });
  useLayoutEffect(() => { current.current = { frame, width, selectable, onSelectionChange }; });
  useLayoutEffect(() => {
    latest.current = { documentId, text, configJson };
    if (frame.documentId !== documentId || frame.configJson !== configJson) {
      setFrame(old => advance(old, documentId, text, configJson));
    } else if (text !== frame.source && pending.current === null) {
      pending.current = requestAnimationFrame(() => {
        pending.current = null;
        const input = latest.current;
        setFrame(old => advance(old, input.documentId, input.text, input.configJson));
      });
    }
  }, [documentId, text, configJson, frame.documentId, frame.source, frame.configJson]);
  useLayoutEffect(() => () => {
    if (pending.current !== null) cancelAnimationFrame(pending.current);
    pending.current = null;
  }, []);

  const height = frame.text.length === 0 ? 0 : measured?.documentId === frame.documentId && measured.height > 0 ? measured.height : lineHeight;
  return <View {...props}>
    <View onLayout={e => {
      const next = e.nativeEvent.layout.width;
      if (Number.isFinite(next) && next >= 0) setWidth(next);
    }} style={{ alignSelf: 'stretch' }}>
      {Native ? width > 0 && <NativeSession
        Native={Native} frame={frame} contentWidth={width} selectable={selectable}
        style={{ width, height }}
        onResync={({ nativeEvent }) => setFrame(old => {
          if (nativeEvent.documentId !== old.documentId || nativeEvent.version !== old.version) return old;
          return old.isAppend ? { ...old, isAppend: false, update: snapshot(old) } : old;
        })}
        onHeightChange={({ nativeEvent: event }) => {
          const active = current.current;
          if (event.documentId !== active.frame.documentId || event.version !== active.frame.version ||
            event.contentWidth !== active.width || !Number.isFinite(event.height) ||
            (active.frame.text.length ? event.height <= 0 : event.height !== 0)) return;
          setMeasured(old => old?.documentId === event.documentId && old.height === event.height ? old : { documentId: event.documentId, height: event.height });
        }}
        onSelectionChange={({ nativeEvent: event }) => {
          const active = current.current;
          if (event.documentId !== active.frame.documentId || event.version !== active.frame.version) return;
          const cleared = event.start === -1 && event.end === -1;
          if (!cleared && (!active.selectable || !isValidTextRange(active.frame.text, event.start, event.end))) return;
          active.onSelectionChange?.({ ...event, text: cleared ? '' : active.frame.text.slice(event.start, event.end) });
        }}
      /> : fallback ?? <Text>PlainTextStream requires a native build containing RichFlowStream.</Text>}
    </View>
  </View>;
}
