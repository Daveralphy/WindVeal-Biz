import { describe, expect, it } from "vitest";
import { addMember, getApp, signUpWithOrg } from "./helpers";

/** Kofi reports to Ngozi; Efua is in another team. */
async function team() {
  const app = await getApp();
  const { c: admin } = await signUpWithOrg(app);
  const { c: ngozi, email: ngoziEmail } = await addMember(app, admin, "member", "Ngozi Eze");
  const { c: kofi, email: kofiEmail } = await addMember(app, admin, "member", "Kofi Mensah");
  const { c: efua } = await addMember(app, admin, "member", "Efua Nyarko");
  const lead = await admin.post("/api/people/employees", { firstName: "Ngozi", lastName: "Eze", email: ngoziEmail, sendAccess: false });
  await admin.post("/api/people/employees", { firstName: "Kofi", lastName: "Mensah", email: kofiEmail, managerId: lead.body.employee.id, sendAccess: false });
  const id = async (c: typeof admin) => (await c.get("/api/auth/me")).body.user.id as string;
  return { ngozi, kofi, efua, kofiId: await id(kofi) };
}

describe("Growth: goals, reviews and training", () => {
  it("each person keeps their own; their manager sees and adds to them; nobody else can", async () => {
    const { ngozi, kofi, efua, kofiId } = await team();
    expect((await ngozi.get("/api/growth/people")).body.people.map((p: any) => p.name)).toEqual(["Me", "Kofi Mensah"]);
    // Kofi's own goal, and one Ngozi sets him.
    const own = await kofi.post("/api/growth/goals", { title: "Bring in 20 new clients" });
    const set = await ngozi.post("/api/growth/goals", { for: kofiId, title: "Close N60m in new deals", dueOn: "2026-12-31" });
    const list = (await kofi.get("/api/growth/goals")).body.goals;
    expect(list.map((g: any) => g.title).sort()).toEqual(["Bring in 20 new clients", "Close N60m in new deals"]);
    expect(list.find((g: any) => g.id === set.body.goal.id).setBy).toBe("Ngozi Eze");
    expect((await kofi.patch(`/api/growth/goals/${own.body.goal.id}`, { progress: 65 })).body.goal.progress).toBe(65);
    expect((await kofi.patch(`/api/growth/goals/${own.body.goal.id}`, { progress: 100 })).body.goal.status).toBe("done");
    expect((await kofi.del(`/api/growth/goals/${set.body.goal.id}`)).status).toBe(403);
    // Efua isn't his manager.
    expect((await efua.get(`/api/growth/goals?for=${kofiId}`)).status).toBe(403);
    expect((await efua.post("/api/growth/goals", { for: kofiId, title: "x" })).status).toBe(403);

    // Training: Ngozi adds a course for him; he finishes it.
    const t = await ngozi.post("/api/growth/training", { for: kofiId, title: "Negotiation skills", dueOn: "2026-11-30" });
    const done = await kofi.patch(`/api/growth/training/${t.body.training.id}`, { status: "done", certificateExpiresOn: "2028-11-30" });
    expect(done.body.training).toMatchObject({ status: "done", certificateExpiresOn: "2028-11-30" });
    expect(done.body.training.completedOn).toBeTruthy();
  });

  it("a review: the manager starts it, the person writes theirs, then the manager finishes it", async () => {
    const { ngozi, kofi, efua, kofiId } = await team();
    expect((await efua.post("/api/growth/reviews", { for: kofiId, title: "Year-end review" })).status).toBe(403);
    const r = await ngozi.post("/api/growth/reviews", { for: kofiId, title: "Year-end review", dueOn: "2026-12-15" });
    const id = r.body.review.id;
    // Ngozi has to wait for his self-review.
    expect((await ngozi.post(`/api/growth/reviews/${id}`, { text: "Great year", rating: 4 })).status).toBe(409);
    expect((await kofi.post(`/api/growth/reviews/${id}`, { text: "I brought in 13 clients." })).status).toBe(200);
    expect((await kofi.post(`/api/growth/reviews/${id}`, { text: "again" })).status).toBe(409);
    expect((await ngozi.post(`/api/growth/reviews/${id}`, { text: "Great year", rating: 4 })).status).toBe(200);
    const mine = (await kofi.get("/api/growth/reviews")).body.reviews[0];
    expect(mine).toMatchObject({ status: "done", selfReview: "I brought in 13 clients.", managerReview: "Great year", rating: 4, reviewer: "Ngozi Eze" });
    expect((await efua.get("/api/growth/reviews")).body.reviews).toEqual([]);
  });
});
