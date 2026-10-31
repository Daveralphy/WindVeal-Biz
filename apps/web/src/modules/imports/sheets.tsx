import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";
import { AlertTriangle, ArrowLeft, ArrowRight, Check, FileSpreadsheet, Info } from "lucide-react";
import { Button, PageHeader } from "@windveal/ui";
import { api } from "../../lib/api";
import { timeAgo } from "../../lib/format";
import { ErrorNotice, JobGate, Stepper, jobKey, plural, useRefreshImport, type Job, type Sheet } from "./shared";

type SheetPatch = { name: string; include?: boolean; destination?: string | null; mapping?: Record<string, string | null>; dateFormat?: string };

export function usePatchSheets(job: Job) {
  const qc = useQueryClient();
  const refresh = useRefreshImport(job.id);
  return useMutation({
    mutationFn: (sheets: SheetPatch[]) => api.patch<{ job: Job }>(`/api/imports/jobs/${job.id}/sheets`, { sheets }),
    onSuccess: (r) => { qc.setQueryData(jobKey(job.id), r.job); refresh(); },
  });
}

function ConfidenceBar({ value, flagged }: { value: number; flagged: boolean }) {
  const filled = flagged ? 1 : value >= 0.75 ? 3 : value >= 0.5 ? 2 : 1;
  return (
    <div className={`imp-conf ${flagged ? "warn" : ""}`} aria-label={flagged ? "Not sure" : `Match strength ${Math.round(value * 100)}%`}>
      {[0, 1, 2].map((i) => <i key={i} className={i < filled ? "on" : ""} />)}
    </div>
  );
}

function SheetCard({ job, sheet, onPatch, busy }: { job: Job; sheet: Sheet; onPatch: (p: SheetPatch) => void; busy: boolean }) {
  const dest = job.destinations.find((d) => d.key === sheet.destination);
  const flagged = sheet.include && !sheet.destination;
  const cols = sheet.columns.slice(0, 5);
  return (
    <section className={`card imp-sheet ${flagged ? "flagged" : ""} ${!sheet.include ? "skipped" : ""}`}>
      <div className="imp-sheet-main">
        <label className="imp-sheet-title">
          <input type="checkbox" checked={sheet.include} disabled={busy} onChange={(e) => onPatch({ name: sheet.name, include: e.target.checked })} />
          <span><b>{sheet.name}</b><small>{plural(sheet.rowCount, "row")} · {plural(sheet.columns.length, "column")}{!sheet.include ? " · skipped" : ""}</small></span>
        </label>
        <div className="table-wrap">
          <table className="imp-mini">
            <thead><tr>{cols.map((c) => <th key={c}>{c}</th>)}{sheet.columns.length > 5 && <th>+{sheet.columns.length - 5} more</th>}</tr></thead>
            <tbody>
              {sheet.preview.slice(0, 2).map((r) => (
                <tr key={r.rowNumber}>{cols.map((c) => <td key={c}>{r.data[c] || "—"}</td>)}{sheet.columns.length > 5 && <td />}</tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      <div className="imp-sheet-side">
        <label className="field-label" htmlFor={`dest-${sheet.name}`}>Add to</label>
        <select id={`dest-${sheet.name}`} className={`select ${flagged ? "warn" : ""}`} value={sheet.destination ?? ""} disabled={busy || !sheet.include}
          onChange={(e) => onPatch({ name: sheet.name, destination: e.target.value || null })}>
          <option value="">Choose where this goes</option>
          {job.destinations.map((d) => <option key={d.key} value={d.key} disabled={!d.allowed}>{d.label}{d.allowed ? "" : " (no access)"}</option>)}
        </select>
        {sheet.include && <ConfidenceBar value={sheet.confidence} flagged={flagged} />}
        {sheet.include && (flagged ? (
          <p className="imp-hint warn"><AlertTriangle size={14} />We're not sure. Pick a destination or skip it.</p>
        ) : dest && sheet.confidence >= 0.75 ? (
          <p className="imp-hint"><Check size={14} />{dest.hint} Strong match.</p>
        ) : dest ? (
          <p className="imp-hint"><Info size={14} />{dest.hint}</p>
        ) : null)}
      </div>
    </section>
  );
}

export function SheetsPage() {
  const { id } = useParams();
  return <JobGate id={id}>{(job) => <Sheets job={job} />}</JobGate>;
}

function Sheets({ job }: { job: Job }) {
  const nav = useNavigate();
  const patch = usePatchSheets(job);
  const [replacing, setReplacing] = useState(false);
  const rows = job.sheets.reduce((a, s) => a + s.rowCount, 0);
  const unsure = job.sheets.filter((s) => s.include && !s.destination);
  const included = job.sheets.filter((s) => s.include);
  const canContinue = included.length > 0 && unsure.length === 0;

  async function replace() {
    setReplacing(true);
    await api.post(`/api/imports/jobs/${job.id}/cancel`).catch(() => null);
    nav("/import");
  }

  return (
    <div className="imp">
      <PageHeader title="Check your sheets" subtitle={`We found ${plural(job.sheets.length, "sheet")}. Confirm where each one should go.`} />
      <Stepper current={1} />
      <section className="card imp-file">
        <span className="imp-file-ic"><FileSpreadsheet size={20} /></span>
        <div><b>{job.fileName}</b><small>{plural(job.sheets.length, "sheet")} · {plural(rows, "row")} · uploaded {timeAgo(job.createdAt).toLowerCase()}</small></div>
        <button className="btn btn-ghost" onClick={replace} disabled={replacing}>Replace file</button>
      </section>
      <ErrorNotice error={patch.error} />
      {job.sheets.map((s) => <SheetCard key={s.name} job={job} sheet={s} busy={patch.isPending} onPatch={(p) => patch.mutate([p])} />)}
      <div className="imp-foot">
        <button className="btn btn-ghost" onClick={() => nav("/import")}><ArrowLeft size={16} />Back</button>
        <div className="imp-foot-r">
          {unsure.length > 0 && (
            <button className="btn btn-ghost" disabled={patch.isPending} onClick={() => patch.mutate(unsure.map((s) => ({ name: s.name, include: false })))}>
              Skip sheets I'm not sure about
            </button>
          )}
          <Button disabled={!canContinue} loading={patch.isPending} onClick={() => nav(`/import/${job.id}/mapping`)}>
            Continue to mapping<ArrowRight size={16} />
          </Button>
        </div>
      </div>
    </div>
  );
}
