import { apiRoute, applyConfig, auth, handleZodError } from "@/api";
import { errorResponse, jsonResponse, proxyUrl, response } from "@/response";
import { zValidator } from "@hono/zod-validator";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "~/drizzle/db";
import { OpenIdAccounts, RolePermissions } from "~/drizzle/schema";
import { config } from "~/packages/config-manager";

export const meta = applyConfig({
    allowedMethods: ["GET", "DELETE"],
    auth: {
        required: true,
    },
    ratelimits: {
        duration: 60,
        max: 20,
    },
    route: "/api/v1/sso/:id",
    permissions: {
        required: [RolePermissions.OAuth],
    },
});

export const schemas = {
    param: z.object({
        id: z.string(),
    }),
};

/**
 * SSO Account Linking management endpoint
 * A GET request allows the user to list all their linked accounts
 * A POST request allows the user to link a new account
 */
export default apiRoute((app) =>
    app.on(
        meta.allowedMethods,
        meta.route,
        zValidator("param", schemas.param, handleZodError),
        auth(meta.auth, meta.permissions),
        async (context) => {
            const { id: issuerId } = context.req.valid("param");
            const { user } = context.req.valid("header");

            if (!user) {
                return errorResponse("Unauthorized", 401);
            }

            const issuer = config.oidc.providers.find(
                (provider) => provider.id === issuerId,
            );

            if (!issuer) {
                return errorResponse("Issuer not found", 404);
            }

            switch (context.req.method) {
                case "GET": {
                    // Get all linked accounts
                    const account = await db.query.OpenIdAccounts.findFirst({
                        where: (account, { eq, and }) =>
                            and(
                                eq(account.userId, account.id),
                                eq(account.issuerId, issuerId),
                            ),
                    });

                    if (!account) {
                        return errorResponse(
                            "Account not found or is not linked to this issuer",
                            404,
                        );
                    }

                    return jsonResponse({
                        id: issuer.id,
                        name: issuer.name,
                        icon: proxyUrl(issuer.icon) || undefined,
                    });
                }
                case "DELETE": {
                    const account = await db.query.OpenIdAccounts.findFirst({
                        where: (account, { eq, and }) =>
                            and(
                                eq(account.userId, user.id),
                                eq(account.issuerId, issuerId),
                            ),
                    });

                    if (!account) {
                        return errorResponse(
                            "Account not found or is not linked to this issuer",
                            404,
                        );
                    }

                    await db
                        .delete(OpenIdAccounts)
                        .where(eq(OpenIdAccounts.id, account.id));

                    return response(null, 204);
                }
            }
        },
    ),
);
