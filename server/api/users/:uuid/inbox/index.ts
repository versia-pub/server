import { apiRoute, applyConfig, debugRequest, handleZodError } from "@/api";
import { response } from "@/response";
import { sentry } from "@/sentry";
import { zValidator } from "@hono/zod-validator";
import { getLogger } from "@logtape/logtape";
import {
    EntityValidator,
    RequestParserHandler,
    SignatureValidator,
} from "@lysand-org/federation";
import type { Entity } from "@lysand-org/federation/types";
import type { SocketAddress } from "bun";
import { eq } from "drizzle-orm";
import { matches } from "ip-matching";
import { z } from "zod";
import { type ValidationError, isValidationError } from "zod-validation-error";
import { sendFollowAccept } from "~/classes/functions/user";
import { db } from "~/drizzle/db";
import { Notes, Notifications } from "~/drizzle/schema";
import { config } from "~/packages/config-manager";
import { Note } from "~/packages/database-interface/note";
import { Relationship } from "~/packages/database-interface/relationship";
import { User } from "~/packages/database-interface/user";

export const meta = applyConfig({
    allowedMethods: ["POST"],
    auth: {
        required: false,
    },
    ratelimits: {
        duration: 60,
        max: 500,
    },
    route: "/users/:uuid/inbox",
});

export const schemas = {
    param: z.object({
        uuid: z.string().uuid(),
    }),
    header: z.object({
        signature: z.string(),
        date: z.string(),
        authorization: z.string().optional(),
    }),
    body: z.any(),
};

export default apiRoute((app) =>
    app.on(
        meta.allowedMethods,
        meta.route,
        zValidator("param", schemas.param, handleZodError),
        zValidator("header", schemas.header, handleZodError),
        zValidator("json", schemas.body, handleZodError),
        async (context) => {
            const { uuid } = context.req.valid("param");
            const { signature, date, authorization } =
                context.req.valid("header");
            const logger = getLogger(["federation", "inbox"]);

            const body: Entity = await context.req.valid("json");

            if (config.debug.federation) {
                // Debug request
                await debugRequest(
                    new Request(context.req.url, {
                        method: context.req.method,
                        headers: context.req.raw.headers,
                        body: await context.req.text(),
                    }),
                );
            }

            const user = await User.fromId(uuid);

            if (!user) {
                return context.json({ error: "User not found" }, 404);
            }

            if (user.isRemote()) {
                return context.json(
                    { error: "Cannot view users from remote instances" },
                    403,
                );
            }

            // @ts-expect-error IP attribute is not in types
            const requestIp = context.env?.ip as
                | SocketAddress
                | undefined
                | null;

            let checkSignature = true;

            if (config.federation.bridge.enabled) {
                const token = authorization?.split("Bearer ")[1];
                if (token) {
                    // Request is bridge request
                    if (token !== config.federation.bridge.token) {
                        return context.json(
                            {
                                error: "An invalid token was passed in the Authorization header. Please use the correct token, or remove the Authorization header.",
                            },
                            401,
                        );
                    }

                    if (requestIp?.address) {
                        if (config.federation.bridge.allowed_ips.length > 0) {
                            checkSignature = false;
                        }

                        for (const ip of config.federation.bridge.allowed_ips) {
                            if (matches(ip, requestIp?.address)) {
                                checkSignature = false;
                                break;
                            }
                        }
                    } else {
                        return context.json(
                            {
                                error: "Request IP address is not available",
                            },
                            500,
                        );
                    }
                }
            }

            const keyId = signature
                .split("keyId=")[1]
                .split(",")[0]
                .replace(/"/g, "");
            const sender = await User.resolve(keyId);

            const origin = new URL(keyId).origin;

            // Check if Origin is defederated
            if (
                config.federation.blocked.find(
                    (blocked) =>
                        blocked.includes(origin) || origin.includes(blocked),
                )
            ) {
                // Pretend to accept request
                return response(null, 201);
            }

            // Verify request signature
            if (checkSignature) {
                if (!sender) {
                    return context.json(
                        { error: "Could not resolve keyId" },
                        400,
                    );
                }

                if (config.debug.federation) {
                    // Log public key
                    logger.debug`Sender public key: ${sender.data.publicKey}`;
                }

                const validator = await SignatureValidator.fromStringKey(
                    sender.data.publicKey,
                );

                // If base_url uses https and request uses http, rewrite request to use https
                // This fixes reverse proxy errors
                const reqUrl = new URL(context.req.url);
                if (
                    new URL(config.http.base_url).protocol === "https:" &&
                    reqUrl.protocol === "http:"
                ) {
                    reqUrl.protocol = "https:";
                }

                const isValid = await validator
                    .validate(
                        new Request(reqUrl, {
                            method: context.req.method,
                            headers: {
                                Signature: signature,
                                Date: date,
                            },
                            body: await context.req.text(),
                        }),
                    )
                    .catch((e) => {
                        logger.error`${e}`;
                        sentry?.captureException(e);
                        return false;
                    });

                if (!isValid) {
                    return context.json({ error: "Invalid signature" }, 400);
                }
            }

            const validator = new EntityValidator();
            const handler = new RequestParserHandler(body, validator);

            try {
                const result = await handler.parseBody({
                    note: async (note) => {
                        const account = await User.resolve(note.author);

                        if (!account) {
                            return context.json(
                                { error: "Author not found" },
                                404,
                            );
                        }

                        const newStatus = await Note.fromVersia(
                            note,
                            account,
                        ).catch((e) => {
                            logger.error`${e}`;
                            sentry?.captureException(e);
                            return null;
                        });

                        if (!newStatus) {
                            return context.json(
                                { error: "Failed to add status" },
                                500,
                            );
                        }

                        return response("Note created", 201);
                    },
                    follow: async (follow) => {
                        const account = await User.resolve(follow.author);

                        if (!account) {
                            return context.json(
                                { error: "Author not found" },
                                400,
                            );
                        }

                        const foundRelationship =
                            await Relationship.fromOwnerAndSubject(
                                account,
                                user,
                            );

                        if (foundRelationship.data.following) {
                            return response("Already following", 200);
                        }

                        await foundRelationship.update({
                            following: !user.data.isLocked,
                            requested: user.data.isLocked,
                            showingReblogs: true,
                            notifying: true,
                            languages: [],
                        });

                        await db.insert(Notifications).values({
                            accountId: account.id,
                            type: user.data.isLocked
                                ? "follow_request"
                                : "follow",
                            notifiedId: user.id,
                        });

                        if (!user.data.isLocked) {
                            await sendFollowAccept(account, user);
                        }

                        return response("Follow request sent", 200);
                    },
                    followAccept: async (followAccept) => {
                        const account = await User.resolve(followAccept.author);

                        if (!account) {
                            return context.json(
                                { error: "Author not found" },
                                400,
                            );
                        }

                        const foundRelationship =
                            await Relationship.fromOwnerAndSubject(
                                user,
                                account,
                            );

                        if (!foundRelationship.data.requested) {
                            return response(
                                "There is no follow request to accept",
                                200,
                            );
                        }

                        await foundRelationship.update({
                            requested: false,
                            following: true,
                        });

                        return response("Follow request accepted", 200);
                    },
                    followReject: async (followReject) => {
                        const account = await User.resolve(followReject.author);

                        if (!account) {
                            return context.json(
                                { error: "Author not found" },
                                400,
                            );
                        }

                        const foundRelationship =
                            await Relationship.fromOwnerAndSubject(
                                user,
                                account,
                            );

                        if (!foundRelationship.data.requested) {
                            return response(
                                "There is no follow request to reject",
                                200,
                            );
                        }

                        await foundRelationship.update({
                            requested: false,
                            following: false,
                        });

                        return response("Follow request rejected", 200);
                    },
                    undo: async (undo) => {
                        // Delete the specified object from database, if it exists and belongs to the user
                        const toDelete = undo.object;

                        // Try and find a follow, note, or user with the given URI
                        // Note
                        const note = await Note.fromSql(
                            eq(Notes.uri, toDelete),
                            eq(Notes.authorId, user.id),
                        );

                        if (note) {
                            await note.delete();
                            return response("Note deleted", 200);
                        }

                        // Follow (unfollow/cancel follow request)
                        // TODO: Remember to store URIs of follow requests/objects in the future

                        // User
                        const otherUser = await User.resolve(toDelete);

                        if (otherUser) {
                            if (otherUser.id === user.id) {
                                // Delete own account
                                await user.delete();
                                return response("Account deleted", 200);
                            }
                            return context.json(
                                {
                                    error: "Cannot delete other users than self",
                                },
                                400,
                            );
                        }

                        return context.json(
                            {
                                error: `Deletetion of object ${toDelete} not implemented`,
                            },
                            400,
                        );
                    },
                    user: async (user) => {
                        // Refetch user to ensure we have the latest data
                        const updatedAccount = await User.saveFromRemote(
                            user.uri,
                        );

                        if (!updatedAccount) {
                            return context.json(
                                { error: "Failed to update user" },
                                500,
                            );
                        }

                        return response("User refreshed", 200);
                    },
                    patch: async (patch) => {
                        // Update the specified note in the database, if it exists and belongs to the user
                        const toPatch = patch.patched_id;

                        const note = await Note.fromSql(
                            eq(Notes.uri, toPatch),
                            eq(Notes.authorId, user.id),
                        );

                        // Refetch note
                        if (!note) {
                            return context.json(
                                { error: "Note not found" },
                                404,
                            );
                        }

                        await note.updateFromRemote();

                        return response("Note updated", 200);
                    },
                });

                if (result) {
                    return result;
                }

                return context.json(
                    { error: "Object has not been implemented" },
                    400,
                );
            } catch (e) {
                if (isValidationError(e)) {
                    return context.json(
                        {
                            error: "Failed to process request",
                            error_description: (e as ValidationError).message,
                        },
                        400,
                    );
                }
                logger.error`${e}`;
                sentry?.captureException(e);
                return context.json(
                    {
                        error: "Failed to process request",
                        message: (e as Error).message,
                    },
                    500,
                );
            }
        },
    ),
);
