import { describe, expect, it } from "vitest";
import type { FastifyInstance } from "fastify";
import { addMember, getApp, signUpWithOrg, type Client } from "./helpers";

const upload = (app: FastifyInstance, c: Client, url: string, name: string) => app.inject({
  method: "POST", url,
  headers: { cookie: Object.entries(c.cookies).map(([k, v]) => `${k}=${v}`).join("; "), "content-type": "multipart/form-data; boundary=X" },
  payload: `--X\r\nContent-Disposition: form-data; name="file"; filename="${name}"\r\nContent-Type: application/pdf\r\n\r\n%PDF-1.4 ${name}\r\n--X--\r\n`,
});

describe("My Workspace: Profile & documents", () => {
  it("shows the person's own record and papers; they keep their contact details and add their own documents", async () => {
    const app = await getApp();
    const { c: admin } = await signUpWithOrg(app);
    const { c: kofi, email } = await addMember(app, admin, "member", "Kofi Mensah");
    const { c: efua } = await addMember(app, admin, "member", "Efua Nyarko");
    const emp = await admin.post("/api/people/employees", { firstName: "Kofi", lastName: "Mensah", email, jobTitle: "Sales rep", sendAccess: false });
    // HR attaches his contract to his record.
    const contract = await upload(app, admin, `/api/files?kind=system&linkType=employee&linkId=${emp.body.employee.id}`, "contract.pdf");
    expect(contract.statusCode).toBe(200);
    const contractId = contract.json().file.id;

    expect((await kofi.get("/api/my/details")).body.details).toMatchObject({ name: "Kofi Mensah", jobTitle: "Sales rep" });
    // Contact details are his to change; his job title isn't.
    expect((await kofi.patch("/api/my/details", { phone: "0803 555 0142", emergencyContact: "Ama Mensah, 0805 333 4444", jobTitle: "CEO" })).status).toBe(200);
    const d = (await kofi.get("/api/my/details")).body.details;
    expect(d).toMatchObject({ phone: "0803 555 0142", emergencyContact: "Ama Mensah, 0805 333 4444", jobTitle: "Sales rep" });

    // He sees the contract HR added and adds his own ID, with when it expires.
    const mine = await upload(app, kofi, "/api/my/documents?category=National%20ID&expiresOn=2027-03-03", "id.pdf");
    expect(mine.statusCode).toBe(200);
    const docs = (await kofi.get("/api/my/documents")).body.documents;
    expect(docs.map((x: any) => x.name).sort()).toEqual(["contract.pdf", "id.pdf"]);
    expect(docs.find((x: any) => x.name === "id.pdf")).toMatchObject({ category: "National ID", expiresOn: "2027-03-03", mine: true, addedBy: "You" });
    expect((await kofi.get(`/api/my/documents/${contractId}/content`)).status).toBe(200);
    // HR's stays; his own he can remove. HR sees his on his record too.
    expect((await kofi.del(`/api/my/documents/${contractId}`)).status).toBe(403);
    expect((await admin.get(`/api/files/${mine.json().id}/content`)).status).toBe(200);
    expect((await kofi.del(`/api/my/documents/${mine.json().id}`)).status).toBe(200);
    // Nobody else reads his papers through My Workspace.
    expect((await efua.get(`/api/my/documents/${contractId}/content`)).status).toBe(404);
  });
});
