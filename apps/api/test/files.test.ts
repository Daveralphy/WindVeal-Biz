import { describe, expect, it } from "vitest";
import { addMember, getApp, signUpWithOrg, type Client } from "./helpers";

/** Builds a multipart body for app.inject. */
function multipart(name: string, content: string, mime = "application/pdf") {
  const boundary = "----wvtest" + Math.random().toString(16).slice(2);
  const body = `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${name}"\r\nContent-Type: ${mime}\r\n\r\n${content}\r\n--${boundary}--\r\n`;
  return { body, contentType: `multipart/form-data; boundary=${boundary}` };
}

async function upload(app: any, c: Client, query: string, name = "contract.pdf") {
  const { body, contentType } = multipart(name, `%PDF-1.4 ${Math.random()}`);
  const res = await app.inject({
    method: "POST", url: `/api/files?${query}`, payload: body,
    headers: { "content-type": contentType, cookie: Object.entries(c.cookies).map(([k, v]) => `${k}=${v}`).join("; ") },
  });
  return { status: res.statusCode, body: res.json() };
}

describe("file access follows the record a file is attached to", () => {
  it("keeps employee files private to HR and the employee", async () => {
    const app = await getApp();
    const { c: admin } = await signUpWithOrg(app);
    const { c: member } = await addMember(app, admin, "member", "Kofi Mensah");
    const emp = await admin.post("/api/people/employees", { firstName: "Grace", lastName: "Eze", email: "grace@example.com", jobTitle: "Accounts Officer" });
    expect(emp.status).toBe(200);
    const employeeId = emp.body.employee?.id ?? emp.body.id;

    const up = await upload(app, admin, `kind=system&linkType=employee&linkId=${employeeId}`);
    expect(up.status).toBe(200);
    const fileId = up.body.file.id;

    // A member with People "view" can't open the employee's contract by guessing its id…
    expect((await member.get(`/api/files/${fileId}/content`)).status).toBe(404);
    // …and can't attach files to someone else's employee record.
    expect((await upload(app, member, `kind=system&linkType=employee&linkId=${employeeId}`)).status).toBe(403);
    // The admin can.
    expect((await admin.get(`/api/files/${fileId}/content`)).status).toBe(200);
  });
});
