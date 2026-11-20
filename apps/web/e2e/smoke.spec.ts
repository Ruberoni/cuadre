import { expect, test } from "@playwright/test";
import { ADMIN, SEED_PASSWORD } from "./support/auth.ts";

// What `pnpm verify` runs against a seeded database: the app boots, the API and the database
// answer, and the main flow works (sign in as the seeded admin, create a product, see it listed).
test("the API answers with a reachable database", async ({ request }) => {
  const apiUrl = `http://127.0.0.1:${process.env.E2E_API_PORT ?? 3100}`;

  const response = await request.get(`${apiUrl}/health`);

  expect(response.status()).toBe(200);
  expect(await response.json()).toEqual({ status: "ok", database: "up" });
});

test("the seeded admin signs in, and a product can be created and found in the list", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));

  // Without a session the app opens on Login; the seeded admin signs in.
  await page.goto("/");
  await expect(page).toHaveTitle("Iniciar sesión · Cuadre");
  await page.getByRole("textbox", { name: "Correo electrónico" }).fill(ADMIN.email);
  await page.getByLabel("Contraseña", { exact: true }).fill(SEED_PASSWORD);
  await page.getByRole("button", { name: "Iniciar sesión" }).click();

  // The seed gave the list its products.
  await expect(page).toHaveTitle("Productos · Cuadre");
  await expect(page.getByRole("complementary")).toContainText("Administrador");
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
