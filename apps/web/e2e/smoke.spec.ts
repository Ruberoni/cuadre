import { expect, test } from "@playwright/test";

// What `pnpm verify` runs against a seeded database: the app boots, the API and the database
// answer, and the main flow works (create a product, see it in the list).
test("the API answers with a reachable database", async ({ request }) => {
  const apiUrl = `http://127.0.0.1:${process.env.E2E_API_PORT ?? 3100}`;

  const response = await request.get(`${apiUrl}/health`);

  expect(response.status()).toBe(200);
  expect(await response.json()).toEqual({ status: "ok", database: "up" });
});

test("the seed is loaded, and a product can be created and found in the list", async ({ page }) => {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));

  // The seed gave the list its products.
  await page.goto("/");
  await expect(page).toHaveTitle("Productos · Cuadre");
  await expect(page.getByRole("row", { name: /HAR-PAN-1K/ })).toBeVisible();

  // Create one with a unique code (the database is shared with the seed, not reset).
  const sku = `SMK-${Date.now().toString(36).toUpperCase()}`;
  await page.getByRole("link", { name: "Nuevo producto" }).click();
  await page.getByLabel("Código").fill(sku);
  await page.getByRole("combobox", { name: "Unidad de medida" }).click();
  await page.getByRole("option", { name: "Unidad" }).click();
  await page.getByLabel("Nombre").fill("Producto de prueba de humo");
  await page.getByLabel("Precio de venta").fill("2,50");
  await page.getByRole("button", { name: "Guardar producto" }).click();

  await expect(page.getByRole("status")).toHaveText(`Producto ${sku} creado.`);
  await page.getByRole("searchbox", { name: "Buscar por código o nombre" }).fill(sku);
  await expect(page.getByRole("row", { name: new RegExp(sku) })).toBeVisible();
  expect(errors).toEqual([]);
});
