import { describe, expect, it } from "vitest";
import { addMember, getApp, signUpWithOrg } from "./helpers";

/** A Sales department led by Ngozi, with Kofi in it; both use WindVeal. The admin set it up. */
async function salesTeam() {
  const app = await getApp();
  const { c: admin } = await signUpWithOrg(app);
  const { c: ngozi, email: ngoziEmail } = await addMember(app, admin, "member", "Ngozi Eze");
  const { c: kofi, email: kofiEmail } = await addMember(app, admin, "member", "Kofi Mensah");
  const lead = await admin.post("/api/people/employees", { firstName: "Ngozi", lastName: "Eze", email: ngoziEmail, jobTitle: "Sales lead", sendAccess: false });
  const dept = await admin.post("/api/people/departments", { name: "Sales", headEmployeeId: lead.body.employee.id });
  await admin.patch(`/api/people/employees/${lead.body.employee.id}`, { departmentId: dept.body.id ?? dept.body.department?.id });
  await admin.post("/api/people/employees", { firstName: "Kofi", lastName: "Mensah", email: kofiEmail, jobTitle: "Sales rep", departmentId: dept.body.id ?? dept.body.department?.id, sendAccess: false });
  const ids = async (c: typeof admin) => (await c.get("/api/auth/me")).body.user.id as string;
  return { app, admin, ngozi, kofi, ngoziId: await ids(ngozi), kofiId: await ids(kofi) };
}

describe("task boards", () => {
  it("one board per team: the head leads it, everyone on it sees every card, and staff add their own", async () => {
    const { ngozi, kofi, ngoziId, kofiId } = await salesTeam();
    const [nb] = (await ngozi.get("/api/boards")).body.boards;
    const [kb] = (await kofi.get("/api/boards")).body.boards;
    expect(nb).toMatchObject({ name: "Sales team", lead: true });
    expect(kb).toMatchObject({ id: nb.id, lead: false });
    const board = (await kofi.get(`/api/boards/${kb.id}`)).body;
    expect(board.lists.map((l: any) => l.name)).toEqual(["To do", "In progress", "Done"]);
    const todo = board.lists[0].id, doing = board.lists[1].id, done = board.lists[2].id;

    // Kofi adds his own card: no approval needed.
    const mine = await kofi.post(`/api/boards/${kb.id}/cards`, { title: "Call Apex Bakery", listId: todo, labels: ["red"] });
    expect(mine.status).toBe(200);
    expect(mine.body.card.assignee.id).toBe(kofiId);
    // Only the lead gives cards to other people.
    expect((await kofi.post(`/api/boards/${kb.id}/cards`, { title: "For Ngozi", listId: todo, assigneeUserId: ngoziId })).status).toBe(403);
    const given = await ngozi.post(`/api/boards/${nb.id}/cards`, { title: "Send the price list", listId: todo, assigneeUserId: kofiId });
    expect(given.body.card.assignee.id).toBe(kofiId);
    const leads = await ngozi.post(`/api/boards/${nb.id}/cards`, { title: "Plan Q1 targets", listId: todo });

    // Everyone sees every card; Kofi can open a card that isn't his, but can't move it.
    const seen = (await kofi.get(`/api/boards/${kb.id}`)).body.cards;
    expect(seen.map((c: any) => c.title)).toEqual(expect.arrayContaining(["Call Apex Bakery", "Send the price list", "Plan Q1 targets"]));
    expect(seen.find((c: any) => c.title === "Plan Q1 targets").canMove).toBe(false);
    expect((await kofi.get(`/api/workflows/tasks/${leads.body.card.id}`)).status).toBe(200);
    expect((await kofi.post(`/api/boards/cards/${leads.body.card.id}/move`, { listId: doing, position: 1 })).status).toBe(403);
    // The lead can move anyone's card.
    expect((await ngozi.post(`/api/boards/cards/${mine.body.card.id}/move`, { listId: doing, position: 1 })).status).toBe(200);
    expect((await kofi.get(`/api/workflows/tasks/${mine.body.card.id}`)).body.task.status).toBe("in_progress");

    // Done completes the task; out of Done reopens it.
    expect((await kofi.post(`/api/boards/cards/${mine.body.card.id}/move`, { listId: done, position: 1 })).status).toBe(200);
    expect((await kofi.get(`/api/workflows/tasks/${mine.body.card.id}`)).body.task.status).toBe("done");
    await kofi.post(`/api/boards/cards/${mine.body.card.id}/move`, { listId: todo, position: 5 });
    expect((await kofi.get(`/api/workflows/tasks/${mine.body.card.id}`)).body.task.status).toBe("todo");
    // Finished elsewhere (e.g. its task page): it shows in Done on the board.
    await kofi.post(`/api/workflows/tasks/${given.body.card.id}/complete`);
    const after = (await kofi.get(`/api/boards/${kb.id}`)).body;
    expect(after.cards.find((c: any) => c.id === given.body.card.id).listId).toBe(done);

    // Labels and people on a card.
    expect((await kofi.patch(`/api/boards/cards/${mine.body.card.id}`, { labels: ["green", "blue"], memberUserIds: [ngoziId] })).status).toBe(200);
    expect((await kofi.get(`/api/boards/${kb.id}`)).body.cards.find((c: any) => c.id === mine.body.card.id)).toMatchObject({ labels: ["green", "blue"], members: [{ id: ngoziId }] });

    // Lists are the lead's: a new one goes before Done; To do can't be removed; removing one keeps its cards.
    expect((await kofi.post(`/api/boards/${kb.id}/lists`, { name: "Waiting" })).status).toBe(403);
    const waiting = await ngozi.post(`/api/boards/${nb.id}/lists`, { name: "Waiting on client" });
    expect((await ngozi.get(`/api/boards/${nb.id}`)).body.lists.map((l: any) => l.name)).toEqual(["To do", "In progress", "Waiting on client", "Done"]);
    expect((await ngozi.del(`/api/boards/lists/${todo}`)).status).toBe(409);
    await ngozi.post(`/api/boards/cards/${leads.body.card.id}/move`, { listId: waiting.body.list.id, position: 1 });
    expect((await ngozi.del(`/api/boards/lists/${waiting.body.list.id}`)).status).toBe(200);
    expect((await ngozi.get(`/api/boards/${nb.id}`)).body.cards.find((c: any) => c.id === leads.body.card.id).listId).toBe(todo);
  });

  it("puts work given to the team elsewhere on the board, and keeps other teams' boards private", async () => {
    const { admin, kofi, kofiId } = await salesTeam();
    // A task given to Kofi outside the board (e.g. a CRM follow-up or from the chat) lands in To do.
    const t = await admin.post("/api/workflows/tasks", { title: "Follow up with Zeta Foods", assigneeUserId: kofiId, priority: "high" });
    const [kb] = (await kofi.get("/api/boards")).body.boards;
    const board = (await kofi.get(`/api/boards/${kb.id}`)).body;
    expect(board.cards.find((c: any) => c.id === t.body.id)?.listId).toBe(board.lists[0].id);
    // Someone outside Sales can't open its board or its cards.
    const app = await getApp();
    const { c: other } = await addMember(app, admin, "member", "Efua Nyarko");
    expect((await other.get(`/api/boards/${kb.id}`)).status).toBe(404);
    const [own] = (await other.get("/api/boards")).body.boards;
    expect(own).toMatchObject({ name: "My board", personal: true, lead: true });
    expect((await other.get(`/api/workflows/tasks/${t.body.id}`)).status).toBe(404);
  });
});
