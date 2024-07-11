import { applyConfig, debugRequest, handleZodError } from "@/api";
import { errorResponse, jsonResponse, response } from "@/response";
import type { Hono } from "@hono/hono";
import { zValidator } from "@hono/zod-validator";
import { getLogger } from "@logtape/logtape";
import {
    EntityValidator,
    RequestParserHandler,
    SignatureValidator,
} from "@lysand-org/federation";
import type { Entity } from "@lysand-org/federation/types";
import type { SocketAddress } from "bun";
import { and, eq } from "drizzle-orm";
import { matches } from "ip-matching";
import { z } from "zod";
import { type ValidationError, isValidationError } from "zod-validation-error";
import {
    getRelationshipToOtherUser,
    sendFollowAccept,
} from "~/classes/functions/user";
import { db } from "~/drizzle/db";
import { Notes, Notifications, Relationships } from "~/drizzle/schema";
import { config } from "~/packages/config-manager";
import { Note } from "~/packages/database-interface/note";
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
        origin: z.string(),
    }),
    body: z.any(),
};

export default (app: Hono) =>
    app.on(
        meta.allowedMethods,
        meta.route,
        zValidator("param", schemas.param, handleZodError),
        zValidator("header", schemas.header, handleZodError),
        zValidator("json", schemas.body, handleZodError),
        async (context) => {
            const { uuid } = context.req.valid("param");
            const { signature, date, authorization, origin } =
                context.req.valid("header");
            const logger = getLogger(["federation", "inbox"]);

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
                return errorResponse("User not found", 404);
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
                        return errorResponse(
                            "An invalid token was passed in the Authorization header. Please use the correct token, or remove the Authorization header.",
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
                        return errorResponse(
                            "Request IP address is not available",
                            500,
                        );
                    }
                }
            }

            // Verify request signature
            if (checkSignature) {
                const keyId = signature
                    .split("keyId=")[1]
                    .split(",")[0]
                    .replace(/"/g, "");

                const sender = await User.resolve(keyId);

                if (!sender) {
                    return errorResponse("Could not resolve keyId", 400);
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
                        return false;
                    });

                if (!isValid) {
                    return errorResponse("Invalid signature", 400);
                }
            }

            const validator = new EntityValidator();
            const handler = new RequestParserHandler(body, validator);

            try {
                const result = await handler.parseBody({
                    note: async (note) => {
                        const account = await User.resolve(note.author);

                        if (!account) {
                            return errorResponse("Author not found", 404);
                        }

                        const newStatus = await Note.fromLysand(
                            note,
                            account,
                        ).catch((e) => {
                            logger.error`${e}`;
                            return null;
                        });

                        if (!newStatus) {
                            return errorResponse("Failed to add status", 500);
                        }

                        return response("Note created", 201);
                    },
                    follow: async (follow) => {
                        const account = await User.resolve(follow.author);

                        if (!account) {
                            return errorResponse("Author not found", 400);
                        }

                        const foundRelationship =
                            await getRelationshipToOtherUser(account, user);

                        if (foundRelationship.following) {
                            return response("Already following", 200);
                        }

                        await db
                            .update(Relationships)
                            .set({
                                following: !user.data.isLocked,
                                requested: user.data.isLocked,
                                showingReblogs: true,
                                notifying: true,
                                languages: [],
                            })
                            .where(eq(Relationships.id, foundRelationship.id));

                        // Update other user's requested_by
                        await db
                            .update(Relationships)
                            .set({
                                requestedBy: user.data.isLocked,
                            })
                            .where(
                                and(
                                    eq(Relationships.subjectId, account.id),
                                    eq(Relationships.ownerId, user.id),
                                ),
                            );

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
                            return errorResponse("Author not found", 400);
                        }

                        const foundRelationship =
                            await getRelationshipToOtherUser(user, account);

                        if (!foundRelationship.requested) {
                            return response(
                                "There is no follow request to accept",
                                200,
                            );
                        }

                        await db
                            .update(Relationships)
                            .set({
                                following: true,
                                requested: false,
                            })
                            .where(eq(Relationships.id, foundRelationship.id));

                        // Update other user's data
                        await db
                            .update(Relationships)
                            .set({
                                followedBy: true,
                                requestedBy: false,
                            })
                            .where(
                                and(
                                    eq(Relationships.subjectId, account.id),
                                    eq(Relationships.ownerId, user.id),
                                ),
                            );

                        return response("Follow request accepted", 200);
                    },
                    followReject: async (followReject) => {
                        const account = await User.resolve(followReject.author);

                        if (!account) {
                            return errorResponse("Author not found", 400);
                        }

                        const foundRelationship =
                            await getRelationshipToOtherUser(user, account);

                        if (!foundRelationship.requested) {
                            return response(
                                "There is no follow request to reject",
                                200,
                            );
                        }

                        await db
                            .update(Relationships)
                            .set({
                                requested: false,
                                following: false,
                            })
                            .where(eq(Relationships.id, foundRelationship.id));

                        // Update other user's data
                        await db
                            .update(Relationships)
                            .set({
                                followedBy: false,
                                requestedBy: false,
                            })
                            .where(
                                and(
                                    eq(Relationships.subjectId, account.id),
                                    eq(Relationships.ownerId, user.id),
                                ),
                            );

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
                            return errorResponse(
                                "Cannot delete other users than self",
                                400,
                            );
                        }

                        return errorResponse(
                            `Deletion of object ${toDelete} not implemented`,
                            400,
                        );
                    },
                    user: async (user) => {
                        // Refetch user to ensure we have the latest data
                        const updatedAccount = await User.saveFromRemote(
                            user.uri,
                        );

                        if (!updatedAccount) {
                            return errorResponse("Failed to update user", 500);
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
                            return errorResponse("Note not found", 404);
                        }

                        await note.updateFromRemote();

                        return response("Note updated", 200);
                    },
                });

                if (result) {
                    return result;
                }

                return errorResponse("Object has not been implemented", 400);
            } catch (e) {
                if (isValidationError(e)) {
                    return errorResponse((e as ValidationError).message, 400);
                }
                logger.error`${e}`;
                return jsonResponse(
                    {
                        error: "Failed to process request",
                        message: (e as Error).message,
                    },
                    500,
                );
            }
        },
    );
