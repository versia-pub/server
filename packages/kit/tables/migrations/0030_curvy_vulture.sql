DROP INDEX IF EXISTS "Users_username_index";--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "Users_username_index" ON "Users" USING btree ("username");