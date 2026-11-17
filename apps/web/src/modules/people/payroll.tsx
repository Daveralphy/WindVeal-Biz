import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Check, Download, Plus, RefreshCw } from "lucide-react";
import { Avatar, Button, Card, ConfirmDialog, EmptyState, Input, Loading, Modal, Notice, Pill, Select, Textarea, useToast } from "@windveal/ui";
import { api, ApiError } from "../../lib/api";
import { useSession } from "../../lib/session";
import { fmtDate } from "../../lib/format";
import "./payroll.css";

type Who = { id: string; name: string } | null;
type Status = "prepared" | "checked" | "approved" | "paid";
type Totals = { people: number; gross: string; net: string; paye: string; pension: string; nhf: string; deductions: string };
type Run = {
  id: string; period: string; label: string; status: Status; currency: string; note: string | null; createdAt: string;
  preparedBy: Who; checkedBy: Who; checkedAt: string | null; approvedBy: Who; approvedAt: string | null; paidBy: Who; paidAt: string | null; totals: Totals;
};
const FIELDS = [
  ["basic", "Basic salary"], ["housing", "Housing"], ["transport", "Transport"], ["otherAllowances", "Other allowances"], ["bonus", "Bonus"],
  ["paye", "PAYE tax"], ["pension", "Pension (8%)"], ["nhf", "National Housing Fund (2.5%)"], ["otherDeductions", "Other deductions"],
] as const;
type Field = (typeof FIELDS)[number][0];
export type Slip = Record<Field | "gross" | "net", string> & {
  id: string; employeeId: string; name: string; jobTitle: string | null; overrides: Field[]; note: string | null; bankName: string | null; accountNumber: string | null;
};
const STEPS: { key: Status; label: string }[] = [{ key: "prepared", label: "Prepared" }, { key: "checked", label: "Checked" }, { key: "approved", label: "Approved" }, { key: "paid", label: "Paid" }];
const TONE: Record<Status, "warn" | "blue" | "ok" | "violet"> = { prepared: "warn", checked: "blue", approved: "violet", paid: "ok" };
const failed = (toast: ReturnType<typeof useToast>) => (e: unknown) => toast(e instanceof ApiError ? e.message : "That didn't work. Try again.", "error");
const ym = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

/** People & HR › Payroll: each month's pay, from prepared to paid. */
export function PayrollPage() {
  const { money } = useSession();
  const navigate = useNavigate();
  const toast = useToast();
  const q = useQuery({ queryKey: ["payroll"], queryFn: () => api.get<{ runs: Run[]; isAdmin: boolean; payablePeople: number; currency: string }>("/api/payroll/runs") });
  const taken = new Set(q.data?.runs.map((r) => r.period));
  const months = Array.from({ length: 6 }, (_, i) => { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() + 1 - i); return ym(d); }).filter((m) => !taken.has(m));
  const [making, setMaking] = useState(false);
  const [period, setPeriod] = useState("");
  const make = useMutation({
    mutationFn: () => api.post<{ id: string }>("/api/payroll/runs", { period: period || months[1] || months[0] }),
    onSuccess: (r) => navigate(`/people/payroll/${r.id}`), onError: failed(toast),
  });
  if (q.isLoading) return <Loading />;
  if (!q.data) return <EmptyState title="Payroll couldn't be opened">You need People &amp; HR (manage) and the See pay permission.</EmptyState>;
  const { runs, payablePeople } = q.data;
  const last = runs[0];
  return (
    <div className="pr">
      <div className="toolbar"><span className="muted">{payablePeople} {payablePeople === 1 ? "person has" : "people have"} a salary set</span><span className="grow" />
        <Button icon={<Plus size={16} />} onClick={() => { setPeriod(months.includes(ym(new Date())) ? ym(new Date()) : months[0] ?? ""); setMaking(true); }} disabled={!months.length}>Prepare payroll</Button></div>
      {last && (
        <div className="pr-kpis">
          <div className="pr-kpi accent"><small>Take-home pay, {last.label}</small><b>{money(last.totals.net)}</b><span>{last.totals.people} {last.totals.people === 1 ? "person" : "people"}</span></div>
          <div className="pr-kpi"><small>Gross pay</small><b>{money(last.totals.gross)}</b><span>{runs[1] ? change(Number(last.totals.gross), Number(runs[1].totals.gross), runs[1].label) : "First payroll"}</span></div>
          <div className="pr-kpi"><small>PAYE tax</small><b>{money(last.totals.paye)}</b><span>To the state tax office</span></div>
          <div className="pr-kpi"><small>Pension + NHF</small><b>{money(Number(last.totals.pension) + Number(last.totals.nhf))}</b><span>To the funds</span></div>
        </div>
      )}
      <Card title="Payrolls" flush={!!runs.length}>
        {!runs.length ? <EmptyState title="No payroll yet" action={<Button icon={<Plus size={16} />} onClick={() => { setPeriod(months[1] ?? months[0] ?? ""); setMaking(true); }}>Prepare payroll</Button>}>
          WindVeal works out each person's pay, PAYE, pension and NHF from their pay details. You check it, an admin approves it, and payslips go out once it's paid.
        </EmptyState> : runs.map((r) => (
          <Link key={r.id} to={`/people/payroll/${r.id}`} className="list-row pr-row">
            <div className="grow"><b className="ink">{r.label}</b><small className="muted">{r.totals.people} {r.totals.people === 1 ? "person" : "people"} · prepared by {r.preparedBy?.name ?? "someone"}{r.paidAt ? ` · paid ${fmtDate(r.paidAt, { day: "numeric", month: "short" })}` : ""}</small></div>
            <span className="pr-amt">{money(r.totals.net)}</span>
            <Pill tone={TONE[r.status]}>{STEPS.find((s) => s.key === r.status)!.label}</Pill>
          </Link>
        ))}
      </Card>
      <Modal open={making} onClose={() => setMaking(false)} title="Prepare payroll" subtitle="A payslip for everyone with a salary. You can change any amount before it's approved."
        footer={<><Button variant="secondary" onClick={() => setMaking(false)}>Cancel</Button><Button loading={make.isPending} onClick={() => make.mutate()}>Prepare</Button></>}>
        <Select label="Month" value={period} onChange={(e) => setPeriod(e.target.value)} options={months.map((m) => ({ value: m, label: new Date(`${m}-01T00:00:00`).toLocaleDateString("en-GB", { month: "long", year: "numeric" }) }))} />
      </Modal>
    </div>
  );
}

function change(now: number, before: number, label: string) {
  if (!before) return `First pay in ${label}`;
  const p = Math.round(((now - before) / before) * 100);
  return p === 0 ? `Same as ${label}` : `${p > 0 ? "Up" : "Down"} ${Math.abs(p)}% on ${label}`;
}

/** One person's payslip, with the amounts HR can change while the payroll is still prepared. */
function EditSlip({ s, canEdit, onClose }: { s: Slip; canEdit: boolean; onClose: () => void }) {
  const { money } = useSession();
  const qc = useQueryClient();
  const toast = useToast();
  const [vals, setVals] = useState<Record<Field, string>>(() => Object.fromEntries(FIELDS.map(([k]) => [k, s.overrides.includes(k) ? String(Number(s[k])) : ""])) as Record<Field, string>);
  const [note, setNote] = useState(s.note ?? "");
  const save = useMutation({
    mutationFn: () => api.patch(`/api/payroll/payslips/${s.id}`, { overrides: Object.fromEntries(FIELDS.map(([k]) => [k, vals[k].trim()])), note: note.trim() || null }),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ["payroll"] }); toast(`${s.name}'s pay saved`); onClose(); },
    onError: failed(toast),
  });
  return (
    <Modal open onClose={onClose} title={s.name} subtitle={[s.jobTitle, s.bankName && s.accountNumber ? `${s.bankName} ${s.accountNumber}` : "No bank details yet"].filter(Boolean).join(" · ")} size="lg"
      footer={canEdit ? <><Button variant="secondary" onClick={onClose}>Cancel</Button><Button loading={save.isPending} onClick={() => save.mutate()}>Save</Button></> : <Button variant="secondary" onClick={onClose}>Close</Button>}>
      {canEdit && <p className="muted pr-help">Leave a box empty and WindVeal works it out. Type an amount to use yours instead.</p>}
      <div className="pr-edit">
        {FIELDS.map(([k, label]) => (
          <div key={k} className="pr-field">
            <label htmlFor={`f-${k}`}>{label}{s.overrides.includes(k) && <Pill tone="warn">Changed</Pill>}</label>
            {canEdit ? <input id={`f-${k}`} className="input" inputMode="decimal" value={vals[k]} placeholder={money(s[k])} onChange={(e) => setVals({ ...vals, [k]: e.target.value.replace(/[^\d.]/g, "") })} />
              : <b>{money(s[k])}</b>}
          </div>
        ))}
      </div>
      <div className="pr-sum"><span>Gross pay <b>{money(s.gross)}</b></span><span>Take-home <b>{money(s.net)}</b></span></div>
      {canEdit ? <Textarea label="Note" optional value={note} onChange={(e) => setNote(e.target.value)} placeholder="Why it's different this month (only HR sees this)" />
        : s.note && <p className="muted">Note: {s.note}</p>}
    </Modal>
  );
}

/** One month's payroll: the steps, the totals and everyone's pay. */
export function PayrollRun() {
  const { id } = useParams();
  const { money } = useSession();
  const qc = useQueryClient();
  const toast = useToast();
  const navigate = useNavigate();
  const q = useQuery({ queryKey: ["payroll", id], queryFn: () => api.get<{ run: Run; slips: Slip[]; canEdit: boolean; isAdmin: boolean }>(`/api/payroll/runs/${id}`) });
  const [open, setOpen] = useState<Slip | null>(null);
  const [confirm, setConfirm] = useState<"pay" | "delete" | null>(null);
  const refresh = () => void qc.invalidateQueries({ queryKey: ["payroll"] });
  const step = useMutation({
    mutationFn: (action: "check" | "approve" | "pay" | "reopen") => api.post(`/api/payroll/runs/${id}/step`, { action }),
    onSuccess: (_r, a) => { refresh(); toast({ check: "Checked. Admins have been told it's ready to approve.", approve: "Approved. Download the bank file to pay everyone.", pay: "Marked as paid. Everyone's payslip is in their Finance space.", reopen: "Back to Prepared" }[a]); },
    onError: failed(toast),
  });
  const recalc = useMutation({ mutationFn: () => api.post<{ people: number }>(`/api/payroll/runs/${id}/refresh`, {}), onSuccess: () => { refresh(); toast("Worked out again from everyone's pay details"); }, onError: failed(toast) });
  if (q.isLoading) return <Loading />;
  if (!q.data) return <EmptyState title="That payroll couldn't be opened" />;
  const { run, slips, canEdit, isAdmin } = q.data;
  const at = STEPS.findIndex((s) => s.key === run.status);
  const t = run.totals;
  const when: Record<Status, string | null> = {
    prepared: run.preparedBy ? `${run.preparedBy.name}, ${fmtDate(run.createdAt, { day: "numeric", month: "short" })}` : null,
    checked: run.checkedBy ? `${run.checkedBy.name}, ${fmtDate(run.checkedAt!, { day: "numeric", month: "short" })}` : null,
    approved: run.approvedBy ? `${run.approvedBy.name}, ${fmtDate(run.approvedAt!, { day: "numeric", month: "short" })}` : null,
    paid: run.paidBy ? `${run.paidBy.name}, ${fmtDate(run.paidAt!, { day: "numeric", month: "short" })}` : null,
  };
  const changed = slips.filter((s) => s.overrides.length).length;
  const noBank = slips.filter((s) => !s.accountNumber).length;
  return (
    <div className="pr">
      <div className="pr-head">
        <Link to="/people/payroll" className="pr-back"><ArrowLeft size={16} />Payroll</Link>
        <h2>{run.label}</h2><span className="grow" />
        {(run.status === "approved" || run.status === "paid") && <Button variant="secondary" icon={<Download size={16} />} onClick={() => { window.location.href = `/api/payroll/runs/${run.id}/bank-file`; }}>Bank file</Button>}
        {run.status === "prepared" && <>
          <Button variant="secondary" icon={<RefreshCw size={15} />} loading={recalc.isPending} onClick={() => recalc.mutate()}>Work out again</Button>
          <Button icon={<Check size={16} />} loading={step.isPending} onClick={() => step.mutate("check")}>Mark as checked</Button>
        </>}
        {run.status === "checked" && <>
          <Button variant="secondary" onClick={() => step.mutate("reopen")}>Send back</Button>
          {isAdmin ? <Button loading={step.isPending} onClick={() => step.mutate("approve")}>Approve payroll</Button> : <span className="muted pr-wait">Waiting for an admin to approve</span>}
        </>}
        {run.status === "approved" && isAdmin && <>
          <Button variant="secondary" onClick={() => step.mutate("reopen")}>Send back</Button>
          <Button loading={step.isPending} onClick={() => setConfirm("pay")}>Mark as paid</Button>
        </>}
      </div>

      <div className="card pr-steps">
        {STEPS.map((s, i) => (
          <div key={s.key} className={`pr-step${i < at || run.status === "paid" ? " done" : i === at ? " now" : ""}`}>
            <span className="dot">{i < at || run.status === "paid" ? <Check size={13} strokeWidth={3} /> : i + 1}</span>
            <span><b>{s.label}</b>{when[s.key] && <small>{when[s.key]}</small>}</span>
          </div>
        ))}
        <span className="grow" />
        {!!changed && <Pill tone="warn">{changed} changed by hand</Pill>}
      </div>

      {!!noBank && run.status !== "paid" && <Notice tone="warn">{noBank} {noBank === 1 ? "person has" : "people have"} no bank account yet. Add it on their profile in People &amp; HR, then work the payroll out again.</Notice>}

      <div className="pr-kpis">
        <div className="pr-kpi accent"><small>Take-home pay</small><b>{money(t.net)}</b><span>{t.people} {t.people === 1 ? "person" : "people"}</span></div>
        <div className="pr-kpi"><small>Gross pay</small><b>{money(t.gross)}</b><span>Before deductions</span></div>
        <div className="pr-kpi"><small>PAYE tax</small><b>{money(t.paye)}</b><span>To the state tax office</span></div>
        <div className="pr-kpi"><small>Pension + NHF</small><b>{money(Number(t.pension) + Number(t.nhf))}</b><span>To the funds</span></div>
      </div>

      <div className="card card-flush">
        <div className="table-wrap">
          <table className="table pr-table">
            <thead><tr><th>Person</th><th className="num">Gross</th><th className="num hide-sm">PAYE</th><th className="num hide-sm">Pension</th><th className="num hide-sm">NHF</th><th className="num">Take-home</th><th className="hide-sm" /></tr></thead>
            <tbody>{slips.map((s) => (
              <tr key={s.id} className="clickable" onClick={() => setOpen(s)}>
                <td><span className="pr-person"><Avatar name={s.name} size={32} /><span><b className="ink">{s.name}</b><small className="muted">{s.jobTitle ?? ""}</small></span></span></td>
                <td className="num">{money(s.gross)}</td><td className="num hide-sm">{money(s.paye)}</td><td className="num hide-sm">{money(s.pension)}</td><td className="num hide-sm">{money(s.nhf)}</td>
                <td className="num"><b className="ink">{money(s.net)}</b></td>
                <td className="hide-sm">{!!s.overrides.length && <Pill tone="warn">Changed</Pill>}{!s.accountNumber && <Pill tone="red">No bank</Pill>}</td>
              </tr>
            ))}</tbody>
            <tfoot><tr><td><b>Total</b></td><td className="num"><b>{money(t.gross)}</b></td><td className="num hide-sm"><b>{money(t.paye)}</b></td><td className="num hide-sm"><b>{money(t.pension)}</b></td><td className="num hide-sm"><b>{money(t.nhf)}</b></td><td className="num"><b>{money(t.net)}</b></td><td className="hide-sm" /></tr></tfoot>
          </table>
        </div>
      </div>

      <p className="muted pr-foot">
        {run.currency === "NGN"
          ? "WindVeal works out PAYE under the Nigeria Tax Act 2025, pension at 8% of basic, housing and transport, and NHF at 2.5% of basic, splitting each salary 60% basic, 25% housing and 15% transport. Reliefs such as rent aren't included: check the figures with your accountant, and change any amount you need to."
          : `WindVeal works out tax only for Nigeria. For ${run.currency}, type each deduction in yourself.`}
        {canEdit && <> <button className="link-btn danger" onClick={() => setConfirm("delete")}>Delete this payroll</button></>}
      </p>

      {open && <EditSlip s={open} canEdit={canEdit} onClose={() => setOpen(null)} />}
      <ConfirmDialog open={confirm === "pay"} onClose={() => setConfirm(null)} title={`Mark ${run.label} as paid?`} confirmLabel="Mark as paid"
        onConfirm={() => { setConfirm(null); step.mutate("pay"); }}>
        Do this once the bank has paid everyone. Each person's payslip then appears in their Finance space and they're told. A paid payroll can't be changed.
      </ConfirmDialog>
      <ConfirmDialog open={confirm === "delete"} onClose={() => setConfirm(null)} danger title={`Delete payroll for ${run.label}?`} confirmLabel="Delete payroll"
        onConfirm={async () => { setConfirm(null); try { await api.del(`/api/payroll/runs/${run.id}`); refresh(); toast("Payroll deleted"); navigate("/people/payroll"); } catch (e) { failed(toast)(e); } }}>
        Everyone's payslip for this month is removed. You can prepare it again afterwards.
      </ConfirmDialog>
    </div>
  );
}
