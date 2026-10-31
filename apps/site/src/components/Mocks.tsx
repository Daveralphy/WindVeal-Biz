import { BrandLogo } from "@windveal/ui";
/* Static, illustrative product UI built in HTML/CSS for marketing pages. */
import type { ReactNode } from "react";
import { FileText, Search } from "lucide-react";

const NAV = ["Overview", "Recruitment", "People & HR", "CRM", "Workflows", "Documents", "Insights"];

export function AppShot({ active, label, children, short }: { active: string; label: string; children: ReactNode; short?: boolean }) {
  return (
    <div className={`shot${short ? " shot-short" : ""}`} role="img" aria-label={label}>
      <div className="shot-window">
        <aside className="shot-side">
          <BrandLogo className="shot-logo" />
          {NAV.map((n) => (
            <span key={n} className={n === active ? "on" : undefined}>
              {n}
            </span>
          ))}
        </aside>
        <div className="shot-main">{children}</div>
      </div>
    </div>
  );
}

function ShotHead({ title, sub, action }: { title: string; sub: string; action?: ReactNode }) {
  return (
    <div className="shot-head">
      <div>
        <h4>{title}</h4>
        <p>{sub}</p>
      </div>
      {action}
    </div>
  );
}

function ShotTabs({ items }: { items: string[] }) {
  return (
    <div className="shot-tabs">
      {items.map((t, i) => (
        <span key={t} className={i === 0 ? "on" : undefined}>
          {t}
        </span>
      ))}
    </div>
  );
}

const Tag = ({ children, tone = "blue" }: { children: ReactNode; tone?: "blue" | "ok" | "warn" | "violet" | "red" }) => (
  <span className={`m-tag m-${tone}`}>{children}</span>
);
const Av = ({ i, tone }: { i: string; tone?: "warm" | "green" | "violet" }) => <span className={`m-av${tone ? ` m-av-${tone}` : ""}`}>{i}</span>;

/* ---------- overview dashboard ---------- */
export function DashboardMock({ rows = 3 }: { rows?: number }) {
  const tasks = [
    ["Approve leave request", "People & HR", "Today"],
    ["Follow up on proposal", "CRM", "Today"],
    ["Renew service agreement", "Documents", "Friday"],
    ["Schedule second interview", "Recruitment", "Tuesday"],
  ].slice(0, rows);
  return (
    <>
      <ShotHead title="Good morning" sub="Here's what's happening across your business today." />
      <div className="m-stats">
        {[
          ["Team members", "42", "3 on leave today"],
          ["Open deals", "17", "4 closing this month"],
          ["Open roles", "3", "12 new applicants"],
          ["Tasks due", "8", "2 overdue"],
        ].map(([a, b, c]) => (
          <div key={a} className="m-stat">
            <small>{a}</small>
            <b>{b}</b>
            <em>{c}</em>
          </div>
        ))}
      </div>
      <div className="m-list">
        {tasks.map(([t, tag, when]) => (
          <div key={t} className="m-row">
            <i className="m-check" />
            <b className="grow">{t}</b>
            <Tag>{tag}</Tag>
            <span className="m-when hide-m">{when}</span>
          </div>
        ))}
      </div>
    </>
  );
}

/* ---------- recruitment ---------- */
type Card = { n: string; r: string; i: string; tag: string };
const PIPE: { stage: string; count: number; cards: Card[] }[] = [
  {
    stage: "Applied",
    count: 9,
    cards: [
      { n: "Adaeze Nwosu", r: "Office Administrator", i: "AN", tag: "New" },
      { n: "Samuel Boateng", r: "Sales Associate", i: "SB", tag: "New" },
      { n: "Grace Eze", r: "Accounts Officer", i: "GE", tag: "New" },
    ],
  },
  {
    stage: "Screening",
    count: 6,
    cards: [
      { n: "Tunde Bello", r: "Sales Associate", i: "TB", tag: "Shortlist" },
      { n: "Mary Asante", r: "Office Administrator", i: "MA", tag: "CV read" },
    ],
  },
  {
    stage: "Interview",
    count: 5,
    cards: [
      { n: "Chidi Okeke", r: "Accounts Officer", i: "CO", tag: "Thu 10:00" },
      { n: "Esi Owusu", r: "Sales Associate", i: "EO", tag: "Score 4.5" },
    ],
  },
  { stage: "Offer", count: 3, cards: [{ n: "David Ojo", r: "Sales Associate", i: "DO", tag: "Accepted" }] },
];

function BoardCard({ title, sub, foot, avatar }: { title: string; sub: string; foot: ReactNode; avatar: string }) {
  return (
    <div className="m-card">
      <b>{title}</b>
      <small>{sub}</small>
      <div className="m-card-foot">
        <Av i={avatar} />
        {foot}
      </div>
    </div>
  );
}

export function PipelineMock() {
  return (
    <>
      <ShotHead title="Hiring pipeline" sub="4 open roles · 23 active candidates" action={<span className="m-btn">Post a job</span>} />
      <ShotTabs items={["All roles", "Office Administrator", "Sales Associate", "Accounts Officer"]} />
      <div className="m-board">
        {PIPE.map((col) => (
          <div key={col.stage} className="m-col">
            <div className="m-col-head">
              <span>{col.stage}</span>
              <span>{col.count}</span>
            </div>
            {col.cards.map((c) => (
              <BoardCard key={c.n} title={c.n} sub={c.r} avatar={c.i} foot={<Tag>{c.tag}</Tag>} />
            ))}
          </div>
        ))}
      </div>
    </>
  );
}

/* ---------- people ---------- */
const PEOPLE: [string, string, string, string, string, "ok" | "warn" | "blue", string, ("warm" | "green" | "violet")?][] = [
  ["Amaka Okafor", "Accounts Officer", "Finance", "Ngozi Eze", "Active", "ok", "AO"],
  ["Kofi Mensah", "Team Lead", "Sales", "Ama Darko", "On leave", "warn", "KM", "warm"],
  ["Fatima Abubakar", "HR Officer", "People", "Ngozi Eze", "Active", "ok", "FA", "green"],
  ["John Obi", "Driver", "Operations", "Yaw Boakye", "Active", "ok", "JO", "violet"],
  ["Efua Nyarko", "Sales Associate", "Sales", "Kofi Mensah", "Onboarding", "blue", "EN"],
];

export function EmployeesMock() {
  return (
    <>
      <ShotHead title="Employees" sub="42 people · 6 departments" action={<span className="m-btn">Add employee</span>} />
      <div className="m-search">
        <Search size={15} aria-hidden /> Search by name, role or department
      </div>
      <div className="m-table">
        <div className="m-tr m-th">
          <span>Name</span>
          <span className="hide-m">Department</span>
          <span className="hide-m">Manager</span>
          <span>Status</span>
        </div>
        {PEOPLE.map(([n, r, d, m, s, tone, i, avTone]) => (
          <div key={n} className="m-tr">
            <span className="m-person">
              <Av i={i} tone={avTone} />
              <span>
                <b>{n}</b>
                <small>{r}</small>
              </span>
            </span>
            <span className="hide-m">{d}</span>
            <span className="hide-m">{m}</span>
            <span>
              <Tag tone={tone}>{s}</Tag>
            </span>
          </div>
        ))}
      </div>
    </>
  );
}

/* ---------- CRM ---------- */
const DEALS: { stage: string; count: number; cards: [string, string, string, string][] }[] = [
  {
    stage: "Lead",
    count: 6,
    cards: [
      ["Harbour Logistics", "Fleet services", "KM", "$12k"],
      ["Sunrise Foods", "Supply contract", "AO", "$8k"],
      ["Bluegate Schools", "Uniforms", "EN", "$5k"],
    ],
  },
  {
    stage: "Qualified",
    count: 5,
    cards: [
      ["Kente Textiles", "Annual order", "KM", "$20k"],
      ["Lagoon Pharmacy", "Restock plan", "FA", "$6k"],
    ],
  },
  {
    stage: "Proposal",
    count: 4,
    cards: [
      ["Northline Hotels", "Linen service", "AO", "$15k"],
      ["Coastal Clinic", "Maintenance", "EN", "$9k"],
    ],
  },
  { stage: "Won", count: 2, cards: [["Greenfield Farms", "Distribution", "KM", "$18k"]] },
];

export function DealsMock() {
  return (
    <>
      <ShotHead title="Deals" sub="17 open deals · 4 expected to close this month" action={<span className="m-btn">New deal</span>} />
      <ShotTabs items={["Pipeline", "Companies", "Contacts", "Follow-ups"]} />
      <div className="m-board">
        {DEALS.map((col) => (
          <div key={col.stage} className="m-col">
            <div className="m-col-head">
              <span>{col.stage}</span>
              <span>{col.count}</span>
            </div>
            {col.cards.map(([n, s, i, v]) => (
              <BoardCard key={n} title={n} sub={s} avatar={i} foot={<b className="m-value">{v}</b>} />
            ))}
          </div>
        ))}
      </div>
    </>
  );
}

/* ---------- workflows ---------- */
const TASKS: [string, string, string, string, string, boolean?][] = [
  ["Approve leave request", "Kofi Mensah · 3 days annual leave", "People & HR", "Today", "KM"],
  ["Follow up on proposal", "Northline Hotels", "CRM", "Today", "AO"],
  ["Renew service agreement", "service_agreement_2026.pdf", "Documents", "Fri", "TB"],
  ["Complete onboarding checklist", "Efua Nyarko · 4 of 7 done", "People & HR", "Mon", "EN"],
  ["Schedule second interview", "Chidi Okeke · Accounts Officer", "Recruitment", "Tue", "FA"],
  ["Send quote to new client", "Greenfield Farms", "CRM", "Done", "DO", true],
];

export function TasksMock() {
  return (
    <>
      <ShotHead title="My tasks" sub="8 open · 2 waiting for your approval" action={<span className="m-btn">New task</span>} />
      <ShotTabs items={["To do", "Approvals", "Assigned by me", "Done"]} />
      <div className="m-list">
        {TASKS.map(([t, s, tag, when, i, done]) => (
          <div key={t} className={`m-row m-row-2${done ? " done" : ""}`}>
            <i className={`m-check${done ? " on" : ""}`} />
            <span className="grow">
              <b>{t}</b>
              <small>{s}</small>
            </span>
            <Tag>{tag}</Tag>
            <span className={`m-when${when === "Today" ? " due" : ""}`}>{when}</span>
            <span className="hide-m">
              <Av i={i} />
            </span>
          </div>
        ))}
      </div>
    </>
  );
}

/* ---------- documents ---------- */
export const FOLDERS: [string, string][] = [
  ["Contracts", "84 files"],
  ["HR policies", "32 files"],
  ["Invoices", "412 files"],
  ["Proposals", "57 files"],
];

export function Folders() {
  return (
    <div className="m-folders">
      {FOLDERS.map(([n, c]) => (
        <div key={n} className="m-folder">
          <span className="m-ficon">
            <FileText size={16} aria-hidden />
          </span>
          <span>
            <b>{n}</b>
            <small>{c}</small>
          </span>
        </div>
      ))}
    </div>
  );
}

const FILES: [string, string, string, string, string, "red" | "blue" | "ok"][] = [
  ["service_agreement_2026.pdf", "Contracts · 1.2 MB", "Northline Hotels", "Today", "PDF", "red"],
  ["Leave policy.docx", "HR policies · 240 KB", "People & HR", "Yesterday", "DOC", "blue"],
  ["Q3 price list.xlsx", "Proposals · 88 KB", "CRM", "Mon", "XLS", "ok"],
  ["Offer letter, David Ojo.pdf", "HR · 310 KB", "Recruitment", "Mon", "PDF", "red"],
];

export function DocumentsMock() {
  return (
    <>
      <ShotHead title="Documents" sub="1,284 files · 6.2 GB of 50 GB used" action={<span className="m-btn">Upload</span>} />
      <Folders />
      <div className="m-table">
        <div className="m-tr m-th m-files">
          <span>Name</span>
          <span className="hide-m">Linked to</span>
          <span>Updated</span>
        </div>
        {FILES.map(([n, s, l, u, t, tone]) => (
          <div key={n} className="m-tr m-files">
            <span className="m-person">
              <span className={`m-ftype m-${tone}`}>{t}</span>
              <span>
                <b>{n}</b>
                <small>{s}</small>
              </span>
            </span>
            <span className="hide-m">
              <Tag>{l}</Tag>
            </span>
            <span>{u}</span>
          </div>
        ))}
      </div>
    </>
  );
}

/* ---------- insights ---------- */
export function BarChartMock({ title = "Deals won by month" }: { title?: string }) {
  const bars = [30, 45, 40, 55, 50, 78];
  const months = ["May", "Jun", "Jul", "Aug", "Sep", "Oct"];
  return (
    <div className="m-chart">
      <div className="m-chart-head">
        <b>{title}</b>
        <small>USD</small>
      </div>
      <div className="m-bars">
        {bars.map((h, i) => (
          <i key={i} style={{ height: `${h}%` }} className={i === bars.length - 1 ? "on" : undefined} />
        ))}
      </div>
      <div className="m-bar-labels">
        {months.map((m) => (
          <span key={m}>{m}</span>
        ))}
      </div>
    </div>
  );
}

export function InsightsMock() {
  const depts: [string, number][] = [
    ["Sales", 14],
    ["Operations", 10],
    ["Finance", 6],
    ["People", 5],
    ["Admin", 4],
    ["Other", 3],
  ];
  return (
    <>
      <ShotHead title="Business overview" sub="Built from your live records · updated just now" action={<span className="m-select">This quarter ▾</span>} />
      <div className="m-stats">
        {[
          ["Revenue won", "$84k", "+12% vs last quarter"],
          ["Headcount", "42", "5 hires this quarter"],
          ["Tasks on time", "91%", "Up from 84%"],
          ["Days to hire", "18", "Down from 24"],
        ].map(([a, b, c]) => (
          <div key={a} className="m-stat">
            <small>{a}</small>
            <b>{b}</b>
            <em>{c}</em>
          </div>
        ))}
      </div>
      <div className="m-insight-grid">
        <BarChartMock />
        <div className="m-chart">
          <div className="m-chart-head">
            <b>Headcount by department</b>
          </div>
          <div className="m-hbars">
            {depts.map(([d, n]) => (
              <div key={d} className="m-hbar">
                <span>{d}</span>
                <i style={{ width: `${(n / 14) * 100}%` }} />
                <b>{n}</b>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

/* ---------- small visuals for the product overview ---------- */
export function MiniPipeline() {
  const cols: [string, Card[]][] = [
    [
      "Applied",
      [
        { n: "Adaeze Nwosu", r: "Office Admin", i: "AN", tag: "New" },
        { n: "Grace Eze", r: "Accounts", i: "GE", tag: "New" },
      ],
    ],
    ["Interview", [{ n: "Chidi Okeke", r: "Accounts", i: "CO", tag: "Thu" }]],
    ["Offer", [{ n: "David Ojo", r: "Sales", i: "DO", tag: "Accepted" }]],
  ];
  return (
    <div className="m-board m-board-3">
      {cols.map(([stage, cards]) => (
        <div key={stage} className="m-col">
          <div className="m-col-head">
            <span>{stage}</span>
          </div>
          {cards.map((c) => (
            <BoardCard key={c.n} title={c.n} sub={c.r} avatar={c.i} foot={<Tag>{c.tag}</Tag>} />
          ))}
        </div>
      ))}
    </div>
  );
}

export function MiniDeals() {
  const cols: [string, [string, string, string, string][]][] = [
    [
      "Lead",
      [
        ["Harbour Logistics", "Fleet", "KM", "$12k"],
        ["Sunrise Foods", "Supply", "AO", "$8k"],
      ],
    ],
    ["Proposal", [["Northline Hotels", "Linen", "AO", "$15k"]]],
    ["Won", [["Greenfield Farms", "Distribution", "KM", "$18k"]]],
  ];
  return (
    <div className="m-board m-board-3">
      {cols.map(([stage, cards]) => (
        <div key={stage} className="m-col">
          <div className="m-col-head">
            <span>{stage}</span>
          </div>
          {cards.map(([n, s, i, v]) => (
            <BoardCard key={n} title={n} sub={s} avatar={i} foot={<b className="m-value">{v}</b>} />
          ))}
        </div>
      ))}
    </div>
  );
}

export function MiniPeople() {
  return (
    <div className="m-list m-list-lg">
      {PEOPLE.slice(0, 3).map(([n, , d, , s, tone, i, avTone]) => (
        <div key={n} className="m-row">
          <Av i={i} tone={avTone === "warm" ? "warm" : undefined} />
          <span className="grow">
            <b>{n}</b>
            <small>{d}</small>
          </span>
          <Tag tone={tone}>{s}</Tag>
        </div>
      ))}
    </div>
  );
}

export function MiniTasks() {
  const rows: [string, string, string, boolean?][] = [
    ["Approve leave request", "Due today", "People & HR"],
    ["Follow up on proposal", "Due today", "CRM"],
    ["Send quote", "Done", "CRM", true],
  ];
  return (
    <div className="m-list m-list-lg">
      {rows.map(([t, s, tag, done]) => (
        <div key={t} className="m-row">
          <i className={`m-check${done ? " on" : ""}`} />
          <span className="grow">
            <b>{t}</b>
            <small>{s}</small>
          </span>
          <Tag>{tag}</Tag>
        </div>
      ))}
    </div>
  );
}
