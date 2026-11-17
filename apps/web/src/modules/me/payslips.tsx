import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Download } from "lucide-react";
import { formatMoney } from "@windveal/shared";
import { Button, Card, EmptyState, Loading } from "@windveal/ui";
import { api } from "../../lib/api";
import { fmtDate } from "../../lib/format";
import "./payslips.css";

type Payslip = {
  id: string; period: string; label: string; currency: string; paidAt: string | null; name: string; jobTitle: string | null;
  basic: string; housing: string; transport: string; otherAllowances: string; bonus: string; gross: string;
  pension: string; nhf: string; paye: string; otherDeductions: string; net: string; bankName: string | null; accountNumber: string | null;
};
type Detail = { payslip: Payslip; employee: { name: string; jobTitle: string | null; reference: string | null }; org: { name: string } };

const short = (period: string) => new Date(`${period}-01T00:00:00`).toLocaleDateString("en-GB", { month: "short" });

/** Take-home pay for the last six payslips: one bar each, the open one marked. */
function TakeHome({ list, open, onOpen }: { list: Payslip[]; open: string; onOpen: (id: string) => void }) {
  const [hover, setHover] = useState<number | null>(null);
  const six = list.slice(0, 6).reverse();
  const max = Math.max(...six.map((p) => Number(p.net)), 1);
  const cur = six[0]?.currency ?? "NGN";
  const top = niceTop(max);
  const h = hover != null ? six[hover] : null;
  return (
    <div className="ps-chart">
      <div className="ps-plot">
        {[top / 2, top].map((t) => <div key={t} className="ps-grid" style={{ bottom: `${(t / top) * 100}%` }}><span>{formatMoney(t, cur, true)}</span></div>)}
        <div className="ps-bars" onMouseLeave={() => setHover(null)}>
          {six.map((p, i) => (
            <button key={p.id} className={`ps-col${p.id === open ? " on" : ""}`} onMouseEnter={() => setHover(i)} onFocus={() => setHover(i)} onClick={() => onOpen(p.id)}
              aria-label={`${p.label}: ${formatMoney(p.net, cur)} take-home`}>
              <i style={{ height: `${(Number(p.net) / top) * 100}%` }} />
            </button>
          ))}
        </div>
        {h && <div className="ps-tip" style={{ left: `${((hover! + 0.5) / six.length) * 100}%` }}><b>{h.label}</b>{formatMoney(h.net, cur)} take-home</div>}
      </div>
      <div className="ps-x">{six.map((p) => <span key={p.id}>{short(p.period)}</span>)}</div>
    </div>
  );
}
function niceTop(max: number) {
  const step = 10 ** Math.floor(Math.log10(max));
  return Math.ceil(max / step) * step;
}

function Line({ label, value, cur, minus, strong }: { label: string; value: string; cur: string; minus?: boolean; strong?: boolean }) {
  if (!Number(value) && !strong) return null;
  return <div className={`ps-line${strong ? " strong" : ""}${minus ? " minus" : ""}`}><span>{label}</span><b>{minus ? "−" : ""}{formatMoney(value, cur)}</b></div>;
}

/** Finance › Payslips: every payslip once the payroll is paid. */
export function Payslips() {
  const [params, setParams] = useSearchParams();
  const list = useQuery({ queryKey: ["my", "payslips"], queryFn: () => api.get<{ payslips: Payslip[] }>("/api/my/payslips") });
  const openId = params.get("slip") ?? list.data?.payslips[0]?.id ?? null;
  const one = useQuery({ queryKey: ["my", "payslips", openId], enabled: !!openId, queryFn: () => api.get<Detail>(`/api/my/payslips/${openId}`) });
  const open = (id: string) => { const p = new URLSearchParams(params); p.set("slip", id); setParams(p, { replace: true }); };
  if (list.isLoading) return <Loading />;
  const slips = list.data?.payslips ?? [];
  if (!slips.length) return <Card><EmptyState title="No payslips yet">When HR runs payroll and it's paid, each month's payslip shows here to view and download.</EmptyState></Card>;
  const print = () => {
    document.body.classList.add("printing-payslip");
    const done = () => { document.body.classList.remove("printing-payslip"); window.removeEventListener("afterprint", done); };
    window.addEventListener("afterprint", done);
    window.print();
  };
  const d = one.data;
  const s = d?.payslip;
  const cur = s?.currency ?? "NGN";
  return (
    <div className="ps">
      <div className="ps-left">
        <Card title="Take-home pay" subtitle={slips.length > 1 ? `Your last ${Math.min(6, slips.length)} payslips` : undefined}>
          <TakeHome list={slips} open={openId ?? ""} onOpen={open} />
        </Card>
        <div className="card card-flush ps-list">
          {slips.map((p) => (
            <button key={p.id} className={`ps-item${p.id === openId ? " on" : ""}`} onClick={() => open(p.id)} aria-pressed={p.id === openId}>
              <span className="grow"><b>{p.label}</b><small>{p.paidAt ? `Paid ${fmtDate(p.paidAt, { day: "numeric", month: "short" })}` : "Paid"}</small></span>
              <span className="amt">{formatMoney(p.net, p.currency)}</span>
            </button>
          ))}
        </div>
      </div>
      <Card className="ps-doc-card">
        {one.isLoading || !s || !d ? <Loading /> : (
          <div className="ps-doc">
            <div className="ps-doc-head">
              <span className="ps-eyebrow">Payslip · {s.label}</span><span className="grow" />
              <Button size="sm" variant="secondary" icon={<Download size={15} />} onClick={print} className="ps-noprint">Download PDF</Button>
            </div>
            <div className="ps-paper">
              <div className="ps-who">
                <div><b>{d.employee.name}</b><small>{[d.employee.jobTitle, d.employee.reference, s.bankName && s.accountNumber ? `${s.bankName} ${s.accountNumber}` : null].filter(Boolean).join(" · ")}</small></div>
                <div className="r"><small>{d.org.name}</small><b>{periodRange(s.period)}</b></div>
              </div>
              <Line label="Basic salary" value={s.basic} cur={cur} />
              <Line label="Housing" value={s.housing} cur={cur} />
              <Line label="Transport" value={s.transport} cur={cur} />
              <Line label="Other allowances" value={s.otherAllowances} cur={cur} />
              <Line label="Bonus" value={s.bonus} cur={cur} />
              <Line label="Gross pay" value={s.gross} cur={cur} strong />
              <Line label="PAYE tax" value={s.paye} cur={cur} minus />
              <Line label="Pension (8%)" value={s.pension} cur={cur} minus />
              <Line label="National Housing Fund (2.5%)" value={s.nhf} cur={cur} minus />
              <Line label="Other deductions" value={s.otherDeductions} cur={cur} minus />
              <div className="ps-net"><span>Take-home pay</span><b>{formatMoney(s.net, cur)}</b></div>
            </div>
            <p className="muted ps-note">Only you and HR can see this. If something looks wrong, send HR a request.</p>
          </div>
        )}
      </Card>
    </div>
  );
}

function periodRange(period: string) {
  const [y, m] = period.split("-").map(Number) as [number, number];
  const last = new Date(y, m, 0).getDate();
  return `1 to ${last} ${new Date(y, m - 1, 1).toLocaleDateString("en-GB", { month: "short", year: "numeric" })}`;
}
