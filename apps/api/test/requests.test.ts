import { describe, expect, it } from "vitest";
import { addMember, getApp, signUpWithOrg } from "./helpers";

/** Kofi reports to Ngozi (People & HR); Tayo is the finance person; the admin set it all up. */
async function team() {
  const app = await getApp();
  const { c: admin } = await signUpWithOrg(app);
  const { c: ngozi, email: ngoziEmail } = await addMember(app, admin, "member", "Ngozi Eze");
  const { c: kofi, email: kofiEmail } = await addMember(app, admin, "member", "Kofi Mensah");
  const { c: tayo } = await addMember(app, admin, "member", "Tayo Bello");
  const lead = await admin.post("/api/people/employees", { firstName: "Ngozi", lastName: "Eze", email: ngoziEmail, sendAccess: false });
  await admin.post("/api/people/employees", { firstName: "Kofi", lastName: "Mensah", email: kofiEmail, managerId: lead.body.employee.id, sendAccess: false });
  const id = async (c: typeof admin) => (await c.get("/api/auth/me")).body.user.id as string;
  return { app, admin, ngozi, kofi, tayo, ngoziId: await id(ngozi), kofiId: await id(kofi), tayoId: await id(tayo) };
}

describe("requests and expense claims", () => {
  it("a request goes to the manager by default, or to whoever an admin chose; the asker sees where it is", async () => {
    const { admin, ngozi, kofi, tayo, ngoziId, tayoId } = await team();
    const kinds = (await kofi.get("/api/requests/kinds")).body.kinds;
    expect(kinds.find((k: any) => k.kind === "it").goesTo).toBe("Ngozi Eze");
    const r = await kofi.post("/api/requests", { kind: "equipment", title: "New laptop charger", details: "Mine stopped working" });
    expect(r.body.request).toMatchObject({ status: "waiting", with: { id: ngoziId } });
    // Ngozi sees it to handle; Tayo doesn't, and can't open it.
    expect((await ngozi.get("/api/requests?scope=handle")).body.requests.map((x: any) => x.title)).toContain("New laptop charger");
    expect((await tayo.get(`/api/requests/${r.body.request.id}`)).status).toBe(404);
    expect((await tayo.post(`/api/requests/${r.body.request.id}/act`, { action: "done" })).status).toBe(404);
    expect((await ngozi.get("/api/my/summary")).body.handles).toBe(true);
    expect((await ngozi.post(`/api/requests/${r.body.request.id}/act`, { action: "start" })).body.request.status).toBe("in_progress");
    // Too late to cancel once started.
    expect((await kofi.post(`/api/requests/${r.body.request.id}/cancel`)).status).toBe(409);
    const done = await ngozi.post(`/api/requests/${r.body.request.id}/act`, { action: "done", note: "On your desk" });
    expect(done.body.request.status).toBe("done");
    const mine = (await kofi.get("/api/requests")).body.requests[0];
    expect(mine.history.map((h: any) => h.action)).toEqual(["asked", "start", "done"]);
    expect(mine.history[2].note).toBe("On your desk");

    // An admin sends IT help to Tayo instead.
    expect((await kofi.put("/api/requests/handlers", { handlers: { it: tayoId } })).status).toBe(403);
    expect((await admin.put("/api/requests/handlers", { handlers: { it: tayoId } })).status).toBe(200);
    const it = await kofi.post("/api/requests", { kind: "it", title: "Email not syncing" });
    expect(it.body.request.with.id).toBe(tayoId);
    // Not started yet: Kofi can take it back.
    expect((await kofi.post(`/api/requests/${it.body.request.id}/cancel`)).body.request.status).toBe("cancelled");
  });

  it("an expense claim goes to the manager to approve, then to whoever pays", async () => {
    const { app, admin, ngozi, kofi, tayo, ngoziId, tayoId } = await team();
    await admin.put("/api/requests/handlers", { handlers: { expense: tayoId } });
    expect((await kofi.post("/api/requests", { kind: "expense", title: "Taxi to Apex Bakery" })).status).toBe(400);
    // The receipt is a private attachment, then shown only through the claim.
    const up = await app.inject({
      method: "POST", url: "/api/files?kind=system",
      headers: { cookie: Object.entries(kofi.cookies).map(([k, v]) => `${k}=${v}`).join("; "), "content-type": "multipart/form-data; boundary=X" },
      payload: `--X\r\nContent-Disposition: form-data; name="file"; filename="taxi.pdf"\r\nContent-Type: application/pdf\r\n\r\n%PDF-1.4 receipt\r\n--X--\r\n`,
    });
    const receipt = up.json().file.id;
    const c = await kofi.post("/api/requests", { kind: "expense", title: "Taxi to Apex Bakery", amount: 12500, spentOn: "2026-11-12", receiptFileId: receipt });
    expect(c.body.request).toMatchObject({ status: "waiting", stage: "manager", amount: "12500.00", hasReceipt: true, with: { id: ngoziId } });
    const id = c.body.request.id;
    // Paying isn't the manager's step, and Tayo can't act before it reaches him.
    expect((await ngozi.post(`/api/requests/${id}/act`, { action: "pay" })).status).toBe(400);
    expect((await tayo.post(`/api/requests/${id}/act`, { action: "pay" })).status).toBe(404);
    expect((await ngozi.get(`/api/requests/${id}/receipt`)).status).toBe(200);
    const ok = await ngozi.post(`/api/requests/${id}/act`, { action: "approve" });
    expect(ok.body.request).toMatchObject({ status: "approved", stage: "finance", with: { id: tayoId } });
    // Ngozi still sees it (she handled it); it now waits for Tayo.
    expect((await ngozi.get(`/api/requests/${id}`)).status).toBe(200);
    expect((await tayo.get("/api/requests?scope=handle")).body.requests.map((x: any) => x.id)).toContain(id);
    expect((await tayo.get(`/api/requests/${id}/receipt`)).status).toBe(200);
    const paid = await tayo.post(`/api/requests/${id}/act`, { action: "pay" });
    expect(paid.body.request.status).toBe("paid");
    expect((await kofi.get("/api/requests?kind=expense")).body.requests[0].statusName).toBe("Paid");
    // Someone else's receipt can't be attached.
    const theirs = await ngozi.post("/api/requests", { kind: "expense", title: "Lunch", amount: 5000, receiptFileId: receipt });
    expect(theirs.status).toBe(400);
  });
});
