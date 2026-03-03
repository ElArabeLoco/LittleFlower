export function getCurrentMonth(): string {
  return new Date().toISOString().slice(0, 7);
}

export function prevMonth(m: string): string {
  const [y, mo] = m.split('-').map(Number);
  if (mo === 1) return `${y - 1}-12`;
  return `${y}-${String(mo - 1).padStart(2, '0')}`;
}

export function nextMonth(m: string): string {
  const [y, mo] = m.split('-').map(Number);
  if (mo === 12) return `${y + 1}-01`;
  return `${y}-${String(mo + 1).padStart(2, '0')}`;
}

export function computeSalaryTotal(baseSalary: number, deductions: number, extraDays: number): number {
  const extraDaysAmount = Math.round(extraDays * baseSalary * 12 / 260);
  return baseSalary - deductions + extraDaysAmount;
}
