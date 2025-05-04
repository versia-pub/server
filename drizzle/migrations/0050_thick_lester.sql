ALTER TABLE "Notes" ADD COLUMN "reblog_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "Notes" ADD COLUMN "like_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "Notes" ADD COLUMN "reply_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "Users" ADD COLUMN "follower_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "Users" ADD COLUMN "following_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "Users" ADD COLUMN "status_count" integer DEFAULT 0 NOT NULL;