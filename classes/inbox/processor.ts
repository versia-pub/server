import { sentry } from "@/sentry";
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
import { Instance, Like, Note, Relationship, User, db } from "@versia/kit/db";
import { Likes, Notes, Notifications } from "@versia/kit/tables";
import type { SocketAddress } from "bun";
import { eq } from "drizzle-orm";
import type { Context, TypedResponse } from "hono";
import type { StatusCode } from "hono/utils/http-status";
import { matches } from "ip-matching";
import { type ValidationError, isValidationError } from "zod-validation-error";
import { config } from "~/packages/config-manager/index.ts";

type ResponseBody = {
    message?: string;
    code: StatusCode;
};

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
 * Processes incoming federation inbox messages.
 *
 * @example
 * ```typescript
 * const processor = new InboxProcessor(context, body, sender, headers);
 *
 * const response = await processor.process();
 *
 * return response;
 * ```
 */
export class InboxProcessor {
    /**
     * Creates a new InboxProcessor instance.
     *
     * @param context Hono request context.
     * @param body Entity JSON body.
     * @param sender Sender of the request (from X-Signed-By header).
     * @param headers Various request headers.
     * @param logger LogTape logger instance.
     * @param requestIp Request IP address. Grabs it from the Hono context if not provided.
     */
    public constructor(
        private context: Context,
        private body: Entity,
        private sender: User,
        private headers: {
            signature: string;
            nonce: string;
            authorization?: string;
        },
        private logger: Logger = getLogger(["federation", "inbox"]),
        private requestIp: SocketAddress | null = context.env?.ip ?? null,
    ) {}

    /**
     * Verifies the request signature.
     *
     * @returns {Promise<boolean>} - Whether the signature is valid.
     */
    private async isSignatureValid(): Promise<boolean> {
        if (config.debug.federation) {
            this.logger.debug`Sender public key: ${this.sender.data.publicKey}`;
        }

        const validator = await SignatureValidator.fromStringKey(
            this.sender.data.publicKey,
        );

        // HACK: Making a fake Request object instead of passing the values directly is necessary because otherwise the validation breaks for some unknown reason
        const isValid = await validator.validate(
            new Request(this.context.req.url, {
                method: this.context.req.method,
                headers: {
                    "X-Signature": this.headers.signature,
                    "X-Nonce": this.headers.nonce,
                },
                body: await this.context.req.text(),
            }),
        );

        return isValid;
    }

    /**
     * Determines if signature checks can be skipped.
     * Useful for requests from federation bridges.
     *
     * @returns {boolean | ResponseBody} - Whether to skip signature checks. May include a response body if there are errors.
     */
    private shouldCheckSignature(): boolean | ResponseBody {
        if (config.federation.bridge.enabled) {
            const token = this.headers.authorization?.split("Bearer ")[1];

            if (token) {
                const isBridge = this.isRequestFromBridge(token);

                if (isBridge === true) {
                    return false;
                }

                return isBridge;
            }
        }

        return true;
    }

    /**
     * Checks if a request is from a federation bridge.
     *
     * @param token - Authorization token to check.
     * @returns
     */
    private isRequestFromBridge(token: string): boolean | ResponseBody {
        if (token !== config.federation.bridge.token) {
            return {
                message:
                    "An invalid token was passed in the Authorization header. Please use the correct token, or remove the Authorization header.",
                code: 401,
            };
        }

        if (!this.requestIp) {
            return {
                message: "The request IP address could not be determined.",
                code: 500,
            };
        }

        if (config.federation.bridge.allowed_ips.length > 0) {
            for (const ip of config.federation.bridge.allowed_ips) {
                if (matches(ip, this.requestIp.address)) {
                    return true;
                }
            }
        }

        return {
            message: "The request is not from a trusted bridge IP address.",
            code: 403,
        };
    }

    /**
     * Performs request processing.
     *
     * @returns {Promise<Response>} - HTTP response to send back.
     */
    public async process(): Promise<
        (Response & TypedResponse<{ error: string }, 500, "json">) | Response
    > {
        const remoteInstance = await Instance.fromUser(this.sender);

        if (!remoteInstance) {
            return this.context.json(
                { error: "Could not resolve the remote instance." },
                500,
            );
        }

        if (isDefederated(remoteInstance.data.baseUrl)) {
            // Return 201 to avoid
            // 1. Leaking defederated instance information
            // 2. Preventing the sender from thinking the message was not delivered and retrying
            return this.context.text("", 201);
        }

        const shouldCheckSignature = this.shouldCheckSignature();

        if (shouldCheckSignature !== true && shouldCheckSignature !== false) {
            return this.context.json(
                { error: shouldCheckSignature.message },
                shouldCheckSignature.code,
            );
        }

        if (shouldCheckSignature) {
            const isValid = await this.isSignatureValid();

            if (!isValid) {
                return this.context.json(
                    { error: "Signature is not valid" },
                    401,
                );
            }
        }

        const validator = new EntityValidator();
        const handler = new RequestParserHandler(this.body, validator);

        try {
            return await handler.parseBody<Response>({
                note: (): Promise<Response> => this.processNote(),
                follow: (): Promise<Response> => this.processFollowRequest(),
                followAccept: (): Promise<Response> =>
                    this.processFollowAccept(),
                followReject: (): Promise<Response> =>
                    this.processFollowReject(),
                "pub.versia:likes/Like": (): Promise<Response> =>
                    this.processLikeRequest(),
                delete: (): Promise<Response> => this.processDelete(),
                user: (): Promise<Response> => this.processUserRequest(),
                unknown: (): Response &
                    TypedResponse<{ error: string }, 400, "json"> =>
                    this.context.json({ error: "Unknown entity type" }, 400),
            });
        } catch (e) {
            return this.handleError(e as Error);
        }
    }

    /**
     * Handles Note entity processing.
     *
     * @returns {Promise<Response>} - The response.
     */
    private async processNote(): Promise<
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
        const note = this.body as VersiaNote;
        const author = await User.resolve(note.author);

        if (!author) {
            return this.context.json({ error: "Author not found" }, 404);
        }

        await Note.fromVersia(note, author);

        return this.context.text("Note created", 201);
    }

    /**
     * Handles Follow entity processing.
     *
     * @returns {Promise<Response>} - The response.
     */
    private async processFollowRequest(): Promise<
        Response &
            TypedResponse<
                | {
                      error: string;
                  }
                | string,
                200 | 404,
                "text" | "json"
            >
    > {
        const follow = this.body as unknown as VersiaFollow;
        const author = await User.resolve(follow.author);
        const followee = await User.resolve(follow.followee);

        if (!author) {
            return this.context.json({ error: "Author not found" }, 404);
        }

        if (!followee) {
            return this.context.json({ error: "Followee not found" }, 404);
        }

        const foundRelationship = await Relationship.fromOwnerAndSubject(
            author,
            followee,
        );

        if (foundRelationship.data.following) {
            return this.context.text("Already following", 200);
        }

        await foundRelationship.update({
            // If followee is not "locked" (doesn't manually approves follow requests), set following to true
            following: !followee.data.isLocked,
            requested: followee.data.isLocked,
            showingReblogs: true,
            notifying: true,
            languages: [],
        });

        await db.insert(Notifications).values({
            accountId: author.id,
            type: followee.data.isLocked ? "follow_request" : "follow",
            notifiedId: followee.id,
        });

        if (!followee.data.isLocked) {
            await followee.sendFollowAccept(author);
        }

        return this.context.text("Follow request sent", 200);
    }

    /**
     * Handles FollowAccept entity processing
     *
     * @returns {Promise<Response>} - The response.
     */
    private async processFollowAccept(): Promise<
        Response &
            TypedResponse<
                { error: string } | string,
                200 | 404,
                "text" | "json"
            >
    > {
        const followAccept = this.body as unknown as VersiaFollowAccept;
        const author = await User.resolve(followAccept.author);
        const follower = await User.resolve(followAccept.follower);

        if (!author) {
            return this.context.json({ error: "Author not found" }, 404);
        }

        if (!follower) {
            return this.context.json({ error: "Follower not found" }, 404);
        }

        const foundRelationship = await Relationship.fromOwnerAndSubject(
            follower,
            author,
        );

        if (!foundRelationship.data.requested) {
            return this.context.text(
                "There is no follow request to accept",
                200,
            );
        }

        await foundRelationship.update({
            requested: false,
            following: true,
        });

        return this.context.text("Follow request accepted", 200);
    }

    /**
     * Handles FollowReject entity processing
     *
     * @returns {Promise<Response>} - The response.
     */
    private async processFollowReject(): Promise<
        Response &
            TypedResponse<
                { error: string } | string,
                200 | 404,
                "text" | "json"
            >
    > {
        const followReject = this.body as unknown as VersiaFollowReject;
        const author = await User.resolve(followReject.author);
        const follower = await User.resolve(followReject.follower);

        if (!author) {
            return this.context.json({ error: "Author not found" }, 404);
        }

        if (!follower) {
            return this.context.json({ error: "Follower not found" }, 404);
        }

        const foundRelationship = await Relationship.fromOwnerAndSubject(
            follower,
            author,
        );

        if (!foundRelationship.data.requested) {
            return this.context.text(
                "There is no follow request to reject",
                200,
            );
        }

        await foundRelationship.update({
            requested: false,
            following: false,
        });

        return this.context.text("Follow request rejected", 200);
    }

    /**
     * Handles Delete entity processing.
     *
     * @returns {Promise<Response>} - The response.
     */
    public async processDelete(): Promise<
        Response &
            TypedResponse<
                { error: string } | string,
                200 | 400 | 404,
                "text" | "json"
            >
    > {
        // JS doesn't allow the use of `delete` as a variable name
        const delete_ = this.body as unknown as VersiaDelete;
        const toDelete = delete_.deleted;

        switch (delete_.deleted_type) {
            case "Note": {
                const note = await Note.fromSql(
                    eq(Notes.uri, toDelete),
                    eq(Notes.authorId, this.sender.id),
                );

                if (!note) {
                    return this.context.json(
                        {
                            error: "Note to delete not found or not owned by sender",
                        },
                        404,
                    );
                }

                await note.delete();
                return this.context.text("Note deleted", 200);
            }
            case "User": {
                const userToDelete = await User.resolve(toDelete);

                if (!userToDelete) {
                    return this.context.json(
                        { error: "User to delete not found" },
                        404,
                    );
                }

                if (userToDelete.id === this.sender.id) {
                    await this.sender.delete();
                    return this.context.text(
                        "Account deleted, goodbye 👋",
                        200,
                    );
                }

                return this.context.json(
                    {
                        error: "Cannot delete other users than self",
                    },
                    400,
                );
            }
            case "pub.versia:likes/Like": {
                const like = await Like.fromSql(
                    eq(Likes.uri, toDelete),
                    eq(Likes.likerId, this.sender.id),
                );

                if (!like) {
                    return this.context.json(
                        { error: "Like not found or not owned by sender" },
                        404,
                    );
                }

                await like.delete();
                return this.context.text("Like deleted", 200);
            }
            default: {
                return this.context.json(
                    {
                        error: `Deletion of object ${toDelete} not implemented`,
                    },
                    400,
                );
            }
        }
    }

    /**
     * Handles Like entity processing.
     *
     * @returns {Promise<Response>} - The response.
     */
    private async processLikeRequest(): Promise<
        Response &
            TypedResponse<
                { error: string } | string,
                200 | 404,
                "text" | "json"
            >
    > {
        const like = this.body as unknown as VersiaLikeExtension;
        const author = await User.resolve(like.author);
        const likedNote = await Note.resolve(like.liked);

        if (!author) {
            return this.context.json({ error: "Author not found" }, 404);
        }

        if (!likedNote) {
            return this.context.json({ error: "Liked Note not found" }, 404);
        }

        await author.like(likedNote, like.uri);

        return this.context.text("Like created", 200);
    }

    /**
     * Handles User entity processing (profile edits).
     *
     * @returns {Promise<Response>} - The response.
     */
    private async processUserRequest(): Promise<
        Response &
            TypedResponse<
                { error: string } | string,
                200 | 500,
                "text" | "json"
            >
    > {
        const user = this.body as unknown as VersiaUser;
        // FIXME: Instead of refetching the remote user, we should read the incoming json and update from that
        const updatedAccount = await User.saveFromRemote(user.uri);

        if (!updatedAccount) {
            return this.context.json({ error: "Failed to update user" }, 500);
        }

        return this.context.text("User updated", 200);
    }

    /**
     * Processes Errors into the appropriate HTTP response.
     *
     * @param {Error} e - The error object.
     * @returns {Response} - The error response.
     */
    private handleError(e: Error):
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
            return this.context.json(
                {
                    error: "Failed to process request",
                    error_description: (e as ValidationError).message,
                },
                400,
            );
        }

        this.logger.error`${e}`;
        sentry?.captureException(e);

        return this.context.json(
            {
                error: "Failed to process request",
                message: (e as Error).message,
            },
            500,
        );
    }
}
