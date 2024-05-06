import { applyConfig, handleZodError } from "@api";
import { zValidator } from "@hono/zod-validator";
import { dualLogger } from "@loggers";
import { errorResponse, jsonResponse, response } from "@response";
import { eq } from "drizzle-orm";
import type { Hono } from "hono";
import type * as Lysand from "lysand-types";
import { z } from "zod";
import { isValidationError } from "zod-validation-error";
import { resolveNote } from "~database/entities/Status";
import {
    getRelationshipToOtherUser,
    sendFollowAccept,
} from "~database/entities/User";
import { db } from "~drizzle/db";
import { Notifications, Relationships } from "~drizzle/schema";
import { User } from "~packages/database-interface/user";
import { LogLevel } from "~packages/log-manager";
import { EntityValidator, SignatureValidator } from "~packages/lysand-utils";

export const meta = applyConfig({
    allowedMethods: ["POST"],
    auth: {
        required: false,
    },
    ratelimits: {
        duration: 60,
        max: 500,
    },
    route: "/users/:uuid",
});

export const schemas = {
    param: z.object({
        uuid: z.string().uuid(),
    }),
    header: z.object({
        signature: z.string(),
        date: z.string(),
    }),
};

export default (app: Hono) =>
    app.on(
        meta.allowedMethods,
        meta.route,
        zValidator("param", schemas.param, handleZodError),
        zValidator("header", schemas.header, handleZodError),
        async (context) => {
            const { uuid } = context.req.valid("param");
            const { signature, date } = context.req.valid("header");

            const user = await User.fromId(uuid);

            if (!user) {
                return errorResponse("User not found", 404);
            }

            // Verify request signature
            // TODO: Check if instance is defederated
            // TODO: Reverse DNS lookup with Origin header
            // biome-ignore lint/correctness/noConstantCondition: Temporary
            if (true) {
                if (!signature) {
                    return errorResponse("Missing Signature header", 400);
                }

                if (!date) {
                    return errorResponse("Missing Date header", 400);
                }

                const keyId = signature
                    .split("keyId=")[1]
                    .split(",")[0]
                    .replace(/"/g, "");

                const sender = await User.resolve(keyId);

                if (!sender) {
                    return errorResponse("Could not resolve keyId", 400);
                }

                const validator = await SignatureValidator.fromStringKey(
                    sender.getUser().publicKey,
                    signature,
                    date,
                    context.req.method,
                    new URL(context.req.url),
                    await context.req.text(),
                );

                const isValid = await validator.validate();

                if (!isValid) {
                    return errorResponse("Invalid signature", 400);
                }
            }

            const validator = new EntityValidator(
                (await context.req.json()) as Lysand.Entity,
            );

            try {
                // Add sent data to database
                switch (validator.getType()) {
                    case "Note": {
                        const note = await validator.validate<Lysand.Note>();

                        const account = await User.resolve(note.author);

                        if (!account) {
                            return errorResponse("Author not found", 404);
                        }

                        const newStatus = await resolveNote(
                            undefined,
                            note,
                        ).catch((e) => {
                            dualLogger.logError(
                                LogLevel.ERROR,
                                "Inbox.NoteResolve",
                                e as Error,
                            );
                            return null;
                        });

                        if (!newStatus) {
                            return errorResponse("Failed to add status", 500);
                        }

                        return response("Note created", 201);
                    }
                    case "Follow": {
                        const follow =
                            await validator.validate<Lysand.Follow>();

                        const account = await User.resolve(follow.author);

                        if (!account) {
                            return errorResponse("Author not found", 400);
                        }

                        const foundRelationship =
                            await getRelationshipToOtherUser(account, user);

                        // Check if already following
                        if (foundRelationship.following) {
                            return response("Already following", 200);
                        }

                        await db
                            .update(Relationships)
                            .set({
                                following: !user.getUser().isLocked,
                                requested: user.getUser().isLocked,
                                showingReblogs: true,
                                notifying: true,
                                languages: [],
                            })
                            .where(eq(Relationships.id, foundRelationship.id));

                        await db.insert(Notifications).values({
                            accountId: account.id,
                            type: user.getUser().isLocked
                                ? "follow_request"
                                : "follow",
                            notifiedId: user.id,
                        });

                        if (!user.getUser().isLocked) {
                            // Federate FollowAccept
                            await sendFollowAccept(account, user);
                        }

                        return response("Follow request sent", 200);
                    }
                    case "FollowAccept": {
                        const followAccept =
                            await validator.validate<Lysand.FollowAccept>();

                        console.log(followAccept);

                        const account = await User.resolve(followAccept.author);

                        if (!account) {
                            return errorResponse("Author not found", 400);
                        }

                        console.log(account);

                        const foundRelationship =
                            await getRelationshipToOtherUser(user, account);

                        console.log(foundRelationship);

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

                        return response("Follow request accepted", 200);
                    }
                    case "FollowReject": {
                        const followReject =
                            await validator.validate<Lysand.FollowReject>();

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

                        return response("Follow request rejected", 200);
                    }
                    default: {
                        return errorResponse(
                            "Object has not been implemented",
                            400,
                        );
                    }
                }
            } catch (e) {
                if (isValidationError(e)) {
                    return errorResponse(e.message, 400);
                }
                dualLogger.logError(LogLevel.ERROR, "Inbox", e as Error);
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
