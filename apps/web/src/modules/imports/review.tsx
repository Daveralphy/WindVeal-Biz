import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, ArrowRight, Ban, Plus, RefreshCw } from "lucide-react";
import { Button, EmptyState, Loading, PageHeader, Pill } from "@windveal/ui";
import { api, qs } from "../../lib/api";
import { fmtDate } from "../../lib/format";
import { ErrorNotice, JobGate, Stepper, activeSheets, destOf, plural, type Counts, type Destination, type Job, type Row } from "./shared";

type RowsResp = { rows: Row[]; total: number; page: number; pageSize: number; counts: Counts };

/** Three columns shown after the name for each destination. */
const DISPLAY: Record<string, string[]> = {
  "people.employees": ["department", "startDate", "phone"],
  "crm.companies": ["contactName", "contactEmail", "location"],
  "crm.leads": ["contactName", "source", "estimatedValue"],
  "recruitment.jobs": ["department", "location", "employmentType"],
};

const showValue = (key: string, v: string | undefined) => {
  if (!v) return "";
  if (key === "startDate" && /^\d{4}-\d{2}-\d{2}$/.test(v)) return fmtDate(v);
  if (key === "estimatedValue" && !Number.isNaN(Number(v))) return Number(v).toLocaleString("en-GB");
  return v;
};

function statusPill(r: Row) {
  if (r.status === "excluded") return <Pill tone="grey">Left out</Pill>;
  if (r.status === "duplicate") return <Pill tone="warn">{r.decision === "update" ? "Will update" : r.decision === "create" ? "Add as new" : "Possible duplicate"}</Pill>;
  if (r.status === "invalid") {
    const i = r.issues[0];
    const short = i?.message.startsWith("Missing") ? i.message : i?.message.startsWith("Email") ? "Check email" : i?.field ? "Check value" : "Needs a fix";
    return <Pill tone="red">{short}</Pill>;
  }
  if (r.issues.some((i) => i.field === "manager")) return <Pill tone="ok">Ready · no manager</Pill>;
  return <Pill tone="ok">Ready</Pill>;
}

export function ReviewPage() {
  const { id } = useParams();
  return <JobGate id={id}>{(job) => <Review job={job} />}</JobGate>;
}

function Review({ job }: { job: Job }) {
  const nav = useNavigate();
  const qc = useQueryClient();
  const sheets = activeSheets(job);
  const [sheetName, setSheetName] = useState(sheets[0]?.name ?? "");
  const [tab, setTab] = useState<"all" | "ready" | "attention" | "excluded">("all");
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const sheet = sheets.find((s) => s.name === sheetName) ?? sheets[0];
  const dest = destOf(job, sheet?.destination);
  const key = ["import-rows", job.id, sheet?.name, tab, page];
  const rows = useQuery({
    queryKey: key, enabled: !!sheet, placeholderData: (p) => p,
    queryFn: () => api.get<RowsResp>(`/api/imports/jobs/${job.id}/rows${qs({ sheet: sheet?.name, tab, page, pageSize: 50 })}`),
  });
  const all = useQuery({ queryKey: ["import-rows", job.id, "__all"], queryFn: () => api.get<RowsResp>(`/api/imports/jobs/${job.id}/rows?pageSize=1`) });
  const update = useMutation({
    mutationFn: ({ id, body }: { id: string; body: Record<string, unknown> }) => api.patch<{ row: Row }>(`/api/imports/rows/${id}`, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["import-rows", job.id] });
      qc.invalidateQueries({ queryKey: ["import-summary", job.id] });
    },
  });

  if (!sheet || !dest) {
    return (
      <div className="imp">
        <PageHeader title="Review your rows" />
        <Stepper current={3} />
        <EmptyState title="No sheets to import" action={<Button onClick={() => nav(`/import/${job.id}/sheets`)}>Back to sheets</Button>} />
      </div>
    );
  }
  const counts = rows.data?.counts;
  const total = all.data?.counts;
  const cols = DISPLAY[dest.key] ?? [];
  const label = (k: string) => dest.fields.find((f) => f.key === k)?.label ?? k;
  const pages = rows.data ? Math.max(1, Math.ceil(rows.data.total / rows.data.pageSize)) : 1;

  return (
    <div className="imp">
      <PageHeader title="Review your rows" subtitle="Fix problems and decide what happens with possible duplicates. Nothing has been added yet." />
      <Stepper current={3} />
      {sheets.length > 1 && (
        <div className="imp-sheet-switch">
          <span className="muted">Sheet</span>
          <select className="chip-select select" value={sheet.name} onChange={(e) => { setSheetName(e.target.value); setPage(1); }}>
            {sheets.map((s) => <option key={s.name} value={s.name}>{s.name} · {destOf(job, s.destination)?.label}</option>)}
          </select>
        </div>
      )}
      <div className="imp-pills" role="tablist">
        {([["all", "All"], ["ready", "Ready"], ["attention", "Needs attention"], ["excluded", "Left out"]] as const).map(([k, l]) => (
          <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? "on" : ""} onClick={() => { setTab(k); setPage(1); }}>
            {l}<span>{counts?.[k] ?? 0}</span>
          </button>
        ))}
      </div>
      <ErrorNotice error={update.error ?? rows.error} />
      {rows.isLoading ? <Loading /> : !rows.data?.rows.length ? (
        <section className="card">
          <EmptyState title={tab === "attention" ? "Nothing needs your attention" : tab === "excluded" ? "No rows left out" : "No rows here"}>
            {tab === "attention" ? "Every row is ready or left out." : tab === "excluded" ? "Untick a row to leave it out of the import." : null}
          </EmptyState>
        </section>
      ) : (
        <section className="card card-flush imp-rows">
          <div className="imp-rows-head hide-sm">
            <span /><span>Row</span><span>Name</span>{cols.map((c) => <span key={c}>{label(c)}</span>)}<span>Status</span>
          </div>
          {rows.data.rows.map((r) => (
            <RowItem key={r.id} r={r} dest={dest} cols={cols} busy={update.isPending}
              open={open[r.id] ?? (r.status === "duplicate" && tab === "attention")}
              onToggle={() => setOpen((o) => ({ ...o, [r.id]: !(o[r.id] ?? (r.status === "duplicate" && tab === "attention")) }))}
              onPatch={(body) => update.mutate({ id: r.id, body })} jobId={job.id} />
          ))}
          {pages > 1 && (
            <div className="imp-pager">
              <button className="btn btn-secondary btn-sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>Previous</button>
              <span className="muted">Page {page} of {pages}</span>
              <button className="btn btn-secondary btn-sm" disabled={page >= pages} onClick={() => setPage((p) => p + 1)}>Next</button>
            </div>
          )}
        </section>
      )}
      <div className="imp-foot">
        <button className="btn btn-ghost" onClick={() => nav(`/import/${job.id}/mapping`)}><ArrowLeft size={16} />Back</button>
        <div className="imp-foot-r">
          {total && <span className="muted">{total.willImport} of {plural(total.all, "row")} will be imported</span>}
          <Button disabled={!total?.willImport || update.isPending} onClick={() => nav(`/import/${job.id}/confirm`)}>Continue<ArrowRight size={16} /></Button>
        </div>
      </div>
    </div>
  );
}

function RowItem({ r, dest, cols, open, onToggle, onPatch, busy, jobId }: {
  r: Row; dest: Destination; cols: string[]; open: boolean; onToggle: () => void; onPatch: (b: Record<string, unknown>) => void; busy: boolean; jobId: string;
}) {
  const excluded = r.status === "excluded";
  const fixField = r.status === "invalid" ? r.issues.find((i) => i.field)?.field : undefined;
  const fieldDef = dest.fields.find((f) => f.key === fixField);
  return (
    <div className={`imp-row ${excluded ? "out" : ""} ${open ? "open" : ""}`}>
      <div className="imp-row-line">
        <input type="checkbox" aria-label={excluded ? `Include row ${r.rowNumber}` : `Leave out row ${r.rowNumber}`} checked={!excluded} disabled={busy}
          onChange={(e) => onPatch({ excluded: !e.target.checked })} />
        <span className="num">{r.rowNumber}</span>
        <span className="name">{r.label || <i className="muted">No name</i>}</span>
        {cols.map((c) => (
          <span key={c} className="val hide-sm">
            {fixField === c && fieldDef ? <FixInput key={r.id + c} label={fieldDef.label} initial={r.values[c] ?? ""} type={fieldDef.type} onSave={(v) => onPatch({ values: { [c]: v } })} /> : showValue(c, r.values[c])}
          </span>
        ))}
        <span className="st">
          {r.status === "duplicate" ? <button className="imp-pill-btn" onClick={onToggle} aria-expanded={open}>{statusPill(r)}</button> : statusPill(r)}
        </span>
      </div>
      {fixField && fieldDef && !cols.includes(fixField) && (
        <div className="imp-row-fix">
          <span className="muted">{r.issues[0]?.message}</span>
          <FixInput key={r.id + fixField} label={fieldDef.label} initial={r.values[fixField] ?? ""} type={fieldDef.type} onSave={(v) => onPatch({ values: { [fixField]: v } })} />
        </div>
      )}
      {fixField && cols.includes(fixField) && (
        <div className="imp-row-fix sm-only">
          <span className="muted">{r.issues[0]?.message}</span>
          <FixInput key={r.id + fixField + "m"} label={fieldDef!.label} initial={r.values[fixField] ?? ""} type={fieldDef!.type} onSave={(v) => onPatch({ values: { [fixField]: v } })} />
        </div>
      )}
      {r.status === "invalid" && !fixField && <div className="imp-row-fix"><span className="muted">{r.issues.map((i) => i.message).join(" · ")}</span></div>}
      {r.status === "ready" && r.issues.length > 0 && <div className="imp-row-note">{r.issues.map((i) => i.message).join(" · ")}</div>}
      {open && r.status === "duplicate" && <DuplicatePanel r={r} dest={dest} jobId={jobId} busy={busy} onDecide={(d) => onPatch({ decision: d })} />}
    </div>
  );
}

function FixInput({ label, initial, type, onSave }: { label: string; initial: string; type: string; onSave: (v: string) => void }) {
  const [v, setV] = useState(initial);
  const save = () => { if (v.trim() !== initial) onSave(v.trim()); };
  return (
    <input className="input imp-fix" value={v} placeholder={`Add ${label.toLowerCase()}`} aria-label={label}
      type={type === "email" ? "email" : "text"} onChange={(e) => setV(e.target.value)} onBlur={save}
      onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); save(); } }} />
  );
}

type Compare = {
  fields: { key: string; label: string }[]; existing: Record<string, string> | null; incoming: Record<string, string>;
  rowNumber: number; differences: string[]; workspaceLabel: string; entity: string; note: string | null;
};

function Summary({ fields, values, diff }: { fields: { key: string; label: string }[]; values: Record<string, string>; diff: string[] }) {
  const shown = fields.filter((f) => values[f.key]);
  if (!shown.length) return <p className="muted">No details</p>;
  return (
    <p className="imp-dup-vals">
      {shown.map((f, i) => (
        <span key={f.key}>{i > 0 && " · "}{diff.includes(f.key) ? <mark>{showValue(f.key, values[f.key])}</mark> : showValue(f.key, values[f.key])}</span>
      ))}
    </p>
  );
}

function DuplicatePanel({ r, dest, jobId, onDecide, busy }: { r: Row; dest: Destination; jobId: string; onDecide: (d: "skip" | "update" | "create") => void; busy: boolean }) {
  const q = useQuery({ queryKey: ["import-dup", r.id], queryFn: () => api.get<Compare>(`/api/imports/jobs/${jobId}/duplicate/${r.id}`) });
  const noun = dest.key === "people.employees" ? "person" : dest.noun.replace(/s$/, "");
  const d = r.decision ?? "skip";
  return (
    <div className="imp-dup">
      <h4>{r.label} may already exist {q.data?.existing ? `in ${dest.workspaceLabel}` : "in your file"}</h4>
      {q.isLoading ? <Loading /> : q.data ? (
        q.data.existing ? (
          <div className="imp-dup-grid">
            <div><div className="section-label">Already in WindVeal</div><Summary fields={q.data.fields} values={q.data.existing} diff={q.data.differences} /></div>
            <div><div className="section-label">In your file, row {r.rowNumber}</div><Summary fields={q.data.fields} values={q.data.incoming} diff={q.data.differences} /></div>
          </div>
        ) : <p className="muted">{q.data.note ?? "Another row in your file has the same details."}</p>
      ) : <ErrorNotice error={q.error} />}
      <div className="imp-dup-actions">
        <Button size="sm" variant={d === "skip" ? "primary" : "secondary"} icon={<Ban size={15} />} disabled={busy} onClick={() => onDecide("skip")}>Skip this row</Button>
        {r.duplicateOfId && (
          <Button size="sm" variant={d === "update" ? "primary" : "secondary"} icon={<RefreshCw size={15} />} disabled={busy} onClick={() => onDecide("update")}>Update existing record</Button>
        )}
        <Button size="sm" variant={d === "create" ? "primary" : "secondary"} icon={<Plus size={15} />} disabled={busy} onClick={() => onDecide("create")}>Add as a new {noun}</Button>
      </div>
    </div>
  );
}
