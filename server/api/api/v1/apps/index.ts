import { randomBytes } from "node:crypto";
import { apiRoute, applyConfig } from "@api";
import { errorResponse, jsonResponse } from "@response";
import { db } from "~drizzle/db";
import { application } from "~drizzle/schema";

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

/**
 * Creates a new application to obtain OAuth 2 credentials
 */
export default apiRoute<{
    client_name: string;
    redirect_uris: string;
    scopes: string;
    website: string;
}>(async (req, matchedRoute, extraData) => {
    const { client_name, redirect_uris, scopes, website } =
        extraData.parsedRequest;

    // Check if redirect URI is a valid URI, and also an absolute URI
    if (redirect_uris) {
        if (!URL.canParse(redirect_uris)) {
            return errorResponse("Redirect URI must be a valid URI", 422);
        }
    }

    const app = (
        await db
            .insert(application)
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
});
