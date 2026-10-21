import { requireNativeViewManager, requireOptionalNativeModule } from 'expo-modules-core';
import { type ComponentType, type ReactNode, useEffect, useMemo, useRef, useState } from 'react';
import { Platform, Text, View, type LayoutChangeEvent, type ViewProps } from 'react-native';
import type { RichTextFlow } from '../model.js';
import {
  createLayoutKey, readActionEvent, readHeightEvent, readSelectionEvent, serializeNativeFlow,
  type RichFlowActionEvent, type RichFlowSelectionEvent,
} from './events.js';

export interface RichFlowConfig {
  readonly fontSize?: number;
  /** Minimum line height; a taller attachment can expand the line. */
  readonly lineHeight?: number;
  readonly paragraphSpacing?: number;
  readonly textColor?: string;
  readonly secondaryColor?: string;
  readonly linkColor?: string;
  readonly justify?: boolean;
  readonly textAlign?: 'left' | 'center' | 'right' | 'start' | 'end';
  /** BCP 47 language tag passed to system text layout. */
  readonly language?: string;
  readonly writingDirection?: 'auto' | 'ltr' | 'rtl';
  readonly hyphenation?: 'none' | 'normal' | 'full';
}

export interface RichFlowProps extends ViewProps {
  readonly flow: RichTextFlow;
  readonly config?: RichFlowConfig;
  readonly selectable?: boolean;
  readonly suppressDoubleTapSelection?: boolean;
  readonly onSelectionChange?: (event: RichFlowSelectionEvent) => void;
  readonly onAction?: (event: RichFlowActionEvent) => void;
  readonly onHeightChange?: (height: number) => void;
  /** Shown when the custom native view is unavailable, including Expo Go. */
  readonly fallback?: ReactNode;
}

interface NativeProps extends ViewProps {
  flowJson: string;
  configJson: string;
  contentWidth: number;
  layoutKey: string;
  selectable: boolean;
  suppressDoubleTapSelection: boolean;
  onSelectionChange: (event: unknown) => void;
  onAction: (event: unknown) => void;
  onHeightChange: (event: unknown) => void;
}

let nativeView: ComponentType<NativeProps> | null | undefined;

function getNativeView(): ComponentType<NativeProps> | null {
  if (Platform.OS !== 'ios' && Platform.OS !== 'android') return null;
  if (nativeView !== undefined) return nativeView;
  try {
    nativeView = requireOptionalNativeModule('RichFlow')
      ? requireNativeViewManager<NativeProps>('RichFlow') : null;
  } catch {
    nativeView = null;
  }
  return nativeView;
}

export function isRichFlowAvailable(): boolean {
  return getNativeView() !== null;
}

const positive = (value: number | undefined, fallback: number) =>
  typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : fallback;

/** One native text view with continuous selection and self-measured content height. */
export function RichFlow({
  flow, config = {}, selectable = true, suppressDoubleTapSelection = false,
  onSelectionChange, onAction, onHeightChange, fallback, ...viewProps
}: RichFlowProps) {
  const NativeView = getNativeView();
  const [width, setWidth] = useState(0);
  const [measurement, setMeasurement] = useState<{ key: string; height: number } | null>(null);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);
  const flowJson = useMemo(() => serializeNativeFlow(flow), [flow]);
  const fontSize = positive(config.fontSize, 17);
  const lineHeight = positive(config.lineHeight, fontSize * 1.55);
  const paragraphSpacing = typeof config.paragraphSpacing === 'number' &&
    Number.isFinite(config.paragraphSpacing) && config.paragraphSpacing >= 0 ? config.paragraphSpacing : 12;
  const configJson = JSON.stringify({
    ...config, fontSize, lineHeight, paragraphSpacing,
    textColor: config.textColor ?? '#18212f', secondaryColor: config.secondaryColor ?? '#64748b',
    linkColor: config.linkColor ?? '#176bd1',
  });
  const layoutKey = useMemo(() => createLayoutKey(flowJson, configJson, width), [flowJson, configJson, width]);
  const current = useRef({ flow, layoutKey, selectable });
  current.current = { flow, layoutKey, selectable };
  const estimatedHeight = flow.text.length === 0 ? 0 : Math.max(lineHeight,
    Math.ceil(flow.text.length / Math.max(1, width / fontSize)) * lineHeight +
    flow.paragraphs.length * paragraphSpacing);
  const height = measurement?.key === layoutKey ? measurement.height : estimatedHeight;

  const onContentLayout = (event: LayoutChangeEvent) => {
    const next = event.nativeEvent.layout.width;
    if (Number.isFinite(next) && next >= 0) setWidth((previous) => previous === next ? previous : next);
  };

  return (
    <View {...viewProps}>
      <View onLayout={onContentLayout} style={{ alignSelf: 'stretch' }}>
        {NativeView ? (width > 0 && <NativeView
          flowJson={flowJson} configJson={configJson} contentWidth={width} layoutKey={layoutKey}
          selectable={selectable} suppressDoubleTapSelection={suppressDoubleTapSelection}
          style={{ width, height }}
          onHeightChange={(raw) => {
            if (!mounted.current || current.current.layoutKey !== layoutKey) return;
            const next = readHeightEvent(raw, current.current.flow, layoutKey);
            if (next === null) return;
            setMeasurement((previous) => previous?.key === layoutKey && previous.height === next
              ? previous : { key: layoutKey, height: next });
            onHeightChange?.(next);
          }}
          onSelectionChange={(raw) => {
            if (!mounted.current) return;
            const event = readSelectionEvent(raw, current.current.flow);
            if (event && (current.current.selectable || event.start === -1)) onSelectionChange?.(event);
          }}
          onAction={(raw) => {
            if (!mounted.current) return;
            const event = readActionEvent(raw, current.current.flow);
            if (event) onAction?.(event);
          }}
        />) : fallback ?? <Text style={{ color: config.textColor ?? '#18212f', fontSize }}>
          RichFlow requires an Android or iOS development build with the native module installed.
        </Text>}
      </View>
    </View>
  );
}
