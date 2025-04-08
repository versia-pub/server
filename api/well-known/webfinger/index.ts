import {
    apiRoute,
    handleZodError,
    idValidator,
    parseUserAddress,
    webfingerMention,
} from "@/api";
import { getLogger } from "@logtape/logtape";
import { User } from "@versia/kit/db";
import { Users } from "@versia/kit/tables";
import { and, eq, isNull } from "drizzle-orm";
import { describeRoute } from "hono-openapi";
import { resolver, validator } from "hono-openapi/zod";
import { z } from "zod";
import { ApiError } from "~/classes/errors/api-error";
import { config } from "~/config.ts";
import { WebFingerSchema } from "~/packages/sdk/schemas";

export default apiRoute((app) =>
    app.get(
        "/.well-known/webfinger",
        describeRoute({
            summary: "Get user information",
            tags: ["Federation"],
            responses: {
                200: {
                    description: "User information",
                    content: {
                        "application/json": {
                            schema: resolver(WebFingerSchema),
                        },
                    },
                },
                404: ApiError.accountNotFound().schema,
            },
        }),
        validator(
            "query",
            z.object({
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
            handleZodError,
        ),
        async (context) => {
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

            let activityPubUrl: URL | null = null;

            if (config.federation.bridge) {
                try {
                    activityPubUrl =
                        await User.federationRequester.resolveWebFinger(
                            user.data.username,
                            config.http.base_url.host,
                            "application/activity+json",
                            config.federation.bridge.url.origin,
                        );
                } catch (e) {
                    const error = e as ApiError;

                    getLogger(["federation", "bridge"])
                        .error`Error from bridge: ${error.message}`;
                }
            }

            return context.json(
                {
                    subject: `acct:${
                        isUuid ? user.id : user.data.username
                    }@${host}`,

                    links: [
                        // Keep the ActivityPub link first, because Misskey only searches
                        // for the first link with rel="self" and doesn't check the type.
                        activityPubUrl
                            ? {
                                  rel: "self",
                                  type: "application/activity+json",
                                  href: activityPubUrl.href,
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
        },
    ),
);
