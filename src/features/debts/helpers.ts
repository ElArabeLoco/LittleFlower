export function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export function formatDate(d: string, monthLabels: Record<string, string>): string {
  const [, m, day] = d.split('-');
  const mm = m.padStart(2, '0');
  return `${parseInt(day)} ${monthLabels[mm] ?? m}`;
}
