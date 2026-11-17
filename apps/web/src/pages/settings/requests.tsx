import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil } from "lucide-react";
import { Button, Card, Loading, useToast } from "@windveal/ui";
import { REQUEST_KINDS, REQUEST_LABELS, type RequestKind } from "@windveal/shared";
import { api, ApiError } from "../../lib/api";
import { useMembers } from "../../modules/workflows/tasks";

/**
 * Settings › Requests: who handles each kind of staff request. Left unset, a request goes to the person's
 * manager. Expense claims always go to the manager first; the person chosen here pays approved ones.
 */
export function RequestSettings() {
  const qc = useQueryClient();
  const toast = useToast();
  const members = useMembers();
  const q = useQuery({ queryKey: ["requests", "handlers"], queryFn: () => api.get<{ handlers: Record<RequestKind, string | null> }>("/api/requests/handlers") });
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const reset = () => setDraft(Object.fromEntries(Object.entries(q.data?.handlers ?? {}).map(([k, v]) => [k, v ?? ""])));
  useEffect(reset, [q.data]); // eslint-disable-line react-hooks/exhaustive-deps
  const save = useMutation({
    mutationFn: () => api.put("/api/requests/handlers", { handlers: Object.fromEntries(REQUEST_KINDS.map((k) => [k, draft[k] || null])) }),
    onSuccess: () => { void qc.invalidateQueries({ queryKey: ["requests"] }); toast("Saved"); setEditing(false); },
    onError: (e) => toast(e instanceof ApiError ? e.message : "Couldn't save", "error"),
  });
  if (q.isLoading || members.isLoading) return <Loading />;
  const nameOf = (id: string) => members.data?.find((m) => m.id === id)?.name ?? "Someone who left";
  return (
    <Card title="Who handles requests"
      subtitle="When nobody is chosen, a request goes to the person's manager. Expense claims always go to the manager first; the person chosen here pays the approved ones."
      actions={editing
        ? <><Button variant="secondary" onClick={() => { reset(); setEditing(false); }}>Cancel</Button><Button loading={save.isPending} onClick={() => save.mutate()}>Save</Button></>
        : <Button icon={<Pencil size={15} />} onClick={() => setEditing(true)}>Edit</Button>}>
      {REQUEST_KINDS.map((k) => (
        <div key={k} className="list-row">
          <div className="grow"><b className="ink">{k === "expense" ? "Paying expense claims" : REQUEST_LABELS[k].name}</b><small className="muted" style={{ display: "block" }}>{REQUEST_LABELS[k].hint}</small></div>
          {editing ? (
            <select className="select" style={{ width: 240 }} aria-label={`Who handles ${REQUEST_LABELS[k].name}`} value={draft[k] ?? ""} onChange={(e) => setDraft({ ...draft, [k]: e.target.value })}>
              <option value="">{k === "expense" ? "An admin" : "Their manager"}</option>
              {(members.data ?? []).map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          ) : <span className={draft[k] ? "ink" : "muted"}>{draft[k] ? nameOf(draft[k]!) : k === "expense" ? "An admin" : "Their manager"}</span>}
        </div>
      ))}
    </Card>
  );
}
