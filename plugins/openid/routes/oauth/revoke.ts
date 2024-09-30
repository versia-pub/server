import { jsonOrForm } from "@/api";
import { createRoute, z } from "@hono/zod-openapi";
import { db } from "@versia/kit/db";
import { eq } from "@versia/kit/drizzle";
import { Tokens } from "@versia/kit/tables";
import type { PluginType } from "../..";

export const schemas = {
    json: z.object({
        client_id: z.string(),
        client_secret: z.string(),
        token: z.string().optional(),
    }),
};

export default (plugin: PluginType) => {
    plugin.registerRoute("/oauth/revoke", (app) => {
        app.openapi(
            createRoute({
                method: "post",
                path: "/oauth/revoke",
                summary: "Revoke token",
                middleware: [jsonOrForm()],
                request: {
                    body: {
                        content: {
                            "application/json": {
                                schema: schemas.json,
                            },
                            "application/x-www-form-urlencoded": {
                                schema: schemas.json,
                            },
                            "multipart/form-data": {
                                schema: schemas.json,
                            },
                        },
                    },
                },
                responses: {
                    200: {
                        description: "Token deleted",
                        content: {
                            "application/json": {
                                schema: z.object({}),
                            },
                        },
                    },
                    401: {
                        description: "Authorization error",
                        content: {
                            "application/json": {
                                schema: z.object({
                                    error: z.string(),
                                    error_description: z.string(),
                                }),
                            },
                        },
                    },
                },
            }),
            async (context) => {
                const { client_id, client_secret, token } =
                    context.req.valid("json");

                const foundToken = await db.query.Tokens.findFirst({
                    where: (tokenTable, { eq, and }) =>
                        and(
                            eq(tokenTable.accessToken, token ?? ""),
                            eq(tokenTable.clientId, client_id),
                        ),
                    with: {
                        application: true,
                    },
                });

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
                if (foundToken.application?.secret !== client_secret) {
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
