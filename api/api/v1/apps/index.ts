import { apiRoute, jsonOrForm, reusedResponses } from "@/api";
import { randomString } from "@/math";
import { createRoute, z } from "@hono/zod-openapi";
import {
    Application as ApplicationSchema,
    CredentialApplication as CredentialApplicationSchema,
} from "@versia/client-ng/schemas";
import { Application } from "@versia/kit/db";

const route = createRoute({
    method: "post",
    path: "/api/v1/apps",
    summary: "Create an application",
    description: "Create a new application to obtain OAuth2 credentials.",
    externalDocs: {
        url: "https://docs.joinmastodon.org/methods/apps/#create",
    },
    tags: ["Apps"],
    middleware: [jsonOrForm()],
    request: {
        body: {
            content: {
                "application/json": {
                    schema: z.object({
                        client_name: ApplicationSchema.shape.name,
                        redirect_uris: ApplicationSchema.shape.redirect_uris.or(
                            ApplicationSchema.shape.redirect_uri.transform(
                                (u) => u.split("\n"),
                            ),
                        ),
                        scopes: z
                            .string()
                            .default("read")
                            .transform((s) => s.split(" "))
                            .openapi({
                                description: "Space separated list of scopes.",
                            }),
                        // Allow empty websites because Traewelling decides to give an empty
                        // value instead of not providing anything at all
                        website: ApplicationSchema.shape.website
                            .optional()
                            .or(z.literal("").transform(() => undefined)),
                    }),
                },
            },
        },
    },
    responses: {
        200: {
            description:
                "Store the client_id and client_secret in your cache, as these will be used to obtain OAuth tokens.",
            content: {
                "application/json": {
                    schema: CredentialApplicationSchema,
                },
            },
        },
        422: reusedResponses[422],
    },
});

export default apiRoute((app) =>
    app.openapi(route, async (context) => {
        const { client_name, redirect_uris, scopes, website } =
            context.req.valid("json");

        const app = await Application.insert({
            name: client_name,
            redirectUri: redirect_uris.join("\n"),
            scopes: scopes.join(" "),
            website,
            clientId: randomString(32, "base64url"),
            secret: randomString(64, "base64url"),
        });

        return context.json(app.toApiCredential(), 200);
    }),
);
