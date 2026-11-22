CREATE SCHEMA "exchange_rates";
--> statement-breakpoint
CREATE TABLE "exchange_rates"."rates" (
	"date" date PRIMARY KEY NOT NULL,
	"rate" numeric(20, 8) NOT NULL,
	"frozen" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "rates_rate_positive" CHECK ("exchange_rates"."rates"."rate" > 0)
);
