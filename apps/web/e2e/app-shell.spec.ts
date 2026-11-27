import { expect, test } from "@playwright/test";
import { SEED_USERS, signIn } from "./support/auth.ts";
import { resetDatabase } from "./support/database.ts";

test.beforeEach(async ({ page }) => {
  await resetDatabase();
  await signIn(page);
});

test.describe("app shell", () => {
  const roleNames = {
    admin: "Administrador",
    sales: "Ventas",
    purchasing: "Compras",
    warehouse: "Almacén",
  } as const;

  const expectedNavByRole: Record<keyof typeof roleNames, readonly string[]> = {
    admin: [
      "Productos",
      "Tasas BCV",
      "Proveedores",
      "Órdenes de compra",
      "Recepciones de mercancía",
      "Clientes",
    ],
    sales: ["Productos", "Tasas BCV", "Clientes"],
    purchasing: [
      "Productos",
      "Tasas BCV",
      "Proveedores",
      "Órdenes de compra",
      "Recepciones de mercancía",
    ],
    warehouse: ["Productos", "Tasas BCV", "Órdenes de compra", "Recepciones de mercancía"],
  };

  for (const [role, roleName] of Object.entries(roleNames)) {
    test(`${role}: the sidebar offers expected links and the footer says ${roleName}`, async ({
      page,
    }) => {
      const roleKey = role as keyof typeof roleNames;
      const user = SEED_USERS[roleKey];
      // Replace the admin signed in by beforeEach.
      await page.context().clearCookies();
      await signIn(page, user);
      await page.goto("/productos");

      const nav = page.getByRole("navigation", { name: "Principal" });
      await expect(nav.getByRole("link")).toHaveText([...expectedNavByRole[roleKey]]);
      const sidebar = page.getByRole("complementary");
      await expect(sidebar).toContainText(user.name);
      await expect(sidebar.getByText(roleName, { exact: true }).last()).toBeVisible();
    });
  }

  test("the sidebar offers expected links for admin", async ({ page }) => {
    await page.goto("/productos");

    const nav = page.getByRole("navigation", { name: "Principal" });
    await expect(nav.getByRole("link")).toHaveCount(6);
    await expect(nav.getByRole("link")).toHaveText([
      "Productos",
      "Tasas BCV",
      "Proveedores",
      "Órdenes de compra",
      "Recepciones de mercancía",
      "Clientes",
    ]);
    await expect(nav.getByRole("link", { name: "Productos" })).toHaveAttribute(
      "aria-current",
      "page",
    );
  });

  test("Productos stays the current page on page 2, sorted, and in the new product form", async ({
    page,
  }) => {
    const link = page
      .getByRole("navigation", { name: "Principal" })
      .getByRole("link", { name: "Productos" });

    for (const path of ["/productos?page=2&sort=name&order=desc", "/productos/nuevo"]) {
      await page.goto(path);
      await expect(link).toHaveAttribute("aria-current", "page");
    }
  });

  test("a status line is not squeezed into a zero-width column", async ({ page }) => {
    await page.goto("/productos/nuevo");
    await page.getByLabel("Código").fill("ABC");
    await page.getByLabel("Nombre").fill("Producto de prueba");
    await page.getByRole("combobox", { name: "Unidad de medida" }).click();
    await page.getByRole("option", { name: "Unidad" }).click();
    await page.getByLabel("Precio de venta").fill("1,00");
    await page.getByRole("button", { name: "Guardar producto" }).click();

    const status = page.getByRole("status").getByText("Producto ABC creado.");
    const box = await status.boundingBox();
    expect(box?.height).toBeLessThan(60); // one line: a squeezed column would be far taller
  });

  test("the skip link is the first Tab stop and moves focus to the content", async ({ page }) => {
    await page.goto("/productos");
    await expect(page.getByRole("heading", { name: "Productos" })).toBeVisible();

    await page.keyboard.press("Tab");
    await expect(page.getByRole("link", { name: "Saltar al contenido" })).toBeFocused();

    await page.keyboard.press("Enter");
    await expect(page.locator("main#contenido")).toBeFocused();
  });
});
