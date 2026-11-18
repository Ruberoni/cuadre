import { expect, type Page, test } from "@playwright/test";
import { ADMIN, SEED_PASSWORD, signIn } from "../support/auth.ts";
import { forgetSessions, resetDatabase } from "../support/database.ts";
import { givenProduct } from "../support/products.ts";

// Acceptance criteria and Login handoff of #10; App shell footer, sign-out and loading state of #7.

const INVALID_CREDENTIALS =
  "El correo electrónico o la contraseña no son correctos. Revisar ambos e intentar de nuevo.";

test.beforeEach(async () => {
  await resetDatabase();
});

const emailField = (page: Page) => page.getByRole("textbox", { name: "Correo electrónico" });
const passwordField = (page: Page) => page.getByLabel("Contraseña", { exact: true });
const submitButton = (page: Page) => page.getByRole("button", { name: /Iniciar sesión|Iniciando/ });
const sidebar = (page: Page) => page.getByRole("complementary");

async function fillAndSubmit(page: Page, email: string, password: string) {
  await emailField(page).fill(email);
  await passwordField(page).fill(password);
  await submitButton(page).click();
}

/** Holds every request to `url` until `release()` is called (no sleeps: the test decides). */
async function holdRequests(page: Page, url: string) {
  let release = () => {};
  const released = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route(url, async (route) => {
    await released;
    await route.continue();
  });
  return release;
}

test.describe("signing in", () => {
  test("the seeded admin lands on Productos and the sidebar footer shows Administrador", async ({
    page,
  }) => {
    await page.goto("/login");
    await expect(page).toHaveTitle("Iniciar sesión · Cuadre");
    await expect(page.getByRole("heading", { level: 1, name: "Iniciar sesión" })).toBeVisible();

    await fillAndSubmit(page, ADMIN.email, SEED_PASSWORD);

    await expect(page).toHaveURL(/\/productos(\?|$)/);
    await expect(page).toHaveTitle("Productos · Cuadre");
    await expect(sidebar(page)).toContainText("Administrador");
    await expect(sidebar(page)).toContainText(ADMIN.name);
  });

  test("a wrong password and an unknown email show the same generic error, focused", async ({
    page,
  }) => {
    await page.goto("/login");

    await fillAndSubmit(page, ADMIN.email, "not-the-password");
    const alert = page.getByRole("alert");
    await expect(alert).toHaveText(INVALID_CREDENTIALS);
    await expect(alert).toBeFocused();
    // Values kept.
    await expect(emailField(page)).toHaveValue(ADMIN.email);

    await fillAndSubmit(page, "nadie@cuadre.test", SEED_PASSWORD);
    await expect(alert).toHaveText(INVALID_CREDENTIALS);
    await expect(alert).toBeFocused();
    await expect(page).toHaveURL(/\/login/);
  });

  test("the email is trimmed before it is sent", async ({ page }) => {
    await page.goto("/login");

    await fillAndSubmit(page, `  ${ADMIN.email}  `, SEED_PASSWORD);

    await expect(sidebar(page)).toContainText("Administrador");
  });

  test("a network failure shows the connection message in the alert", async ({ page }) => {
    await page.route("**/api/auth/sign-in/email", (route) => route.abort());
    await page.goto("/login");

    await fillAndSubmit(page, ADMIN.email, SEED_PASSWORD);

    await expect(page.getByRole("alert")).toHaveText(
      "No se pudo iniciar sesión. Revisar la conexión e intentar de nuevo.",
    );
    await expect(page.getByRole("alert")).toBeFocused();
  });

  test("while signing in the button is busy, a second submit is ignored, fields stay editable", async ({
    page,
  }) => {
    const signInCalls: string[] = [];
    page.on("request", (request) => {
      if (request.url().endsWith("/api/auth/sign-in/email")) signInCalls.push(request.url());
    });
    const release = await holdRequests(page, "**/api/auth/sign-in/email");
    await page.goto("/login");

    await fillAndSubmit(page, ADMIN.email, SEED_PASSWORD);
    const busy = page.getByRole("button", { name: "Iniciando sesión…" });
    await expect(busy).toHaveAttribute("aria-busy", "true");
    await passwordField(page).press("Enter");
    await expect(emailField(page)).toBeEditable();

    release();
    await expect(sidebar(page)).toContainText("Administrador");
    expect(signInCalls).toHaveLength(1);
  });
});

test.describe("the Login form", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/login");
  });

  test("opens with focus on Correo electrónico and the handoff's field attributes", async ({
    page,
  }) => {
    await expect(emailField(page)).toBeFocused();
    await expect(emailField(page)).toHaveAttribute("type", "email");
    await expect(emailField(page)).toHaveAttribute("autocomplete", "username");
    await expect(emailField(page)).toHaveAttribute("spellcheck", "false");
    await expect(emailField(page)).toHaveAttribute("autocapitalize", "off");
    await expect(emailField(page)).toHaveAttribute("aria-required", "true");
    await expect(emailField(page)).toHaveAttribute("placeholder", "nombre@empresa.com");
    await expect(passwordField(page)).toHaveAttribute("type", "password");
    await expect(passwordField(page)).toHaveAttribute("autocomplete", "current-password");
    await expect(passwordField(page)).toHaveAttribute("aria-required", "true");
  });

  test("empty fields: both messages, focus on the first invalid field", async ({ page }) => {
    await submitButton(page).click();

    await expect(page.getByText("Falta el correo electrónico.")).toBeVisible();
    await expect(page.getByText("Falta la contraseña.")).toBeVisible();
    await expect(emailField(page)).toBeFocused();
    await expect(emailField(page)).toHaveAttribute("aria-invalid", "true");
  });

  test("an email without a valid shape is reported, and re-checked as it changes", async ({
    page,
  }) => {
    await fillAndSubmit(page, "mfernandez@distribuidora", SEED_PASSWORD);

    const message = page.getByText(
      "Escribir un correo electrónico válido, como nombre@empresa.com.",
    );
    await expect(message).toBeVisible();
    await expect(emailField(page)).toBeFocused();

    await emailField(page).fill(ADMIN.email);
    await expect(message).toBeHidden();
  });

  test("only the password missing: focus goes to Contraseña", async ({ page }) => {
    await emailField(page).fill(ADMIN.email);
    await submitButton(page).click();

    await expect(page.getByText("Falta la contraseña.")).toBeVisible();
    await expect(passwordField(page)).toBeFocused();
  });

  test("Mostrar / Ocultar shows the password, keeps focus and says so; submit hides it", async ({
    page,
  }) => {
    await passwordField(page).fill("not-the-password");
    const show = page.getByRole("button", { name: "Mostrar contraseña" });
    await expect(show).toHaveText("Mostrar");

    await show.click();
    const hide = page.getByRole("button", { name: "Ocultar contraseña" });
    await expect(hide).toBeFocused();
    await expect(hide).toHaveText("Ocultar");
    await expect(passwordField(page)).toHaveAttribute("type", "text");
    await expect(page.getByText("Contraseña visible.")).toBeAttached();

    // From the keyboard too, and focus stays on the toggle.
    await page.keyboard.press("Space");
    await expect(show).toBeFocused();
    await expect(passwordField(page)).toHaveAttribute("type", "password");
    await expect(page.getByText("Contraseña oculta.")).toBeAttached();
    await page.keyboard.press("Enter");
    await expect(hide).toBeFocused();
    await expect(passwordField(page)).toHaveAttribute("type", "text");

    await emailField(page).fill(ADMIN.email);
    await submitButton(page).click();
    await expect(page.getByRole("alert")).toHaveText(INVALID_CREDENTIALS);
    await expect(passwordField(page)).toHaveAttribute("type", "password");
  });

  test("Tab order: Correo electrónico, Contraseña, Mostrar, Iniciar sesión", async ({ page }) => {
    await expect(emailField(page)).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(passwordField(page)).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(page.getByRole("button", { name: "Mostrar contraseña" })).toBeFocused();
    await page.keyboard.press("Tab");
    await expect(submitButton(page)).toBeFocused();
  });
});

test.describe("the session", () => {
  test("without a session the products list shows Login; after signing in, the list opens", async ({
    page,
    request,
  }) => {
    await givenProduct(request, { sku: "HAR-PAN-1K", name: "Harina de maíz precocida 1 kg" });
    await givenProduct(request, { sku: "ACE-GIR-1L", name: "Aceite de girasol 1 L" });
    // Not signed in: `givenProduct` signs in its own request context, not the page's.
    await page.goto("/productos?q=harina");

    await expect(page.getByRole("heading", { level: 1, name: "Iniciar sesión" })).toBeVisible();
    await expect(page).toHaveURL(/\/login\?redirect=/);
    // No notice on Login (maintainer decision 2026-11-18).
    await expect(page.getByRole("alert")).toHaveCount(0);

    await fillAndSubmit(page, ADMIN.email, SEED_PASSWORD);

    await expect(page).toHaveURL(/\/productos\?.*q=harina/);
    await expect(page.getByRole("row", { name: /HAR-PAN-1K/ })).toBeVisible();
    await expect(page.getByRole("row", { name: /ACE-GIR-1L/ })).toHaveCount(0);
  });

  test("a signed-in user stays signed in after reloading", async ({ page }) => {
    await signIn(page);
    await page.goto("/productos");
    await expect(sidebar(page)).toContainText("Administrador");

    await page.reload();

    await expect(page).toHaveURL(/\/productos/);
    await expect(sidebar(page)).toContainText("Administrador");
  });

  test("a signed-in user opening Login goes straight to Productos", async ({ page }) => {
    await signIn(page);

    await page.goto("/login");

    await expect(page).toHaveURL(/\/productos/);
  });

  test("Cerrar sesión ends the session, shows Login, and Back shows no app data", async ({
    page,
    request,
  }) => {
    await givenProduct(request, { sku: "HAR-PAN-1K", name: "Harina de maíz" });
    await signIn(page);
    await page.goto("/productos");
    await expect(page.getByRole("row", { name: /HAR-PAN-1K/ })).toBeVisible();
    await page.getByRole("link", { name: "Nuevo producto" }).click();
    await expect(page).toHaveURL(/\/productos\/nuevo/);

    await page.getByRole("button", { name: "Cerrar sesión" }).click();

    await expect(page.getByRole("heading", { level: 1, name: "Iniciar sesión" })).toBeVisible();
    expect(new URL(page.url()).pathname).toBe("/login");
    expect(new URL(page.url()).search).toBe("");
    await expect(emailField(page)).toHaveValue("");

    await page.goBack();

    await expect(page.getByRole("heading", { level: 1, name: "Iniciar sesión" })).toBeVisible();
    await expect(page.getByRole("navigation")).toHaveCount(0);
    await expect(page.getByRole("row")).toHaveCount(0);
    // And the server agrees: the old session no longer opens the API.
    expect((await page.request.get("/api/products")).status()).toBe(401);
  });

  test("a session that ends while in the app goes to Login, then back to the same page", async ({
    page,
    request,
  }) => {
    await givenProduct(request, { sku: "ACE-GIR-1L", name: "Aceite de girasol 1 L" });
    await signIn(page);
    await page.goto("/productos");
    await expect(sidebar(page)).toContainText("Administrador");

    await forgetSessions();
    await page.getByRole("searchbox", { name: "Buscar por código o nombre" }).fill("aceite");

    await expect(page.getByRole("heading", { level: 1, name: "Iniciar sesión" })).toBeVisible();
    await fillAndSubmit(page, ADMIN.email, SEED_PASSWORD);
    await expect(page).toHaveURL(/\/productos\?.*q=aceite/);
  });
});

test.describe("while the session loads", () => {
  test("an app page shows only the empty frame: no nav, no footer, nothing in main", async ({
    page,
  }) => {
    await signIn(page);
    const release = await holdRequests(page, "**/api/auth/get-session");
    await page.goto("/productos");

    await expect(sidebar(page)).toContainText("Cuadre");
    await expect(page.getByRole("navigation")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Cerrar sesión" })).toHaveCount(0);
    await expect(page.getByRole("main")).toHaveText("");

    release();
    await expect(page.getByRole("navigation", { name: "Principal" })).toBeVisible();
    await expect(sidebar(page)).toContainText("Administrador");
  });

  test("Login renders nothing until the check answers", async ({ page }) => {
    const release = await holdRequests(page, "**/api/auth/get-session");
    await page.goto("/login");

    await expect(page.locator("#root")).toBeEmpty();

    release();
    await expect(emailField(page)).toBeFocused();
  });
});
