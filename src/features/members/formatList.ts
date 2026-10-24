/** "Ana, Luis y Eva" / "Ana, Luis, and Eva" in the given locale. */
export function formatList(locale: string, items: string[]): string {
  return new Intl.ListFormat(locale, { style: 'long', type: 'conjunction' }).format(items);
}
