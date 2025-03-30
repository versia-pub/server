CREATE TABLE IF NOT EXISTS "FilterKeywords" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"filterId" uuid NOT NULL,
	"keyword" text NOT NULL,
	"whole_word" boolean NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "Filters" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"userId" uuid NOT NULL,
	"context" text[],
	"title" text NOT NULL,
	"filter_action" text NOT NULL,
	"expires_at" timestamp(3),
	"created_at" timestamp(3) DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "FilterKeywords" ADD CONSTRAINT "FilterKeywords_filterId_Filters_id_fk" FOREIGN KEY ("filterId") REFERENCES "Filters"("id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "Filters" ADD CONSTRAINT "Filters_userId_Users_id_fk" FOREIGN KEY ("userId") REFERENCES "Users"("id") ON DELETE cascade ON UPDATE cascade;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
