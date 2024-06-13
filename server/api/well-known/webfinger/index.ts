import {
    applyConfig,
    handleZodError,
    idValidator,
    webfingerMention,
} from "@/api";
import { errorResponse, jsonResponse } from "@/response";
import { zValidator } from "@hono/zod-validator";
import { eq } from "drizzle-orm";
import type { Hono } from "hono";
import { lookup } from "mime-types";
import { z } from "zod";
import { Users } from "~/drizzle/schema";
import { config } from "~/packages/config-manager";
import { User } from "~/packages/database-interface/user";

export const meta = applyConfig({
    allowedMethods: ["GET"],
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
        resource: z.string().trim().min(1).max(512).startsWith("acct:"),
    }),
};

export default (app: Hono) =>
    app.on(
        meta.allowedMethods,
        meta.route,
        zValidator("query", schemas.query, handleZodError),
        async (context) => {
            const { resource } = context.req.valid("query");

            // Check if resource is in the correct format (acct:uuid/username@domain)
            if (!resource.match(webfingerMention)) {
                return errorResponse(
                    "Invalid resource (should be acct:(id or username)@domain)",
                    400,
                );
            }

            const requestedUser = resource.split("acct:")[1];

            const host = new URL(config.http.base_url).host;

            // Check if user is a local user
            if (requestedUser.split("@")[1] !== host) {
                return errorResponse("User is a remote user", 404);
            }

            const isUuid = requestedUser.split("@")[0].match(idValidator);

            const user = await User.fromSql(
                eq(
                    isUuid ? Users.id : Users.username,
                    requestedUser.split("@")[0],
                ),
            );

            if (!user) {
                return errorResponse("User not found", 404);
            }

            return jsonResponse({
                subject: `acct:${
                    isUuid ? user.id : user.data.username
                }@${host}`,

                links: [
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
                        type: lookup(user.getAvatarUrl(config)),
                        href: user.getAvatarUrl(config),
                    },
                ],
            });
        },
    );
