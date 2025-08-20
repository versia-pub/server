CREATE TABLE "AuthorizationCodes" (
	"code" text PRIMARY KEY NOT NULL,
	"scopes" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"redirect_uri" text,
	"expires_at" timestamp(3) NOT NULL,
	"created_at" timestamp(3) DEFAULT now() NOT NULL,
	"code_challenge" text,
	"code_challenge_method" text,
	"userId" uuid NOT NULL,
	"clientId" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "Tokens" RENAME COLUMN "applicationId" TO "clientId";--> statement-breakpoint
--ALTER TABLE "Notes" DROP CONSTRAINT "Notes_applicationId_Applications_id_fk";
--> statement-breakpoint
--ALTER TABLE "OpenIdLoginFlows" DROP CONSTRAINT "OpenIdLoginFlows_applicationId_Applications_id_fk";
--> statement-breakpoint
--ALTER TABLE "Tokens" DROP CONSTRAINT "Tokens_applicationId_Applications_id_fk";
--> statement-breakpoint
DROP INDEX "Applications_client_id_index";--> statement-breakpoint
ALTER TABLE "Applications" ADD PRIMARY KEY ("client_id");--> statement-breakpoint
ALTER TABLE "Applications" ALTER COLUMN "scopes" SET DATA TYPE text[] USING (string_to_array("scopes", ' ')::text[]);--> statement-breakpoint
ALTER TABLE "Applications" ALTER COLUMN "scopes" SET DEFAULT ARRAY[]::text[];--> statement-breakpoint
ALTER TABLE "Notes" ALTER COLUMN "applicationId" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "OpenIdLoginFlows" ALTER COLUMN "applicationId" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "Applications" ADD COLUMN "redirect_uris" text[] DEFAULT ARRAY[]::text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "OpenIdLoginFlows" ADD COLUMN "state" text;--> statement-breakpoint
ALTER TABLE "OpenIdLoginFlows" ADD COLUMN "client_state" text;--> statement-breakpoint
ALTER TABLE "OpenIdLoginFlows" ADD COLUMN "client_redirect_uri" text;--> statement-breakpoint
ALTER TABLE "OpenIdLoginFlows" ADD COLUMN "client_scopes" text[];--> statement-breakpoint
ALTER TABLE "Tokens" ADD COLUMN "scopes" text[] DEFAULT ARRAY[]::text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "AuthorizationCodes" ADD CONSTRAINT "AuthorizationCodes_userId_Users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."Users"("id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "AuthorizationCodes" ADD CONSTRAINT "AuthorizationCodes_clientId_Applications_client_id_fk" FOREIGN KEY ("clientId") REFERENCES "public"."Applications"("client_id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "Notes" ADD CONSTRAINT "Notes_applicationId_Applications_client_id_fk" FOREIGN KEY ("applicationId") REFERENCES "public"."Applications"("client_id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "OpenIdLoginFlows" ADD CONSTRAINT "OpenIdLoginFlows_applicationId_Applications_client_id_fk" FOREIGN KEY ("applicationId") REFERENCES "public"."Applications"("client_id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "Tokens" ALTER COLUMN "clientId" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "Tokens" ADD CONSTRAINT "Tokens_clientId_Applications_client_id_fk" FOREIGN KEY ("clientId") REFERENCES "public"."Applications"("client_id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "Applications" DROP COLUMN "id";--> statement-breakpoint
ALTER TABLE "Applications" DROP COLUMN "vapid_key";--> statement-breakpoint
ALTER TABLE "Applications" DROP COLUMN "redirect_uri";--> statement-breakpoint
ALTER TABLE "Tokens" DROP COLUMN "token_type";--> statement-breakpoint
ALTER TABLE "Tokens" DROP COLUMN "scope";--> statement-breakpoint
ALTER TABLE "Tokens" DROP COLUMN "code";--> statement-breakpoint
ALTER TABLE "Tokens" DROP COLUMN "client_id";--> statement-breakpoint
ALTER TABLE "Tokens" DROP COLUMN "redirect_uri";--> statement-breakpoint
ALTER TABLE "Tokens" DROP COLUMN "id_token";
