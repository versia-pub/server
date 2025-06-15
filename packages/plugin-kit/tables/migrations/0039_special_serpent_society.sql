ALTER TABLE "VersiaObject" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "VersiaObject" CASCADE;--> statement-breakpoint
ALTER TABLE "Likes" RENAME COLUMN "createdAt" TO "created_at";--> statement-breakpoint
ALTER TABLE "Notes" RENAME COLUMN "createdAt" TO "created_at";--> statement-breakpoint
ALTER TABLE "Notes" RENAME COLUMN "updatedAt" TO "updated_at";--> statement-breakpoint
ALTER TABLE "Notifications" RENAME COLUMN "createdAt" TO "created_at";--> statement-breakpoint
ALTER TABLE "Reaction" RENAME COLUMN "update_at" TO "updated_at";--> statement-breakpoint
ALTER TABLE "OpenIdAccounts" DROP CONSTRAINT "OpenIdAccounts_userId_Users_id_fk";
--> statement-breakpoint
ALTER TABLE "OpenIdAccounts" ADD CONSTRAINT "OpenIdAccounts_userId_Users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."Users"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "Users" ADD CONSTRAINT "Users_uri_unique" UNIQUE("uri");