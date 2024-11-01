import { apiRoute, applyConfig, idValidator, webfingerMention } from "@/api";
import { createRoute } from "@hono/zod-openapi";
import { getLogger } from "@logtape/logtape";
import type { ResponseError } from "@versia/federation";
import { WebFinger } from "@versia/federation/schemas";
import { User } from "@versia/kit/db";
import { and, eq, isNull } from "drizzle-orm";
import { lookup } from "mime-types";
import { z } from "zod";
import { Users } from "~/drizzle/schema";
import { config } from "~/packages/config-manager";
import { ErrorSchema } from "~/types/api";

export const meta = applyConfig({
    auth: {
        required: false,
    },
    ratelimits: {
        duration: 60,
        max: 60,
    },
    route: "/.well-known/webfinger",
});

export const schemas = {
    query: z.object({
        resource: z
            .string()
            .trim()
            .min(1)
            .max(512)
            .startsWith("acct:")
            .regex(
                webfingerMention,
                "Invalid resource (should be acct:(id or username)@domain)",
            ),
    }),
};

const route = createRoute({
    method: "get",
    path: "/.well-known/webfinger",
    summary: "Get user information",
    request: {
        query: schemas.query,
    },
    responses: {
        200: {
            description: "User information",
            content: {
                "application/json": {
                    schema: WebFinger,
                },
            },
        },
        404: {
            description: "User not found",
            content: {
                "application/json": {
                    schema: ErrorSchema,
                },
            },
        },
    },
});

export default apiRoute((app) =>
    app.openapi(route, async (context) => {
        const { resource } = context.req.valid("query");

        const requestedUser = resource.split("acct:")[1];

        const host = new URL(config.http.base_url).host;

        // Check if user is a local user
        if (requestedUser.split("@")[1] !== host) {
            return context.json({ error: "User is a remote user" }, 404);
        }

        const isUuid = requestedUser.split("@")[0].match(idValidator);

        const user = await User.fromSql(
            and(
                eq(
                    isUuid ? Users.id : Users.username,
                    requestedUser.split("@")[0],
                ),
                isNull(Users.instanceId),
            ),
        );

        if (!user) {
            return context.json({ error: "User not found" }, 404);
        }

        let activityPubUrl = "";

        if (config.federation.bridge.enabled) {
            const manager = await User.getFederationRequester();

            try {
                activityPubUrl = await manager.webFinger(
                    user.data.username,
                    new URL(config.http.base_url).host,
                    "application/activity+json",
                    config.federation.bridge.url,
                );
            } catch (e) {
                const error = e as ResponseError;

                getLogger("federation")
                    .error`Error from bridge: ${await error.response.data}`;
            }
        }

        return context.json(
            {
                subject: `acct:${isUuid ? user.id : user.data.username}@${host}`,

                links: [
                    // Keep the ActivityPub link first, because Misskey only searches
                    // for the first link with rel="self" and doesn't check the type.
                    activityPubUrl
                        ? {
                              rel: "self",
                              type: "application/activity+json",
                              href: activityPubUrl,
                          }
                        : undefined,
                    {
                        rel: "self",
                        type: "application/json",
                        href: new URL(
                            `/users/${user.id}`,
                            config.http.base_url,
                        ).toString(),
                    },
                    {
                        rel: "avatar",
                        // TODO: don't... don't use the mime type from the file extension
                        type:
                            lookup(user.getAvatarUrl(config)) ||
                            "application/octet-stream",
                        href: user.getAvatarUrl(config),
                    },
                ].filter(Boolean) as {
                    rel: string;
                    type: string;
                    href: string;
                }[],
            },
            200,
        );
    }),
);
