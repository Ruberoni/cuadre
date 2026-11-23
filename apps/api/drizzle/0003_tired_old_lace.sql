CREATE SCHEMA "partners";
--> statement-breakpoint
CREATE TABLE "partners"."partners" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"rif" text NOT NULL,
	"name" text NOT NULL,
	"phone" text,
	"email" text,
	"address" text,
	"is_supplier" boolean DEFAULT false NOT NULL,
	"is_customer" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "partners_rif_unique" UNIQUE("rif"),
	CONSTRAINT "partners_rif_format" CHECK ("partners"."partners"."rif" ~ '^[VEJPG]-[0-9]{8}-[0-9]$'),
	CONSTRAINT "partners_name_length" CHECK (char_length("partners"."partners"."name") between 1 and 120),
	CONSTRAINT "partners_phone_length" CHECK ("partners"."partners"."phone" is null or char_length("partners"."partners"."phone") between 1 and 30),
	CONSTRAINT "partners_email_length" CHECK ("partners"."partners"."email" is null or char_length("partners"."partners"."email") between 1 and 120),
	CONSTRAINT "partners_address_length" CHECK ("partners"."partners"."address" is null or char_length("partners"."partners"."address") between 1 and 250),
	CONSTRAINT "partners_has_role" CHECK ("partners"."partners"."is_supplier" or "partners"."partners"."is_customer")
);
