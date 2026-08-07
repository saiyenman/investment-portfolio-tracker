CREATE TABLE "allocation_targets" (
	"asset_class_id" uuid PRIMARY KEY NOT NULL,
	"target_pct" numeric(6, 3) NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "allocation_targets_pct_range" CHECK ("allocation_targets"."target_pct" >= 0 and "allocation_targets"."target_pct" <= 100)
);
--> statement-breakpoint
CREATE TABLE "asset_classes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"color" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "asset_classes_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "envelopes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"color" text,
	"ceiling_amount" numeric(18, 2),
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "envelopes_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "holdings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"envelope_id" uuid NOT NULL,
	"asset_class_id" uuid NOT NULL,
	"name" text NOT NULL,
	"isin" text,
	"input_mode" text DEFAULT 'QUANTITY' NOT NULL,
	"quantity" numeric(24, 8) DEFAULT '0' NOT NULL,
	"unit_price" numeric(20, 8) DEFAULT '1' NOT NULL,
	"price_updated_at" date,
	"cost_basis" numeric(18, 2),
	"note" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "holdings_envelope_name_unique" UNIQUE("envelope_id","name"),
	CONSTRAINT "holdings_input_mode_check" CHECK ("holdings"."input_mode" in ('QUANTITY', 'AMOUNT')),
	CONSTRAINT "holdings_quantity_positive" CHECK ("holdings"."quantity" >= 0),
	CONSTRAINT "holdings_unit_price_positive" CHECK ("holdings"."unit_price" >= 0)
);
--> statement-breakpoint
ALTER TABLE "allocation_targets" ADD CONSTRAINT "allocation_targets_asset_class_id_asset_classes_id_fk" FOREIGN KEY ("asset_class_id") REFERENCES "public"."asset_classes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "holdings" ADD CONSTRAINT "holdings_envelope_id_envelopes_id_fk" FOREIGN KEY ("envelope_id") REFERENCES "public"."envelopes"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "holdings" ADD CONSTRAINT "holdings_asset_class_id_asset_classes_id_fk" FOREIGN KEY ("asset_class_id") REFERENCES "public"."asset_classes"("id") ON DELETE restrict ON UPDATE no action;