import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { CalendarDays } from "lucide-react";
import { Card, EmptyState, Loading, Notice, Pill, Select } from "@windveal/ui";
import { api, qs } from "../../lib/api";
import { fmtDate, fmtTime } from "../../lib/format";
import { MODE_LABEL, keys, type InterviewListItem } from "./data";
import { ScorecardForm } from "./widgets";

function dayHeading(iso: string) {
  const d = new Date(iso);
  const t = new Date();
  const same = d.toDateString() === t.toDateString();
  const label = d.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "short" });
  return same ? `Today, ${d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })}` : label;
}

export function InterviewsTab() {
  const [params, setParams] = useSearchParams();
  const [range, setRange] = useState("week");
  const [who, setWho] = useState("me");
  const query = qs({ range, interviewer: who === "me" ? "me" : "" });
  const list = useQuery({ queryKey: keys.interviews(query), queryFn: () => api.get<{ items: InterviewListItem[] }>(`/api/recruitment/interviews${query}`), placeholderData: (p) => p });
  const items = list.data?.items ?? [];
  const selectedId = params.get("interview");
  const selected = items.find((i) => i.id === selectedId) ?? null;

  useEffect(() => {
    // Pick the first interview you're on when nothing is selected (desktop only, so mobile stays a list).
    if (!selectedId && items.length && window.matchMedia("(min-width: 901px)").matches) {
      const first = items.find((i) => i.isInterviewer && !i.myScorecard?.submittedAt) ?? items.find((i) => i.isInterviewer);
      if (first) setParams({ interview: first.id }, { replace: true });
    }
  }, [items, selectedId, setParams]);

  const groups = useMemo(() => {
    const g: { day: string; items: InterviewListItem[] }[] = [];
    for (const i of items) {
      const day = new Date(i.scheduledAt).toDateString();
      const last = g[g.length - 1];
      if (last?.day === day) last.items.push(i); else g.push({ day, items: [i] });
    }
    return g;
  }, [items]);

  return (
    <div className="grid-side rc-iv">
      <div>
        <div className="toolbar">
          <Select className="chip-select" aria-label="When" value={range} onChange={(e) => setRange(e.target.value)}
            options={[{ value: "week", label: "This week" }, { value: "next_week", label: "Next week" }, { value: "upcoming", label: "Next 60 days" }]} />
          <Select className="chip-select" aria-label="Interviewer" value={who} onChange={(e) => setWho(e.target.value)}
            options={[{ value: "me", label: "Interviewer: Me" }, { value: "all", label: "Interviewer: Anyone" }]} />
        </div>
        {list.isLoading ? <Loading /> : list.isError ? <Notice tone="error">{(list.error as Error).message}</Notice> : !items.length ? (
          <div className="card">
            <EmptyState icon={<CalendarDays size={24} />} title="No interviews">
              {who === "me" ? "You're not interviewing anyone in this period." : "Nothing scheduled in this period."} Schedule interviews from a candidate's profile.
            </EmptyState>
          </div>
        ) : groups.map((g) => (
          <div key={g.day} className="rc-iv-group">
            <div className="section-label">{dayHeading(g.items[0]!.scheduledAt)}</div>
            {g.items.map((i) => (
              <button key={i.id} className={`rc-iv-row ${selected?.id === i.id ? "on" : ""} ${i.status === "cancelled" ? "cancelled" : ""}`}
                onClick={() => setParams({ interview: i.id })}>
                <div className="rc-up-time"><b>{fmtTime(i.scheduledAt)}</b><small>{i.durationMinutes} min</small></div>
                <div style={{ flex: 1, minWidth: 0, textAlign: "left" }}>
                  <b className="ink">{i.candidateName}</b>
                  <small className="muted" style={{ display: "block" }}>
                    {i.jobTitle} · {i.title.toLowerCase()}{who !== "me" || !i.isInterviewer ? ` · with ${i.interviewers.map((x) => x.name).join(", ")}` : ""}
                  </small>
                </div>
                <div className="rc-iv-tags">
                  {i.myScorecard?.submittedAt && <Pill tone="ok">Submitted</Pill>}
                  {i.status === "completed" && !i.myScorecard?.submittedAt && <Pill tone="grey">Done</Pill>}
                  <Pill tone="blue">{MODE_LABEL[i.mode]}</Pill>
                </div>
              </button>
            ))}
          </div>
        ))}
      </div>
      <div className={`rc-iv-panel ${selected ? "open" : ""}`}>
        {selected ? (
          <Card>
            <div className="rc-sc-head">
              <h3>Scorecard: {selected.candidateName}</h3>
              <p className="muted">{selected.jobTitle} · {selected.title.toLowerCase()} · {fmtDate(selected.scheduledAt, { day: "numeric", month: "short" })} {fmtTime(selected.scheduledAt)}</p>
              <div className="row" style={{ gap: 14 }}>
                <Link to={`/recruitment/applications/${selected.applicationId}`} className="btn btn-ghost">Open profile</Link>
                <button className="btn btn-ghost rc-only-sm" onClick={() => setParams({})}>Back to list</button>
              </div>
            </div>
            {selected.isInterviewer ? (
              <ScorecardForm key={selected.id} applicationId={selected.applicationId} interviewId={selected.id} initial={selected.myScorecard} />
            ) : <Notice tone="info">You're not an interviewer for this one, so there's no scorecard to fill in.</Notice>}
          </Card>
        ) : items.length ? <Card><p className="muted">Choose an interview to give feedback.</p></Card> : null}
      </div>
    </div>
  );
}
