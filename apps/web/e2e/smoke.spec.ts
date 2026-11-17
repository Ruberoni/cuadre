import { expect, test } from "@playwright/test";

test("the web app loads a blank page without errors", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));

  const response = await page.goto("/");

  expect(response?.status()).toBe(200);
  await expect(page).toHaveTitle("Cuadre");
  await expect(page.locator("main")).toBeEmpty();
  expect(errors).toEqual([]);
});

test("the API answers with a reachable database", async ({ request }) => {
  const apiUrl = `http://127.0.0.1:${process.env.E2E_API_PORT ?? 3100}`;

  const response = await request.get(`${apiUrl}/health`);

  expect(response.status()).toBe(200);
  expect(await response.json()).toEqual({ status: "ok", database: "up" });
});
