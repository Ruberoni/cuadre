# Glossary

Canonical domain vocabulary. Code uses the **Term** column; the UI uses the **Spanish (UI)** column. Never invent synonyms — if a concept is missing, add it here in the same PR.

## Money and taxes

| Term (code) | Spanish (UI) | Meaning |
|---|---|---|
| `Money` | Monto | Value object: integer amount in minor units + currency. See ADR-005. |
| `Currency` | Moneda | `USD` or `VES`. |
| `FunctionalCurrency` | Moneda funcional | USD. The currency for costs and reports. |
| `DocumentCurrency` | Moneda del documento | Currency a document is issued in. |
| `ExchangeRate` | Tasa de cambio / Tasa BCV | VES per 1 USD on a given date, as published by the BCV. |
| `Bcv` | BCV | Banco Central de Venezuela, source of the official rate. Kept untranslated. |
| `Iva` | IVA | Value-added tax. Rates: general 16%, reduced 8%, exempt. Kept untranslated. |
| `TaxRate` | Alícuota | A tax percentage (e.g. IVA general). |
| `Igtf` | IGTF | Impuesto a las Grandes Transacciones Financieras, 3% on payments in foreign currency. See ADR-006. Kept untranslated. |

## Parties

| Term (code) | Spanish (UI) | Meaning |
|---|---|---|
| `Partner` | Tercero | A supplier or customer. |
| `Supplier` | Proveedor | Partner we buy from. |
| `Customer` | Cliente | Partner we sell to. |
| `Rif` | RIF | Venezuelan tax ID (e.g. `J-12345678-9`). Kept untranslated. |

## Catalog and inventory

| Term (code) | Spanish (UI) | Meaning |
|---|---|---|
| `Product` | Producto | An item that is bought, stocked and sold. |
| `Sku` | Código / SKU | Unique product code. |
| `UnitOfMeasure` | Unidad de medida | e.g. unit, box, kg. |
| `Warehouse` | Almacén | Physical stock location. Single warehouse in the MVP. |
| `StockLedger` | Kardex | Chronological record of stock movements per product. |
| `StockMovement` | Movimiento de inventario | One ledger entry: receipt (in) or issue (out). |
| `AverageCost` | Costo promedio | Weighted average unit cost in USD. See ADR-007. |
| `OnHand` | Existencia | Current quantity in stock. |

## Purchasing

| Term (code) | Spanish (UI) | Meaning |
|---|---|---|
| `PurchaseOrder` | Orden de compra | Request to a supplier for goods. |
| `GoodsReceipt` | Recepción de mercancía | Arrival of goods; increases stock. |

## Sales and billing

| Term (code) | Spanish (UI) | Meaning |
|---|---|---|
| `SalesOrder` | Pedido / Nota de pedido | Customer request for goods. |
| `Invoice` | Factura | Fiscal sales document; decreases stock. |
| `Payment` | Pago | Money paid to a supplier. |
| `Receipt` _(billing)_ | Cobro | Money received from a customer. Not to be confused with `GoodsReceipt`. |
| `OutstandingBalance` | Saldo pendiente | Amount of an invoice not yet paid. |
