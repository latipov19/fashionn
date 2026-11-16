CREATE TABLE "admin_activity" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_id" uuid,
	"actor_email" text NOT NULL,
	"action" text NOT NULL,
	"target_type" text NOT NULL,
	"target_id" text,
	"target_label" text,
	"meta" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "inventory_adjustments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"variant_id" uuid,
	"product_name" text NOT NULL,
	"color_name" text NOT NULL,
	"size" text NOT NULL,
	"sku" text NOT NULL,
	"previous_stock" integer NOT NULL,
	"new_stock" integer NOT NULL,
	"reason" text NOT NULL,
	"note" text,
	"actor_id" uuid,
	"actor_email" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "inventory_adjustments_stock_nonnegative" CHECK ("inventory_adjustments"."new_stock" >= 0 and "inventory_adjustments"."previous_stock" >= 0)
);
--> statement-breakpoint
CREATE TABLE "promotions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"kind" text NOT NULL,
	"value" integer NOT NULL,
	"min_order_uzs" integer DEFAULT 0 NOT NULL,
	"starts_at" timestamp with time zone,
	"ends_at" timestamp with time zone,
	"usage_limit" integer,
	"used_count" integer DEFAULT 0 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "promotions_kind_valid" CHECK ("promotions"."kind" in ('percent', 'fixed')),
	CONSTRAINT "promotions_value_valid" CHECK (("promotions"."kind" = 'percent' and "promotions"."value" between 1 and 90) or ("promotions"."kind" = 'fixed' and "promotions"."value" > 0)),
	CONSTRAINT "promotions_dates_ordered" CHECK ("promotions"."starts_at" is null or "promotions"."ends_at" is null or "promotions"."ends_at" > "promotions"."starts_at"),
	CONSTRAINT "promotions_limits_valid" CHECK ("promotions"."min_order_uzs" >= 0 and "promotions"."used_count" >= 0 and ("promotions"."usage_limit" is null or "promotions"."usage_limit" > 0))
);
--> statement-breakpoint
ALTER TABLE "admin_users" ADD COLUMN "role" text DEFAULT 'owner' NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "archived_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "admin_activity" ADD CONSTRAINT "admin_activity_actor_id_admin_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."admin_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_adjustments" ADD CONSTRAINT "inventory_adjustments_variant_id_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."variants"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_adjustments" ADD CONSTRAINT "inventory_adjustments_actor_id_admin_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."admin_users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "admin_activity_created_idx" ON "admin_activity" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "admin_activity_target_idx" ON "admin_activity" USING btree ("target_type","target_id");--> statement-breakpoint
CREATE INDEX "inventory_adjustments_created_idx" ON "inventory_adjustments" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "inventory_adjustments_variant_idx" ON "inventory_adjustments" USING btree ("variant_id");--> statement-breakpoint
CREATE UNIQUE INDEX "promotions_code_key" ON "promotions" USING btree ("code");--> statement-breakpoint
ALTER TABLE "admin_users" ADD CONSTRAINT "admin_users_role_valid" CHECK ("admin_users"."role" in ('owner', 'manager', 'editor'));