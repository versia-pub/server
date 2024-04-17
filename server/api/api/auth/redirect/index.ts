import { apiRoute, applyConfig } from "@api";
import { and, eq } from "drizzle-orm";
import { db } from "~drizzle/db";
import { Applications, Tokens } from "~drizzle/schema";

export const meta = applyConfig({
    allowedMethods: ["POST"],
    ratelimits: {
        max: 4,
        duration: 60,
    },
    route: "/api/auth/redirect",
    auth: {
        required: false,
    },
});

/**
 * OAuth Code flow
 */
export default apiRoute(async (req, matchedRoute) => {
    const redirect_uri = decodeURIComponent(matchedRoute.query.redirect_uri);
    const client_id = matchedRoute.query.client_id;
    const code = matchedRoute.query.code;

    const redirectToLogin = (error: string) =>
        Response.redirect(
            `/oauth/authorize?${new URLSearchParams({
                ...matchedRoute.query,
                error: encodeURIComponent(error),
            }).toString()}`,
            302,
        );

    const foundToken = await db
        .select()
        .from(Tokens)
        .leftJoin(Applications, eq(Tokens.applicationId, Applications.id))
        .where(and(eq(Tokens.code, code), eq(Applications.clientId, client_id)))
        .limit(1);

    if (!foundToken || foundToken.length <= 0)
        return redirectToLogin("Invalid code");

    // Redirect back to application
    return Response.redirect(`${redirect_uri}?code=${code}`, 302);
});
