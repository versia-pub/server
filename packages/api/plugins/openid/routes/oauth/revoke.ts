import { handleZodError, jsonOrForm } from "@versia-server/kit/api";
import { db, Token } from "@versia-server/kit/db";
import { Tokens } from "@versia-server/kit/tables";
import { and, eq } from "drizzle-orm";
import { describeRoute, resolver, validator } from "hono-openapi";
import { z } from "zod/v4";
import type { PluginType } from "../../index.ts";

export default (plugin: PluginType): void => {
    plugin.registerRoute("/oauth/revoke", (app) => {
        app.post(
            "/oauth/revoke",
            describeRoute({
                summary: "Revoke token",
                tags: ["OpenID"],
                responses: {
                    200: {
                        description: "Token deleted",
                        content: {
                            "application/json": {
                                schema: resolver(z.object({})),
                            },
                        },
                    },
                    401: {
                        description: "Authorization error",
                        content: {
                            "application/json": {
                                schema: resolver(
                                    z.object({
                                        error: z.string(),
                                        error_description: z.string(),
                                    }),
                                ),
                            },
                        },
                    },
                },
            }),
            jsonOrForm(),
            plugin.middleware,
            validator(
                "json",
                z.object({
                    client_id: z.string(),
                    client_secret: z.string(),
                    token: z.string().optional(),
                }),
                handleZodError,
            ),
            async (context) => {
                const { client_id, client_secret, token } =
                    context.req.valid("json");

                const foundToken = await Token.fromSql(
                    and(
                        eq(Tokens.accessToken, token ?? ""),
                        eq(Tokens.clientId, client_id),
                    ),
                );

                if (!(foundToken && token)) {
                    return context.json(
                        {
                            error: "unauthorized_client",
                            error_description:
                                "You are not authorized to revoke this token",
                        },
                        401,
                    );
                }

                // Check if the client secret is correct
                if (foundToken.data.application?.secret !== client_secret) {
                    return context.json(
                        {
                            error: "unauthorized_client",
                            error_description:
                                "You are not authorized to revoke this token",
                        },
                        401,
                    );
                }

                await db.delete(Tokens).where(eq(Tokens.accessToken, token));

                return context.json({}, 200);
            },
        );
    });
};
