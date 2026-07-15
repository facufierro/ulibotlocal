import { expect, test, type Page } from "@playwright/test";

// End-to-end against the all-in-one stack (python up.py must have run).
// A real OpenAI key seeded (ULIBOT_OPENAI_TOKEN) is needed for the chat round-trip.
const ADMIN_USER = "admin";
const ADMIN_PASS = "Admin#12345";

async function loginAsAdmin(page: Page) {
  await page.goto("/login/index.php");
  await page.fill("#username", ADMIN_USER);
  await page.fill("#password", ADMIN_PASS);
  await page.click("#loginbtn");
  await expect(page).toHaveURL(/\/my\/?|\/index\.php|\/\?/);
}

test("widget mounts on the dashboard", async ({ page }) => {
  await loginAsAdmin(page);
  await page.goto("/my/");

  // widget.js injects a shadow host <div id="ulibot-host"> once check_assistant succeeds.
  await expect(page.locator("#ulibot-host")).toBeAttached({ timeout: 20_000 });
});

// Full chat round-trip. Selectors inside the shadow DOM depend on the widget template; fill them
// in against your build, then unskip. Playwright pierces shadow DOM automatically.
test.skip("widget returns a real chat reply", async ({ page }) => {
  await loginAsAdmin(page);
  await page.goto("/my/");
  await page.locator("#ulibot-host").waitFor({ state: "attached", timeout: 20_000 });

  // TODO: open the launcher, type into the composer, submit, and assert a non-empty reply.
  // await page.getByRole("button", { name: /chat|uli/i }).click();
  // await page.getByRole("textbox").fill("hello");
  // await page.keyboard.press("Enter");
  // await expect(page.locator(".assistant-message").last()).not.toBeEmpty();
});
