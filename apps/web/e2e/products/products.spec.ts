import { expect, type Page, test } from "@playwright/test";
import { formatMoney, NBSP } from "../../src/lib/format/index.ts";
import { SEED_USERS, signIn } from "../support/auth.ts";
import { resetDatabase } from "../support/database.ts";
import { apiUrl, givenProduct } from "../support/products.ts";

const GENERAL_16 = `General 16${NBSP}%`;

// Every test acts as the seeded admin; read-only roles are in read-only.spec.ts.
test.beforeEach(async ({ page }) => {
  await resetDatabase();
  await signIn(page);
});

async function fillForm(
  page: Page,
  fields: { sku?: string; unit?: string; name?: string; price?: string; tax?: string },
) {
  if (fields.sku !== undefined) await page.getByLabel("Código").fill(fields.sku);
  if (fields.unit !== undefined) {
    await page.getByRole("combobox", { name: "Unidad de medida" }).click();
    await page.getByRole("option", { name: fields.unit }).click();
  }
  if (fields.name !== undefined) await page.getByLabel("Nombre").fill(fields.name);
  if (fields.price !== undefined) await page.getByLabel("Precio de venta").fill(fields.price);
  if (fields.tax !== undefined) {
    await page.getByRole("combobox", { name: "Alícuota de IVA" }).click();
    await page.getByRole("option", { name: fields.tax }).click();
  }
}

const submit = (page: Page) => page.getByRole("button", { name: "Guardar producto" }).click();

const validFlour = {
  sku: "HAR-PAN-1K",
  unit: "Bulto",
  name: "Harina de maíz precocida 1 kg",
  price: "1,45",
  tax: "Exento",
};

test.describe("create a product", () => {
  test("an admin creates a product and sees it in the list with the status line", async ({
    page,
  }) => {
    await page.goto("/productos");
    await expect(page.getByText("Aún no hay productos")).toBeVisible();
    await page.getByRole("link", { name: "Nuevo producto" }).click();

    await fillForm(page, validFlour);
    await submit(page);

    await expect(page).toHaveURL(/\/productos(\?|$)/);
    await expect(page.getByRole("status")).toHaveText("Producto HAR-PAN-1K creado.");
    const row = page.getByRole("row", { name: /HAR-PAN-1K/ });
    for (const text of [
      "HAR-PAN-1K",
      "Harina de maíz precocida 1 kg",
      "Bulto",
      "Exento",
      formatMoney(145, "USD"),
    ]) {
      await expect(row).toContainText(text);
    }

    // Stored as 145 minor units in USD.
    const listed = await (await page.request.get(`${apiUrl}/api/products`)).json();
    expect(listed.items[0].salePrice).toEqual({ minorUnits: 145, currency: "USD" });
  });

  test("the form opens with focus on Código and IVA defaulting to General 16 %", async ({
    page,
  }) => {
    await page.goto("/productos/nuevo");

    await expect(page.getByLabel("Código")).toBeFocused();
    await expect(page.getByRole("combobox", { name: "Alícuota de IVA" })).toHaveText(GENERAL_16);
  });

  test("a code that already exists is reported on Código", async ({ page, request }) => {
    await givenProduct(request, { sku: "HAR-PAN-1K", name: "Harina" });
    await page.goto("/productos/nuevo");

    await fillForm(page, { ...validFlour, name: "Otra harina" });
    await submit(page);

    await expect(page.getByText("Ya existe un producto con el código HAR-PAN-1K.")).toBeVisible();
    await expect(page.getByLabel("Código")).toBeFocused();
  });

  test("a code typed in lowercase is saved in uppercase and then counts as a duplicate", async ({
    page,
  }) => {
    await page.goto("/productos/nuevo");
    await fillForm(page, { ...validFlour, sku: "har-pan-1k" });
    await submit(page);
    await expect(page.getByRole("row", { name: /HAR-PAN-1K/ })).toBeVisible();

    await page.getByRole("link", { name: "Nuevo producto" }).click();
    await fillForm(page, validFlour);
    await submit(page);

    await expect(page.getByText("Ya existe un producto con el código HAR-PAN-1K.")).toBeVisible();
  });
});

test.describe("form validation", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/productos/nuevo");
  });

  test("a code with spaces says which characters are allowed", async ({ page }) => {
    await fillForm(page, { ...validFlour, sku: "HAR PAN" });
    await submit(page);

    await expect(
      page.getByText("Usar solo letras, números y guiones, sin espacios (máximo 20).", {
        exact: true,
      }),
    ).toBeVisible();
    await expect(page.getByLabel("Código")).toBeFocused();
  });

  test("a price with 3 decimals is rejected, never rounded", async ({ page }) => {
    await fillForm(page, { ...validFlour, price: "1,456" });
    await submit(page);

    await expect(page.getByText("Usar como máximo 2 decimales.")).toBeVisible();
  });

  test("a price of 0 must be greater than $ 0,00", async ({ page }) => {
    await fillForm(page, { ...validFlour, price: "0" });
    await submit(page);

    await expect(
      page.getByText(`El precio debe ser mayor que ${formatMoney(0, "USD")}.`),
    ).toBeVisible();
  });

  test("empty fields are reported, focus goes to the first one", async ({ page }) => {
    await submit(page);

    await expect(page.getByText("Falta el código.")).toBeVisible();
    await expect(page.getByText("Falta la unidad de medida.")).toBeVisible();
    await expect(page.getByText("Falta el nombre.")).toBeVisible();
    await expect(page.getByText("Falta el precio de venta.")).toBeVisible();
    await expect(page.getByLabel("Código")).toBeFocused();
  });
});

test.describe("the product list", () => {
  test("30 products: sorted by Código, 25 rows, pager 1–25 de 30", async ({ page, request }) => {
    for (let i = 1; i <= 30; i++) {
      await givenProduct(request, {
        sku: `P-${String(i).padStart(2, "0")}`,
        name: `Producto ${i}`,
      });
    }

    await page.goto("/productos");

    await expect(page.getByText("1–25 de 30 productos")).toBeVisible();
    const rows = page.locator("tbody tr");
    await expect(rows).toHaveCount(25);
    await expect(rows.first()).toContainText("P-01");
    await expect(rows.last()).toContainText("P-25");

    await page.getByRole("button", { name: "Página siguiente" }).click();
    await expect(page.getByText("26–30 de 30 productos")).toBeVisible();
    await expect(rows).toHaveCount(5);
  });

  test("search by name, by code, and with no results", async ({ page, request }) => {
    await givenProduct(request, { sku: "HAR-PAN-1K", name: "Harina de maíz precocida 1 kg" });
    await givenProduct(request, { sku: "ACE-GIR-1L", name: "Aceite de girasol 1 L" });
    await page.goto("/productos");
    const search = page.getByRole("searchbox", { name: "Buscar por código o nombre" });
    const rows = page.locator("tbody tr");

    await search.fill("aceite");
    await expect(rows.first()).toContainText("ACE-GIR-1L");
    await expect(rows).toHaveCount(1);

    await search.fill("HAR-");
    await expect(rows.first()).toContainText("HAR-PAN-1K");
    await expect(rows).toHaveCount(1);

    await search.fill("xyz");
    await expect(page.getByText("Sin resultados para «xyz»")).toBeVisible();
    await page.getByRole("button", { name: "Limpiar búsqueda" }).click();
    await expect(rows).toHaveCount(2);
    await expect(search).toHaveValue("");
  });

  test("following the sidebar link clears the search instead of bringing it back", async ({
    page,
    request,
  }) => {
    await givenProduct(request, { sku: "HAR-PAN-1K", name: "Harina de maíz" });
    await givenProduct(request, { sku: "ACE-GIR-1L", name: "Aceite de girasol" });
    await page.goto("/productos");
    const search = page.getByRole("searchbox", { name: "Buscar por código o nombre" });
    await search.fill("harina");
    await expect(page.locator("tbody tr")).toHaveCount(1);

    await page.getByRole("navigation", { name: "Principal" }).getByRole("link").click();

    await expect(page.locator("tbody tr")).toHaveCount(2);
    await expect(search).toHaveValue("");
    await expect(page).not.toHaveURL(/q=/);
  });

  test("a page beyond the last one goes to the last page", async ({ page, request }) => {
    for (let i = 1; i <= 30; i++) {
      await givenProduct(request, {
        sku: `P-${String(i).padStart(2, "0")}`,
        name: `Producto ${i}`,
      });
    }

    await page.goto("/productos?page=9");

    await expect(page.getByText("26–30 de 30 productos")).toBeVisible();
  });

  test("with no products it shows the empty state and the way to create one", async ({ page }) => {
    await page.goto("/productos");

    await expect(page.getByText("Aún no hay productos")).toBeVisible();
    await expect(page.getByRole("link", { name: "Nuevo producto" })).toBeVisible();
  });

  test("a failed load shows the error with Reintentar, which loads again", async ({
    page,
    request,
  }) => {
    await givenProduct(request, { sku: "HAR-PAN-1K", name: "Harina" });
    await page.route("**/api/products?**", (route) =>
      route.fulfill({ status: 500, json: { code: "INTERNAL_ERROR" } }),
    );

    await page.goto("/productos");
    await expect(
      page.getByText(
        "No se pudo cargar la lista de productos. Revisar la conexión e intentar de nuevo.",
      ),
    ).toBeVisible();

    await page.unroute("**/api/products?**");
    await page.getByRole("button", { name: "Reintentar" }).click();
    await expect(page.getByRole("row", { name: /HAR-PAN-1K/ })).toBeVisible();
  });
});

test.describe("app shell", () => {
  const roleNames = {
    admin: "Administrador",
    sales: "Ventas",
    purchasing: "Compras",
    warehouse: "Almacén",
  } as const;

  for (const [role, roleName] of Object.entries(roleNames)) {
    test(`${role}: the sidebar offers Productos and the footer says ${roleName}`, async ({
      page,
    }) => {
      const user = SEED_USERS[role as keyof typeof roleNames];
      // Replace the admin signed in by beforeEach.
      await page.context().clearCookies();
      await signIn(page, user);
      await page.goto("/productos");

      const nav = page.getByRole("navigation", { name: "Principal" });
      await expect(nav.getByRole("link")).toHaveText(["Productos"]);
      const sidebar = page.getByRole("complementary");
      await expect(sidebar).toContainText(user.name);
      await expect(sidebar.getByText(roleName, { exact: true })).toBeVisible();
    });
  }

  test("the sidebar offers only Productos", async ({ page }) => {
    await page.goto("/productos");

    const nav = page.getByRole("navigation", { name: "Principal" });
    await expect(nav.getByRole("link")).toHaveCount(1);
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
