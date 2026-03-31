ALTER TABLE "Likes" DROP CONSTRAINT "Likes_uri_unique";--> statement-breakpoint
ALTER TABLE "Notes" DROP CONSTRAINT "Notes_uri_unique";--> statement-breakpoint
ALTER TABLE "Users" DROP CONSTRAINT "Users_uri_unique";--> statement-breakpoint
DROP INDEX "Users_uri_index";--> statement-breakpoint
ALTER TABLE "Likes" ADD COLUMN "remote_id" text;--> statement-breakpoint
ALTER TABLE "Notes" ADD COLUMN "remote_id" text;--> statement-breakpoint
ALTER TABLE "Reaction" ADD COLUMN "remote_id" text;--> statement-breakpoint
ALTER TABLE "Users" ADD COLUMN "remote_id" text;--> statement-breakpoint
ALTER TABLE "Likes" DROP COLUMN "uri";--> statement-breakpoint
ALTER TABLE "Notes" DROP COLUMN "uri";--> statement-breakpoint
ALTER TABLE "Users" DROP COLUMN "uri";--> statement-breakpoint
ALTER TABLE "Users" DROP COLUMN "endpoints";--> statement-breakpoint
ALTER TABLE "Users" DROP COLUMN "public_key";--> statement-breakpoint
ALTER TABLE "Users" DROP COLUMN "private_key";