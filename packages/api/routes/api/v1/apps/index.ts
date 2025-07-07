import {
    Application as ApplicationSchema,
    CredentialApplication as CredentialApplicationSchema,
} from "@versia/client/schemas";
import { ApiError } from "@versia-server/kit";
import { apiRoute, handleZodError, jsonOrForm } from "@versia-server/kit/api";
import { Application } from "@versia-server/kit/db";
import { randomUUIDv7 } from "bun";
import { describeRoute, resolver, validator } from "hono-openapi";
import { z } from "zod/v4";
import { randomString } from "@/math";
import { rateLimit } from "../../../../middlewares/rate-limit.ts";

export default apiRoute((app) =>
    app.post(
        "/api/v1/apps",
        describeRoute({
            summary: "Create an application",
            description:
                "Create a new application to obtain OAuth2 credentials.",
            externalDocs: {
                url: "https://docs.joinmastodon.org/methods/apps/#create",
            },
            tags: ["Apps"],
            responses: {
                200: {
                    description:
                        "Store the client_id and client_secret in your cache, as these will be used to obtain OAuth tokens.",
                    content: {
                        "application/json": {
                            schema: resolver(CredentialApplicationSchema),
                        },
                    },
                },
                422: ApiError.validationFailed().schema,
            },
        }),
        jsonOrForm(),
        rateLimit(4),
        validator(
            "json",
            z.object({
                client_name: ApplicationSchema.shape.name,
                redirect_uris: ApplicationSchema.shape.redirect_uris.or(
                    ApplicationSchema.shape.redirect_uri,
                ),
                scopes: z.string().default("read").meta({
                    description: "Space separated list of scopes.",
                    type: "string",
                }),
                // Allow empty websites because Traewelling decides to give an empty
                // value instead of not providing anything at all
                website: ApplicationSchema.shape.website
                    .optional()
                    .or(z.literal(""))
                    .meta({
                        type: "string",
                    }),
            }),
            handleZodError,
        ),
        async (context) => {
            const { client_name, redirect_uris, scopes, website } =
                context.req.valid("json");

            const app = await Application.insert({
                id: randomUUIDv7(),
                name: client_name,
                redirectUri: Array.isArray(redirect_uris)
                    ? redirect_uris.join("\n")
                    : redirect_uris,
                scopes,
                website: website || undefined,
                clientId: randomString(32, "base64url"),
                secret: randomString(64, "base64url"),
            });

            return context.json(app.toApiCredential(), 200);
        },
    ),
);
