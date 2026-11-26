CREATE SCHEMA "inventory";
--> statement-breakpoint
CREATE TABLE "inventory"."stock_balances" (
	"product_id" uuid PRIMARY KEY NOT NULL,
	"on_hand" numeric(15, 3) DEFAULT '0' NOT NULL,
	"total_value_usd_minor" bigint DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "stock_balances_on_hand_non_negative" CHECK ("inventory"."stock_balances"."on_hand" >= 0),
	CONSTRAINT "stock_balances_value_non_negative" CHECK ("inventory"."stock_balances"."total_value_usd_minor" >= 0),
	CONSTRAINT "stock_balances_value_zero_when_empty" CHECK ("inventory"."stock_balances"."on_hand" > 0 or "inventory"."stock_balances"."total_value_usd_minor" = 0)
);
--> statement-breakpoint
CREATE TABLE "inventory"."stock_movements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"direction" text NOT NULL,
	"quantity" numeric(15, 3) NOT NULL,
	"total_cost_usd_minor" bigint NOT NULL,
	"reference_type" text NOT NULL,
	"reference_id" uuid NOT NULL,
	"document_date" date NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "stock_movements_direction" CHECK ("inventory"."stock_movements"."direction" in ('INBOUND', 'OUTBOUND')),
	CONSTRAINT "stock_movements_quantity_positive" CHECK ("inventory"."stock_movements"."quantity" > 0),
	CONSTRAINT "stock_movements_cost_non_negative" CHECK ("inventory"."stock_movements"."total_cost_usd_minor" >= 0)
);
--> statement-breakpoint
CREATE TABLE "purchasing"."goods_receipt_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"goods_receipt_id" uuid NOT NULL,
	"purchase_order_line_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"product_id" uuid NOT NULL,
	"quantity" numeric(15, 3) NOT NULL,
	"unit_cost_minor" bigint NOT NULL,
	CONSTRAINT "goods_receipt_lines_position_non_negative" CHECK ("purchasing"."goods_receipt_lines"."position" >= 0),
	CONSTRAINT "goods_receipt_lines_quantity_positive" CHECK ("purchasing"."goods_receipt_lines"."quantity" > 0),
	CONSTRAINT "goods_receipt_lines_unit_cost_positive" CHECK ("purchasing"."goods_receipt_lines"."unit_cost_minor" > 0)
);
--> statement-breakpoint
CREATE TABLE "purchasing"."goods_receipts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"purchase_order_id" uuid NOT NULL,
	"supplier_id" uuid NOT NULL,
	"currency" text NOT NULL,
	"document_date" date NOT NULL,
	"supplier_invoice_number" text NOT NULL,
	"control_number" text NOT NULL,
	"status" text DEFAULT 'DRAFT' NOT NULL,
	"frozen_rate" numeric(20, 8),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "goods_receipts_currency" CHECK ("purchasing"."goods_receipts"."currency" in ('USD', 'VES')),
	CONSTRAINT "goods_receipts_status" CHECK ("purchasing"."goods_receipts"."status" in ('DRAFT', 'ISSUED')),
	CONSTRAINT "goods_receipts_frozen_rate_matches_status" CHECK (("purchasing"."goods_receipts"."status" = 'DRAFT' and "purchasing"."goods_receipts"."frozen_rate" is null) or ("purchasing"."goods_receipts"."status" = 'ISSUED' and "purchasing"."goods_receipts"."frozen_rate" is not null and "purchasing"."goods_receipts"."frozen_rate" > 0)),
	CONSTRAINT "goods_receipts_supplier_invoice_number_not_blank" CHECK (length(trim("purchasing"."goods_receipts"."supplier_invoice_number")) > 0),
	CONSTRAINT "goods_receipts_control_number_not_blank" CHECK (length(trim("purchasing"."goods_receipts"."control_number")) > 0)
);
--> statement-breakpoint
ALTER TABLE "purchasing"."goods_receipt_lines" ADD CONSTRAINT "goods_receipt_lines_goods_receipt_id_goods_receipts_id_fk" FOREIGN KEY ("goods_receipt_id") REFERENCES "purchasing"."goods_receipts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchasing"."goods_receipt_lines" ADD CONSTRAINT "goods_receipt_lines_purchase_order_line_id_purchase_order_lines_id_fk" FOREIGN KEY ("purchase_order_line_id") REFERENCES "purchasing"."purchase_order_lines"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchasing"."goods_receipts" ADD CONSTRAINT "goods_receipts_purchase_order_id_purchase_orders_id_fk" FOREIGN KEY ("purchase_order_id") REFERENCES "purchasing"."purchase_orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "stock_movements_product_date_idx" ON "inventory"."stock_movements" USING btree ("product_id","document_date","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "goods_receipt_lines_receipt_position_unique" ON "purchasing"."goods_receipt_lines" USING btree ("goods_receipt_id","position");--> statement-breakpoint
CREATE UNIQUE INDEX "goods_receipt_lines_receipt_order_line_unique" ON "purchasing"."goods_receipt_lines" USING btree ("goods_receipt_id","purchase_order_line_id");--> statement-breakpoint
CREATE UNIQUE INDEX "goods_receipts_purchase_order_unique" ON "purchasing"."goods_receipts" USING btree ("purchase_order_id");