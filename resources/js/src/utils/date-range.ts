export type QuickRange = 'today' | '7d' | '30d' | '90d';

export function formatDateInput(value: Date): string {
  const date = new Date(value.getTime() - value.getTimezoneOffset() * 60000);
  return date.toISOString().slice(0, 10);
}

export function quickDateRange(range: QuickRange, today = new Date()): { from: string; to: string } {
  const days = { today: 1, '7d': 7, '30d': 30, '90d': 90 }[range];
  const start = new Date(today);
  start.setDate(start.getDate() - days + 1);
  return { from: formatDateInput(start), to: formatDateInput(today) };
}
