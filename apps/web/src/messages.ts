// The single UI message catalog (ADR-012): every user-facing error, status line and label that
// comes from an error code or a domain value lives here, in Spanish, verbatim from the design
// handoffs. Screens never write these strings inline and never show a raw code.
import type { ProductField, ProductIssueCode, TaxRate, UnitOfMeasure } from "@cuadre/contracts";
import type { ClientErrorCode } from "@/api/client";
import { formatMoney, NBSP, type ParseAmountError } from "@/lib/format";

/** Message for an error that belongs to no field, shown in the form alert. */
export const errorMessages: Record<ClientErrorCode, (details: { sku?: string }) => string> = {
  VALIDATION_ERROR: () => "Algunos datos no son válidos. Revisar los campos marcados.",
  SKU_ALREADY_EXISTS: ({ sku }) =>
    sku === undefined
      ? "Ya existe un producto con ese código."
      : `Ya existe un producto con el código ${sku}.`,
  NOT_FOUND: () => "No se encontró lo que se buscaba.",
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
  products: "Productos",
  documentTitle: (pageTitle: string) => `${pageTitle} · Cuadre`,
} as const;
