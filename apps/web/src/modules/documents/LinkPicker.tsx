import { useEffect, useState, type ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { Briefcase, CircleCheck, Link2, UserRound, X } from "lucide-react";
import { api, qs } from "../../lib/api";
import "./linkpicker.css";

export type LinkTarget = { type: string; id: string; label: string; sub: string };

export const LINK_ICON: Record<string, ReactNode> = {
  company: <Briefcase size={15} />, deal: <Briefcase size={15} />, lead: <Briefcase size={15} />,
  employee: <UserRound size={15} />, application: <UserRound size={15} />, task: <CircleCheck size={15} />, job: <Briefcase size={15} />,
};

function useDebounced<T>(value: T, ms = 250): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

/** Search-as-you-type picker for a record to link to (companies, deals, employees, tasks). */
export function LinkPicker({ value, onChange, endpoint, placeholder = "Search clients, deals, people or tasks", exclude }: {
  value: LinkTarget | null; onChange: (t: LinkTarget | null) => void; endpoint: string; placeholder?: string; exclude?: string[];
}) {
  const [text, setText] = useState("");
  const q = useDebounced(text.trim());
  const { data, isFetching, isError } = useQuery({
    queryKey: ["link-targets", endpoint, q],
    queryFn: () => api.get<LinkTarget[]>(`${endpoint}${qs({ q })}`),
    enabled: q.length > 0 && !value,
  });
  if (value) {
    return (
      <div className="lp-chosen">
        <span className="lp-ic">{LINK_ICON[value.type] ?? <Link2 size={15} />}</span>
        <span className="lp-text"><b>{value.label}</b><small>{value.sub}</small></span>
        <button type="button" className="icon-btn" aria-label="Remove link" onClick={() => onChange(null)}><X size={16} /></button>
      </div>
    );
  }
  const results = (data ?? []).filter((r) => !exclude?.includes(`${r.type}:${r.id}`));
  return (
    <div className="lp">
      <input className="input" value={text} onChange={(e) => setText(e.target.value)} placeholder={placeholder} aria-label="Link to" />
      {q.length > 0 && (
        <div className="lp-results" role="listbox">
          {isFetching && !data ? <div className="lp-note">Searching…</div>
            : isError ? <div className="lp-note">Couldn't search right now. Try again.</div>
            : results.length === 0 ? <div className="lp-note">Nothing matches "{q}".</div>
            : results.map((r) => (
              <button type="button" role="option" aria-selected={false} key={`${r.type}:${r.id}`} onClick={() => { onChange(r); setText(""); }}>
                <span className="lp-ic">{LINK_ICON[r.type] ?? <Link2 size={15} />}</span>
                <span className="lp-text"><b>{r.label}</b><small>{r.sub}</small></span>
              </button>
            ))}
        </div>
      )}
    </div>
  );
}
