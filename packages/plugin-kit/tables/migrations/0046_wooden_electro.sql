ALTER TABLE "Users" ADD COLUMN "is_hiding_collections" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "Users" ADD COLUMN "is_indexable" boolean DEFAULT false NOT NULL;