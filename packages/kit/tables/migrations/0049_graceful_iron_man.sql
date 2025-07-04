ALTER TABLE "Notes" ALTER COLUMN "sensitive" SET DEFAULT false;--> statement-breakpoint
ALTER TABLE "Users" ALTER COLUMN "display_name" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "Users" ALTER COLUMN "source" DROP NOT NULL;