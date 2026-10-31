import { useQuery } from "@tanstack/react-query";
import { Info, Lock } from "lucide-react";
import { Avatar, BarChart, EmptyState, HBarChart, LineChart, Loading, Notice } from "@windveal/ui";
import { ApiError, api, qs } from "../../lib/api";
import { KpiCard, useChangeNote, useFormat, type Chart, type Report } from "./shared";

export function useReport(name: string, range: string, owner: string) {
  return useQuery({
    queryKey: ["insights", "report", name, range, owner],
    queryFn: () => api.get<Report>(`/api/insights/reports/${name}${qs({ range, owner: name === "sales" ? owner : undefined })}`),
    placeholderData: (p) => p,
  });
}

function ChartView({ c }: { c: Chart }) {
  const fmt = useFormat();
  const big = c.format === "money" && c.data.some((d) => d.value >= 1_000_000);
  const f = (v: number) => (big ? (v / 1_000_000).toFixed(1) : fmt(v, c.format, true));
  if (c.kind === "hbar") return <HBarChart data={c.data.slice(0, 10)} format={f} />;
  if (c.kind === "line") return <LineChart data={c.data} />;
  return <BarChart data={c.data} format={f} />;
}

export function ReportPage({ name, range, owner, setOwner }: { name: string; range: string; owner: string; setOwner: (o: string) => void }) {
  const q = useReport(name, range, owner);
  const fmt = useFormat();
  const change = useChangeNote();
  if (q.isLoading) return <Loading />;
  if (!q.data) return <Notice tone="error">{q.error instanceof ApiError ? q.error.message : "We couldn't load this report. Please try again."}</Notice>;
  const r = q.data;
  if (r.restricted) {
    return <EmptyState icon={<Lock size={22} />} title="You don't have access to these records">Ask an admin for access to the workspace behind this report.</EmptyState>;
  }
  const defs = Object.values(r.definitions);
  const nameCol = r.table.columns[0]!;
  return (
    <>
      {r.filters && (
        <div className="toolbar">
          <select className="chip-select select" aria-label="Owner" value={owner} onChange={(e) => setOwner(e.target.value)}>
            <option value="everyone">Owner: Everyone</option>
            {r.filters.owners.map((o) => <option key={o.id} value={o.id}>Owner: {o.name}</option>)}
          </select>
          <span className="chip-select ins-static">Compare to: {r.range.compare.replace(/^the /, "").replace(/^./, (c) => c.toUpperCase())}</span>
        </div>
      )}
      <div className="stats ins-stats">
        {r.kpis.map((k) => {
          const c = change(k, r.range.compare);
          return <KpiCard key={k.key} label={k.label} definition={k.definition} value={fmt(k.value, k.format, k.format === "money")} note={k.note ?? c?.text} good={k.note ? undefined : c?.good} />;
        })}
      </div>
      {r.notes.length > 0 && <Notice tone="info" icon={<Info size={17} />}>{r.notes.join(" ")}</Notice>}
      <div className={r.charts.length > 1 ? "grid-2 ins-grid" : "ins-grid"}>
        {r.charts.map((c) => (
          <section className="card ins-chart" key={c.key}>
            <div className="card-head"><div><h3>{c.title}</h3><p>{c.subtitle}</p></div></div>
            {c.data.length && c.data.some((d) => d.value) ? <ChartView c={c} /> : <p className="muted ins-empty">Nothing to show for this period yet.</p>}
          </section>
        ))}
      </div>
      <Notice tone="info" icon={<Info size={17} />}><span><b>How these are calculated.</b> {defs.join(" ")}</span></Notice>
      {r.table.rows.length ? (
        <div className="table-wrap ins-table">
          <table className="table">
            <thead><tr>{r.table.columns.map((c) => <th key={c.key} className={c.format === "text" ? undefined : "num"}>{c.label}</th>)}</tr></thead>
            <tbody>
              {r.table.rows.map((row, i) => (
                <tr key={i}>
                  {r.table.columns.map((c) => (
                    <td key={c.key} className={c.format === "text" ? undefined : "num"}>
                      {c === nameCol && name === "sales"
                        ? <span className="cell-main"><Avatar name={String(row[c.key] ?? "")} size={30} /><b>{row[c.key]}</b></span>
                        : c === nameCol ? <b className="ink">{row[c.key]}</b> : fmt(row[c.key], c.format, c.format === "money")}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
            {r.table.total && (
              <tfoot>
                <tr className="ins-total">
                  {r.table.columns.map((c) => <td key={c.key} className={c.format === "text" ? undefined : "num"}>{c === nameCol ? "Total" : fmt(r.table.total![c.key], c.format, c.format === "money")}</td>)}
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      ) : (
        <section className="card"><EmptyState title={r.notes[0] ?? "Nothing to show for this period yet."} /></section>
      )}
    </>
  );
}
