import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Users } from "lucide-react";
import { Avatar, EmptyState, Loading, Notice, Pill, SearchInput, Select } from "@windveal/ui";
import { api, qs } from "../../lib/api";
import { fmtDate } from "../../lib/format";
import { keys, type AppRow, type Job } from "./data";

export function CandidatesTab() {
  const nav = useNavigate();
  const [q, setQ] = useState("");
  const [stage, setStage] = useState("");
  const [jobId, setJobId] = useState("");
  const [status, setStatus] = useState("active");
  const params = qs({ q: q.trim(), stage, jobId, status });
  const rows = useQuery({ queryKey: keys.apps(params), queryFn: () => api.get<AppRow[]>(`/api/recruitment/applications${params}`), placeholderData: (p) => p });
  const jobs = useQuery({ queryKey: keys.jobs("?status=all"), queryFn: () => api.get<Job[]>("/api/recruitment/jobs") });
  const stages = Array.from(new Set((jobs.data ?? []).filter((j) => !jobId || j.id === jobId).flatMap((j) => j.stages)));

  return (
    <>
      <div className="toolbar">
        <SearchInput value={q} onChange={setQ} placeholder="Search by name, email or job" />
        <Select className="chip-select" aria-label="Job" value={jobId} onChange={(e) => { setJobId(e.target.value); setStage(""); }}
          options={[{ value: "", label: "Job: All" }, ...(jobs.data ?? []).map((j) => ({ value: j.id, label: j.title }))]} />
        <Select className="chip-select" aria-label="Stage" value={stage} onChange={(e) => setStage(e.target.value)}
          options={[{ value: "", label: "Stage: All" }, ...stages.map((s) => ({ value: s, label: s }))]} />
        <Select className="chip-select" aria-label="Status" value={status} onChange={(e) => setStatus(e.target.value)}
          options={[{ value: "active", label: "Active" }, { value: "hired", label: "Hired" }, { value: "rejected", label: "Rejected" }, { value: "all", label: "Everyone" }]} />
      </div>
      {rows.isLoading ? <Loading /> : rows.isError ? <Notice tone="error">{(rows.error as Error).message}</Notice> : !rows.data?.length ? (
        <div className="card">
          <EmptyState icon={<Users size={24} />} title={q || stage || jobId || status !== "active" ? "No candidates match" : "No active candidates"}>
            {q || stage || jobId ? "Try a different search or filter." : "Candidates appear here when they apply or you add them to a job."}
          </EmptyState>
        </div>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead><tr><th>Candidate</th><th>Job</th><th>Stage</th><th className="hide-sm">Source</th><th className="hide-sm">Applied</th></tr></thead>
            <tbody>
              {rows.data.map((r) => (
                <tr key={r.id} className="clickable" onClick={() => nav(`/recruitment/applications/${r.id}`)}>
                  <td><div className="cell-main"><Avatar name={r.name} size={32} /><div style={{ minWidth: 0 }}><b>{r.name}</b><small>{r.email}</small></div></div></td>
                  <td>{r.jobTitle}</td>
                  <td>{r.hiredAt ? <Pill tone="ok">Hired</Pill> : r.rejectedAt ? <Pill tone="red">Rejected</Pill> : <Pill tone="blue">{r.stage}</Pill>}
                    {!r.hiredAt && !r.rejectedAt && <small className="muted rc-days">{r.daysInStage}d</small>}</td>
                  <td className="hide-sm">{r.source}</td>
                  <td className="hide-sm">{fmtDate(r.appliedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
