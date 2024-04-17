import { apiRoute, applyConfig } from "@api";
import { errorResponse, jsonResponse } from "@response";
import { z } from "zod";
import { db } from "~drizzle/db";

export const meta = applyConfig({
    allowedMethods: ["POST"],
    auth: {
        required: false,
    },
    ratelimits: {
        duration: 60,
        max: 10,
    },
    route: "/oauth/token",
});

export const schema = z.object({
    grant_type: z.string(),
    code: z.string(),
    redirect_uri: z.string().url(),
    client_id: z.string(),
    client_secret: z.string(),
    scope: z.string(),
});

/**
 * Allows getting token from OAuth code
 */
export default apiRoute<typeof meta, typeof schema>(
    async (req, matchedRoute, extraData) => {
        const {
            grant_type,
            code,
            redirect_uri,
            client_id,
            client_secret,
            scope,
        } = extraData.parsedRequest;

        if (grant_type !== "authorization_code")
            return errorResponse(
                "Invalid grant type (try 'authorization_code')",
                422,
            );

        // Get associated token
        const application = await db.query.Applications.findFirst({
            where: (application, { eq, and }) =>
                and(
                    eq(application.clientId, client_id),
                    eq(application.secret, client_secret),
                    eq(application.redirectUris, redirect_uri),
                    eq(application.scopes, scope?.replaceAll("+", " ")),
                ),
        });

        if (!application)
            return errorResponse(
                "Invalid client credentials (missing application)",
                401,
            );

        const token = await db.query.Tokens.findFirst({
            where: (token, { eq }) =>
                eq(token.code, code) && eq(token.applicationId, application.id),
        });

        if (!token)
            return errorResponse(
                "Invalid access token or client credentials",
                401,
            );

        return jsonResponse({
            access_token: token.accessToken,
            token_type: token.tokenType,
            scope: token.scope,
            created_at: new Date(token.createdAt).getTime(),
        });
    },
);
