import { applyConfig, debugRequest, handleZodError } from "@api";
import { zValidator } from "@hono/zod-validator";
import { dualLogger } from "@loggers";
import {
    EntityValidator,
    type HttpVerb,
    SignatureValidator,
} from "@lysand-org/federation";
import { errorResponse, jsonResponse, response } from "@response";
import type { SocketAddress } from "bun";
import { eq } from "drizzle-orm";
import type { Hono } from "hono";
import { matches } from "ip-matching";
import { z } from "zod";
import { isValidationError } from "zod-validation-error";
import { resolveNote } from "~database/entities/Status";
import {
    getRelationshipToOtherUser,
    sendFollowAccept,
} from "~database/entities/User";
import { db } from "~drizzle/db";
import { Notifications, Relationships } from "~drizzle/schema";
import { config } from "~packages/config-manager";
import { User } from "~packages/database-interface/user";
import { LogLevel, LogManager } from "~packages/log-manager";

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

            const body: typeof EntityValidator.$Entity =
                await context.req.valid("json");

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
            const request_ip = context.env?.ip as
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

                    if (request_ip?.address) {
                        if (config.federation.bridge.allowed_ips.length > 0)
                            checkSignature = false;

                        for (const ip of config.federation.bridge.allowed_ips) {
                            if (matches(ip, request_ip?.address)) {
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
                    new LogManager(Bun.stdout).log(
                        LogLevel.DEBUG,
                        "Inbox.Signature",
                        `Sender public key: ${sender.getUser().publicKey}`,
                    );
                }

                const validator = await SignatureValidator.fromStringKey(
                    sender.getUser().publicKey,
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
                        signature,
                        new Date(Date.parse(date)),
                        context.req.method as HttpVerb,
                        reqUrl,
                        await context.req.text(),
                    )
                    .catch((e) => {
                        dualLogger.logError(
                            LogLevel.ERROR,
                            "Inbox.Signature",
                            e as Error,
                        );
                        return false;
                    });

                if (!isValid) {
                    return errorResponse("Invalid signature", 400);
                }
            }

            const validator = new EntityValidator();

            try {
                // Add sent data to database
                switch (body.type) {
                    case "Note": {
                        const note = await validator.Note(body);

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
                        const follow = await validator.Follow(body);

                        if (
                            config.federation.discard.follows.find(
                                (blocked) =>
                                    blocked.includes(origin) ||
                                    origin.includes(blocked),
                            )
                        ) {
                            // Pretend to accept request
                            return response("Follow request sent", 200);
                        }

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
                        const followAccept = await validator.FollowAccept(body);

                        if (
                            config.federation.discard.follows.find(
                                (blocked) =>
                                    blocked.includes(origin) ||
                                    origin.includes(blocked),
                            )
                        ) {
                            // Pretend to accept request
                            return response("Follow request accepted", 200);
                        }

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
                        const followReject = await validator.FollowReject(body);

                        if (
                            config.federation.discard.follows.find(
                                (blocked) =>
                                    blocked.includes(origin) ||
                                    origin.includes(blocked),
                            )
                        ) {
                            // Pretend to accept request
                            return response("Follow request rejected", 200);
                        }

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
