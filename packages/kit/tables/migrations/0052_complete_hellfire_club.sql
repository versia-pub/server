ALTER TABLE "Applications" RENAME TO "Clients";--> statement-breakpoint
ALTER TABLE "Notes" RENAME COLUMN "applicationId" TO "clientId";--> statement-breakpoint
ALTER TABLE "OpenIdLoginFlows" RENAME COLUMN "applicationId" TO "clientId";--> statement-breakpoint
ALTER TABLE "AuthorizationCodes" DROP CONSTRAINT "AuthorizationCodes_clientId_Applications_client_id_fk";
--> statement-breakpoint
ALTER TABLE "Notes" DROP CONSTRAINT "Notes_applicationId_Applications_client_id_fk";
--> statement-breakpoint
ALTER TABLE "OpenIdLoginFlows" DROP CONSTRAINT "OpenIdLoginFlows_applicationId_Applications_client_id_fk";
--> statement-breakpoint
ALTER TABLE "Tokens" DROP CONSTRAINT "Tokens_clientId_Applications_client_id_fk";
--> statement-breakpoint
ALTER TABLE "AuthorizationCodes" ADD CONSTRAINT "AuthorizationCodes_clientId_Clients_client_id_fk" FOREIGN KEY ("clientId") REFERENCES "public"."Clients"("client_id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "Notes" ADD CONSTRAINT "Notes_clientId_Clients_client_id_fk" FOREIGN KEY ("clientId") REFERENCES "public"."Clients"("client_id") ON DELETE set null ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "OpenIdLoginFlows" ADD CONSTRAINT "OpenIdLoginFlows_clientId_Clients_client_id_fk" FOREIGN KEY ("clientId") REFERENCES "public"."Clients"("client_id") ON DELETE cascade ON UPDATE cascade;--> statement-breakpoint
ALTER TABLE "Tokens" ADD CONSTRAINT "Tokens_clientId_Clients_client_id_fk" FOREIGN KEY ("clientId") REFERENCES "public"."Clients"("client_id") ON DELETE cascade ON UPDATE cascade;