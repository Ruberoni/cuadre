import { expect, test } from "@playwright/test";
import { SEED_USERS, signIn } from "../support/auth.ts";
import { resetDatabase } from "../support/database.ts";
import { givenProduct } from "../support/products.ts";

// Products as a role that only reads them (PLAN → Roles; Products handoff, #7): sales stands for
// purchasing and warehouse, which get the same screens.
test.beforeEach(async ({ page }) => {
  await resetDatabase();
  await signIn(page, SEED_USERS.sales);
});

test("the footer says who is signed in: Ventas", async ({ page }) => {
  await page.goto("/productos");

  await expect(page.getByRole("complementary").getByText("Ventas", { exact: true })).toBeVisible();
});

test("with no products: the read-only empty state, and no Nuevo producto", async ({ page }) => {
  await page.goto("/productos");

  await expect(page.getByText("Aún no hay productos")).toBeVisible();
  await expect(page.getByText("Un administrador debe crearlos.")).toBeVisible();
  await expect(
    page.getByText("Los productos se usan en las órdenes de compra, los pedidos y las facturas."),
  ).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Nuevo producto" })).toHaveCount(0);
});

test("with products: the list, without Nuevo producto, and Código as plain text", async ({
  page,
  request,
}) => {
  await givenProduct(request, { sku: "HAR-PAN-1K", name: "Harina de maíz precocida 1 kg" });

  await page.goto("/productos");

  const row = page.getByRole("row", { name: /HAR-PAN-1K/ });
  await expect(row).toBeVisible();
  await expect(row.getByRole("link")).toHaveCount(0);
  await expect(page.getByRole("searchbox", { name: "Buscar por código o nombre" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Nuevo producto" })).toHaveCount(0);
});

test("opening the new-product URL and saving shows that only an administrator can", async ({
  page,
}) => {
  await page.goto("/productos/nuevo");
  await page.getByLabel("Código").fill("HAR-PAN-1K");
  await page.getByRole("combobox", { name: "Unidad de medida" }).click();
  await page.getByRole("option", { name: "Bulto" }).click();
  await page.getByLabel("Nombre").fill("Harina de maíz precocida 1 kg");
  await page.getByLabel("Precio de venta").fill("1,45");
  await page.getByRole("button", { name: "Guardar producto" }).click();

  const alert = page.getByRole("alert");
  await expect(alert).toHaveText("Solo un administrador puede crear o editar productos.");
  await expect(alert).toBeFocused();
  await expect(page).toHaveURL(/\/productos\/nuevo/);
});
