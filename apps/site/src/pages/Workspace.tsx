import type { ReactNode } from "react";
import { Benefits, CtaBand, MarketingLayout, ArrowLink } from "../components/Layout";
import { AppShot, DealsMock, DocumentsMock, EmployeesMock, InsightsMock, PipelineMock, TasksMock } from "../components/Mocks";
import { useTitle } from "../lib/site";
import { workspaceByKey, type WorkspaceKey } from "../lib/workspaces";
import { PageHero } from "./Product";
import NotFound from "./NotFound";

interface Page {
  title: string;
  accent: string;
  accentBreak?: boolean;
  lede: string;
  shot: ReactNode;
  shotLabel: string;
  features: { title: string; text: string }[];
  links: { ws: WorkspaceKey; title: string; text: string }[];
}

const PAGES: Record<WorkspaceKey, Page> = {
  recruitment: {
    title: "Hire the right people,",
    accent: "faster.",
    lede: "post jobs, collect applications and move every candidate forward from one simple pipeline.",
    shot: <PipelineMock />,
    shotLabel: "A hiring pipeline with candidates in Applied, Screening, Interview and Offer.",
    features: [
      { title: "Your own careers page", text: "Publish roles on a careers page for your business. Candidates apply without creating an account." },
      { title: "One clear pipeline", text: "See every candidate's stage at a glance and move them on with a click." },
      { title: "Interviews and scores", text: "Schedule interviews, collect feedback and compare candidates fairly." },
    ],
    links: [
      { ws: "people-hr", title: "Hire straight into your team", text: "When you hire someone, their employee record is ready to go." },
      { ws: "workflows", title: "Onboarding that runs itself", text: "New hires get their onboarding checklist automatically." },
      { ws: "documents", title: "CVs and offer letters, filed", text: "Every candidate file is stored safely with their profile." },
    ],
  },
  "people-hr": {
    title: "Your team,",
    accent: "organised.",
    lede: "keep every employee record, leave request and attendance log in one place your whole HR team can trust.",
    shot: <EmployeesMock />,
    shotLabel: "An employee directory showing names, departments, managers and status.",
    features: [
      { title: "Employee directory", text: "Find anyone in seconds, with their role, department and manager." },
      { title: "Leave and attendance", text: "Request, approve and track leave, with balances that update themselves." },
      { title: "Onboarding and offboarding", text: "Checklists that make every start and every exit smooth." },
    ],
    links: [
      { ws: "recruitment", title: "From candidate to colleague", text: "Hired candidates become employees without retyping." },
      { ws: "workflows", title: "Approvals in one place", text: "Leave requests land in the right manager's approvals." },
      { ws: "insights", title: "Know your headcount", text: "See headcount, leave and turnover at a glance." },
    ],
  },
  crm: {
    title: "Keep every deal",
    accent: "moving.",
    lede: "track companies, contacts, leads and deals in one place, so no client or follow-up slips through.",
    shot: <DealsMock />,
    shotLabel: "A deals pipeline with clients in Lead, Qualified, Proposal and Won.",
    features: [
      { title: "Clients and contacts", text: "Every company with all its people, calls, meetings and notes." },
      { title: "Your own pipeline", text: "Set the stages that fit how you sell and drag deals forward." },
      { title: "Follow-ups that happen", text: "Reminders for every next step, so nothing is forgotten." },
    ],
    links: [
      { ws: "workflows", title: "Turn next steps into tasks", text: "Follow-ups become tasks assigned to the right person." },
      { ws: "documents", title: "Proposals with the deal", text: "Quotes and contracts stay attached to each client." },
      { ws: "insights", title: "See what's closing", text: "Track pipeline value and win rate over time." },
    ],
  },
  workflows: {
    title: "Work that",
    accent: "gets done.",
    lede: "assign tasks, set deadlines and handle approvals across every part of your business.",
    shot: <TasksMock />,
    shotLabel: "A task list with approvals, follow-ups and due dates across workspaces.",
    features: [
      { title: "Tasks with owners", text: "Every task has a person, a deadline and a clear status." },
      { title: "Approvals without chasing", text: "Leave, purchases and documents go to the right person to approve." },
      { title: "Repeatable templates", text: "Turn routine work like onboarding into a checklist you reuse." },
    ],
    links: [
      { ws: "people-hr", title: "Leave approvals", text: "Managers approve leave right from their task list." },
      { ws: "crm", title: "Client follow-ups", text: "Next steps on deals show up as tasks." },
      { ws: "recruitment", title: "Hiring steps", text: "Interviews and offers become tasks for your team." },
    ],
  },
  documents: {
    title: "Every file,",
    accent: "easy to find.",
    lede: "store, organise and share your business documents securely, with access set by role.",
    shot: <DocumentsMock />,
    shotLabel: "A document library with folders and recent files linked to clients and teams.",
    features: [
      { title: "One shared library", text: "Contracts, policies and invoices organised in folders your team understands." },
      { title: "Find it in seconds", text: "Search by name, type or the client, employee or deal it belongs to." },
      { title: "The right access", text: "Decide who can view, upload or manage each folder." },
    ],
    links: [
      { ws: "crm", title: "Contracts with clients", text: "Attach quotes and agreements to the deal they belong to." },
      { ws: "people-hr", title: "Employee files", text: "Keep contracts and IDs on each employee's profile." },
      { ws: "recruitment", title: "Candidate CVs", text: "Applications arrive with their files already stored." },
    ],
  },
  insights: {
    title: "Know how you're",
    accent: "really doing.",
    lede: "get clear dashboards and reports built from the work your team already does in WindVeal.",
    shot: <InsightsMock />,
    shotLabel: "A business overview with revenue, headcount, tasks on time and charts.",
    features: [
      { title: "Live dashboards", text: "Sales, headcount, hiring and tasks, updated as work happens." },
      { title: "Reports you can trust", text: "Every number comes from your real records, never estimates." },
      { title: "Export in a click", text: "Download any report to Excel or CSV to share or present." },
    ],
    links: [
      { ws: "crm", title: "Sales performance", text: "Pipeline value, win rate and revenue by month." },
      { ws: "people-hr", title: "Team health", text: "Headcount, leave and turnover by department." },
      { ws: "workflows", title: "Work on time", text: "See which tasks and approvals are falling behind." },
    ],
  },
};

export default function Workspace({ ws }: { ws: WorkspaceKey }) {
  const info = workspaceByKey(ws);
  const page = PAGES[ws];
  useTitle(`${info.name} · WindVeal`);
  if (!page) return <NotFound />;
  return (
    <MarketingLayout>
      <PageHero title={page.title} accent={page.accent}>
        With <b>{info.name}</b>, {page.lede}
      </PageHero>

      <section className="container shot-section">
        <AppShot active={info.name} label={page.shotLabel}>
          {page.shot}
        </AppShot>
      </section>

      <section className="section">
        <div className="container">
          <h2 className="section-title narrow">What you can do with {info.name}.</h2>
          <Benefits items={page.features} />
        </div>
      </section>

      <section className="section section-tight">
        <div className="container">
          <h2 className="section-title narrow">Works with the rest of WindVeal.</h2>
          <div className="link-cards">
            {page.links.map((l) => {
              const other = workspaceByKey(l.ws);
              return (
                <article key={l.ws} className="link-card">
                  <span className="link-card-label">{other.name}</span>
                  <h3>{l.title}</h3>
                  <p>{l.text}</p>
                  <ArrowLink to={other.path}>Explore {other.name}</ArrowLink>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <CtaBand />
    </MarketingLayout>
  );
}
