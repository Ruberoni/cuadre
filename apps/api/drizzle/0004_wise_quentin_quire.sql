CREATE SCHEMA "purchasing";
--> statement-breakpoint
CREATE TABLE "purchasing"."purchase_order_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"purchase_order_id" uuid NOT NULL,
	"position" integer NOT NULL,
	"product_id" uuid NOT NULL,
	"quantity" numeric(15, 3) NOT NULL,
	"unit_cost_minor" bigint NOT NULL,
	CONSTRAINT "purchase_order_lines_position_non_negative" CHECK ("purchasing"."purchase_order_lines"."position" >= 0),
	CONSTRAINT "purchase_order_lines_quantity_positive" CHECK ("purchasing"."purchase_order_lines"."quantity" > 0),
	CONSTRAINT "purchase_order_lines_unit_cost_positive" CHECK ("purchasing"."purchase_order_lines"."unit_cost_minor" > 0)
);
--> statement-breakpoint
CREATE TABLE "purchasing"."purchase_orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"supplier_id" uuid NOT NULL,
	"currency" text NOT NULL,
	"document_date" date NOT NULL,
	"status" text DEFAULT 'DRAFT' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "purchase_orders_currency" CHECK ("purchasing"."purchase_orders"."currency" in ('USD', 'VES')),
	CONSTRAINT "purchase_orders_status" CHECK ("purchasing"."purchase_orders"."status" in ('DRAFT', 'ISSUED'))
);
--> statement-breakpoint
ALTER TABLE "purchasing"."purchase_order_lines" ADD CONSTRAINT "purchase_order_lines_purchase_order_id_purchase_orders_id_fk" FOREIGN KEY ("purchase_order_id") REFERENCES "purchasing"."purchase_orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "purchase_order_lines_order_position_unique" ON "purchasing"."purchase_order_lines" USING btree ("purchase_order_id","position");