/** Markup adapters accept web links, mail/tel links, and data-image attachments. */
export function markupUrl(
  input: string | undefined,
  image: boolean,
  baseUrl?: string,
): string | undefined {
  if (!input) return undefined;
  const value = input.trim();
  if (!value || /[\u0000-\u0020\u007f]/.test(value)) return undefined;
  if (image && /^data:image\/(?:png|jpeg|gif|webp|svg\+xml)(?:;charset=utf-8)?(?:;base64)?,/i.test(value)) {
    return value;
  }
  try {
    const base = baseUrl ? new URL(baseUrl) : undefined;
    if (base && base.protocol !== 'https:' && base.protocol !== 'http:') return undefined;
    const parsed = base ? new URL(value, base) : new URL(value);
    if (parsed.username || parsed.password) return undefined;
    if (parsed.protocol === 'https:' || parsed.protocol === 'http:') return parsed.href;
    if (!image && (parsed.protocol === 'mailto:' || parsed.protocol === 'tel:')) return parsed.href;
  } catch {
    // A bad source URL only disables that link/resource, never the surrounding text.
  }
  return undefined;
}
