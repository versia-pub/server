import { applyConfig, handleZodError, jsonOrForm } from "@/api";
import { randomString } from "@/math";
import { jsonResponse } from "@/response";
import { zValidator } from "@hono/zod-validator";
import type { Hono } from "hono";
import { z } from "zod";
import { db } from "~/drizzle/db";
import { Applications, RolePermissions } from "~/drizzle/schema";

export const meta = applyConfig({
    allowedMethods: ["POST"],
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
    form: z.object({
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

export default (app: Hono) =>
    app.on(
        meta.allowedMethods,
        meta.route,
        jsonOrForm(),
        zValidator("form", schemas.form, handleZodError),
        async (context) => {
            const { client_name, redirect_uris, scopes, website } =
                context.req.valid("form");

            const app = (
                await db
                    .insert(Applications)
                    .values({
                        name: client_name || "",
                        redirectUri: decodeURIComponent(redirect_uris) || "",
                        scopes: scopes || "read",
                        website: website || null,
                        clientId: randomString(32, "base64url"),
                        secret: randomString(64, "base64url"),
                    })
                    .returning()
            )[0];

            return jsonResponse({
                id: app.id,
                name: app.name,
                website: app.website,
                client_id: app.clientId,
                client_secret: app.secret,
                redirect_uri: app.redirectUri,
                vapid_link: app.vapidKey,
            });
        },
    );
