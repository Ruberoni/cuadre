// The single UI message catalog (ADR-012): every user-facing error, status line and label that
// comes from an error code or a domain value lives here, in Spanish, verbatim from the design
// handoffs. Screens never write these strings inline and never show a raw code.
import type {
  ExchangeRateField,
  ExchangeRateIssueCode,
  PartnerField,
  PartnerIssueCode,
  ProductField,
  ProductIssueCode,
  Role,
  TaxRate,
  UnitOfMeasure,
} from "@cuadre/contracts";
import type { ClientErrorCode } from "@/api/client";
import type { PasswordInputLabels } from "@/components/password-input";
import type { SignInError } from "@/features/auth/sign-in-error";
import {
  formatDate,
  formatMoney,
  NBSP,
  type ParseAmountError,
  type ParseRateError,
} from "@/lib/format";

/**
 * Message for an error that belongs to no field, shown in the form alert. `UNAUTHORIZED` has none:
 * the client goes to Login instead (Login handoff, #10).
 */
export const errorMessages: Record<
  Exclude<ClientErrorCode, "UNAUTHORIZED">,
  (details: { sku?: string; rif?: string; partnerName?: string; date?: string }) => string
> = {
  VALIDATION_ERROR: () => "Algunos datos no son válidos. Revisar los campos marcados.",
  SKU_ALREADY_EXISTS: ({ sku }) =>
    sku === undefined
      ? "Ya existe un producto con ese código."
      : `Ya existe un producto con el código ${sku}.`,
  RIF_ALREADY_EXISTS: ({ rif }) =>
    rif === undefined
      ? "Ya existe un tercero con ese RIF."
      : `Ya existe un tercero con el RIF ${rif}.`,
  PARTNER_ALREADY_EXISTS: ({ rif, partnerName }) =>
    rif !== undefined && partnerName !== undefined
      ? `El RIF ${rif} ya pertenece al tercero «${partnerName}».`
      : "Este RIF ya pertenece a un tercero registrado.",
  RATE_ALREADY_EXISTS: ({ date }) =>
    date === undefined
      ? "Ya existe una tasa para esa fecha. Para cambiarla, corregir la existente."
      : `Ya existe una tasa para el ${formatDate(date)}. Para cambiarla, corregir la existente.`,
  RATE_DATE_TOO_FAR: () => "La fecha no puede superar 7 días desde hoy.",
  RATE_ALREADY_FROZEN: () =>
    "Esta tasa ya fue usada en un documento emitido y no se puede corregir.",
  MISSING_EXCHANGE_RATE: () => "No hay una tasa BCV registrada para esa fecha.",
  NOT_FOUND: () => "No se encontró lo que se buscaba.",
  // Products handoff (#7): default screen is Productos; module-specific alerts override below.
  FORBIDDEN: () => "Solo un administrador puede crear o editar productos.",
  INTERNAL_ERROR: () => "No se pudo guardar el producto. Revisar la conexión e intentar de nuevo.",
  NETWORK_ERROR: () => "No se pudo guardar el producto. Revisar la conexión e intentar de nuevo.",
};

const SKU_FORMAT = "Usar solo letras, números y guiones, sin espacios (máximo 20).";
const PRICE_NOT_A_NUMBER = "Escribir solo números, con coma para los decimales.";

/** Message of each rule the product fields can break (server issues and the form's own checks). */
export const productFieldMessages: Record<
  ProductField,
  Partial<Record<ProductIssueCode, string>>
> = {
  sku: { REQUIRED: "Falta el código.", INVALID_FORMAT: SKU_FORMAT },
  name: { REQUIRED: "Falta el nombre.", TOO_LONG: "Usar como máximo 120 caracteres." },
  unitOfMeasure: { REQUIRED: "Falta la unidad de medida.", INVALID: "Falta la unidad de medida." },
  salePrice: {
    REQUIRED: "Falta el precio de venta.",
    INVALID: PRICE_NOT_A_NUMBER,
    OUT_OF_RANGE: PRICE_NOT_A_NUMBER,
    NOT_POSITIVE: `El precio debe ser mayor que ${formatMoney(0, "USD")}.`,
  },
  taxRate: { REQUIRED: "Falta la alícuota de IVA.", INVALID: "Falta la alícuota de IVA." },
};

export function productFieldMessage(field: string, code: string): string | undefined {
  const messages: Partial<Record<string, Partial<Record<string, string>>>> = productFieldMessages;
  return messages[field]?.[code];
}

/** What the money field says when the typed text cannot become an amount. */
export const priceParseMessages: Record<ParseAmountError, string> = {
  NOT_A_NUMBER: PRICE_NOT_A_NUMBER,
  TOO_MANY_DECIMALS: "Usar como máximo 2 decimales.",
  OUT_OF_RANGE: PRICE_NOT_A_NUMBER,
  WRONG_CURRENCY_SYMBOL: PRICE_NOT_A_NUMBER,
};

export const unitOfMeasureLabels: Record<UnitOfMeasure, string> = {
  UNIT: "Unidad",
  BOX: "Caja",
  BULK: "Bulto",
  KILOGRAM: "Kilogramo",
  LITER: "Litro",
};

/** Options of the Alícuota de IVA select. */
export const taxRateLabels: Record<TaxRate, string> = {
  GENERAL: `General 16${NBSP}%`,
  REDUCED: `Reducida 8${NBSP}%`,
  EXEMPT: "Exento",
};

/** Values of the IVA column of the list. */
export const taxRateColumnLabels: Record<TaxRate, string> = {
  GENERAL: `16${NBSP}%`,
  REDUCED: `8${NBSP}%`,
  EXEMPT: "Exento",
};

export const productsMessages = {
  pageTitle: "Productos",
  newPageTitle: "Nuevo producto",
  searchPlaceholder: "Buscar por código o nombre",
  newProduct: "Nuevo producto",
  tableCaption: (sortedBy: string) => `Productos, ordenados por ${sortedBy}`,
  columns: {
    sku: "Código",
    name: "Nombre",
    unitOfMeasure: "Unidad de medida",
    taxRate: "IVA",
    salePrice: "Precio de venta",
  },
  pager: (from: number, to: number, total: number) => `${from}–${to} de ${total} productos`,
  previousPage: "Página anterior",
  nextPage: "Página siguiente",
  created: (sku: string) => `Producto ${sku} creado.`,
  empty: {
    title: "Aún no hay productos",
    description: "Los productos se usan en las órdenes de compra, los pedidos y las facturas.",
    /** Roles that cannot create products: no action, only who can. */
    readOnlyDescription: "Un administrador debe crearlos.",
  },
  noResults: {
    title: (query: string) => `Sin resultados para «${query}»`,
    description: "Buscar por otra parte del nombre o por el código.",
    clear: "Limpiar búsqueda",
  },
  loadError: "No se pudo cargar la lista de productos. Revisar la conexión e intentar de nuevo.",
  retry: "Reintentar",
  form: {
    sku: "Código",
    skuHelp: "Único. Letras, números y guiones; máximo 20.",
    unitOfMeasure: "Unidad de medida",
    name: "Nombre",
    salePrice: "Precio de venta",
    salePriceHelp: "En dólares, sin IVA.",
    taxRate: "Alícuota de IVA",
    selectPlaceholder: "Seleccionar…",
    submit: "Guardar producto",
    submitting: "Guardando…",
    cancel: "Cancelar",
  },
} as const;

export const shellMessages = {
  wordmark: "Cuadre",
  skipLink: "Saltar al contenido",
  navLabel: "Principal",
  navGroups: {
    general: "General",
    purchasing: "Compras",
    sales: "Ventas",
  },
  products: "Productos",
  exchangeRates: "Tasas BCV",
  suppliers: "Proveedores",
  customers: "Clientes",
  headerRatePrefix: (date: string) => `Tasa BCV ${date}`,
  noRateBadge: "Sin tasa BCV",
  registerRateLink: "Registrar tasa",
  noRateOtherRoles: "Un administrador debe registrarla.",
  signOut: "Cerrar sesión",
  /** Not in the App shell handoff: proposed in #51, same pattern as the sign-in network message. */
  signOutFailed: "No se pudo cerrar la sesión. Revisar la conexión e intentar de nuevo.",
  documentTitle: (pageTitle: string) => `${pageTitle} · Cuadre`,
} as const;

const RATE_NOT_A_NUMBER = "Escribir solo números, con coma para los decimales.";
const DATE_FORMAT_INVALID = "Escribir una fecha válida con formato dd/mm/aaaa.";

export const exchangeRateFieldMessages: Record<
  ExchangeRateField,
  Partial<Record<ExchangeRateIssueCode, string>>
> = {
  date: {
    REQUIRED: "Falta la fecha.",
    INVALID_DATE: DATE_FORMAT_INVALID,
    INVALID: DATE_FORMAT_INVALID,
  },
  rate: {
    REQUIRED: "Falta la tasa.",
    INVALID_FORMAT: RATE_NOT_A_NUMBER,
    TOO_MANY_DECIMALS: "Usar como máximo 8 decimales.",
    NOT_POSITIVE: "La tasa debe ser mayor que 0.",
    OUT_OF_RANGE: "Escribir un valor de tasa válido.",
    INVALID: RATE_NOT_A_NUMBER,
  },
};

export function exchangeRateFieldMessage(field: string, code: string): string | undefined {
  const messages: Partial<Record<string, Partial<Record<string, string>>>> =
    exchangeRateFieldMessages;
  return messages[field]?.[code];
}

export const rateParseMessages: Record<ParseRateError, string> = {
  NOT_A_NUMBER: RATE_NOT_A_NUMBER,
  TOO_MANY_DECIMALS: "Usar como máximo 8 decimales.",
  NOT_POSITIVE: "La tasa debe ser mayor que 0.",
  OUT_OF_RANGE: "Escribir un valor de tasa válido.",
};

export const exchangeRatesMessages = {
  pageTitle: "Tasas BCV",
  registerAction: "Registrar tasa",
  correctAction: "Corregir",
  frozenBadge: "Congelada",
  tableCaption: "Tasas BCV, ordenadas por fecha más reciente",
  columns: {
    date: "Fecha",
    rate: "Tasa",
    status: "Estado",
    actions: "Acciones",
  },
  pager: (from: number, to: number, total: number) => `${from}–${to} de ${total} tasas`,
  previousPage: "Página anterior",
  nextPage: "Página siguiente",
  recorded: (date: string) => `Tasa del ${date} registrada.`,
  corrected: (date: string) => `Tasa del ${date} corregida.`,
  empty: {
    title: "Aún no hay tasas BCV",
    description: "Las tasas BCV se usan al emitir órdenes de compra, facturas, cobros y pagos.",
    readOnlyDescription: "Un administrador debe registrarlas.",
  },
  loadError: "No se pudo cargar la lista de tasas BCV. Revisar la conexión e intentar de nuevo.",
  retry: "Reintentar",
  form: {
    recordTitle: "Registrar tasa BCV",
    correctTitle: "Corregir tasa BCV",
    date: "Fecha",
    datePlaceholder: "dd/mm/aaaa",
    dateHelp: "Formato dd/mm/aaaa. Hasta 7 días desde hoy.",
    rate: "Tasa",
    rateHelp: "Bolívares por 1 USD; hasta 8 decimales.",
    currencyPrefix: "Bs.",
    submit: "Guardar tasa",
    submitting: "Guardando…",
    cancel: "Cancelar",
  },
  errors: {
    FORBIDDEN: "Solo un administrador puede registrar o corregir tasas BCV.",
    saveFailed: "No se pudo guardar la tasa BCV. Revisar la conexión e intentar de nuevo.",
  },
} as const;

export const partnerFieldMessages: Record<
  PartnerField,
  Partial<Record<PartnerIssueCode, string>>
> = {
  rif: {
    REQUIRED: "Falta el RIF.",
    INVALID_FORMAT: "Escribir un RIF válido, como J-12345678-9.",
    INVALID_CHECK_DIGIT: "El dígito verificador del RIF no coincide.",
    INVALID: "Escribir un RIF válido, como J-12345678-9.",
  },
  name: {
    REQUIRED: "Falta la razón social.",
    TOO_LONG: "Usar como máximo 120 caracteres.",
    INVALID: "Falta la razón social.",
  },
  phone: {
    TOO_LONG: "Usar como máximo 30 caracteres.",
    INVALID: "Usar como máximo 30 caracteres.",
  },
  email: {
    INVALID_FORMAT: "Escribir un correo electrónico válido, como nombre@empresa.com.",
    TOO_LONG: "Usar como máximo 120 caracteres.",
    INVALID: "Escribir un correo electrónico válido, como nombre@empresa.com.",
  },
  address: {
    TOO_LONG: "Usar como máximo 250 caracteres.",
    INVALID: "Usar como máximo 250 caracteres.",
  },
};

export function partnerFieldMessage(field: string, code: string): string | undefined {
  const messages: Partial<Record<string, Partial<Record<string, string>>>> = partnerFieldMessages;
  return messages[field]?.[code];
}

export const suppliersMessages = {
  pageTitle: "Proveedores",
  newPartner: "Nuevo proveedor",
  searchPlaceholder: "Buscar por razón social o RIF",
  tableCaption: (sortedBy: string) => `Proveedores, ordenados por ${sortedBy}`,
  columns: {
    rif: "RIF",
    name: "Razón social",
    phone: "Teléfono",
    email: "Correo electrónico",
  },
  emptyCell: "—",
  pager: (from: number, to: number, total: number) => `${from}–${to} de ${total} proveedores`,
  previousPage: "Página anterior",
  nextPage: "Página siguiente",
  created: (rif: string) => `Proveedor ${rif} creado.`,
  promoted: (rif: string) => `Proveedor ${rif} agregado.`,
  empty: {
    title: "Aún no hay proveedores",
    description: "Los proveedores se usan en las órdenes de compra y los pagos.",
  },
  noResults: {
    title: (query: string) => `Sin resultados para «${query}»`,
    description: "Buscar por otra parte de la razón social o por el RIF.",
    clear: "Limpiar búsqueda",
  },
  loadError: "No se pudo cargar la lista de proveedores. Revisar la conexión e intentar de nuevo.",
  retry: "Reintentar",
  form: {
    title: "Nuevo proveedor",
    rif: "RIF",
    rifPlaceholder: "J-12345678-9",
    rifHelp: "Ej.: J-12345678-9. Se normaliza automáticamente.",
    name: "Razón social",
    phone: "Teléfono",
    email: "Correo electrónico",
    emailPlaceholder: "nombre@empresa.com",
    address: "Dirección",
    submit: "Guardar proveedor",
    confirmExistingSubmit: "Agregar como proveedor",
    existingPartnerWarning: (rif: string, partnerName: string) =>
      `El RIF ${rif} ya pertenece al tercero «${partnerName}». Al confirmar, también se registrará como proveedor conservando sus datos actuales.`,
    submitting: "Guardando…",
    cancel: "Cancelar",
  },
  errors: {
    FORBIDDEN: "Solo un administrador o compras puede gestionar proveedores.",
    saveFailed: "No se pudo guardar el proveedor. Revisar la conexión e intentar de nuevo.",
  },
} as const;

export const customersMessages = {
  pageTitle: "Clientes",
  newPartner: "Nuevo cliente",
  searchPlaceholder: "Buscar por razón social o RIF",
  tableCaption: (sortedBy: string) => `Clientes, ordenados por ${sortedBy}`,
  columns: {
    rif: "RIF",
    name: "Razón social",
    phone: "Teléfono",
    email: "Correo electrónico",
  },
  emptyCell: "—",
  pager: (from: number, to: number, total: number) => `${from}–${to} de ${total} clientes`,
  previousPage: "Página anterior",
  nextPage: "Página siguiente",
  created: (rif: string) => `Cliente ${rif} creado.`,
  promoted: (rif: string) => `Cliente ${rif} agregado.`,
  empty: {
    title: "Aún no hay clientes",
    description: "Los clientes se usan en los pedidos, las facturas y los cobros.",
  },
  noResults: {
    title: (query: string) => `Sin resultados para «${query}»`,
    description: "Buscar por otra parte de la razón social o por el RIF.",
    clear: "Limpiar búsqueda",
  },
  loadError: "No se pudo cargar la lista de clientes. Revisar la conexión e intentar de nuevo.",
  retry: "Reintentar",
  form: {
    title: "Nuevo cliente",
    rif: "RIF",
    rifPlaceholder: "J-12345678-9",
    rifHelp: "Ej.: J-12345678-9 o V-12345678-1. Se normaliza automáticamente.",
    name: "Razón social",
    phone: "Teléfono",
    email: "Correo electrónico",
    emailPlaceholder: "nombre@empresa.com",
    address: "Dirección",
    submit: "Guardar cliente",
    confirmExistingSubmit: "Agregar como cliente",
    existingPartnerWarning: (rif: string, partnerName: string) =>
      `El RIF ${rif} ya pertenece al tercero «${partnerName}». Al confirmar, también se registrará como cliente conservando sus datos actuales.`,
    submitting: "Guardando…",
    cancel: "Cancelar",
  },
  errors: {
    FORBIDDEN: "Solo un administrador o ventas puede gestionar clientes.",
    saveFailed: "No se pudo guardar el cliente. Revisar la conexión e intentar de nuevo.",
  },
} as const;

/** Role names in the sidebar footer (App shell handoff, #7). */
export const roleLabels: Record<Role, string> = {
  admin: "Administrador",
  sales: "Ventas",
  purchasing: "Compras",
  warehouse: "Almacén",
};

const passwordInputLabels: PasswordInputLabels = {
  show: "Mostrar",
  hide: "Ocultar",
  showAriaLabel: "Mostrar contraseña",
  hideAriaLabel: "Ocultar contraseña",
  shownStatus: "Contraseña visible.",
  hiddenStatus: "Contraseña oculta.",
};

/** Login screen (Login handoff, #10). */
export const loginMessages = {
  pageTitle: "Iniciar sesión",
  email: "Correo electrónico",
  emailPlaceholder: "nombre@empresa.com",
  password: "Contraseña",
  passwordInput: passwordInputLabels,
  submit: "Iniciar sesión",
  submitting: "Iniciando sesión…",
  emailRequired: "Falta el correo electrónico.",
  emailInvalid: "Escribir un correo electrónico válido, como nombre@empresa.com.",
  passwordRequired: "Falta la contraseña.",
} as const;

/** Form alert of each sign-in failure; `INVALID_EMAIL` goes on the field instead. */
export const signInErrorMessages: Record<Exclude<SignInError, "INVALID_EMAIL">, string> = {
  INVALID_CREDENTIALS:
    "El correo electrónico o la contraseña no son correctos. Revisar ambos e intentar de nuevo.",
  TOO_MANY_ATTEMPTS: "Demasiados intentos seguidos. Esperar unos segundos e intentar de nuevo.",
  NETWORK_ERROR: "No se pudo iniciar sesión. Revisar la conexión e intentar de nuevo.",
};
