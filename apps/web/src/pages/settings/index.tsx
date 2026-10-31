import { useEffect, useRef, useState } from "react";
import { NavLink, Navigate, Route, Routes, useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Clock, Download, KeyRound, Lock, MoreHorizontal, Pause, Plus, Shield, Trash2, Upload, X } from "lucide-react";
import {
  Avatar, Button, Card, ConfirmDialog, EmptyState, IconButton, Input, Loading, Menu, Modal, Notice, PageHeader, Pill, Progress,
  SearchInput, Segmented, Select, Switch, Textarea, useToast,
} from "@windveal/ui";
import {
  ACCESS_LEVELS, COUNTRIES, INDUSTRIES, PLAN_PRICES, SPECIAL_PERMISSIONS, TEAM_SIZES, WORKSPACES, WORKSPACE_LABELS, formatBytes, formatMoney,
} from "@windveal/shared";
import { api, ApiError, publicFileUrl } from "../../lib/api";
import { ME_KEY, useSession } from "../../lib/session";
import { useForm } from "../../lib/form";
import { CONTACT_EMAIL } from "../../lib/config";
import { fmtDate, timeAgo } from "../../lib/format";

function SettingsTabs() {
  const { isAdmin } = useSession();
  const tabs = [
    ["/settings", "Organisation", true], ["/settings/members", "Members", true], ["/settings/roles", "Roles and permissions", isAdmin],
    ["/settings/billing", "Plan and billing", true], ["/settings/audit", "Audit history", isAdmin], ["/settings/profile", "My profile", true],
  ] as const;
  return (
    <div className="tabs">
      {tabs.filter((t) => t[2]).map(([to, label]) => (
        <NavLink key={to} to={to} end className={({ isActive }) => `tab ${isActive ? "active" : ""}`}>{label}</NavLink>
      ))}
    </div>
  );
}

// ---------------- Organisation ----------------
function Organisation() {
  const { isAdmin, membership } = useSession();
  const qc = useQueryClient();
  const toast = useToast();
  const orgQ = useQuery({ queryKey: ["org"], queryFn: () => api.get("/api/org") });
  const membersQ = useQuery({ queryKey: ["members"], queryFn: () => api.get<any[]>("/api/members") });
  const f = useForm({ legalName: "", tradingName: "", industry: "", teamSize: "", city: "", address: "", registrationNumber: "", website: "" });
  const [transfer, setTransfer] = useState(false);
  const [target, setTarget] = useState("");
  const certInput = useRef<HTMLInputElement>(null);
  const o = orgQ.data?.org;
  const loaded = useRef(false);
  useEffect(() => {
    if (o && !loaded.current) {
      loaded.current = true;
      f.setValues({ legalName: o.legalName, tradingName: o.tradingName ?? "", industry: o.industry ?? "", teamSize: o.teamSize ?? "", city: o.city ?? "", address: o.address ?? "", registrationNumber: o.registrationNumber ?? "", website: o.website ?? "" });
    }
  }, [o]);
  if (!o) return <Loading />;
  const country = COUNTRIES.find((c) => c.code === o.country);
  const owner = (membersQ.data ?? []).find((m) => m.isOwner);
  const primary = (membersQ.data ?? []).find((m) => m.isPrimaryAdmin);
  const status = o.verificationStatus as string;
  return (
    <div className="grid-side side-360">
      <div>
        <Card title="Business details" subtitle="Used for verification, invoices and your careers page.">
          <form noValidate onSubmit={(e) => { e.preventDefault(); f.submit(async (v) => { await api.patch("/api/org/details", v); await qc.invalidateQueries({ queryKey: ["org"] }); await qc.invalidateQueries({ queryKey: ME_KEY }); toast("Business details saved"); }); }}>
            <fieldset disabled={!isAdmin} style={{ border: 0, padding: 0, margin: 0 }}>
              <div className="form-grid">
                <Input label="Registered business name" {...f.bind("legalName")} />
                <Input label="Trading name" optional {...f.bind("tradingName")} />
                <Select label="Industry" options={INDUSTRIES} {...f.bind("industry")} />
                <Select label="Team size" options={TEAM_SIZES} {...f.bind("teamSize")} />
                <Input label="Country" value={`${country?.name ?? o.country} · ${o.currency}`} disabled hint="Sets your currency. Contact support to change it." readOnly />
                <Input label="City" {...f.bind("city")} />
                <Input label="Business address" wrapClassName="span-2" {...f.bind("address")} />
                <Input label="Company registration number" {...f.bind("registrationNumber")} />
                <Input label="Website" {...f.bind("website")} />
              </div>
            </fieldset>
            {isAdmin && <div className="row" style={{ justifyContent: "flex-end", borderTop: "1px solid var(--line)", paddingTop: 16, marginTop: 18 }}><Button type="submit" loading={f.busy}>Save changes</Button></div>}
          </form>
        </Card>
        <BrandingCard org={o} />
      </div>
      <div>
        <Card title="Verification" subtitle="Usually takes 1 to 2 working days." actions={
          <Pill tone={status === "verified" ? "ok" : status === "rejected" ? "red" : "warn"}>{status === "verified" ? "Verified" : status === "rejected" ? "Not verified" : "Pending"}</Pill>
        } className={status === "pending" ? "" : ""}>
          <div className="stack" style={{ gap: 12, marginBottom: 16, fontSize: 14 }}>
            <div className="row"><Pill tone="ok">✓</Pill><span>Business details submitted<br /><small className="muted">{fmtDate(o.createdAt)}</small></span></div>
            <div className="row"><Pill tone={status === "verified" ? "ok" : "warn"}>{status === "verified" ? "✓" : "…"}</Pill><span>Checking registration details<br /><small className="muted">{status === "verified" ? "Done" : "In progress"}</small></span></div>
            <div className="row"><Pill tone={status === "verified" ? "ok" : "grey"}>{status === "verified" ? "✓" : "3"}</Pill><span>Careers page goes live<br /><small className="muted">{status === "verified" ? "Live" : "After verification"}</small></span></div>
          </div>
          {o.verificationNote && <Notice tone="info">{o.verificationNote}</Notice>}
          {isAdmin && status !== "verified" && <>
            <Button variant="secondary" block icon={<Upload size={15} />} onClick={() => certInput.current?.click()}>Upload a certificate to speed this up</Button>
            <input ref={certInput} type="file" accept=".pdf,.png,.jpg,.jpeg" hidden onChange={async (e) => {
              const file = e.target.files?.[0]; if (!file) return;
              try {
                const r = await api.upload<{ file: { id: string } }>("/api/files", file, { kind: "system" });
                await api.post("/api/org/verification-document", { fileId: r.file.id });
                toast("Thanks. We've added it to your verification.");
              } catch (err) { toast(err instanceof ApiError ? err.message : "Upload failed", "error"); }
              e.target.value = "";
            }} />
          </>}
          {import.meta.env.DEV && isAdmin && status !== "verified" && (
            <p className="field-hint" style={{ marginTop: 10 }}>Testing locally? <button className="link" onClick={async () => { await api.post("/api/dev/verify-org", { status: "verified" }); qc.invalidateQueries(); toast("Marked as verified (development only)"); }}>Mark as verified</button></p>
          )}
        </Card>
        <Card title="Ownership" subtitle="The owner and primary admin can't be removed.">
          <div className="stack" style={{ gap: 0 }}>
            <div className="list-row"><Avatar name={o.ownerName ?? owner?.name ?? "Owner"} /><div style={{ minWidth: 0, flex: 1 }}><b className="ink" style={{ display: "block" }}>{o.ownerName ?? owner?.name ?? "Not set"}</b><small className="muted">{o.ownerEmail ?? ""}</small></div><Pill>Owner</Pill></div>
            {primary && <div className="list-row"><Avatar name={primary.name} /><div style={{ minWidth: 0, flex: 1 }}><b className="ink" style={{ display: "block" }}>{primary.name}{primary.isYou && <Pill tone="blue" className="" >You</Pill>}</b><small className="muted">{primary.jobTitle ?? primary.email}</small></div><Pill>Primary admin</Pill></div>}
          </div>
          {membership.isPrimaryAdmin && <Button variant="secondary" block style={{ marginTop: 14 }} onClick={() => setTransfer(true)}>Transfer primary admin</Button>}
        </Card>
      </div>
      <Modal open={transfer} onClose={() => setTransfer(false)} title="Transfer primary admin" subtitle="The new primary admin gets full control and becomes the only person who can transfer it again."
        footer={<><Button variant="secondary" onClick={() => setTransfer(false)}>Cancel</Button><Button disabled={!target} onClick={async () => {
          try { await api.post("/api/org/transfer-primary-admin", { membershipId: target }); await qc.invalidateQueries(); setTransfer(false); toast("Primary admin transferred"); }
          catch (e) { toast(e instanceof ApiError ? e.message : "Couldn't transfer", "error"); }
        }}>Transfer</Button></>}>
        <Select label="New primary admin" placeholder="Choose a member" value={target} onChange={(e) => setTarget(e.target.value)}
          options={(membersQ.data ?? []).filter((m) => !m.isYou && m.status === "active").map((m) => ({ value: m.id, label: `${m.name} (${m.role})` }))} />
      </Modal>
    </div>
  );
}

function BrandingCard({ org }: { org: any }) {
  const { isAdmin } = useSession();
  const qc = useQueryClient();
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [color, setColor] = useState<string>(org.brandColor ?? "#1E6B47");
  const [tagline, setTagline] = useState<string>(org.tagline ?? "");
  const [about, setAbout] = useState<string>(org.about ?? "");
  const [perks, setPerks] = useState<string>((org.settings?.perks ?? []).join("\n"));
  const [logo, setLogo] = useState<string | null>(org.logoFileId);
  const [cover, setCover] = useState<string | null>(org.coverFileId);
  const save = useMutation({
    mutationFn: () => api.patch("/api/org/branding", { brandColor: color, tagline, about, logoFileId: logo, coverFileId: cover, perks: perks.split("\n").map((p) => p.trim()).filter(Boolean) }),
    onSuccess: async () => { await qc.invalidateQueries({ queryKey: ["org"] }); await qc.invalidateQueries({ queryKey: ME_KEY }); setOpen(false); toast("Branding saved"); },
    onError: (e) => toast(e instanceof ApiError ? e.message : "Couldn't save", "error"),
  });
  const pick = async (file: File | undefined, set: (id: string) => void) => {
    if (!file) return;
    try { const r = await api.upload<{ file: { id: string } }>("/api/files", file, { kind: "system" }); set(r.file.id); }
    catch (e) { toast(e instanceof ApiError ? e.message : "Upload failed", "error"); }
  };
  return (
    <Card title="Branding and careers page" subtitle="Your logo, cover and colour." actions={isAdmin && <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>Edit branding</Button>}>
      <div className="row" style={{ gap: 14 }}>
        <span style={{ width: 52, height: 52, borderRadius: 12, background: org.logoFileId ? "#fff" : org.brandColor ?? "var(--navy)", overflow: "hidden", flex: "none", border: "1px solid var(--line)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 800 }}>
          {org.logoFileId ? <img src={publicFileUrl(org.logoFileId)} alt="" style={{ width: "100%", height: "100%", objectFit: "contain" }} /> : org.name.slice(0, 1)}
        </span>
        <span style={{ flex: 1, height: 52, borderRadius: 12, background: org.coverFileId ? `url(${publicFileUrl(org.coverFileId)}) center/cover` : "var(--soft)", border: "1px solid var(--line)" }} />
        <span className="row" style={{ border: "1px solid var(--line)", borderRadius: 10, padding: "8px 12px", fontSize: 13 }}><i style={{ width: 14, height: 14, borderRadius: 4, background: org.brandColor ?? "#1E6B47" }} />{org.brandColor ?? "Not set"}</span>
      </div>
      <Modal open={open} onClose={() => setOpen(false)} title="Edit branding" size="lg"
        footer={<><Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button><Button loading={save.isPending} onClick={() => save.mutate()}>Save</Button></>}>
        <div className="stack">
          <div className="form-grid">
            <label className="field"><span className="field-label">Logo</span><input type="file" accept="image/*" onChange={(e) => pick(e.target.files?.[0], setLogo)} /></label>
            <label className="field"><span className="field-label">Cover image</span><input type="file" accept="image/*" onChange={(e) => pick(e.target.files?.[0], setCover)} /></label>
          </div>
          <label className="field"><span className="field-label">Brand colour</span><span className="row"><input type="color" value={color} onChange={(e) => setColor(e.target.value.toUpperCase())} /><span className="muted">{color}</span></span></label>
          <Input label="Tagline" value={tagline} onChange={(e) => setTagline(e.target.value)} />
          <Textarea label="About your business" value={about} onChange={(e) => setAbout(e.target.value)} />
          <Textarea label="Why work with us" hint="One perk per line. Shown on your careers page." value={perks} onChange={(e) => setPerks(e.target.value)} />
        </div>
      </Modal>
    </Card>
  );
}

// ---------------- Members ----------------
function Members() {
  const { isAdmin } = useSession();
  const qc = useQueryClient();
  const toast = useToast();
  const [view, setView] = useState<"members" | "invites">("members");
  const [q, setQ] = useState("");
  const [role, setRole] = useState("");
  const [status, setStatus] = useState("");
  const [inviteOpen, setInviteOpen] = useState(false);
  const [confirm, setConfirm] = useState<{ kind: "remove" | "suspend"; m: any } | null>(null);
  const [accessFor, setAccessFor] = useState<any | null>(null);
  const membersQ = useQuery({ queryKey: ["members"], queryFn: () => api.get<any[]>("/api/members") });
  const invitesQ = useQuery({ queryKey: ["invitations"], queryFn: () => api.get<any[]>("/api/invitations") });
  const refresh = () => { qc.invalidateQueries({ queryKey: ["members"] }); qc.invalidateQueries({ queryKey: ["invitations"] }); qc.invalidateQueries({ queryKey: ["audit"] }); };
  const act = async (fn: () => Promise<unknown>, ok: string) => {
    try { await fn(); refresh(); toast(ok); } catch (e) { toast(e instanceof ApiError ? e.message : "Something went wrong", "error"); }
  };
  const members = (membersQ.data ?? []).filter((m) =>
    (!q || `${m.name} ${m.email}`.toLowerCase().includes(q.toLowerCase())) && (!role || m.role === role) && (!status || m.status === status));
  return (
    <>
      <div className="toolbar">
        <SearchInput value={q} onChange={setQ} placeholder="Search members" />
        <select className="select chip-select" value={role} onChange={(e) => setRole(e.target.value)} aria-label="Role"><option value="">Role: All</option><option value="admin">Admin</option><option value="manager">Manager</option><option value="member">Member</option></select>
        <select className="select chip-select" value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Status"><option value="">Status: All</option><option value="active">Active</option><option value="suspended">Suspended</option></select>
        <span className="grow" />
        {isAdmin && <Button icon={<Plus size={15} />} onClick={() => setInviteOpen(true)}>Invite people</Button>}
      </div>
      <div style={{ marginBottom: 14 }}>
        <Segmented value={view} onChange={setView} options={[{ value: "members", label: `Members · ${membersQ.data?.length ?? 0}` }, { value: "invites", label: `Pending invitations · ${invitesQ.data?.length ?? 0}` }]} />
      </div>
      {view === "members" ? (
        membersQ.isLoading ? <Loading /> : (
          <div className="table-wrap">
            <table className="table">
              <thead><tr><th>Name</th><th>Role</th><th className="hide-sm">Workspace access</th><th>Status</th><th className="hide-sm">Last active</th><th /></tr></thead>
              <tbody>
                {members.map((m) => (
                  <tr key={m.id}>
                    <td><div className="cell-main"><Avatar name={m.name} /><div style={{ minWidth: 0 }}><b>{m.name} {m.isYou && <Pill>You</Pill>}</b><small>{m.email}</small></div></div></td>
                    <td>{isAdmin && !m.isPrimaryAdmin ? (
                      <select className="select chip-select" value={m.role} aria-label={`Role for ${m.name}`}
                        onChange={(e) => act(() => api.patch(`/api/members/${m.id}`, { role: e.target.value }), `${m.name} is now ${e.target.value === "admin" ? "an admin" : `a ${e.target.value}`}`)}>
                        <option value="admin">Admin</option><option value="manager">Manager</option><option value="member">Member</option>
                      </select>
                    ) : <span className="row muted" style={{ gap: 6 }}>{m.isPrimaryAdmin && <Lock size={13} />}{m.role[0].toUpperCase() + m.role.slice(1)}</span>}</td>
                    <td className="hide-sm"><div className="row" style={{ gap: 4, flexWrap: "wrap" }}>
                      {m.role === "admin" ? <Pill tone="grey">All workspaces</Pill> : WORKSPACES.filter((w) => m.access[w] !== "none").map((w) => <Pill key={w} tone="grey">{WORKSPACE_LABELS[w]}</Pill>)}
                    </div></td>
                    <td><Pill tone={m.status === "active" ? "ok" : "grey"}>{m.status === "active" ? "Active" : "Suspended"}</Pill></td>
                    <td className="hide-sm muted">{m.isYou ? "Now" : m.lastActiveAt ? timeAgo(m.lastActiveAt) : "Not yet"}</td>
                    <td style={{ width: 40 }}>{isAdmin && !m.isYou && (
                      <Menu trigger={(t) => <IconButton label={`Actions for ${m.name}`} onClick={t}><MoreHorizontal size={18} /></IconButton>}>
                        {(close) => <>
                          <button onClick={() => { close(); setAccessFor(m); }}><Shield size={16} />Edit workspace access</button>
                          <button onClick={() => { close(); act(() => api.post(`/api/members/${m.id}/password-reset`), `Reset link sent to ${m.email}`); }}><KeyRound size={16} />Send password reset</button>
                          <hr />
                          {m.status === "active"
                            ? <button disabled={m.isPrimaryAdmin} onClick={() => { close(); setConfirm({ kind: "suspend", m }); }}><Pause size={16} />Suspend access</button>
                            : <button onClick={() => { close(); act(() => api.patch(`/api/members/${m.id}`, { status: "active" }), `${m.name}'s access restored`); }}><Pause size={16} />Restore access</button>}
                          <button className="danger" disabled={m.isPrimaryAdmin} onClick={() => { close(); setConfirm({ kind: "remove", m }); }}><Trash2 size={16} />Remove from organisation</button>
                        </>}
                      </Menu>
                    )}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {members.length === 0 && <EmptyState title="No members match">Try a different search or filter.</EmptyState>}
          </div>
        )
      ) : (
        invitesQ.isLoading ? <Loading /> : (invitesQ.data ?? []).length === 0 ? <Card><EmptyState title="No pending invitations" action={isAdmin && <Button onClick={() => setInviteOpen(true)}>Invite people</Button>} /></Card> : (
          <table className="table">
            <thead><tr><th>Email</th><th>Role</th><th className="hide-sm">Invited by</th><th>Expires</th><th /></tr></thead>
            <tbody>{(invitesQ.data ?? []).map((i) => (
              <tr key={i.id}><td><b className="ink">{i.email}</b></td><td>{i.role}</td><td className="hide-sm">{i.invitedBy}</td>
                <td>{i.expired ? <Pill tone="red">Expired</Pill> : fmtDate(i.expiresAt)}</td>
                <td>{isAdmin && <div className="row" style={{ justifyContent: "flex-end" }}>
                  <Button size="sm" variant="secondary" onClick={() => act(() => api.post(`/api/invitations/${i.id}/resend`), "Invitation sent again")}>Resend</Button>
                  <IconButton label="Cancel invitation" onClick={() => act(() => api.del(`/api/invitations/${i.id}`), "Invitation cancelled")}><X size={16} /></IconButton>
                </div>}</td></tr>
            ))}</tbody>
          </table>
        )
      )}
      {isAdmin && <p className="muted row" style={{ marginTop: 14, fontSize: 13 }}><Lock size={15} />The primary admin can't be demoted or removed. Transfer primary admin in Organisation first.</p>}
      <InviteModal open={inviteOpen} onClose={() => setInviteOpen(false)} onDone={refresh} />
      {accessFor && <AccessModal member={accessFor} onClose={() => setAccessFor(null)} onSaved={refresh} />}
      <ConfirmDialog open={!!confirm} onClose={() => setConfirm(null)} danger
        title={confirm?.kind === "remove" ? `Remove ${confirm?.m.name}?` : `Suspend ${confirm?.m.name}?`}
        confirmLabel={confirm?.kind === "remove" ? "Remove" : "Suspend access"}
        onConfirm={() => {
          const c = confirm!; setConfirm(null);
          act(() => c.kind === "remove" ? api.del(`/api/members/${c.m.id}`) : api.patch(`/api/members/${c.m.id}`, { status: "suspended" }),
            c.kind === "remove" ? `${c.m.name} was removed` : `${c.m.name} was suspended and signed out`);
        }}>
        {confirm?.kind === "remove" ? "They'll lose access straight away and be signed out on every device. Their work stays in WindVeal." : "They'll be signed out on every device until you restore their access."}
      </ConfirmDialog>
    </>
  );
}

function InviteModal({ open, onClose, onDone }: { open: boolean; onClose: () => void; onDone: () => void }) {
  const toast = useToast();
  const [rows, setRows] = useState([{ email: "", role: "member" }]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const send = async () => {
    setBusy(true); setErr(null);
    try {
      const r = await api.post<{ results: { email: string; status: string }[] }>("/api/invitations", { invites: rows.filter((x) => x.email.trim()) });
      const sent = r.results.filter((x) => x.status === "sent").length;
      const skipped = r.results.filter((x) => x.status !== "sent");
      toast(`${sent} invitation${sent === 1 ? "" : "s"} sent${skipped.length ? `, ${skipped.length} skipped (already a member or invited)` : ""}`);
      setRows([{ email: "", role: "member" }]); onDone(); onClose();
    } catch (e) { setErr(e instanceof ApiError ? (e.details ? "Check the email addresses." : e.message) : "Something went wrong"); }
    finally { setBusy(false); }
  };
  return (
    <Modal open={open} onClose={onClose} title="Invite people" subtitle="They'll get an email to join. Invitations expire after 7 days."
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button loading={busy} onClick={send}>Send invites</Button></>}>
      {err && <Notice tone="error">{err}</Notice>}
      <div className="stack" style={{ gap: 10 }}>
        {rows.map((r, i) => (
          <div key={i} style={{ display: "grid", gridTemplateColumns: "minmax(0,1.6fr) minmax(0,1fr) 36px", gap: 8 }}>
            <Input type="email" placeholder="colleague@email.com" aria-label="Email" value={r.email} onChange={(e) => setRows(rows.map((x, k) => k === i ? { ...x, email: e.target.value } : x))} />
            <Select aria-label="Role" value={r.role} onChange={(e) => setRows(rows.map((x, k) => k === i ? { ...x, role: e.target.value } : x))} options={[{ value: "admin", label: "Admin" }, { value: "manager", label: "Manager" }, { value: "member", label: "Member" }]} />
            <IconButton label="Remove" onClick={() => setRows(rows.length > 1 ? rows.filter((_, k) => k !== i) : rows)}><X size={16} /></IconButton>
          </div>
        ))}
      </div>
      <button className="link row" style={{ marginTop: 12 }} onClick={() => setRows([...rows, { email: "", role: "member" }])}><Plus size={15} />Add another</button>
    </Modal>
  );
}

function AccessModal({ member, onClose, onSaved }: { member: any; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const [access, setAccess] = useState<Record<string, string>>({ ...member.access });
  return (
    <Modal open onClose={onClose} title={`Workspace access: ${member.name}`} subtitle={member.role === "admin" ? "Admins always have full access." : "Overrides the defaults for their role."}
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button disabled={member.role === "admin"} onClick={async () => {
        try { await api.patch(`/api/members/${member.id}`, { workspaceAccess: access }); onSaved(); onClose(); toast("Access updated"); }
        catch (e) { toast(e instanceof ApiError ? e.message : "Couldn't save", "error"); }
      }}>Save</Button></>}>
      <AccessMatrix value={access} onChange={setAccess} disabled={member.role === "admin"} />
    </Modal>
  );
}

const LEVEL_LABEL: Record<string, string> = { none: "None", view: "View", edit: "Edit", manage: "Manage" };
function AccessMatrix({ value, onChange, disabled }: { value: Record<string, string>; onChange: (v: Record<string, string>) => void; disabled?: boolean }) {
  return (
    <div className="table-wrap">
      <table className="table">
        <thead><tr><th>Workspace</th>{ACCESS_LEVELS.map((l) => <th key={l} style={{ textAlign: "center" }}>{LEVEL_LABEL[l]}</th>)}</tr></thead>
        <tbody>{WORKSPACES.map((w) => (
          <tr key={w}><td className="ink" style={{ fontWeight: 500 }}>{WORKSPACE_LABELS[w]}</td>
            {ACCESS_LEVELS.map((l) => <td key={l} style={{ textAlign: "center" }}>
              <input type="radio" name={`acc-${w}`} aria-label={`${WORKSPACE_LABELS[w]}: ${LEVEL_LABEL[l]}`} disabled={disabled} checked={value[w] === l} onChange={() => onChange({ ...value, [w]: l })} style={{ width: 18, height: 18, accentColor: "var(--blue)" }} />
            </td>)}</tr>
        ))}</tbody>
      </table>
    </div>
  );
}

// ---------------- Roles ----------------
const SPECIAL_LABELS: Record<string, [string, string]> = {
  approve_leave: ["Approve leave for their team", "Leave requests from people they manage."],
  see_pay: ["See salaries and pay details", "Sensitive People & HR information."],
  export_data: ["Export data", "Download reports and lists to Excel or CSV."],
  manage_billing: ["Manage billing", "Change plan and payment details."],
};
function Roles() {
  const qc = useQueryClient();
  const toast = useToast();
  const q = useQuery({ queryKey: ["roles"], queryFn: () => api.get("/api/roles") });
  const [sel, setSel] = useState("manager");
  const [access, setAccess] = useState<Record<string, string>>({});
  const [special, setSpecial] = useState<string[]>([]);
  const role = q.data?.roles.find((r: any) => r.key === sel);
  useEffect(() => { if (role) { setAccess({ ...role.access }); setSpecial([...role.special]); } }, [role?.key, q.data]);
  if (!q.data) return <Loading />;
  const label = (k: string) => k[0]!.toUpperCase() + k.slice(1);
  const desc: Record<string, string> = { admin: "Full access to everything", manager: "Runs a team's work", member: "Works in assigned workspaces" };
  return (
    <div className="grid-side side-left-260">
      <Card flush className="">
        <div style={{ padding: 8 }}>
          {q.data.roles.map((r: any) => (
            <button key={r.key} onClick={() => setSel(r.key)} className="between" style={{ width: "100%", padding: "12px 14px", borderRadius: 11, border: 0, cursor: "pointer", background: sel === r.key ? "var(--pale)" : "transparent", textAlign: "left" }}>
              <span><b className="ink" style={{ display: "block" }}>{label(r.key)}</b><small className="muted">{desc[r.key]}</small></span><Pill tone="grey">{r.count}</Pill>
            </button>
          ))}
          <div className="between" style={{ padding: "12px 14px", borderTop: "1px solid var(--line)", marginTop: 6, color: "var(--muted)", fontSize: 14 }}>
            <span className="row" style={{ gap: 6 }}><Plus size={15} />Create custom role</span><Pill tone="blue">Growth</Pill>
          </div>
        </div>
      </Card>
      <div>
        <Card title={label(sel)} subtitle={sel === "admin" ? "Admins can see and do everything. This role can't be changed." : `What ${sel}s can see and do in each workspace. ${role?.count ?? 0} people have this role.`}>
          <AccessMatrix value={access} onChange={setAccess} disabled={!role?.editable} />
        </Card>
        <Card title="Special permissions" subtitle="Extra abilities on top of workspace access.">
          {SPECIAL_PERMISSIONS.map((p) => (
            <div key={p} className="list-row" style={{ justifyContent: "space-between" }}>
              <div><b className="ink" style={{ display: "block" }}>{SPECIAL_LABELS[p]![0]}</b><small className="muted">{SPECIAL_LABELS[p]![1]}</small></div>
              <Switch label={SPECIAL_LABELS[p]![0]} disabled={!role?.editable} checked={special.includes(p)} onChange={(v) => setSpecial(v ? [...special, p] : special.filter((x) => x !== p))} />
            </div>
          ))}
          {role?.editable && <div className="row" style={{ justifyContent: "flex-end", borderTop: "1px solid var(--line)", paddingTop: 16, marginTop: 8 }}>
            <Button onClick={async () => {
              try { await api.put(`/api/roles/${sel}`, { access, special }); await qc.invalidateQueries(); toast("Role saved"); }
              catch (e) { toast(e instanceof ApiError ? e.message : "Couldn't save", "error"); }
            }}>Save changes</Button>
          </div>}
        </Card>
      </div>
    </div>
  );
}

// ---------------- Billing ----------------
function Billing() {
  const { org, hasSpecial } = useSession();
  const storage = useQuery({ queryKey: ["storage"], queryFn: () => api.get("/api/storage") });
  const members = useQuery({ queryKey: ["members"], queryFn: () => api.get<any[]>("/api/members") });
  const [billing, setBilling] = useState<"monthly" | "yearly">("yearly");
  const [upgrade, setUpgrade] = useState<string | null>(null);
  const prices = PLAN_PRICES[org.currency] ?? PLAN_PRICES.USD!;
  const price = (p: "growth" | "pro") => formatMoney(billing === "yearly" ? prices[p] * 10 / 12 : prices[p], org.currency);
  const planName = org.plan[0]!.toUpperCase() + org.plan.slice(1);
  return (
    <>
      <Card>
        <div className="grid-2">
          <div>
            <p className="muted" style={{ fontSize: 13, fontWeight: 600 }}>Current plan</p>
            <p style={{ fontFamily: "var(--display)", fontSize: 28, fontWeight: 800, color: "var(--ink)" }}>{planName} <span className="muted" style={{ fontSize: 14, fontWeight: 500, fontFamily: "var(--font)" }}>{org.plan === "free" ? `${formatMoney(0, org.currency)} per month` : ""}</span></p>
            <p style={{ margin: "6px 0 14px" }}>{org.plan === "free" ? "All six workspaces and 5 GB storage. No AI." : "Thanks for supporting WindVeal."}</p>
          </div>
          <div className="stack" style={{ gap: 14 }}>
            <div><div className="between" style={{ fontSize: 13.5, marginBottom: 6 }}><span>Storage</span><b className="ink">{storage.data ? `${formatBytes(storage.data.used)} of ${formatBytes(storage.data.limit)}` : "…"}</b></div><Progress value={storage.data ? (storage.data.used / storage.data.limit) * 100 : 0} /></div>
            <div className="between" style={{ fontSize: 13.5 }}><span>WindVeal AI requests this month</span><b className="ink">{org.plan === "free" ? "Not included" : "0"}</b></div>
            <div className="between" style={{ fontSize: 13.5 }}><span>Team members</span><b className="ink">{members.data?.length ?? "…"} · no limit</b></div>
          </div>
        </div>
      </Card>
      <Card title="Upgrade for more space and AI" subtitle={`Prices in ${org.currency}. Switch any time.`} actions={<Segmented value={billing} onChange={setBilling} options={[{ value: "monthly", label: "Monthly" }, { value: "yearly", label: "Yearly" }]} />}>
        <div className="grid-2">
          {(["growth", "pro"] as const).map((p) => (
            <div key={p} style={{ border: `1.5px solid ${p === "growth" ? "var(--blue)" : "var(--line)"}`, borderRadius: 16, padding: 20 }}>
              <div className="between"><h4 style={{ fontSize: 17 }}>{p === "growth" ? "Growth" : "Pro"}</h4>{p === "growth" && <Pill>Popular</Pill>}</div>
              <p style={{ fontFamily: "var(--display)", fontSize: 24, fontWeight: 800, color: "var(--ink)", margin: "6px 0 2px" }}>{price(p)} <small className="muted" style={{ fontSize: 13, fontFamily: "var(--font)", fontWeight: 500 }}>per month{billing === "yearly" ? ", billed yearly" : ""}</small></p>
              <ul style={{ paddingLeft: 18, margin: "12px 0 16px", fontSize: 13.5 }}>
                {p === "growth" ? <><li>50 GB storage</li><li>WindVeal AI: 200 requests a month</li><li>Custom roles and permissions</li></> : <><li>100 GB storage</li><li>WindVeal AI: 1,000 requests a month</li><li>Advanced reports and exports</li></>}
              </ul>
              <Button block variant={p === "growth" ? "primary" : "secondary"} disabled={!hasSpecial("manage_billing")} onClick={() => setUpgrade(p)}>Upgrade to {p === "growth" ? "Growth" : "Pro"}</Button>
            </div>
          ))}
        </div>
        <div className="ent-row" style={{ marginTop: 14 }}><div><b className="ink" style={{ fontFamily: "var(--display)", fontSize: 16, display: "block" }}>Enterprise</b>Storage, AI and support built around your organisation.</div><a className="btn btn-secondary" href={`mailto:${CONTACT_EMAIL}`}>Talk to us</a></div>
      </Card>
      <div className="grid-2">
        <Card title="Payment method" subtitle="Added when you upgrade."><EmptyState title="No payment method">{org.plan === "free" ? "You're on the Free plan." : ""}</EmptyState></Card>
        <Card title="Invoices" subtitle="Download receipts for your records."><EmptyState title="No invoices yet">Invoices will appear here after you upgrade.</EmptyState></Card>
      </div>
      <Modal open={!!upgrade} onClose={() => setUpgrade(null)} title="Online payments are coming soon" footer={<Button onClick={() => setUpgrade(null)}>OK</Button>}>
        <p>Card and bank payments for {org.currency} will be added before launch. To upgrade now, email <a className="link" href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> and we'll set it up for you.</p>
      </Modal>
    </>
  );
}

// ---------------- Audit ----------------
function Audit() {
  const [q, setQ] = useState("");
  const [category, setCategory] = useState("");
  const [days, setDays] = useState("30");
  const members = useQuery({ queryKey: ["members"], queryFn: () => api.get<any[]>("/api/members") });
  const [actor, setActor] = useState("");
  const params = new URLSearchParams({ days, ...(q ? { q } : {}), ...(category ? { category } : {}), ...(actor ? { actor } : {}) });
  const audit = useQuery({ queryKey: ["audit", params.toString()], queryFn: () => api.get<{ items: any[] }>(`/api/audit?${params}`) });
  const items = audit.data?.items ?? [];
  const groups = new Map<string, any[]>();
  for (const i of items) {
    const d = new Date(i.createdAt); const today = new Date();
    const key = d.toDateString() === today.toDateString() ? "Today" : d.toDateString() === new Date(Date.now() - 86_400_000).toDateString() ? "Yesterday" : fmtDate(d);
    groups.set(key, [...(groups.get(key) ?? []), i]);
  }
  const chip: Record<string, [string, "red" | "warn" | "blue"]> = { access: ["Access", "red"], sync: ["Sync", "warn"], settings: ["Settings", "blue"] };
  return (
    <>
      <div className="toolbar">
        <SearchInput value={q} onChange={setQ} placeholder="Search activity" />
        <select className="select chip-select" value={actor} onChange={(e) => setActor(e.target.value)} aria-label="Person"><option value="">Person: All</option>{(members.data ?? []).map((m) => <option key={m.userId} value={m.userId}>{m.name}</option>)}</select>
        <select className="select chip-select" value={category} onChange={(e) => setCategory(e.target.value)} aria-label="Type"><option value="">Type: All</option><option value="access">Access</option><option value="data">Data</option><option value="settings">Settings</option></select>
        <select className="select chip-select" value={days} onChange={(e) => setDays(e.target.value)} aria-label="Range"><option value="7">Last 7 days</option><option value="30">Last 30 days</option><option value="90">Last 90 days</option><option value="365">Last year</option></select>
        <span className="grow" />
        <a className="btn btn-secondary" href={`/api/audit?${params}&format=csv`}><Download size={15} />Export</a>
      </div>
      {audit.isLoading ? <Loading /> : items.length === 0 ? <Card><EmptyState title="No activity in this period" /></Card> : [...groups.entries()].map(([day, rows]) => (
        <div key={day}>
          <p className="section-label" style={{ margin: "16px 0 8px" }}>{day}</p>
          <div className="card card-flush">
            {rows.map((i) => (
              <div key={i.id} className="list-row" style={{ padding: "12px 18px", borderTop: "1px solid var(--line)" }}>
                <span className="muted hide-sm" style={{ width: 48, fontSize: 12.5 }}>{new Date(i.createdAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}</span>
                <Avatar name={i.actor?.name ?? "?"} size={30} />
                <span style={{ flex: 1, minWidth: 0 }}>{i.summary}{chip[i.category] && <Pill tone={chip[i.category]![1]} className="" >{chip[i.category]![0]}</Pill>}</span>
                <span className="muted hide-sm" style={{ fontSize: 12.5 }}>{i.device ?? ""}</span>
              </div>
            ))}
          </div>
        </div>
      ))}
      <p className="muted row" style={{ marginTop: 14, fontSize: 13 }}><Lock size={15} />Audit history can't be edited or deleted.</p>
    </>
  );
}

// ---------------- Profile ----------------
function Profile() {
  const { user } = useSession();
  const qc = useQueryClient();
  const toast = useToast();
  const navigate = useNavigate();
  const nameF = useForm({ name: user.name });
  const pwF = useForm({ currentPassword: "", password: "" });
  const devices = useQuery({ queryKey: ["devices"], queryFn: () => api.get<any[]>("/api/auth/devices") });
  return (
    <div className="grid-2">
      <div>
        <Card title="Your details">
          <form className="stack" onSubmit={(e) => { e.preventDefault(); nameF.submit(async (v) => { qc.setQueryData(ME_KEY, await api.patch("/api/auth/profile", v)); toast("Saved"); }); }}>
            <Input label="Full name" {...nameF.bind("name")} />
            <Input label="Email" value={user.email} disabled readOnly hint="Contact your admin to change your email." />
            <div><Button type="submit" loading={nameF.busy}>Save</Button></div>
          </form>
        </Card>
        <Card title="Change password" subtitle="You'll stay signed in here and be signed out everywhere else.">
          <form className="stack" onSubmit={(e) => { e.preventDefault(); pwF.submit(async (v) => { await api.post("/api/auth/change-password", v); pwF.setValues({ currentPassword: "", password: "" }); toast("Password changed"); }); }}>
            {pwF.formError && !Object.keys(pwF.errors).length && <Notice tone="error">{pwF.formError}</Notice>}
            <Input label="Current password" type="password" autoComplete="current-password" {...pwF.bind("currentPassword")} />
            <Input label="New password" type="password" autoComplete="new-password" hint="At least 10 characters with a number, an uppercase letter and a symbol." {...pwF.bind("password")} />
            <div><Button type="submit" loading={pwF.busy}>Change password</Button></div>
          </form>
        </Card>
      </div>
      <Card title="Your devices" subtitle="Where you're signed in to WindVeal." actions={<Button variant="danger" size="sm" onClick={async () => { await api.post("/api/auth/logout-all"); qc.clear(); navigate("/sign-in"); }}>Sign out everywhere</Button>}>
        {devices.isLoading ? <Loading /> : (devices.data ?? []).map((d) => (
          <div key={d.id} className="list-row"><Clock size={18} className="muted" /><div style={{ flex: 1 }}><b className="ink" style={{ display: "block" }}>{d.label}{d.current && <> <Pill tone="ok">This device</Pill></>}</b><small className="muted">Last active {timeAgo(d.lastSeenAt)}</small></div>{d.blocked && <Pill tone="red">Blocked</Pill>}</div>
        ))}
      </Card>
    </div>
  );
}

export function SettingsRoutes() {
  const { org, isAdmin } = useSession();
  useEffect(() => { document.title = "Settings · WindVeal"; }, []);
  return (
    <>
      <PageHeader title="Settings" subtitle={`Manage ${org.name}, your team and your plan.`} />
      <SettingsTabs />
      <Routes>
        <Route index element={<Organisation />} />
        <Route path="members" element={<Members />} />
        <Route path="roles" element={isAdmin ? <Roles /> : <Navigate to="/settings" replace />} />
        <Route path="billing" element={<Billing />} />
        <Route path="audit" element={isAdmin ? <Audit /> : <Navigate to="/settings" replace />} />
        <Route path="profile" element={<Profile />} />
        <Route path="*" element={<Navigate to="/settings" replace />} />
      </Routes>
    </>
  );
}
