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
| `Igtf` | IGTF | Impuesto a las Grandes Transacciones Financieras: 3% charged on top of a `Receipt` made in foreign currency. See ADR-006. Kept untranslated. |
| `SpecialTaxpayer` | Contribuyente especial | Taxpayer designated by SENIAT with extra duties, such as collecting IGTF. The business is one. |

## Parties

| Term (code) | Spanish (UI) | Meaning |
|---|---|---|
| `Partner` | Tercero | A supplier, a customer, or both. One per `Rif`. |
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
| `StockMovement` | Movimiento de inventario | One ledger entry, either inbound (raises `OnHand`) or outbound (lowers it). _Avoid_: "receipt"/"issue" for direction. |
| `AverageCost` | Costo promedio | Weighted average unit cost in USD, excluding IVA. See ADR-007. |
| `OnHand` | Existencia | Current quantity in stock. |

## Purchasing

| Term (code) | Spanish (UI) | Meaning |
|---|---|---|
| `PurchaseOrder` | Orden de compra | Request to a supplier for goods. |
| `GoodsReceipt` | Recepción de mercancía | Arrival of the goods of one `PurchaseOrder`; increases stock and is what we owe the supplier, referencing the supplier's invoice. |
| `SupplierInvoiceNumber` | N.º de factura del proveedor | The supplier's own invoice number, recorded on a `GoodsReceipt`. |
| `ControlNumber` | N.º de control | Fiscal control number printed on a Venezuelan invoice, distinct from the invoice number. |

## Sales and billing

| Term (code) | Spanish (UI) | Meaning |
|---|---|---|
| `SalesOrder` | Pedido | Customer request for goods; required before an `Invoice`. _Avoid_: Nota de pedido. |
| `Invoice` | Factura | Fiscal sales document issued from one `SalesOrder`; decreases stock. |
| `Payment` | Pago | Money we pay to a supplier against a `GoodsReceipt`. |
| `Receipt` _(billing)_ | Cobro | Money we receive from a customer against an `Invoice`. Not to be confused with `GoodsReceipt`. |
| `OutstandingBalance` | Saldo pendiente | Part of an `Invoice` (receivable) or `GoodsReceipt` (payable) not yet settled, in the document's currency. |

## Documents

| Term (code) | Spanish (UI) | Meaning |
|---|---|---|
| `Draft` | Borrador | A document still being prepared; editable and deletable, with no effect on stock, balances or rates. |
| `Issued` | Emitido | A document that has taken effect; immutable. Its exchange rate, stock movements and balances are fixed at this point. _Avoid_: posted, confirmed. |
| `DocumentDate` | Fecha | The business date of a document; drives exchange-rate lookup. Never in the future. |

## Access

| Term (code) | Spanish (UI) | Meaning |
|---|---|---|
| `User` | Usuario | A person who signs in. Has exactly one `Role`. |
| `Role` | Rol | `admin` (Administrador), `sales` (Ventas), `purchasing` (Compras) or `warehouse` (Almacén). |
