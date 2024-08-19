import { apiRoute, applyConfig, handleZodError } from "@/api";
import { zValidator } from "@hono/zod-validator";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "~/drizzle/db";
import { Applications, Tokens } from "~/drizzle/schema";
import { config } from "~/packages/config-manager";

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

export const schemas = {
    query: z.object({
        redirect_uri: z.string().url(),
        client_id: z.string(),
        code: z.string(),
    }),
};

/**
 * OAuth Code flow
 */
export default apiRoute((app) =>
    app.on(
        meta.allowedMethods,
        meta.route,
        zValidator("query", schemas.query, handleZodError),
        async (context) => {
            const { redirect_uri, client_id, code } =
                context.req.valid("query");

            const redirectToLogin = (error: string) =>
                Response.redirect(
                    `${config.frontend.routes.login}?${new URLSearchParams({
                        ...context.req.query,
                        error: encodeURIComponent(error),
                    }).toString()}`,
                    302,
                );

            const foundToken = await db
                .select()
                .from(Tokens)
                .leftJoin(
                    Applications,
                    eq(Tokens.applicationId, Applications.id),
                )
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
            return Response.redirect(`${redirect_uri}?code=${code}`, 302);
        },
    ),
);
