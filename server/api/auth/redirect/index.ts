import { apiRoute, applyConfig } from "@api";
import { client } from "~database/datasource";
import { userRelations } from "~database/entities/relations";

export const meta = applyConfig({
    allowedMethods: ["POST"],
    ratelimits: {
        max: 4,
        duration: 60,
    },
    route: "/auth/redirect",
    auth: {
        required: false,
    },
});

/**
 * OAuth Code flow
 */
export default apiRoute<{
    email: string;
    password: string;
}>(async (req, matchedRoute) => {
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

    // Get token
    const token = await client.token.findFirst({
        where: {
            code,
            application: {
                client_id,
            },
        },
        include: {
            user: {
                include: userRelations,
            },
            application: true,
        },
    });

    if (!token) return redirectToLogin("Invalid code");

    // Redirect back to application
    return Response.redirect(`${redirect_uri}?code=${code}`, 302);
});
