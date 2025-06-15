ALTER TABLE "Users" ADD COLUMN "email_verification_token" text;--> statement-breakpoint
ALTER TABLE "Users" ADD COLUMN "password_reset_token" text;