import type { RichFlowDocument, RichFlowInline } from 'react-native-rich-flow';
import type { RichFlowConfig } from 'react-native-rich-flow/native';
import { type Locale, translations } from './i18n';

export const TYPOGRAPHY_PRESETS = ['chinese', 'japanese', 'zhuyin', 'korean', 'arabic', 'french', 'english'] as const;
export type TypographyPreset = (typeof TYPOGRAPHY_PRESETS)[number];

export const TYPOGRAPHY_CONFIG = {
  chinese: { language: 'zh-CN', writingDirection: 'ltr', hyphenation: 'none' },
  japanese: { language: 'ja-JP', writingDirection: 'ltr', hyphenation: 'none' },
  zhuyin: { language: 'zh-Hant-TW', writingDirection: 'ltr', hyphenation: 'none' },
  korean: { language: 'ko-KR', writingDirection: 'ltr', hyphenation: 'none' },
  arabic: { language: 'ar', writingDirection: 'rtl', hyphenation: 'none' },
  french: { language: 'fr-FR', writingDirection: 'ltr', hyphenation: 'normal' },
  english: { language: 'en-US', writingDirection: 'ltr', hyphenation: 'full' },
} as const satisfies Record<TypographyPreset, Pick<RichFlowConfig, 'language' | 'writingDirection' | 'hyphenation'>>;

const text = (id: string, value: string): RichFlowInline => ({ id, type: 'text', text: value });
const ruby = (id: string, base: string, annotation: string): RichFlowInline => ({ id, type: 'ruby', children: [text(`${id}-base`, base)], annotation, position: 'over' });

/** Linguistic samples stay in the chosen writing system; explanatory UI is localized. */
export function createTypographyDocument(preset: TypographyPreset, locale: Locale): RichFlowDocument {
  const copy = translations[locale].typography;
  const heading = { id: 'local-heading', type: 'heading' as const, level: 2 as const, children: [text('local-heading-text', copy[preset])] };
  const paragraph = (id: string, children: readonly RichFlowInline[]) => ({ id, type: 'paragraph' as const, children });
  const id = `typography-${preset}`;
  switch (preset) {
    case 'chinese':
      return { id, blocks: [
        heading,
        paragraph('chinese-dot-p', [text('chinese-before', '读书时，请留意'), { id: 'chinese-dots', type: 'textEmphasis', mark: 'dot', position: 'under', children: [text('chinese-dots-text', '这几个重要的字')] }, text('chinese-after', '。下方着重号不改变正文与选区偏移。')]),
        paragraph('chinese-pinyin-p', [ruby('pinyin-han', '汉', 'Hàn'), ruby('pinyin-zi', '字', 'zì'), ruby('pinyin-zhu', '注', 'zhù'), ruby('pinyin-yin', '音', 'yīn'), text('pinyin-end', '，按字指定读音；复制时只保留汉字正文。')]),
        paragraph('chinese-shapes-p', [{ id: 'chinese-circles', type: 'textEmphasis', mark: 'circle', position: 'under', children: [text('chinese-circle-text', '空心圆标记')] }, text('shapes-separator', '，'), { id: 'chinese-sesame', type: 'textEmphasis', mark: 'sesame', position: 'under', children: [text('chinese-sesame-text', '芝麻点标记')] }, text('shapes-end', '。')]),
      ] };
    case 'japanese':
      return { id, blocks: [
        heading,
        paragraph('japanese-ruby-p', [ruby('ja-kan', '漢', 'かん'), ruby('ja-ji', '字', 'じ'), text('ja-reading', 'を読む練習です。'), ruby('ja-ni', '日', 'に'), ruby('ja-hon', '本', 'ほん'), ruby('ja-go', '語', 'ご'), text('ja-reading-end', 'の読み方を文字ごとに指定します。')]),
        paragraph('japanese-emphasis-p', [text('ja-before', '文章の中の'), { id: 'ja-sesame', type: 'textEmphasis', mark: 'sesame', position: 'over', children: [text('ja-emphasis-text', '大切な言葉')] }, text('ja-after', 'を傍点で示します。これは横書きの例です。')]),
      ] };
    case 'zhuyin':
      return { id, blocks: [
        heading,
        paragraph('zhuyin-ruby-p', [ruby('bopo-zhu', '注', 'ㄓㄨˋ'), ruby('bopo-yin', '音', 'ㄧㄣ'), ruby('bopo-shi', '示', 'ㄕˋ'), ruby('bopo-li', '例', 'ㄌㄧˋ')]),
        paragraph('zhuyin-note-p', [text('bopo-note', '此處把注音符號橫向放在漢字上方，不是傳統直排的字旁注音。')]),
      ] };
    case 'korean':
      return { id, blocks: [
        heading,
        paragraph('korean-one', [text('ko-text-one', '한국어 문장을 자연스럽게 읽을 수 있도록 시스템의 줄바꿈 규칙을 사용합니다. 글자 크기를 바꾸고 문단 사이로 선택 영역을 이동해 보세요.')]),
        paragraph('korean-two', [text('ko-text-two', '여러 단어와 숫자 2026, English 표현이 섞여 있어도 하나의 텍스트 흐름을 유지합니다. 줄이 바뀌는 위치는 운영체제와 글꼴에 따라 달라질 수 있습니다.')]),
      ] };
    case 'arabic':
      return { id, blocks: [
        heading,
        paragraph('arabic-one', [text('ar-text-one', 'هذه فقرة عربية تُقرأ من اليمين إلى اليسار. جرّب تحديد النص بين الفقرات، ثم غيّر المحاذاة بين بداية السطر ونهايته.')]),
        paragraph('arabic-mixed', [text('ar-text-mixed', 'نص مختلط: React Native 0.83، ثم الأرقام 1234 و١٢٣٤. يظل نطاق التحديد مبنيًا على ترتيب النص المنطقي باستخدام UTF-16.')]),
        paragraph('arabic-link', [text('ar-link-prefix', 'رابط داخل النص: '), { id: 'ar-link', type: 'link', url: 'https://github.com/huamurui/react-native-rich-flow', children: [text('ar-link-text', 'RichFlow على GitHub')] }, text('ar-link-suffix', '، مع استمرار التحديد في الفقرة نفسها.')]),
      ] };
    case 'french':
      return { id, blocks: [
        heading,
        paragraph('french-one', [text('fr-text-one', '«\u00a0Bonjour\u202f!\u00a0» Voici une phrase avec des espaces insécables explicites\u00a0: le prix est de 10\u00a0€, et la distance de 1\u202f234,56\u00a0km.')]),
        paragraph('french-two', [text('fr-text-two', 'Est-ce lisible\u202f? Oui\u202f; ces caractères restent présents lors de la copie. Le moteur conserve le texte fourni sans ajouter automatiquement d’espaces typographiques.')]),
      ] };
    case 'english':
      return { id, blocks: [
        heading,
        paragraph('english-one', [text('en-text-one', 'Internationalization, characterization and interoperability are deliberately long words. This example requests full system hyphenation with an English language hint. Change the font size to change the available line width.')]),
        paragraph('english-two', [text('en-text-two', 'Hyphenation opportunities depend on the operating system, font and available width. Selecting across these paragraphs still uses one continuous text buffer and preserves the original spelling when copied.')]),
      ] };
  }
}
