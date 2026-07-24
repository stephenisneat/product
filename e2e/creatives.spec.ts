import { expect, test } from "@playwright/test";

/**
 * Creative flow smoke — API contract + UI entry points.
 * Full generate→accept e2e needs Trigger + media keys; those paths are covered
 * by unit tests (enqueue failure parking) and manual QA.
 */
test.describe("video creative surfaces", () => {
  test("creatives list requires auth", async ({ page }) => {
    await page.goto("/studio");
    await expect(page).toHaveURL(/\/login/);
  });

  test("login remains reachable for creative flows", async ({ page }) => {
    await page.goto("/login?next=/studio");
    await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
    await expect(page.getByLabel("Email")).toBeVisible();
  });
});
