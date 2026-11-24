/** IVA rates (`TaxRate`, GLOSSARY): general 16 %, reduced 8 %, exempt. */
export const TAX_RATES = ["GENERAL", "REDUCED", "EXEMPT"] as const;
export type TaxRate = (typeof TAX_RATES)[number];

export const TAX_RATE_PERCENT: Readonly<Record<TaxRate, number>> = {
  GENERAL: 16,
  REDUCED: 8,
  EXEMPT: 0,
};
