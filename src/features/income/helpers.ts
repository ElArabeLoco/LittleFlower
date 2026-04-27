export { getCurrentMonth, prevMonth, nextMonth } from '@/shared/helpers';

export function computeSalaryTotal(baseSalary: number, deductions: number, extraDays: number): number {
  const extraDaysAmount = Math.round(extraDays * baseSalary * 12 / 260);
  return baseSalary - deductions + extraDaysAmount;
}
