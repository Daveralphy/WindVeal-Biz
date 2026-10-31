import { useState } from "react";
import { Navigate, Route, Routes, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { Plus } from "lucide-react";
import { Button, PageHeader, Tabs } from "@windveal/ui";
import { useSession } from "../../lib/session";
import { useSummary } from "./data";
import { CompanyModal, DealModal, LeadModal, useCrmAccess } from "./parts";
import { CompaniesPage, CompanyPage } from "./companies";
import { FollowUpsPage, OverviewPage, PipelinePage } from "./pages";
import { LeadsPage } from "./leads";
import "./crm.css";

const TABS = [
  { key: "", label: "Overview" },
  { key: "pipeline", label: "Pipeline" },
  { key: "companies", label: "Companies" },
  { key: "leads", label: "Leads" },
  { key: "follow-ups", label: "Follow-ups" },
];

export default function CrmModule() {
  const navigate = useNavigate();
  const location = useLocation();
  const [params, setParams] = useSearchParams();
  const { money } = useSession();
  const { canEdit } = useCrmAccess();
  const summary = useSummary();
  const [newCompany, setNewCompany] = useState(false);

  const section = location.pathname.replace(/^\/crm\/?/, "").split("/")[0] ?? "";
  const s = summary.data;
  const subtitle = s
    ? `${s.companies} compan${s.companies === 1 ? "y" : "ies"} · ${s.openDeals} open deal${s.openDeals === 1 ? "" : "s"} worth ${money(s.openValue, true)} · ${s.activeLeads} active lead${s.activeLeads === 1 ? "" : "s"}`
    : summary.isError ? "Couldn't load the summary" : " ";
  const newParam = params.get("new");
  const closeNew = () => { const p = new URLSearchParams(params); p.delete("new"); setParams(p, { replace: true }); };
  const openNewDeal = () => { const p = new URLSearchParams(params); p.set("new", "deal"); setParams(p); };

  return (
    <div className="crm">
      <PageHeader title="CRM" subtitle={subtitle}
        actions={canEdit && (
          <>
            <Button variant="secondary" className="hide-sm" icon={<Plus size={16} />} onClick={() => setNewCompany(true)}>New company</Button>
            <Button icon={<Plus size={16} />} className="crm-cta" onClick={openNewDeal}>New deal</Button>
          </>
        )} />
      <Tabs value={section} onChange={(k) => navigate(k ? `/crm/${k}` : "/crm")}
        items={TABS.map((t) => ({
          ...t,
          count: t.key === "leads" ? s?.activeLeads : t.key === "follow-ups" ? s?.myFollowUps : undefined,
        }))} />
      <Routes>
        <Route index element={<OverviewPage />} />
        <Route path="pipeline" element={<PipelinePage />} />
        <Route path="companies" element={<CompaniesPage onNew={() => setNewCompany(true)} />} />
        <Route path="companies/:id" element={<CompanyPage />} />
        <Route path="leads" element={<LeadsPage />} />
        <Route path="follow-ups" element={<FollowUpsPage />} />
        <Route path="*" element={<Navigate to="/crm" replace />} />
      </Routes>
      {canEdit && (
        <>
          <CompanyModal open={newCompany} onClose={() => setNewCompany(false)} onSaved={(id) => navigate(`/crm/companies/${id}`)} />
          <DealModal open={newParam === "deal"} onClose={closeNew}
            onSaved={(d) => { if (section !== "pipeline" && section !== "companies") navigate(`/crm/pipeline?deal=${d.id}`); }} />
          <LeadModal open={newParam === "lead"} onClose={closeNew} />
        </>
      )}
    </div>
  );
}
