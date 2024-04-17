import { randomBytes } from "node:crypto";
import { apiRoute, applyConfig } from "@api";
import { errorResponse, jsonResponse } from "@response";
import { z } from "zod";
import { db } from "~drizzle/db";
import { Applications } from "~drizzle/schema";

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
});

export const schema = z.object({
    client_name: z.string().min(1).max(100),
    redirect_uris: z.string().min(0).max(2000).url(),
    scopes: z.string().min(1).max(200),
    website: z.string().min(0).max(2000).url().optional(),
});

/**
 * Creates a new application to obtain OAuth 2 credentials
 */
export default apiRoute<typeof meta, typeof schema>(
    async (req, matchedRoute, extraData) => {
        const { client_name, redirect_uris, scopes, website } =
            extraData.parsedRequest;

        const app = (
            await db
                .insert(Applications)
                .values({
                    name: client_name || "",
                    redirectUris: redirect_uris || "",
                    scopes: scopes || "read",
                    website: website || null,
                    clientId: randomBytes(32).toString("base64url"),
                    secret: randomBytes(64).toString("base64url"),
                })
                .returning()
        )[0];

        return jsonResponse({
            id: app.id,
            name: app.name,
            website: app.website,
            client_id: app.clientId,
            client_secret: app.secret,
            redirect_uri: app.redirectUris,
            vapid_link: app.vapidKey,
        });
    },
);
