/** First letter of a name, uppercased ('?' when there is none). */
export function memberInitial(name: string): string {
  const [first] = Array.from(name.trim());
  return first ? first.toLocaleUpperCase() : '?';
}
