/** Date helpers for People & HR. Dates are "YYYY-MM-DD" strings in the server's local calendar. */
export const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export function localDate(d: Date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function addDays(day: string, n: number): string {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function weekday(day: string): number {
  return new Date(`${day}T00:00:00Z`).getUTCDay();
}

export function eachDay(from: string, to: string, max = 400): string[] {
  const out: string[] = [];
  for (let d = from; d <= to && out.length < max; d = addDays(d, 1)) out.push(d);
  return out;
}

export type Holiday = { day: string; recurring: boolean };

export function isHoliday(day: string, holidays: Holiday[]): boolean {
  return holidays.some((h) => (h.recurring ? h.day.slice(5) === day.slice(5) : h.day === day));
}

/** Working days between two dates (inclusive): Monday to Friday, minus public holidays. */
export function workingDays(from: string, to: string, holidays: Holiday[]): number {
  return eachDay(from, to).filter((d) => {
    const w = weekday(d);
    return w !== 0 && w !== 6 && !isHoliday(d, holidays);
  }).length;
}

/** Monday of the week containing `day`. */
export function mondayOf(day: string): string {
  const w = weekday(day);
  return addDays(day, w === 0 ? -6 : 1 - w);
}

export function fmtDay(day: string): string {
  return new Date(`${day}T00:00:00Z`).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
}

export function minutesOfDay(d: Date): number {
  return d.getHours() * 60 + d.getMinutes();
}

export function parseHm(hm: string | undefined | null, fallback = "09:00"): number {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hm ?? fallback) ?? /^(\d{1,2}):(\d{2})$/.exec(fallback)!;
  return Number(m[1]) * 60 + Number(m[2]);
}
