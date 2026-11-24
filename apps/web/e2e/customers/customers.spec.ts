import { expect, type Page, test } from "@playwright/test";
import { SEED_USERS, signIn } from "../support/auth.ts";
import { givenCustomer } from "../support/customers.ts";
import { resetDatabase } from "../support/database.ts";
import { givenSupplier } from "../support/suppliers.ts";

async function openCreateDialog(page: Page) {
  await page.getByRole("button", { name: "Nuevo cliente" }).click();
  await expect(page.getByRole("dialog", { name: "Nuevo cliente" })).toBeVisible();
}

async function fillCustomerForm(
  page: Page,
  fields: { rif?: string; name?: string; phone?: string; email?: string; address?: string },
) {
  const dialog = page.getByRole("dialog", { name: "Nuevo cliente" });
  if (fields.rif !== undefined) await dialog.getByLabel("RIF").fill(fields.rif);
  if (fields.name !== undefined) await dialog.getByLabel("Razón social").fill(fields.name);
  if (fields.phone !== undefined) await dialog.getByLabel("Teléfono").fill(fields.phone);
  if (fields.email !== undefined) await dialog.getByLabel("Correo electrónico").fill(fields.email);
  if (fields.address !== undefined) await dialog.getByLabel("Dirección").fill(fields.address);
}

const submitDialog = (page: Page, buttonName = "Guardar cliente") =>
  page
    .getByRole("dialog", { name: "Nuevo cliente" })
    .getByRole("button", { name: buttonName })
    .click();

test.describe("customers as sales", () => {
  test.beforeEach(async ({ page }) => {
    await resetDatabase();
    await signIn(page, SEED_USERS.sales);
  });

  test("sales user creates a customer from empty state and sees it in the list", async ({
    page,
  }) => {
    await page.goto("/");
    const nav = page.getByRole("navigation", { name: "Principal" });
    await expect(nav.getByText("Ventas")).toBeVisible();
    await nav.getByRole("link", { name: "Clientes" }).click();

    await expect(page).toHaveURL(/\/clientes/);
    await expect(page.getByText("Aún no hay clientes")).toBeVisible();

    await openCreateDialog(page);
    await expect(page.getByRole("dialog").getByLabel("RIF")).toBeFocused();
    await fillCustomerForm(page, {
      rif: "J-40987654-3",
      name: "Abastos La Esquina, C.A.",
      phone: "+58 212-555-0201",
      email: "compras@laesquina.test",
      address: "Av. Francisco de Miranda, Chacao, Caracas",
    });
    await submitDialog(page);

    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.getByRole("status")).toHaveText("Cliente J-40987654-3 creado.");
    const row = page.getByRole("row", { name: /J-40987654-3/ });
    await expect(row).toBeVisible();
    await expect(row).toContainText("Abastos La Esquina, C.A.");
    await expect(row).toContainText("+58 212-555-0201");
    await expect(row).toContainText("compras@laesquina.test");
  });

  test("accepts an individual customer with RIF V-12345678-1", async ({ page }) => {
    await page.goto("/clientes");
    await openCreateDialog(page);
    await fillCustomerForm(page, {
      rif: "V-12345678-1",
      name: "María Elena González",
    });
    await submitDialog(page);

    await expect(page.getByRole("status")).toHaveText("Cliente V-12345678-1 creado.");
    const row = page.getByRole("row", { name: /V-12345678-1/ });
    await expect(row).toBeVisible();
    await expect(row).toContainText("María Elena González");
  });

  test("shows duplicate RIF error when J-40987654-3 already exists as a customer", async ({
    page,
    request,
  }) => {
    await givenCustomer(request, {
      rif: "J-40987654-3",
      name: "Abastos La Esquina, C.A.",
    });

    await page.goto("/clientes");
    await openCreateDialog(page);
    await fillCustomerForm(page, {
      rif: "j409876543",
      name: "Otro Cliente, C.A.",
    });
    await submitDialog(page);

    await expect(page.getByText("Ya existe un tercero con el RIF J-40987654-3.")).toBeVisible();
    await expect(page.getByRole("dialog").getByLabel("RIF")).toBeFocused();
  });

  test("warns when RIF belongs to an existing supplier and promotes it on confirm keeping its legal name", async ({
    page,
    request,
  }) => {
    await givenSupplier(request, {
      rif: "J-30123456-1",
      name: "Distribuidora Andina, C.A.",
      phone: "+58 212-555-0101",
      email: "ventas@andina.test",
    });

    await page.goto("/clientes");
    await expect(page.getByText("Aún no hay clientes")).toBeVisible();

    await openCreateDialog(page);
    await fillCustomerForm(page, {
      rif: "j301234561",
      name: "Otro Nombre, C.A.",
      phone: "+58 414-000-0000",
    });
    await submitDialog(page);

    const dialog = page.getByRole("dialog", { name: "Nuevo cliente" });
    const warning = dialog.getByRole("alert");
    await expect(warning).toHaveText(
      "El RIF J-30123456-1 ya pertenece al tercero «Distribuidora Andina, C.A.». Al confirmar, también se registrará como cliente conservando sus datos actuales.",
    );
    await expect(warning).toBeFocused();
    await expect(dialog.getByRole("button", { name: "Agregar como cliente" })).toBeVisible();

    // Editing the RIF clears the pending confirmation so another RIF cannot be confirmed blindly.
    await dialog.getByLabel("RIF").fill("J-40987654-3");
    await expect(dialog.getByRole("alert")).toHaveCount(0);
    await expect(dialog.getByRole("button", { name: "Guardar cliente" })).toBeVisible();

    // Cancelling after warning leaves the customer list untouched.
    await dialog.getByLabel("RIF").fill("j301234561");
    await submitDialog(page);
    await expect(dialog.getByRole("alert")).toBeVisible();
    await dialog.getByRole("button", { name: "Cancelar" }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.getByText("Aún no hay clientes")).toBeVisible();

    // Re-opening and confirming promotes the supplier to customer keeping its legal name and contact info.
    await openCreateDialog(page);
    await fillCustomerForm(page, {
      rif: "j301234561",
      name: "Otro Nombre, C.A.",
      phone: "+58 414-000-0000",
    });
    await submitDialog(page);
    await expect(dialog.getByRole("alert")).toBeVisible();
    await submitDialog(page, "Agregar como cliente");

    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page.getByRole("status")).toHaveText("Cliente J-30123456-1 agregado.");
    const row = page.getByRole("row", { name: /J-30123456-1/ });
    await expect(row).toBeVisible();
    await expect(row).toContainText("Distribuidora Andina, C.A.");
    await expect(row).toContainText("+58 212-555-0101");
    await expect(row).toContainText("ventas@andina.test");
  });

  test("filters customers by legal name 'esquina' and by RIF prefix 'V-123'", async ({
    page,
    request,
  }) => {
    await givenCustomer(request, {
      rif: "J-40987654-3",
      name: "Abastos La Esquina, C.A.",
    });
    await givenCustomer(request, {
      rif: "V-12345678-1",
      name: "María Elena González",
    });

    await page.goto("/clientes");
    const search = page.getByRole("searchbox", { name: "Buscar por razón social o RIF" });

    await search.fill("esquina");
    await expect(page.getByRole("row", { name: /Abastos La Esquina, C\.A\./ })).toBeVisible();
    await expect(page.getByRole("row", { name: /María Elena González/ })).toHaveCount(0);

    await search.fill("V-123");
    await expect(page.getByRole("row", { name: /V-12345678-1/ })).toBeVisible();
    await expect(page.getByRole("row", { name: /J-40987654-3/ })).toHaveCount(0);

    await search.fill("no-existe-xyz");
    await expect(page.getByText("Sin resultados para «no-existe-xyz»")).toBeVisible();
    await page.getByRole("button", { name: "Limpiar búsqueda" }).click();
    await expect(search).toBeFocused();
    await expect(page.getByRole("row", { name: /Abastos La Esquina, C\.A\./ })).toBeVisible();
  });
});

test.describe("customers role restriction", () => {
  for (const role of ["purchasing", "warehouse"] as const) {
    test(`hides Clientes from ${role} sidebar, shows 403 alert on direct URL, and rejects API`, async ({
      page,
    }) => {
      await resetDatabase();
      await signIn(page, SEED_USERS[role]);
      await page.goto("/productos");

      const nav = page.getByRole("navigation", { name: "Principal" });
      await expect(nav.getByRole("link", { name: "Productos" })).toBeVisible();
      await expect(nav.getByRole("link", { name: "Clientes" })).toHaveCount(0);
      await expect(nav.getByText("Ventas")).toHaveCount(0);

      await page.goto("/clientes");
      await expect(page.getByRole("alert")).toHaveText(
        "Solo un administrador o ventas puede gestionar clientes.",
      );
      await expect(page.getByRole("button", { name: "Nuevo cliente" })).toHaveCount(0);

      expect((await page.request.get("/api/customers")).status()).toBe(403);
    });
  }
});
