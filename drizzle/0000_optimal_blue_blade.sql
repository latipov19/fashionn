CREATE TABLE "admin_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"admin_user_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "admin_users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cloths" (
	"id" text PRIMARY KEY NOT NULL,
	"label" text NOT NULL,
	"weave" text NOT NULL,
	"composition" text NOT NULL,
	"gsm" integer NOT NULL,
	"warp_per_cm" integer NOT NULL,
	"weft_per_cm" integer NOT NULL,
	"bend" double precision NOT NULL,
	"roughness" double precision NOT NULL,
	"sheen" double precision NOT NULL,
	"fuzz" double precision NOT NULL,
	"wrap" double precision NOT NULL
);
--> statement-breakpoint
CREATE TABLE "colourways" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"piece_id" uuid NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"hex" text NOT NULL,
	"lining" text NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "media_overrides" (
	"media_key" text PRIMARY KEY NOT NULL,
	"colourway_id" uuid NOT NULL,
	"hidden" boolean DEFAULT false NOT NULL,
	"position" integer
);
--> statement-breakpoint
CREATE TABLE "newsletter_signups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "order_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"variant_id" uuid NOT NULL,
	"piece_slug" text NOT NULL,
	"piece_name" text NOT NULL,
	"peg" text NOT NULL,
	"colourway_name" text NOT NULL,
	"size" text NOT NULL,
	"sku" text NOT NULL,
	"unit_price_cents" integer NOT NULL,
	"quantity" integer NOT NULL,
	"line_total_cents" integer NOT NULL,
	CONSTRAINT "order_items_quantity_positive" CHECK ("order_items"."quantity" > 0)
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"seq" integer GENERATED ALWAYS AS IDENTITY (sequence name "orders_seq_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"token" text NOT NULL,
	"idempotency_key" text NOT NULL,
	"status" text DEFAULT 'placed' NOT NULL,
	"email" text NOT NULL,
	"phone" text,
	"address" jsonb NOT NULL,
	"shipping_method" text NOT NULL,
	"currency" text DEFAULT 'USD' NOT NULL,
	"subtotal_cents" integer NOT NULL,
	"shipping_cents" integer NOT NULL,
	"tax_cents" integer NOT NULL,
	"total_cents" integer NOT NULL,
	"payment_provider" text NOT NULL,
	"payment_status" text NOT NULL,
	"payment_reference" text,
	"stock_restored_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "orders_status_valid" CHECK ("orders"."status" in ('placed', 'packed', 'shipped', 'delivered', 'cancelled')),
	CONSTRAINT "orders_total_adds_up" CHECK ("orders"."total_cents" = "orders"."subtotal_cents" + "orders"."shipping_cents" + "orders"."tax_cents")
);
--> statement-breakpoint
CREATE TABLE "pieces" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"peg" text NOT NULL,
	"name" text NOT NULL,
	"category" text NOT NULL,
	"room" text NOT NULL,
	"hour" text NOT NULL,
	"frame_class" text NOT NULL,
	"hang" text NOT NULL,
	"price_cents" integer NOT NULL,
	"sizes" jsonb NOT NULL,
	"cloth_id" text NOT NULL,
	"description" text NOT NULL,
	"cut" jsonb NOT NULL,
	"gather_pct" double precision NOT NULL,
	"seed" integer NOT NULL,
	"details" jsonb NOT NULL,
	"published" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "pieces_price_nonnegative" CHECK ("pieces"."price_cents" >= 0)
);
--> statement-breakpoint
CREATE TABLE "product_media" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"piece_id" uuid NOT NULL,
	"colourway_id" uuid NOT NULL,
	"role" text DEFAULT 'photo' NOT NULL,
	"hour" text,
	"url" text NOT NULL,
	"width" integer NOT NULL,
	"height" integer NOT NULL,
	"src_set" jsonb NOT NULL,
	"blur" text NOT NULL,
	"dominant" text,
	"alt" text NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"hidden" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "variants" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"piece_id" uuid NOT NULL,
	"colourway_id" uuid NOT NULL,
	"size" text NOT NULL,
	"stock" integer DEFAULT 0 NOT NULL,
	"sku" text NOT NULL,
	CONSTRAINT "variants_stock_nonnegative" CHECK ("variants"."stock" >= 0)
);
--> statement-breakpoint
ALTER TABLE "admin_sessions" ADD CONSTRAINT "admin_sessions_admin_user_id_admin_users_id_fk" FOREIGN KEY ("admin_user_id") REFERENCES "public"."admin_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "colourways" ADD CONSTRAINT "colourways_piece_id_pieces_id_fk" FOREIGN KEY ("piece_id") REFERENCES "public"."pieces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "media_overrides" ADD CONSTRAINT "media_overrides_colourway_id_colourways_id_fk" FOREIGN KEY ("colourway_id") REFERENCES "public"."colourways"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_variant_id_variants_id_fk" FOREIGN KEY ("variant_id") REFERENCES "public"."variants"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pieces" ADD CONSTRAINT "pieces_cloth_id_cloths_id_fk" FOREIGN KEY ("cloth_id") REFERENCES "public"."cloths"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_media" ADD CONSTRAINT "product_media_piece_id_pieces_id_fk" FOREIGN KEY ("piece_id") REFERENCES "public"."pieces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_media" ADD CONSTRAINT "product_media_colourway_id_colourways_id_fk" FOREIGN KEY ("colourway_id") REFERENCES "public"."colourways"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "variants" ADD CONSTRAINT "variants_piece_id_pieces_id_fk" FOREIGN KEY ("piece_id") REFERENCES "public"."pieces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "variants" ADD CONSTRAINT "variants_colourway_id_colourways_id_fk" FOREIGN KEY ("colourway_id") REFERENCES "public"."colourways"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "admin_sessions_token_hash_key" ON "admin_sessions" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "admin_sessions_expires_idx" ON "admin_sessions" USING btree ("expires_at");--> statement-breakpoint
CREATE UNIQUE INDEX "admin_users_email_key" ON "admin_users" USING btree ("email");--> statement-breakpoint
CREATE UNIQUE INDEX "colourways_piece_slug_key" ON "colourways" USING btree ("piece_id","slug");--> statement-breakpoint
CREATE INDEX "media_overrides_colourway_idx" ON "media_overrides" USING btree ("colourway_id");--> statement-breakpoint
CREATE UNIQUE INDEX "newsletter_signups_email_key" ON "newsletter_signups" USING btree ("email");--> statement-breakpoint
CREATE INDEX "order_items_order_idx" ON "order_items" USING btree ("order_id");--> statement-breakpoint
CREATE UNIQUE INDEX "orders_token_key" ON "orders" USING btree ("token");--> statement-breakpoint
CREATE UNIQUE INDEX "orders_idempotency_key_key" ON "orders" USING btree ("idempotency_key");--> statement-breakpoint
CREATE UNIQUE INDEX "orders_seq_key" ON "orders" USING btree ("seq");--> statement-breakpoint
CREATE INDEX "orders_created_idx" ON "orders" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "orders_status_idx" ON "orders" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "pieces_slug_key" ON "pieces" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "pieces_peg_key" ON "pieces" USING btree ("peg");--> statement-breakpoint
CREATE INDEX "pieces_published_sort_idx" ON "pieces" USING btree ("published","sort_order");--> statement-breakpoint
CREATE INDEX "product_media_colourway_idx" ON "product_media" USING btree ("colourway_id");--> statement-breakpoint
CREATE UNIQUE INDEX "variants_colourway_size_key" ON "variants" USING btree ("colourway_id","size");--> statement-breakpoint
CREATE UNIQUE INDEX "variants_sku_key" ON "variants" USING btree ("sku");--> statement-breakpoint
CREATE INDEX "variants_piece_idx" ON "variants" USING btree ("piece_id");