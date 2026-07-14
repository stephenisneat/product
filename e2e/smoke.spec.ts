import { expect, test } from "@playwright/test";

test("marketing home for logged-out visitors", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Product Agent" })).toBeVisible();
  await expect(page.getByText(/Import your products/i)).toBeVisible();
  await expect(page.getByRole("link", { name: "Enter demo" }).first()).toBeVisible();
});

test("demo login opens catalog and product workspace with agent", async ({ page }) => {
  await page.goto("/api/auth/demo");
  await expect(page.getByRole("heading", { name: "Products" })).toBeVisible();
  await expect(page.getByText("Aurora Insulated Bottle")).toBeVisible();

  await page.getByRole("link", { name: /Aurora Insulated Bottle/i }).click();
  await expect(page.getByRole("heading", { name: "Aurora Insulated Bottle" })).toBeVisible();
  await expect(page.getByText("Agent", { exact: true })).toBeVisible();
  await expect(page.getByPlaceholder(/Propose Meta ad copy/i)).toBeVisible();
});
