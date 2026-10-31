import { useState } from "react";
import { Navigate, Route, Routes, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Columns3, List, Plus } from "lucide-react";
import { Button, EmptyState, PageHeader, Tabs } from "@windveal/ui";
import { api } from "../../lib/api";
import { useSession } from "../../lib/session";
import { NewTaskModal, TaskBoard, TaskDrawer, TaskFilterBar, TaskList, useTaskList, type TaskFilters } from "./tasks";
import { ApprovalsView } from "./approvals";
import { TemplatesView } from "./templates";
import "./workflows.css";

const EMPTY: TaskFilters = { q: "", workspace: "", priority: "", createdBy: "" };

function readView(): "list" | "board" {
  try { return localStorage.getItem("wv-wf-view") === "board" ? "board" : "list"; } catch { return "list"; }
}

function TasksTab({ scope, view, onOpen, onNew }: { scope: "mine" | "all"; view: "list" | "board"; onOpen: (id: string) => void; onNew: () => void }) {
  const { can } = useSession();
  const [f, setF] = useState<TaskFilters>(EMPTY);
  const { data, isLoading, error } = useTaskList(scope, f);
  const filtered = !!(f.q || f.workspace || f.priority || f.createdBy);
  return (
    <>
      <TaskFilterBar f={f} setF={setF} />
      {view === "board"
        ? <TaskBoard data={data} isLoading={isLoading} error={error} onOpen={onOpen} />
        : <TaskList data={data} isLoading={isLoading} error={error} onOpen={onOpen} filtered={filtered} onNew={onNew} canCreate={can("workflows", "edit")}
            emptyText={scope === "mine" ? "Tasks assigned to you from every workspace show up here." : "No one in your organisation has any open tasks."} />}
    </>
  );
}

export default function WorkflowsModule() {
  const { can } = useSession();
  const navigate = useNavigate();
  const loc = useLocation();
  const [params, setParams] = useSearchParams();
  const [view, setView] = useState<"list" | "board">(readView);
  const { data: summary } = useQuery({
    queryKey: ["wf-summary"], queryFn: () => api.get<{ myTasks: number; approvalsWaiting: number }>("/api/workflows/summary"), refetchInterval: 60_000,
  });

  if (!can("workflows", "view")) {
    return <><PageHeader title="Workflows" /><EmptyState title="You don't have access to Workflows">Ask an admin if you need it.</EmptyState></>;
  }

  const tab = loc.pathname.startsWith("/workflows/approvals") ? "approvals" : loc.pathname.startsWith("/workflows/all") ? "all"
    : loc.pathname.startsWith("/workflows/templates") ? "templates" : "mine";
  const taskId = params.get("task");
  const newOpen = params.get("new") === "task";
  const setParam = (k: string, v: string | null) => {
    const p = new URLSearchParams(params);
    if (v) p.set(k, v); else p.delete(k);
    setParams(p, { replace: true });
  };
  const toggleView = () => {
    const next = view === "list" ? "board" : "list";
    setView(next);
    try { localStorage.setItem("wv-wf-view", next); } catch { /* ignore */ }
  };
  const openTask = (id: string) => setParam("task", id);
  const newTask = () => setParam("new", "task");
  const isTaskTab = tab === "mine" || tab === "all";
  const my = summary?.myTasks ?? 0;
  const waiting = summary?.approvalsWaiting ?? 0;

  return (
    <div className="wf">
      <PageHeader
        title="Workflows"
        subtitle={summary ? `${my} task${my === 1 ? "" : "s"} for you · ${waiting} approval${waiting === 1 ? "" : "s"} waiting` : " "}
        actions={<>
          {isTaskTab && (
            <Button variant="secondary" className="hide-sm" icon={view === "list" ? <Columns3 size={16} /> : <List size={16} />} onClick={toggleView}>
              {view === "list" ? "Board view" : "List view"}
            </Button>
          )}
          {can("workflows", "edit") && <Button className="wf-new-btn" icon={<Plus size={16} />} onClick={newTask}>New task</Button>}
        </>}
      />
      <Tabs
        value={tab}
        onChange={(k) => navigate(k === "mine" ? "/workflows" : `/workflows/${k}`)}
        items={[
          { key: "mine", label: "My tasks", count: my },
          { key: "approvals", label: "Approvals", count: waiting },
          { key: "all", label: "All tasks" },
          { key: "templates", label: "Templates" },
        ]}
      />
      <Routes>
        <Route index element={<TasksTab key="mine" scope="mine" view={view} onOpen={openTask} onNew={newTask} />} />
        <Route path="all" element={<TasksTab key="all" scope="all" view={view} onOpen={openTask} onNew={newTask} />} />
        <Route path="approvals" element={<ApprovalsView />} />
        <Route path="templates" element={<TemplatesView />} />
        <Route path="*" element={<Navigate to="/workflows" replace />} />
      </Routes>
      <NewTaskModal open={newOpen} onClose={() => setParam("new", null)} onCreated={(id) => {
        const p = new URLSearchParams(params);
        p.delete("new");
        p.set("task", id);
        setParams(p, { replace: true });
      }} />
      <TaskDrawer id={taskId} onClose={() => setParam("task", null)} />
    </div>
  );
}
