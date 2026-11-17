CREATE SCHEMA "catalog";
--> statement-breakpoint
CREATE TABLE "catalog"."products" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sku" text NOT NULL,
	"name" text NOT NULL,
	"unit_of_measure" text NOT NULL,
	"sale_price_minor" bigint NOT NULL,
	"sale_price_currency" text DEFAULT 'USD' NOT NULL,
	"tax_rate" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "products_sku_unique" UNIQUE("sku"),
	CONSTRAINT "products_sku_format" CHECK ("catalog"."products"."sku" ~ '^[A-Z0-9-]{1,20}$'),
	CONSTRAINT "products_name_length" CHECK (char_length("catalog"."products"."name") between 1 and 120),
	CONSTRAINT "products_unit_of_measure" CHECK ("catalog"."products"."unit_of_measure" in ('UNIT', 'BOX', 'BULK', 'KILOGRAM', 'LITER')),
	CONSTRAINT "products_tax_rate" CHECK ("catalog"."products"."tax_rate" in ('GENERAL', 'REDUCED', 'EXEMPT')),
	CONSTRAINT "products_sale_price_positive" CHECK ("catalog"."products"."sale_price_minor" > 0),
	CONSTRAINT "products_sale_price_usd" CHECK ("catalog"."products"."sale_price_currency" = 'USD')
);
