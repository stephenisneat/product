import { expect, test } from "@playwright/test";

test("marketing home for logged-out visitors", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Product Agent" })).toBeVisible();
  await expect(page.getByText(/Import your products/i)).toBeVisible();
  await expect(page.getByRole("link", { name: "Get started" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Sign in" }).first()).toBeVisible();
});

test("login page is reachable", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
  await expect(page.getByLabel("Email")).toBeVisible();
});
