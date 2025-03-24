import {
    apiRoute,
    idValidator,
    parseUserAddress,
    webfingerMention,
} from "@/api";
import { createRoute, z } from "@hono/zod-openapi";
import { getLogger } from "@logtape/logtape";
import type { ResponseError } from "@versia/federation";
import { WebFinger } from "@versia/federation/schemas";
import { User } from "@versia/kit/db";
import { Users } from "@versia/kit/tables";
import { and, eq, isNull } from "drizzle-orm";
import { ApiError } from "~/classes/errors/api-error";
import { config } from "~/config.ts";

const schemas = {
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
        404: ApiError.accountNotFound().schema,
    },
});

export default apiRoute((app) =>
    app.openapi(route, async (context) => {
        const { resource } = context.req.valid("query");

        const requestedUser = resource.split("acct:")[1];

        const host = config.http.base_url.host;

        const { username, domain } = parseUserAddress(requestedUser);

        // Check if user is a local user
        if (domain !== host) {
            throw new ApiError(
                404,
                `User domain ${domain} does not match ${host}`,
            );
        }

        const isUuid = username.match(idValidator);

        const user = await User.fromSql(
            and(
                eq(isUuid ? Users.id : Users.username, username),
                isNull(Users.instanceId),
            ),
        );

        if (!user) {
            throw ApiError.accountNotFound();
        }

        let activityPubUrl = "";

        if (config.federation.bridge) {
            const manager = await User.getFederationRequester();

            try {
                activityPubUrl = await manager.webFinger(
                    user.data.username,
                    config.http.base_url.host,
                    "application/activity+json",
                    config.federation.bridge.url.origin,
                );
            } catch (e) {
                const error = e as ResponseError;

                getLogger(["federation", "bridge"])
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
                        // Default avatars are SVGs
                        type:
                            user.avatar?.getPreferredMimeType() ??
                            "image/svg+xml",
                        href: user.getAvatarUrl(),
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
