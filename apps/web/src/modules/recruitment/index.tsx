import { Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { Globe, Plus } from "lucide-react";
import { Button, EmptyState, PageHeader, Tabs } from "@windveal/ui";
import { useSession } from "../../lib/session";
import { useStats } from "./data";
import { JobsPage } from "./JobsPage";
import { JobFormPage } from "./JobForm";
import { PipelinePage } from "./Pipeline";
import { CandidatePage } from "./CandidatePage";
import { CandidatesTab } from "./CandidatesTab";
import { InterviewsTab } from "./InterviewsTab";
import { CareersTab } from "./CareersTab";
import "./recruitment.css";

function tabFor(path: string) {
  const rest = path.replace(/^\/recruitment\/?/, "");
  if (rest.startsWith("candidates") || rest.startsWith("applications")) return "candidates";
  if (rest.startsWith("interviews")) return "interviews";
  if (rest.startsWith("careers")) return "careers";
  return "jobs";
}

export default function RecruitmentModule() {
  const { can } = useSession();
  const nav = useNavigate();
  const loc = useLocation();
  const stats = useStats();
  const s = stats.data;

  if (!can("recruitment", "view")) {
    return (
      <>
        <PageHeader title="Recruitment" />
        <EmptyState title="You don't have access to Recruitment">Ask an admin if you need to see jobs and candidates.</EmptyState>
      </>
    );
  }

  const tab = tabFor(loc.pathname);
  const go = (k: string) => nav(k === "jobs" ? "/recruitment" : `/recruitment/${k}`);

  return (
    <div className="rc">
      <PageHeader
        title="Recruitment"
        subtitle={s ? `${s.openRoles} open role${s.openRoles === 1 ? "" : "s"} · ${s.activeCandidates} active candidate${s.activeCandidates === 1 ? "" : "s"}` : " "}
        actions={<>
          <Button variant="secondary" className="hide-sm" icon={<Globe size={16} />} onClick={() => nav("/recruitment/careers")}>Careers page</Button>
          {can("recruitment", "edit") && <Button className="rc-block-sm" icon={<Plus size={16} />} onClick={() => nav("/recruitment/jobs/new")}>New job</Button>}
        </>}
      />
      <Tabs value={tab} onChange={go} items={[
        { key: "jobs", label: "Jobs" },
        { key: "candidates", label: "Candidates" },
        { key: "interviews", label: "Interviews", count: s?.myUpcomingInterviews || s?.interviewsThisWeek || 0 },
        { key: "careers", label: "Careers page" },
      ]} />
      <Routes>
        <Route index element={<JobsPage />} />
        <Route path="jobs" element={<Navigate to="/recruitment" replace />} />
        <Route path="jobs/new" element={<JobFormPage />} />
        <Route path="jobs/:id/edit" element={<JobFormPage />} />
        <Route path="jobs/:id" element={<PipelinePage />} />
        <Route path="applications/:id" element={<CandidatePage />} />
        <Route path="candidates" element={<CandidatesTab />} />
        <Route path="interviews" element={<InterviewsTab />} />
        <Route path="careers" element={<CareersTab />} />
        <Route path="*" element={<EmptyState title="Page not found" action={<Button onClick={() => nav("/recruitment")}>Back to jobs</Button>} />} />
      </Routes>
    </div>
  );
}
