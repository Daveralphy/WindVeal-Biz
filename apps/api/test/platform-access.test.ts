import { describe, expect, it } from "vitest";
import { addMember, getApp, giveAccess, signUpWithOrg } from "./helpers";

/** A Sales department led by Ngozi, with Kofi in it; Efua is in no department. */
async function setUp() {
  const app = await getApp();
  const { c: admin } = await signUpWithOrg(app);
  const { c: ngozi, email: ngoziEmail } = await addMember(app, admin, "member", "Ngozi Eze");
  const { c: kofi, email: kofiEmail } = await addMember(app, admin, "member", "Kofi Mensah");
  const { c: efua, email: efuaEmail } = await addMember(app, admin, "member", "Efua Nyarko");
  const lead = await admin.post("/api/people/employees", { firstName: "Ngozi", lastName: "Eze", email: ngoziEmail, sendAccess: false });
  const dept = await admin.post("/api/people/departments", { name: "Sales", headEmployeeId: lead.body.employee.id });
  const deptId = dept.body.id ?? dept.body.department?.id;
  await admin.patch(`/api/people/employees/${lead.body.employee.id}`, { departmentId: deptId });
  await admin.post("/api/people/employees", { firstName: "Kofi", lastName: "Mensah", email: kofiEmail, departmentId: deptId, sendAccess: false });
  return { admin, ngozi, kofi, efua, ngoziEmail, kofiEmail, efuaEmail };
}

describe("platform access", () => {
  it("everyone has their own platforms; an admin can turn one off, and its pages close", async () => {
    const { admin, kofi, kofiEmail } = await setUp();
    const access = (await kofi.get("/api/auth/me")).body.membership.access;
    expect(access).toMatchObject({ attendance: "view", tasks: "view", finance: "view", requests: "view", mydocs: "view", growth: "view", crm: "none" });
    expect((await kofi.get("/api/my/pay")).status).toBe(200);
    await giveAccess(admin, kofiEmail, { finance: "none", growth: "none" });
    expect((await kofi.get("/api/my/pay")).status).toBe(403);
    expect((await kofi.post("/api/requests", { kind: "expense", title: "Taxi", amount: 100 })).status).toBe(403);
    expect((await kofi.get("/api/growth/goals")).status).toBe(403);
    // Other requests still work: that's a different platform.
    expect((await kofi.post("/api/requests", { kind: "it", title: "Printer jam" })).status).toBe(200);
    // Turning personal platforms off doesn't use up the Free plan's roles with access.
    expect((await admin.get("/api/roles")).body.allowance.used).toBe(1);
  });

  it("a team lead gives their team what they have, up to their own level, and nothing to anyone else", async () => {
    const { admin, ngozi, kofi, efua, ngoziEmail } = await setUp();
    expect((await kofi.get("/api/team-access")).status).toBe(403);
    expect((await kofi.get("/api/my/summary")).body.leads).toBe(false);
    expect((await ngozi.get("/api/my/summary")).body.leads).toBe(true);
    await giveAccess(admin, ngoziEmail, { crm: "edit" });
    const team = (await ngozi.get("/api/team-access")).body;
    expect(team.departments).toEqual(["Sales"]);
    expect(team.people.map((p: any) => p.name)).toEqual(["Kofi Mensah"]);
    const kofiId = team.people[0].id;
    // CRM up to Edit, yes; Manage, or People & HR (which Ngozi doesn't have), no.
    expect((await ngozi.patch(`/api/team-access/${kofiId}`, { access: { crm: "manage" } })).status).toBe(403);
    expect((await ngozi.patch(`/api/team-access/${kofiId}`, { access: { people: "view" } })).status).toBe(403);
    expect((await ngozi.patch(`/api/team-access/${kofiId}`, { access: { crm: "edit", growth: "none" } })).status).toBe(200);
    const kofiAccess = (await kofi.get("/api/auth/me")).body.membership.access;
    expect(kofiAccess).toMatchObject({ crm: "edit", growth: "none" });
    expect((await kofi.get("/api/crm/overview")).status).toBe(200);
    // Efua isn't in Sales.
    const efuaMembership = (await admin.get("/api/members")).body.find((m: any) => m.name === "Efua Nyarko").id;
    expect((await ngozi.patch(`/api/team-access/${efuaMembership}`, { access: { crm: "view" } })).status).toBe(404);
    expect((await efua.get("/api/auth/me")).body.membership.access.crm).toBe("none");
  });
});
