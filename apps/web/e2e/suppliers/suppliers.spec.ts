import { expect, type Page, test } from "@playwright/test";
import { SEED_USERS, signIn } from "../support/auth.ts";
import { givenCustomer } from "../support/customers.ts";
import { resetDatabase } from "../support/database.ts";
import { givenSupplier } from "../support/suppliers.ts";

async function openCreateDialog(page: Page) {
  await page.getByRole("button", { name: "Nuevo proveedor" }).click();
  await expect(page.getByRole("dialog", { name: "Nuevo proveedor" })).toBeVisible();
}

async function fillSupplierForm(
  page: Page,
  fields: { rif?: string; name?: string; phone?: string; email?: string; address?: string },
) {
  const dialog = page.getByRole("dialog", { name: "Nuevo proveedor" });
  if (fields.rif !== undefined) await dialog.getByLabel("RIF").fill(fields.rif);
  if (fields.name !== undefined) await dialog.getByLabel("Razón social").fill(fields.name);
  if (fields.phone !== undefined) await dialog.getByLabel("Teléfono").fill(fields.phone);
  if (fields.email !== undefined) await dialog.getByLabel("Correo electrónico").fill(fields.email);
  if (fields.address !== undefined) await dialog.getByLabel("Dirección").fill(fields.address);
}

const submitDialog = (page: Page) =>
  page
    .getByRole("dialog", { name: "Nuevo proveedor" })
    .getByRole("button", {
      name: "Guardar proveedor",
    })
    .click();

test.describe("suppliers as purchasing", () => {
  test.beforeEach(async ({ page }) => {
    await resetDatabase();
    await signIn(page, SEED_USERS.purchasing);
  });

  test("purchasing user creates a supplier from empty state and sees it in the list", async ({
    page,
  }) => {
    await page.goto("/productos");
    await page
      .getByRole("navigation", { name: "Principal" })
      .getByRole("link", {
        name: "Proveedores",
      })
      .click();

    await expect(page).toHaveURL(/\/proveedores/);
    await expect(page.getByText("Aún no hay proveedores")).toBeVisible();

    await openCreateDialog(page);
    await expect(page.getByRole("dialog").getByLabel("RIF")).toBeFocused();
    await fillSupplierForm(page, {
      rif: "J-30123456-1",
      name: "Distribuidora Andina, C.A.",
      phone: "+58 212-555-0101",
      email: "ventas@andina.test",
      address: "Zona Industrial La Yaguara, Caracas",
    });
    await submitDialog(page);

    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.getByRole("status")).toHaveText("Proveedor J-30123456-1 creado.");
    const row = page.getByRole("row", { name: /J-30123456-1/ });
    await expect(row).toBeVisible();
    await expect(row).toContainText("Distribuidora Andina, C.A.");
    await expect(row).toContainText("+58 212-555-0101");
    await expect(row).toContainText("ventas@andina.test");
  });

  test("normalises unhyphenated lowercase RIF j301234561 to J-30123456-1", async ({ page }) => {
    await page.goto("/proveedores");
    await openCreateDialog(page);
    await fillSupplierForm(page, {
      rif: "j301234561",
      name: "Distribuidora Andina, C.A.",
    });
    await submitDialog(page);

    await expect(page.getByRole("status")).toHaveText("Proveedor J-30123456-1 creado.");
    await expect(page.getByRole("row", { name: /J-30123456-1/ })).toBeVisible();
  });

  test("shows check-digit field message for J-30123456-7", async ({ page }) => {
    await page.goto("/proveedores");
    await openCreateDialog(page);
    await fillSupplierForm(page, {
      rif: "J-30123456-7",
      name: "Distribuidora Andina, C.A.",
    });
    await submitDialog(page);

    await expect(page.getByText("El dígito verificador del RIF no coincide.")).toBeVisible();
    await expect(page.getByRole("dialog").getByLabel("RIF")).toBeFocused();
  });

  test("shows expected-format field message for J-123", async ({ page }) => {
    await page.goto("/proveedores");
    await openCreateDialog(page);
    await fillSupplierForm(page, {
      rif: "J-123",
      name: "Distribuidora Andina, C.A.",
    });
    await submitDialog(page);

    await expect(page.getByText("Escribir un RIF válido, como J-12345678-9.")).toBeVisible();
    await expect(page.getByRole("dialog").getByLabel("RIF")).toBeFocused();
  });

  test("shows duplicate RIF error when J-30123456-1 already exists", async ({ page, request }) => {
    await givenSupplier(request, {
      rif: "J-30123456-1",
      name: "Distribuidora Andina, C.A.",
    });

    await page.goto("/proveedores");
    await openCreateDialog(page);
    await fillSupplierForm(page, {
      rif: "j301234561",
      name: "Otra Empresa, C.A.",
    });
    await submitDialog(page);

    await expect(page.getByText("Ya existe un tercero con el RIF J-30123456-1.")).toBeVisible();
    await expect(page.getByRole("dialog").getByLabel("RIF")).toBeFocused();
  });

  test("filters suppliers by legal name 'andina' and by RIF prefix 'J-301'", async ({
    page,
    request,
  }) => {
    await givenSupplier(request, {
      rif: "J-30123456-1",
      name: "Distribuidora Andina, C.A.",
    });
    await givenSupplier(request, {
      rif: "J-40234567-4",
      name: "Alimentos del Sur, C.A.",
    });

    await page.goto("/proveedores");
    const search = page.getByRole("searchbox", { name: "Buscar por razón social o RIF" });

    await search.fill("andina");
    await expect(page.getByRole("row", { name: /Distribuidora Andina, C\.A\./ })).toBeVisible();
    await expect(page.getByRole("row", { name: /Alimentos del Sur, C\.A\./ })).toHaveCount(0);

    await search.fill("J-301");
    await expect(page.getByRole("row", { name: /J-30123456-1/ })).toBeVisible();
    await expect(page.getByRole("row", { name: /J-40234567-4/ })).toHaveCount(0);

    await search.fill("no-existe-xyz");
    await expect(page.getByText("Sin resultados para «no-existe-xyz»")).toBeVisible();
    await page.getByRole("button", { name: "Limpiar búsqueda" }).click();
    await expect(search).toBeFocused();
    await expect(page.getByRole("row", { name: /Alimentos del Sur, C\.A\./ })).toBeVisible();
  });

  test("warns when RIF belongs to an existing customer and promotes it on confirm keeping its legal name", async ({
    page,
    request,
  }) => {
    await givenCustomer(request, {
      rif: "J-40987654-3",
      name: "Abastos La Esquina, C.A.",
    });

    await page.goto("/proveedores");
    await openCreateDialog(page);
    await fillSupplierForm(page, {
      rif: "J-40987654-3",
      name: "Otro Proveedor, C.A.",
    });
    await submitDialog(page);

    const dialog = page.getByRole("dialog", { name: "Nuevo proveedor" });
    await expect(dialog.getByRole("alert")).toHaveText(
      "El RIF J-40987654-3 ya pertenece al tercero «Abastos La Esquina, C.A.». Al confirmar, también se registrará como proveedor conservando sus datos actuales.",
    );
    await dialog.getByRole("button", { name: "Agregar como proveedor" }).click();

    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.getByRole("status")).toHaveText("Proveedor J-40987654-3 agregado.");
    const row = page.getByRole("row", { name: /J-40987654-3/ });
    await expect(row).toBeVisible();
    await expect(row).toContainText("Abastos La Esquina, C.A.");
  });
});

test.describe("suppliers role restriction", () => {
  test("hides Proveedores from sales sidebar and shows 403 alert on direct URL", async ({
    page,
  }) => {
    await resetDatabase();
    await signIn(page, SEED_USERS.sales);
    await page.goto("/productos");

    const nav = page.getByRole("navigation", { name: "Principal" });
    await expect(nav.getByRole("link", { name: "Productos" })).toBeVisible();
    await expect(nav.getByRole("link", { name: "Proveedores" })).toHaveCount(0);
    await expect(nav.getByText("Compras")).toHaveCount(0);

    await page.goto("/proveedores");
    await expect(page.getByRole("alert")).toHaveText(
      "Solo un administrador o compras puede gestionar proveedores.",
    );
    await expect(page.getByRole("button", { name: "Nuevo proveedor" })).toHaveCount(0);
  });
});
