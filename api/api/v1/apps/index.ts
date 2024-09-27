import { apiRoute, applyConfig, jsonOrForm } from "@/api";
import { randomString } from "@/math";
import { createRoute } from "@hono/zod-openapi";
import { z } from "zod";
import { db } from "~/drizzle/db";
import { Applications, RolePermissions } from "~/drizzle/schema";

export const meta = applyConfig({
    route: "/api/v1/apps",
    ratelimits: {
        max: 2,
        duration: 60,
    },
    auth: {
        required: false,
    },
    permissions: {
        required: [RolePermissions.ManageOwnApps],
    },
});

export const schemas = {
    json: z.object({
        client_name: z.string().trim().min(1).max(100),
        redirect_uris: z
            .string()
            .min(0)
            .max(2000)
            .url()
            .or(z.literal("urn:ietf:wg:oauth:2.0:oob")),
        scopes: z.string().min(1).max(200),
        website: z
            .string()
            .min(0)
            .max(2000)
            .url()
            .optional()
            // Allow empty websites because Traewelling decides to give an empty
            // value instead of not providing anything at all
            .or(z.literal("").transform(() => undefined)),
    }),
};

const route = createRoute({
    method: "post",
    path: "/api/v1/apps",
    summary: "Create app",
    description: "Create an OAuth2 app",
    middleware: [jsonOrForm()],
    request: {
        body: {
            content: {
                "application/json": {
                    schema: schemas.json,
                },
            },
        },
    },
    responses: {
        200: {
            description: "App",
            content: {
                "application/json": {
                    schema: z.object({
                        id: z.string().uuid(),
                        name: z.string(),
                        website: z.string().nullable(),
                        client_id: z.string(),
                        client_secret: z.string(),
                        redirect_uri: z.string(),
                        vapid_link: z.string().nullable(),
                    }),
                },
            },
        },
    },
});

export default apiRoute((app) =>
    app.openapi(route, async (context) => {
        const { client_name, redirect_uris, scopes, website } =
            context.req.valid("json");

        const app = (
            await db
                .insert(Applications)
                .values({
                    name: client_name || "",
                    redirectUri: decodeURI(redirect_uris) || "",
                    scopes: scopes || "read",
                    website: website || null,
                    clientId: randomString(32, "base64url"),
                    secret: randomString(64, "base64url"),
                })
                .returning()
        )[0];

        return context.json(
            {
                id: app.id,
                name: app.name,
                website: app.website,
                client_id: app.clientId,
                client_secret: app.secret,
                redirect_uri: app.redirectUri,
                vapid_link: app.vapidKey,
            },
            200,
        );
    }),
);
