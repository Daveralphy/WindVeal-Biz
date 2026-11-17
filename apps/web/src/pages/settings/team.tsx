import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Avatar, Button, Card, EmptyState, Loading, Modal, Pill, Segmented, useToast } from "@windveal/ui";
import { ACCESS_LEVELS, PERSONAL_AREAS, PERSONAL_LABELS, WORKSPACES, WORKSPACE_LABELS, type AccessLevel, type Area } from "@windveal/shared";
import { api, ApiError } from "../../lib/api";
import { PersonalRow } from "./access";

type Person = { id: string; name: string; jobTitle: string | null; department: string | null; roleName: string | null; access: Record<Area, AccessLevel> };
type Team = { departments: string[]; mine: Record<Area, AccessLevel>; people: Person[] };
const LEVEL: Record<AccessLevel, string> = { none: "None", view: "View", edit: "Edit", manage: "Manage" };
const rank = (l: AccessLevel) => ACCESS_LEVELS.indexOf(l);

/** One person: what they can open, and the choices the lead may make (up to the lead's own level). */
function EditPerson({ p, mine, onClose }: { p: Person; mine: Record<Area, AccessLevel>; onClose: () => void }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [access, setAccess] = useState<Record<Area, AccessLevel>>({ ...p.access });
  const save = useMutation({
    mutationFn: () => api.patch(`/api/team-access/${p.id}`, { access: Object.fromEntries(Object.entries(access).filter(([a, l]) => l !== p.access[a as Area])) }),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ["team-access"] }); toast(`${p.name}'s access saved`); onClose(); },
    onError: (e) => toast(e instanceof ApiError ? e.message : "Couldn't save", "error"),
  });
  const workspaces = WORKSPACES.filter((w) => mine[w] !== "none" || p.access[w] !== "none");
  return (
    <Modal open onClose={onClose} title={p.name} subtitle={[p.jobTitle, p.roleName ? `role: ${p.roleName}` : null].filter(Boolean).join(" · ")}
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button loading={save.isPending} onClick={() => save.mutate()}>Save</Button></>}>
      <div className="section-label">My Workspace</div>
      {PERSONAL_AREAS.map((a) => (
        <PersonalRow key={a} a={a} on={access[a] !== "none"} editing disabled={mine[a] === "none"}
          onChange={(v) => setAccess({ ...access, [a]: v ? "view" : "none" })} />
      ))}
      <div className="section-label" style={{ marginTop: 16 }}>Workspaces</div>
      {!workspaces.length ? <p className="muted">You can only give workspaces you have yourself, and you don't have any yet.</p> : workspaces.map((w) => {
        const top = mine[w];
        const locked = rank(p.access[w]) > rank(top);
        return (
          <div key={w} className="ac-row">
            <div><b>{WORKSPACE_LABELS[w]}</b><small>{locked ? `${p.name.split(" ")[0]} has more than you can give. Ask an admin to change it.` : `Up to ${LEVEL[top].toLowerCase()}, your own level.`}</small></div>
            <div className="ac-right">
              {locked ? <Pill>{LEVEL[p.access[w]]}</Pill> : <Segmented value={access[w]} onChange={(v) => setAccess({ ...access, [w]: v as AccessLevel })}
                options={ACCESS_LEVELS.filter((l) => rank(l) <= rank(top)).map((l) => ({ value: l, label: LEVEL[l] }))} />}
            </div>
          </div>
        );
      })}
    </Modal>
  );
}

/**
 * Settings › Team access: a department's leader gives (or takes away) platforms for their team, up to their
 * own level. Admins give anything to anyone in Members and Roles.
 */
export function TeamAccess() {
  const q = useQuery({ queryKey: ["team-access"], queryFn: () => api.get<Team>("/api/team-access") });
  const [open, setOpen] = useState<Person | null>(null);
  if (q.isLoading) return <Loading />;
  if (!q.data) return <EmptyState title="You don't lead a team">Team leads give their team access here.</EmptyState>;
  const { people, mine, departments } = q.data;
  const onCount = (p: Person) => WORKSPACES.filter((w) => p.access[w] !== "none").map((w) => WORKSPACE_LABELS[w]);
  return (
    <>
      <Card title={`Your team: ${departments.join(", ")}`} subtitle="Give the people you lead what they need, up to your own level. Admins can give more." flush={!!people.length}>
        {!people.length ? <EmptyState title="No one to give access to yet">People in your department who use WindVeal show here.</EmptyState> : people.map((p) => {
          const ws = onCount(p);
          const off = PERSONAL_AREAS.filter((a) => p.access[a] === "none").map((a) => PERSONAL_LABELS[a]);
          return (
            <button key={p.id} className="list-row rq-row" onClick={() => setOpen(p)}>
              <Avatar name={p.name} size={36} />
              <span className="grow"><b className="ink">{p.name}</b>
                <small className="muted">{[p.jobTitle, ws.length ? ws.join(", ") : "My Workspace only", off.length ? `${off.join(", ")} off` : null].filter(Boolean).join(" · ")}</small></span>
              <span className="btn btn-secondary btn-sm">Change</span>
            </button>
          );
        })}
      </Card>
      {open && <EditPerson p={open} mine={mine} onClose={() => setOpen(null)} />}
    </>
  );
}
