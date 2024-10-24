ALTER TABLE "Likes" ADD COLUMN "uri" text;--> statement-breakpoint
ALTER TABLE "Likes" ADD CONSTRAINT "Likes_uri_unique" UNIQUE("uri");