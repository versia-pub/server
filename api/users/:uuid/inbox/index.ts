import { apiRoute, applyConfig, debugRequest } from "@/api";
import { sentry } from "@/sentry";
import { createRoute } from "@hono/zod-openapi";
import { type Logger, getLogger } from "@logtape/logtape";
import {
    EntityValidator,
    RequestParserHandler,
    SignatureValidator,
} from "@versia/federation";
import type {
    Entity,
    Delete as VersiaDelete,
    Follow as VersiaFollow,
    FollowAccept as VersiaFollowAccept,
    FollowReject as VersiaFollowReject,
    LikeExtension as VersiaLikeExtension,
    Note as VersiaNote,
    User as VersiaUser,
} from "@versia/federation/types";
import type { SocketAddress } from "bun";
import { eq } from "drizzle-orm";
import type { Context, TypedResponse } from "hono";
import { matches } from "ip-matching";
import { z } from "zod";
import { type ValidationError, isValidationError } from "zod-validation-error";
import { Like } from "~/classes/database/like";
import { Note } from "~/classes/database/note";
import { Relationship } from "~/classes/database/relationship";
import { User } from "~/classes/database/user";
import { sendFollowAccept } from "~/classes/functions/user";
import { db } from "~/drizzle/db";
import { Likes, Notes, Notifications } from "~/drizzle/schema";
import { config } from "~/packages/config-manager";
import { ErrorSchema } from "~/types/api";

export const meta = applyConfig({
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
        "x-signature": z.string(),
        "x-nonce": z.string(),
        "x-signed-by": z.string().url().or(z.literal("instance")),
        authorization: z.string().optional(),
    }),
    body: z.any(),
};

const route = createRoute({
    method: "post",
    path: "/users/{uuid}/inbox",
    summary: "Receive federation inbox",
    request: {
        params: schemas.param,
        headers: schemas.header,
        body: {
            content: {
                "application/json": {
                    schema: schemas.body,
                },
            },
        },
    },
    responses: {
        200: {
            description: "Request processed",
        },
        201: {
            description: "Request accepted",
        },
        400: {
            description: "Bad request",
            content: {
                "application/json": {
                    schema: ErrorSchema,
                },
            },
        },
        401: {
            description: "Signature could not be verified",
            content: {
                "application/json": {
                    schema: ErrorSchema,
                },
            },
        },
        403: {
            description: "Cannot view users from remote instances",
            content: {
                "application/json": {
                    schema: ErrorSchema,
                },
            },
        },
        404: {
            description: "Not found",
            content: {
                "application/json": {
                    schema: ErrorSchema,
                },
            },
        },
        500: {
            description: "Internal server error",
            content: {
                "application/json": {
                    schema: z.object({
                        error: z.string(),
                        message: z.string(),
                    }),
                },
            },
        },
    },
});

export default apiRoute((app) =>
    app.openapi(route, async (context) => {
        const { uuid } = context.req.valid("param");
        const {
            "x-signature": signature,
            "x-nonce": nonce,
            "x-signed-by": signedBy,
            authorization,
        } = context.req.valid("header");
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

        const requestIp = context.env?.ip ?? null;

        let checkSignature = true;

        if (config.federation.bridge.enabled) {
            const token = authorization?.split("Bearer ")[1];
            if (token) {
                const bridgeResponse = await handleBridgeRequest(
                    token,
                    requestIp,
                    context,
                );
                if (bridgeResponse) {
                    return bridgeResponse;
                }
                checkSignature = false;
            }
        }

        const sender = await User.resolve(signedBy);

        if (!sender) {
            return context.json(
                { error: `Couldn't resolve sender ${signedBy}` },
                404,
            );
        }

        if (sender?.isLocal()) {
            return context.json(
                { error: "Cannot send federation requests to local users" },
                400,
            );
        }

        const hostname = sender?.data.instance?.baseUrl ?? "";

        // Check if Origin is defederated
        if (isDefederated(hostname)) {
            // Return 201 to not make the sender think there's an error
            return context.newResponse(null, 201);
        }

        // Verify request signature
        if (checkSignature) {
            const signatureResponse = await verifySignature(
                sender,
                signature,
                nonce,
                context,
                logger,
            );
            if (signatureResponse) {
                return signatureResponse;
            }
        }

        const validator = new EntityValidator();
        const handler = new RequestParserHandler(body, validator);

        try {
            return await handler.parseBody<Response>({
                note: async (note) => handleNoteRequest(note, context, logger),
                follow: async (follow) =>
                    handleFollowRequest(follow, user, context),
                followAccept: async (followAccept) =>
                    handleFollowAcceptRequest(followAccept, user, context),
                followReject: async (followReject) =>
                    handleFollowRejectRequest(followReject, user, context),
                "pub.versia:likes/Like": async (like) =>
                    handleLikeRequest(like, context),
                delete: async (delete_) =>
                    handleDeleteRequest(delete_, user, context),
                user: async (user) => handleUserRequest(user, context),
                unknown: () =>
                    context.json({ error: "Unknown entity type" }, 400),
            });
        } catch (e) {
            return handleError(e as Error, context, logger);
        }
    }),
);

/**
 * Handles bridge requests.
 * @param {string} token - The authorization token.
 * @param {SocketAddress | null} requestIp - The request IP address.
 * @param {Context} context - Hono request context.
 * @returns {Promise<Response | null>} - The response or null if no error.
 */
function handleBridgeRequest(
    token: string,
    requestIp: SocketAddress | null,
    context: Context,
): (Response & TypedResponse<{ error: string }, 401 | 500, "json">) | null {
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
            for (const ip of config.federation.bridge.allowed_ips) {
                if (matches(ip, requestIp?.address)) {
                    return null;
                }
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

    return null;
}

/**
 * Checks if the hostname is defederated using glob matching.
 * @param {string} hostname - The hostname to check. Can contain glob patterns.
 * @returns {boolean} - True if defederated, false otherwise.
 */
function isDefederated(hostname: string): boolean {
    const pattern = new Bun.Glob(hostname);

    return (
        config.federation.blocked.find(
            (blocked) => pattern.match(blocked) !== null,
        ) !== undefined
    );
}

/**
 * Verifies the request signature.
 * @param {User} sender - The sender user.
 * @param {string} signature - The request signature.
 * @param {string} nonce - The request nonce.
 * @param {Context} context - Hono request context.
 * @param {Logger} logger - LogTape logger.
 * @returns {Promise<Response | null>} - The response or null if no error.
 */
async function verifySignature(
    sender: User,
    signature: string,
    nonce: string,
    context: Context,
    logger: Logger,
): Promise<
    (Response & TypedResponse<{ error: string }, 401 | 400, "json">) | null
> {
    if (!sender) {
        return context.json({ error: "Could not resolve sender" }, 400);
    }

    if (config.debug.federation) {
        logger.debug`Sender public key: ${sender.data.publicKey}`;
    }

    const validator = await SignatureValidator.fromStringKey(
        sender.data.publicKey,
    );

    const isValid = await validator
        .validate(
            new Request(context.req.url, {
                method: context.req.method,
                headers: {
                    "X-Signature": signature,
                    "X-Nonce": nonce,
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
        return context.json({ error: "Signature could not be verified" }, 401);
    }

    return null;
}

/**
 * Handles Note entity processing.
 *
 * @param {VersiaNote} note - Note entity to process.
 * @param {Context} context - Hono request context.
 * @param {Logger} logger - LogTape logger.
 * @returns {Promise<Response>} - The response.
 */
async function handleNoteRequest(
    note: VersiaNote,
    context: Context,
    logger: Logger,
): Promise<
    Response &
        TypedResponse<
            | {
                  error: string;
              }
            | string,
            404 | 500 | 201,
            "json" | "text"
        >
> {
    const account = await User.resolve(note.author);

    if (!account) {
        return context.json({ error: "Author not found" }, 404);
    }

    const newStatus = await Note.fromVersia(note, account).catch((e) => {
        logger.error`${e}`;
        sentry?.captureException(e);
        return null;
    });

    if (!newStatus) {
        return context.json({ error: "Failed to add status" }, 500);
    }

    return context.text("Note created", 201);
}

/**
 * Handles Follow entity processing.
 *
 * @param {VersiaFollow} follow - Follow entity to process.
 * @param {User} user - Owner of this inbox.
 * @param {Context} context - Hono request context.
 * @returns {Promise<Response>} - The response.
 */
async function handleFollowRequest(
    follow: VersiaFollow,
    user: User,
    context: Context,
): Promise<
    Response &
        TypedResponse<
            | {
                  error: string;
              }
            | string,
            200 | 400,
            "text" | "json"
        >
> {
    const account = await User.resolve(follow.author);

    if (!account) {
        return context.json({ error: "Author not found" }, 400);
    }

    const foundRelationship = await Relationship.fromOwnerAndSubject(
        account,
        user,
    );

    if (foundRelationship.data.following) {
        return context.text("Already following", 200);
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
        type: user.data.isLocked ? "follow_request" : "follow",
        notifiedId: user.id,
    });

    if (!user.data.isLocked) {
        await sendFollowAccept(account, user);
    }

    return context.text("Follow request sent", 200);
}

/**
 * Handles FollowAccept entity processing
 *
 * @param {VersiaFollowAccept} followAccept - FollowAccept entity to process.
 * @param {User} user - Owner of this inbox.
 * @param {Context} context - Hono request context.
 * @returns {Promise<Response>} - The response.
 */
async function handleFollowAcceptRequest(
    followAccept: VersiaFollowAccept,
    user: User,
    context: Context,
): Promise<
    Response &
        TypedResponse<{ error: string } | string, 200 | 400, "text" | "json">
> {
    const account = await User.resolve(followAccept.author);

    if (!account) {
        return context.json({ error: "Author not found" }, 400);
    }

    const foundRelationship = await Relationship.fromOwnerAndSubject(
        user,
        account,
    );

    if (!foundRelationship.data.requested) {
        return context.text("There is no follow request to accept", 200);
    }

    await foundRelationship.update({
        requested: false,
        following: true,
    });

    return context.text("Follow request accepted", 200);
}

/**
 * Handles FollowReject entity processing
 *
 * @param {VersiaFollowReject} followReject - FollowReject entity to process.
 * @param {User} user - Owner of this inbox.
 * @param {Context} context - Hono request context.
 * @returns {Promise<Response>} - The response.
 */
async function handleFollowRejectRequest(
    followReject: VersiaFollowReject,
    user: User,
    context: Context,
): Promise<
    Response &
        TypedResponse<{ error: string } | string, 200 | 400, "text" | "json">
> {
    const account = await User.resolve(followReject.author);

    if (!account) {
        return context.json({ error: "Author not found" }, 400);
    }

    const foundRelationship = await Relationship.fromOwnerAndSubject(
        user,
        account,
    );

    if (!foundRelationship.data.requested) {
        return context.text("There is no follow request to reject", 200);
    }

    await foundRelationship.update({
        requested: false,
        following: false,
    });

    return context.text("Follow request rejected", 200);
}

/**
 * Handles Like entity processing.
 *
 * @param {VersiaLikeExtension} like - Like entity to process.
 * @param {Context} context - Hono request context.
 * @returns {Promise<Response>} - The response.
 */
async function handleLikeRequest(
    like: VersiaLikeExtension,
    context: Context,
): Promise<
    Response &
        TypedResponse<{ error: string } | string, 200 | 400, "text" | "json">
> {
    const author = await User.resolve(like.author);

    if (!author) {
        return context.json({ error: "Author not found" }, 400);
    }

    const note = await Note.resolve(like.liked);

    if (!note) {
        return context.json({ error: "Note not found" }, 400);
    }

    await author.like(note, like.uri);

    return context.text("Like added", 200);
}

/**
 * Handles Delete entity processing.
 *
 * @param {VersiaDelete} delete_ - Delete entity to process.
 * @param {User} user - Owner of this inbox.
 * @param {Context} context - Hono request context.
 * @returns {Promise<Response>} - The response.
 */
async function handleDeleteRequest(
    delete_: VersiaDelete,
    user: User,
    context: Context,
): Promise<
    Response &
        TypedResponse<
            { error: string } | string,
            200 | 400 | 404,
            "text" | "json"
        >
> {
    const toDelete = delete_.deleted;

    switch (delete_.deleted_type) {
        case "Note": {
            const note = await Note.fromSql(
                eq(Notes.uri, toDelete),
                eq(Notes.authorId, user.id),
            );

            if (note) {
                await note.delete();
                return context.text("Note deleted", 200);
            }

            break;
        }
        case "User": {
            const otherUser = await User.resolve(toDelete);

            if (otherUser) {
                if (otherUser.id === user.id) {
                    await user.delete();
                    return context.text("Account deleted", 200);
                }
                return context.json(
                    {
                        error: "Cannot delete other users than self",
                    },
                    400,
                );
            }

            break;
        }
        case "pub.versia:likes/Like": {
            const like = await Like.fromSql(
                eq(Likes.uri, toDelete),
                eq(Likes.likerId, user.id),
            );

            if (like) {
                await like.delete();
                return context.text("Like deleted", 200);
            }

            return context.json(
                {
                    error: "Like not found or not owned by user",
                },
                404,
            );
        }
        default: {
            return context.json(
                {
                    error: `Deletion of object ${toDelete} not implemented`,
                },
                400,
            );
        }
    }

    return context.json(
        { error: "Object not found or not owned by user" },
        404,
    );
}

/**
 * Handles User entity processing (profile edits).
 *
 * @param {VersiaUser} user - User entity to process.
 * @param {Context} context - Hono request context.
 * @returns {Promise<Response>} - The response.
 */
async function handleUserRequest(
    user: VersiaUser,
    context: Context,
): Promise<
    Response &
        TypedResponse<{ error: string } | string, 200 | 500, "text" | "json">
> {
    const updatedAccount = await User.saveFromRemote(user.uri);

    if (!updatedAccount) {
        return context.json({ error: "Failed to update user" }, 500);
    }

    return context.text("User refreshed", 200);
}

/**
 * Processes Errors into the appropriate HTTP response.
 *
 * @param {Error} e - The error object.
 * @param {Context} context - Hono request context.
 * @param {any} logger - LogTape logger.
 * @returns {Response} - The error response.
 */
function handleError(
    e: Error,
    context: Context,
    logger: Logger,
):
    | (Response &
          TypedResponse<
              {
                  error: string;
                  error_description: string;
              },
              400,
              "json"
          >)
    | (Response &
          TypedResponse<
              {
                  error: string;
                  message: string;
              },
              500,
              "json"
          >) {
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
