import { apiRoute } from "@/api";
import { createRoute, z } from "@hono/zod-openapi";
import { db } from "@versia/kit/db";
import { Applications, Tokens } from "@versia/kit/tables";
import { and, eq } from "drizzle-orm";
import { config } from "~/config.ts";

const schemas = {
    query: z.object({
        redirect_uri: z.string().url(),
        client_id: z.string(),
        code: z.string(),
    }),
};

const route = createRoute({
    method: "get",
    path: "/api/auth/redirect",
    summary: "OAuth Code flow",
    description:
        "Redirects to the application, or back to login if the code is invalid",
    responses: {
        302: {
            description:
                "Redirects to the application, or back to login if the code is invalid",
        },
    },
    request: {
        query: schemas.query,
    },
});

/**
 * OAuth Code flow
 */
export default apiRoute((app) =>
    app.openapi(route, async (context) => {
        const { redirect_uri, client_id, code } = context.req.valid("query");

        const redirectToLogin = (error: string): Response =>
            context.redirect(
                `${config.frontend.routes.login}?${new URLSearchParams({
                    ...context.req.query,
                    error: encodeURIComponent(error),
                }).toString()}`,
            );

        const foundToken = await db
            .select()
            .from(Tokens)
            .leftJoin(Applications, eq(Tokens.applicationId, Applications.id))
            .where(
                and(
                    eq(Tokens.code, code),
                    eq(Applications.clientId, client_id),
                ),
            )
            .limit(1);

        if (!foundToken || foundToken.length <= 0) {
            return redirectToLogin("Invalid code");
        }

        // Redirect back to application
        return context.redirect(
            `${redirect_uri}?${new URLSearchParams({
                code,
            }).toString()}`,
        );
    }),
);
