import type { ReactNode } from "react";
import { Info } from "lucide-react";
import { useSession } from "../../lib/session";

export type Format = "text" | "number" | "money" | "percent" | "days" | "years";
export type Kpi = { key: string; label: string; value: number | null; previous?: number | null; format: Format; note?: string; definition: string };
export type Column = { key: string; label: string; format: Format };
export type Chart = { key: string; title: string; subtitle: string; kind: "bar" | "hbar" | "line"; format: Format; data: { label: string; value: number }[] };
export type Report = {
  name: string; title: string; range: { key: string; label: string; compare: string; start: string; end: string };
  restricted: boolean; kpis: Kpi[]; charts: Chart[];
  table: { columns: Column[]; rows: Record<string, string | number | null>[]; total: Record<string, string | number | null> | null };
  definitions: Record<string, string>; notes: string[]; filters?: { owner: string | null; owners: { id: string; name: string }[] };
};

export const RANGES = [
  { value: "3m", label: "Last 3 months" },
  { value: "month", label: "This month" },
  { value: "quarter", label: "This quarter" },
  { value: "year", label: "This year" },
];

export const REPORT_TABS = [
  { key: "", label: "Overview" },
  { key: "sales", label: "Sales" },
  { key: "people", label: "People" },
  { key: "hiring", label: "Hiring" },
  { key: "work", label: "Work" },
];

export function useFormat() {
  const { money } = useSession();
  return (v: number | string | null | undefined, f: Format, compact = false): string => {
    if (v === null || v === undefined || v === "") return "—";
    if (typeof v === "string") return v;
    switch (f) {
      case "money": return money(v, compact);
      case "percent": return `${Math.round(v)}%`;
      case "days": return `${Math.round(v)}`;
      case "years": return `${v.toFixed(1)} yrs`;
      case "number": return v.toLocaleString("en-GB");
      default: return String(v);
    }
  };
}

/** "+22% on the 3 months before", "+4 points", "down from 24" — honest comparisons only when there's something to compare. */
export function useChangeNote() {
  const fmt = useFormat();
  return (k: Pick<Kpi, "value" | "previous" | "format" | "key">, compare: string): { text: string; good: boolean } | null => {
    const { value: v, previous: p } = k;
    if (v === null || p === null || p === undefined) return null;
    const lowerIsBetter = k.key === "daysToHire" || k.key === "overdue" || k.key === "leavers";
    if (k.format === "percent") {
      const d = Math.round(v - p);
      if (d === 0) return { text: `Same as ${compare}`, good: true };
      return { text: `${d > 0 ? "up" : "down"} from ${Math.round(p)}%`, good: d > 0 };
    }
    if (k.format === "days") {
      if (Math.round(v) === Math.round(p)) return { text: `Same as ${compare}`, good: true };
      return { text: `${v < p ? "down" : "up"} from ${Math.round(p)}`, good: lowerIsBetter ? v < p : v > p };
    }
    if (p === 0) return v > 0 ? { text: `None in ${compare}`, good: !lowerIsBetter } : null;
    if (k.format === "money" && k.key === "averageDeal") {
      const d = v - p;
      return { text: `${d >= 0 ? "+" : "−"}${fmt(Math.abs(d), "money", true)}`, good: d >= 0 };
    }
    const pct = Math.round(((v - p) / p) * 100);
    return { text: `${pct >= 0 ? "+" : ""}${pct}% on ${compare}`, good: lowerIsBetter ? pct <= 0 : pct >= 0 };
  };
}

export function InfoTip({ text, label }: { text: string; label: string }) {
  return (
    <span className="ins-tip">
      <button type="button" aria-label={`How ${label.toLowerCase()} is calculated`}><Info size={14} /></button>
      <span role="tooltip">{text}</span>
    </span>
  );
}

export function KpiCard({ label, value, note, good, definition }: { label: string; value: ReactNode; note?: ReactNode; good?: boolean; definition: string }) {
  return (
    <div className="stat ins-kpi">
      <div className="between"><small>{label}</small><InfoTip text={definition} label={label} /></div>
      <b>{value}</b>
      {note && <em className={good ? "up" : good === false ? "down" : undefined}>{note}</em>}
    </div>
  );
}
