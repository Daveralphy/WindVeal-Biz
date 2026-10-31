import { expect, type Page } from "@playwright/test";

export const PASSWORD = "Testing#2026x";

export async function signIn(page: Page, email = "admin@example-trading.test", password = PASSWORD) {
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: /^Sign in/ }).click();
  await expect(page.getByRole("heading", { level: 1 })).toContainText(/Good (morning|afternoon|evening)/);
}

/** Reads the newest email to `to` from the development mailbox. */
export async function latestMail(page: Page, to: string) {
  for (let i = 0; i < 20; i++) {
    const r = await page.request.get(`http://localhost:4000/api/dev/mailbox?to=${encodeURIComponent(to)}`);
    const items = (await r.json()).items as { code?: string; link?: string; subject: string }[];
    if (items.length) return items[0]!;
    await page.waitForTimeout(250);
  }
  throw new Error(`No email for ${to}`);
}
