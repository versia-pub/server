ALTER TABLE "Reaction" ALTER COLUMN "emojiId" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "Reaction" ADD COLUMN "uri" text;--> statement-breakpoint
ALTER TABLE "Reaction" ADD COLUMN "emoji_text" text;--> statement-breakpoint
ALTER TABLE "Reaction" ADD COLUMN "created_at" timestamp(3) DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "Reaction" ADD COLUMN "update_at" timestamp(3) DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "Reaction" ADD CONSTRAINT "Reaction_uri_unique" UNIQUE("uri");