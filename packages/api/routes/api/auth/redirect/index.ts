import { config } from "@versia-server/config";
import { apiRoute, handleZodError } from "@versia-server/kit/api";
import { db } from "@versia-server/kit/db";
import { Applications, Tokens } from "@versia-server/kit/tables";
import { and, eq } from "drizzle-orm";
import { describeRoute, validator } from "hono-openapi";
import { z } from "zod/v4";

/**
 * OAuth Code flow
 */
export default apiRoute((app) =>
    app.get(
        "/api/auth/redirect",
        describeRoute({
            summary: "OAuth Code flow",
            description:
                "Redirects to the application, or back to login if the code is invalid",
            tags: ["OpenID"],
            responses: {
                302: {
                    description:
                        "Redirects to the application, or back to login if the code is invalid",
                },
            },
        }),
        validator(
            "query",
            z.object({
                redirect_uri: z.url(),
                client_id: z.string(),
                code: z.string(),
            }),
            handleZodError,
        ),
        async (context) => {
            const { redirect_uri, client_id, code } =
                context.req.valid("query");

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
            return context.redirect(
                `${redirect_uri}?${new URLSearchParams({
                    code,
                }).toString()}`,
            );
        },
    ),
);
