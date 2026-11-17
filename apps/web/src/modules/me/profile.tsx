import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { FileText, Pencil, Plus, Trash2 } from "lucide-react";
import { Button, Card, ConfirmDialog, EmptyState, Input, Loading, Modal, Pill, useToast } from "@windveal/ui";
import { api, ApiError } from "../../lib/api";
import { fmtDate } from "../../lib/format";

type Details = {
  name: string; jobTitle: string | null; department: string | null; manager: string | null; startDate: string | null; employmentType: string | null;
  location: string | null; email: string | null; phone: string | null; homeAddress: string | null; emergencyContact: string | null; employeeCode: string | null;
};
type Doc = { id: string; name: string; category: string | null; expiresOn: string | null; createdAt: string; addedBy: string; mine: boolean };
const failed = (toast: ReturnType<typeof useToast>) => (e: unknown) => toast(e instanceof ApiError ? e.message : "That didn't work. Try again.", "error");

/** Profile & documents › My details: read first; Edit for the details that are theirs to keep up to date. */
export function MyDetails() {
  const qc = useQueryClient();
  const toast = useToast();
  const q = useQuery({ queryKey: ["my", "details"], queryFn: () => api.get<{ details: Details }>("/api/my/details"), retry: false });
  const [editing, setEditing] = useState(false);
  const [f, setF] = useState({ phone: "", homeAddress: "", emergencyContact: "" });
  const d = q.data?.details;
  useEffect(() => { if (d) setF({ phone: d.phone ?? "", homeAddress: d.homeAddress ?? "", emergencyContact: d.emergencyContact ?? "" }); }, [d]);
  const save = useMutation({
    mutationFn: () => api.patch("/api/my/details", f),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ["my", "details"] }); toast("Saved"); setEditing(false); }, onError: failed(toast),
  });
  if (q.isLoading) return <Loading />;
  if (!d) return <Card><EmptyState title="You're not on the team record yet">HR needs to add you in People &amp; HR first.</EmptyState></Card>;
  const rows: [string, string | null][] = [
    ["Name", d.name], ["Job title", d.jobTitle], ["Team", [d.department, d.manager ? `reports to ${d.manager}` : null].filter(Boolean).join(" · ") || null],
    ["Started", d.startDate ? fmtDate(d.startDate, { day: "numeric", month: "short", year: "numeric" }) : null], ["Employment", d.employmentType], ["Location", d.location],
    ["Staff number", d.employeeCode], ["Work email", d.email],
  ];
  return (
    <div className="grid-side side-360">
      <Card title="Your record" subtitle="HR keeps these up to date. Ask them if something is wrong.">
        <dl className="kv pf-kv">{rows.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v || <span className="muted">Not given</span>}</dd></div>)}</dl>
      </Card>
      <Card title="Contact details" actions={!editing && <Button variant="secondary" size="sm" icon={<Pencil size={14} />} onClick={() => setEditing(true)}>Edit</Button>}>
        {editing ? <>
          <Input label="Phone" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} />
          <Input label="Home address" value={f.homeAddress} onChange={(e) => setF({ ...f, homeAddress: e.target.value })} />
          <Input label="Emergency contact" placeholder="Name and phone" value={f.emergencyContact} onChange={(e) => setF({ ...f, emergencyContact: e.target.value })} />
          <div className="row" style={{ justifyContent: "flex-end", gap: 8 }}>
            <Button variant="secondary" onClick={() => { setEditing(false); setF({ phone: d.phone ?? "", homeAddress: d.homeAddress ?? "", emergencyContact: d.emergencyContact ?? "" }); }}>Cancel</Button>
            <Button loading={save.isPending} onClick={() => save.mutate()}>Save</Button>
          </div>
        </> : (
          <dl className="kv pf-kv">
            {([["Phone", d.phone], ["Home address", d.homeAddress], ["Emergency contact", d.emergencyContact]] as const).map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v || <span className="muted">Not given</span>}</dd></div>)}
          </dl>
        )}
      </Card>
    </div>
  );
}

function expiry(on: string | null) {
  if (!on) return null;
  const days = Math.round((new Date(`${on}T00:00:00`).getTime() - Date.now()) / 86_400_000);
  if (days < 0) return { tone: "red" as const, text: "Expired" };
  if (days <= 60) return { tone: "warn" as const, text: "Renew soon" };
  return null;
}

/** Profile & documents › Documents: contract, ID and certificates, with a flag when one runs out. */
export function MyDocuments() {
  const qc = useQueryClient();
  const toast = useToast();
  const q = useQuery({ queryKey: ["my", "documents"], queryFn: () => api.get<{ documents: Doc[] }>("/api/my/documents"), retry: false });
  const [adding, setAdding] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [category, setCategory] = useState("");
  const [expiresOn, setExpiresOn] = useState("");
  const [busy, setBusy] = useState(false);
  const [removing, setRemoving] = useState<Doc | null>(null);
  const refresh = () => void qc.invalidateQueries({ queryKey: ["my", "documents"] });
  const add = async () => {
    if (!file) return;
    setBusy(true);
    try {
      await api.upload("/api/my/documents", file, { category: category.trim() || undefined, expiresOn: expiresOn || undefined });
      refresh(); toast("Added"); setAdding(false); setFile(null); setCategory(""); setExpiresOn("");
    } catch (e) { failed(toast)(e); } finally { setBusy(false); }
  };
  if (q.isLoading) return <Loading />;
  if (q.error) return <Card><EmptyState title="You're not on the team record yet">HR needs to add you in People &amp; HR first.</EmptyState></Card>;
  const docs = q.data?.documents ?? [];
  return (
    <>
      <div className="toolbar"><span className="grow" /><Button icon={<Plus size={16} />} onClick={() => setAdding(true)}>Add a document</Button></div>
      <Card title="Your documents" subtitle="Only you, HR and admins can see these." flush={!!docs.length}>
        {!docs.length ? <EmptyState title="No documents yet">Your contract and ID show here once HR adds them. You can add your own too.</EmptyState> : docs.map((doc) => {
          const x = expiry(doc.expiresOn);
          return (
            <div key={doc.id} className="list-row rq-row" style={{ cursor: "default" }}>
              <span className="rq-ic"><FileText size={18} /></span>
              <span className="grow"><a className="ink" href={`/api/my/documents/${doc.id}/content`} target="_blank" rel="noreferrer"><b>{doc.category || doc.name}</b></a>
                <small className="muted">{[doc.category ? doc.name : null, `added by ${doc.addedBy}`, doc.expiresOn ? `${x?.text === "Expired" ? "expired" : "expires"} ${fmtDate(doc.expiresOn)}` : null].filter(Boolean).join(" · ")}</small></span>
              {x && <Pill tone={x.tone}>{x.text}</Pill>}
              {doc.mine && <button className="bd-ic" aria-label={`Remove ${doc.name}`} onClick={() => setRemoving(doc)}><Trash2 size={15} /></button>}
            </div>
          );
        })}
      </Card>
      {adding && (
        <Modal open onClose={() => setAdding(false)} title="Add a document"
          footer={<><Button variant="secondary" onClick={() => setAdding(false)}>Cancel</Button><Button loading={busy} disabled={!file} onClick={() => void add()}>Add</Button></>}>
          <Input label="What is it?" placeholder="e.g. National ID, Driver's licence, First aid certificate" value={category} onChange={(e) => setCategory(e.target.value)} />
          <Input label="Expires on" optional type="date" value={expiresOn} onChange={(e) => setExpiresOn(e.target.value)} />
          <label className="rq-receipt"><input type="file" hidden accept="image/*,application/pdf" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            <FileText size={16} />{file ? file.name : "Choose the file (photo or PDF)"}</label>
        </Modal>
      )}
      <ConfirmDialog open={!!removing} onClose={() => setRemoving(null)} danger title={`Remove ${removing?.category || removing?.name}?`} confirmLabel="Remove"
        onConfirm={async () => { const d = removing!; setRemoving(null); try { await api.del(`/api/my/documents/${d.id}`); refresh(); } catch (e) { failed(toast)(e); } }}>
        It's removed from your record. HR's copies stay.
      </ConfirmDialog>
    </>
  );
}
