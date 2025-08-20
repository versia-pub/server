import { Token as TokenSchema } from "@versia/client/schemas";
import { apiRoute, handleZodError, jsonOrForm } from "@versia-server/kit/api";
import { Application, db, Token } from "@versia-server/kit/db";
import { AuthorizationCodes } from "@versia-server/kit/tables";
import { randomUUIDv7 } from "bun";
import { and, eq } from "drizzle-orm";
import { describeRoute, resolver, validator } from "hono-openapi";
import { z } from "zod/v4";
import { randomString } from "@/math";

export default apiRoute((app) => {
    app.post(
        "/oauth/token",
        describeRoute({
            summary: "Obtain a token",
            description:
                "Obtain an access token, to be used during API calls that are not public.",
            externalDocs: {
                url: "https://docs.joinmastodon.org/methods/oauth/#token",
            },
            tags: ["OpenID"],
            responses: {
                200: {
                    description: "Token",
                    content: {
                        "application/json": {
                            schema: resolver(TokenSchema),
                        },
                    },
                },
                401: {
                    description: "Invalid grant",
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
        validator(
            "json",
            z.object({
                code: z.string(),
                grant_type: z.enum([
                    "authorization_code",
                    "refresh_token",
                    "client_credentials",
                ]),
                code_verifier: z.string().optional(),
                client_id: z.string(),
                client_secret: z.string(),
                redirect_uri: z.url(),
                refresh_token: z.string().optional(),
                scope: z.string().default("read"),
            }),
            handleZodError,
        ),
        async (context) => {
            const { code, client_id, client_secret, redirect_uri } =
                context.req.valid("json");

            // Verify the client_secret
            const client = await Application.fromClientId(client_id);

            if (!client || client.data.secret !== client_secret) {
                return context.json(
                    {
                        error: "invalid_client",
                        error_description: "Invalid client credentials",
                    },
                    401,
                );
            }

            const authorizationCode =
                await db.query.AuthorizationCodes.findFirst({
                    where: (codeTable) =>
                        and(
                            eq(codeTable.code, code),
                            eq(codeTable.redirectUri, redirect_uri),
                            eq(codeTable.clientId, client.id),
                        ),
                });

            if (
                !authorizationCode ||
                new Date(authorizationCode.expiresAt).getTime() < Date.now()
            ) {
                return context.json(
                    {
                        error: "invalid_grant",
                        error_description:
                            "Authorization code not found or expired",
                    },
                    404,
                );
            }

            const token = await Token.insert({
                accessToken: randomString(64, "base64url"),
                clientId: client.id,
                id: randomUUIDv7(),
                userId: authorizationCode.userId,
            });

            // Invalidate the code
            await db
                .delete(AuthorizationCodes)
                .where(eq(AuthorizationCodes.code, authorizationCode.code));

            return context.json(
                {
                    ...token.toApi(),
                    expires_in: token.data.expiresAt
                        ? Math.floor(
                              (new Date(token.data.expiresAt).getTime() -
                                  Date.now()) /
                                  1000,
                          )
                        : null,
                    refresh_token: null,
                },
                200,
            );
        },
    );
});
