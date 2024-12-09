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
import {
    Instance,
    Like,
    Note,
    Notification,
    Relationship,
    User,
} from "@versia/kit/db";
import { Likes, Notes } from "@versia/kit/tables";
import type { SocketAddress } from "bun";
import chalk from "chalk";
import { eq } from "drizzle-orm";
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
     * @param request Request object.
     * @param body Entity JSON body.
     * @param sender Sender of the request's instance and key (from X-Signed-By header). Null if request is from a bridge.
     * @param headers Various request headers.
     * @param logger LogTape logger instance.
     * @param requestIp Request IP address. Grabs it from the Hono context if not provided.
     */
    public constructor(
        private request: {
            url: string;
            method: string;
            body: string;
        },
        private body: Entity,
        private sender: {
            instance: Instance;
            key: string;
        } | null,
        private headers: {
            signature?: string;
            nonce?: string;
            authorization?: string;
        },
        private logger: Logger = getLogger(["federation", "inbox"]),
        private requestIp: SocketAddress | null = null,
    ) {}

    /**
     * Verifies the request signature.
     *
     * @returns {Promise<boolean>} - Whether the signature is valid.
     */
    private async isSignatureValid(): Promise<boolean> {
        if (!this.sender) {
            throw new Error("Sender is not defined");
        }

        if (config.debug.federation) {
            this.logger.debug`Sender public key: ${chalk.gray(
                this.sender.key,
            )}`;
        }

        const validator = await SignatureValidator.fromStringKey(
            this.sender.key,
        );

        if (!(this.headers.signature && this.headers.nonce)) {
            throw new Error("Missing signature or nonce");
        }

        // HACK: Making a fake Request object instead of passing the values directly is necessary because otherwise the validation breaks for some unknown reason
        const isValid = await validator.validate(
            new Request(this.request.url, {
                method: this.request.method,
                headers: {
                    "X-Signature": this.headers.signature,
                    "X-Nonce": this.headers.nonce,
                },
                body: this.request.body,
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

        if (config.federation.bridge.allowed_ips.length === 0) {
            return true;
        }

        if (!this.requestIp) {
            return {
                message: "The request IP address could not be determined.",
                code: 500,
            };
        }

        for (const ip of config.federation.bridge.allowed_ips) {
            if (matches(ip, this.requestIp.address)) {
                return true;
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
     * @returns {Promise<Response | null>} - HTTP response to send back. Null if no response is needed (no errors).
     */
    public async process(): Promise<Response | null> {
        !this.sender &&
            this.logger.debug`Processing request from potential bridge`;

        if (this.sender && isDefederated(this.sender.instance.data.baseUrl)) {
            // Return 201 to avoid
            // 1. Leaking defederated instance information
            // 2. Preventing the sender from thinking the message was not delivered and retrying
            return null;
        }

        this.logger.debug`Instance ${chalk.gray(
            this.sender?.instance.data.baseUrl,
        )} is not defederated`;

        const shouldCheckSignature = this.shouldCheckSignature();

        if (shouldCheckSignature !== true && shouldCheckSignature !== false) {
            return Response.json(
                { error: shouldCheckSignature.message },
                { status: shouldCheckSignature.code },
            );
        }

        shouldCheckSignature
            ? this.logger.debug`Checking signature`
            : this.logger.debug`Skipping signature check`;

        if (shouldCheckSignature) {
            const isValid = await this.isSignatureValid();

            if (!isValid) {
                return Response.json(
                    { error: "Signature is not valid" },
                    { status: 401 },
                );
            }
        }

        shouldCheckSignature && this.logger.debug`Signature is valid`;

        const validator = new EntityValidator();
        const handler = new RequestParserHandler(this.body, validator);

        try {
            return await handler.parseBody<Response | null>({
                note: (): Promise<Response | null> => this.processNote(),
                follow: (): Promise<Response | null> =>
                    this.processFollowRequest(),
                followAccept: (): Promise<Response | null> =>
                    this.processFollowAccept(),
                followReject: (): Promise<Response | null> =>
                    this.processFollowReject(),
                "pub.versia:likes/Like": (): Promise<Response | null> =>
                    this.processLikeRequest(),
                delete: (): Promise<Response | null> => this.processDelete(),
                user: (): Promise<Response | null> => this.processUserRequest(),
                unknown: (): Response =>
                    Response.json(
                        { error: "Unknown entity type" },
                        { status: 400 },
                    ),
            });
        } catch (e) {
            return this.handleError(e as Error);
        }
    }

    /**
     * Handles Note entity processing.
     *
     * @returns {Promise<Response | null>} - The response.
     */
    private async processNote(): Promise<Response | null> {
        const note = this.body as VersiaNote;
        const author = await User.resolve(note.author);
        const instance = await Instance.resolve(note.uri);

        if (!instance) {
            return Response.json(
                { error: "Instance not found" },
                { status: 404 },
            );
        }

        if (!author) {
            return Response.json(
                { error: "Author not found" },
                { status: 404 },
            );
        }

        await Note.fromVersia(note, author, instance);

        return null;
    }

    /**
     * Handles Follow entity processing.
     *
     * @returns {Promise<Response | null>} - The response.
     */
    private async processFollowRequest(): Promise<Response | null> {
        const follow = this.body as unknown as VersiaFollow;
        const author = await User.resolve(follow.author);
        const followee = await User.resolve(follow.followee);

        if (!author) {
            return Response.json(
                { error: "Author not found" },
                { status: 404 },
            );
        }

        if (!followee) {
            return Response.json(
                { error: "Followee not found" },
                { status: 404 },
            );
        }

        const foundRelationship = await Relationship.fromOwnerAndSubject(
            author,
            followee,
        );

        if (foundRelationship.data.following) {
            return null;
        }

        await foundRelationship.update({
            // If followee is not "locked" (doesn't manually approves follow requests), set following to true
            following: !followee.data.isLocked,
            requested: followee.data.isLocked,
            showingReblogs: true,
            notifying: true,
            languages: [],
        });

        await Notification.insert({
            accountId: author.id,
            type: followee.data.isLocked ? "follow_request" : "follow",
            notifiedId: followee.id,
        });

        if (!followee.data.isLocked) {
            await followee.sendFollowAccept(author);
        }

        return null;
    }

    /**
     * Handles FollowAccept entity processing
     *
     * @returns {Promise<Response | null>} - The response.
     */
    private async processFollowAccept(): Promise<Response | null> {
        const followAccept = this.body as unknown as VersiaFollowAccept;
        const author = await User.resolve(followAccept.author);
        const follower = await User.resolve(followAccept.follower);

        if (!author) {
            return Response.json(
                { error: "Author not found" },
                { status: 404 },
            );
        }

        if (!follower) {
            return Response.json(
                { error: "Follower not found" },
                { status: 404 },
            );
        }

        const foundRelationship = await Relationship.fromOwnerAndSubject(
            follower,
            author,
        );

        if (!foundRelationship.data.requested) {
            return null;
        }

        await foundRelationship.update({
            requested: false,
            following: true,
        });

        return null;
    }

    /**
     * Handles FollowReject entity processing
     *
     * @returns {Promise<Response | null>} - The response.
     */
    private async processFollowReject(): Promise<Response | null> {
        const followReject = this.body as unknown as VersiaFollowReject;
        const author = await User.resolve(followReject.author);
        const follower = await User.resolve(followReject.follower);

        if (!author) {
            return Response.json(
                { error: "Author not found" },
                { status: 404 },
            );
        }

        if (!follower) {
            return Response.json(
                { error: "Follower not found" },
                { status: 404 },
            );
        }

        const foundRelationship = await Relationship.fromOwnerAndSubject(
            follower,
            author,
        );

        if (!foundRelationship.data.requested) {
            return null;
        }

        await foundRelationship.update({
            requested: false,
            following: false,
        });

        return null;
    }

    /**
     * Handles Delete entity processing.
     *
     * @returns {Promise<Response | null>} - The response.
     */
    public async processDelete(): Promise<Response | null> {
        // JS doesn't allow the use of `delete` as a variable name
        const delete_ = this.body as unknown as VersiaDelete;
        const toDelete = delete_.deleted;

        const author = delete_.author
            ? await User.resolve(delete_.author)
            : null;

        switch (delete_.deleted_type) {
            case "Note": {
                const note = await Note.fromSql(
                    eq(Notes.uri, toDelete),
                    author ? eq(Notes.authorId, author.id) : undefined,
                );

                if (!note) {
                    return Response.json(
                        {
                            error: "Note to delete not found or not owned by sender",
                        },
                        { status: 404 },
                    );
                }

                await note.delete();
                return null;
            }
            case "User": {
                const userToDelete = await User.resolve(toDelete);

                if (!userToDelete) {
                    return Response.json(
                        { error: "User to delete not found" },
                        { status: 404 },
                    );
                }

                if (!author || userToDelete.id === author.id) {
                    await userToDelete.delete();
                    return null;
                }

                return Response.json(
                    {
                        error: "Cannot delete other users than self",
                    },
                    { status: 400 },
                );
            }
            case "pub.versia:likes/Like": {
                const like = await Like.fromSql(
                    eq(Likes.uri, toDelete),
                    author ? eq(Likes.likerId, author.id) : undefined,
                );

                if (!like) {
                    return Response.json(
                        { error: "Like not found or not owned by sender" },
                        { status: 404 },
                    );
                }

                await like.delete();
                return null;
            }
            default: {
                return Response.json(
                    {
                        error: `Deletion of object ${toDelete} not implemented`,
                    },
                    { status: 400 },
                );
            }
        }
    }

    /**
     * Handles Like entity processing.
     *
     * @returns {Promise<Response | null>} - The response.
     */
    private async processLikeRequest(): Promise<Response | null> {
        const like = this.body as unknown as VersiaLikeExtension;
        const author = await User.resolve(like.author);
        const likedNote = await Note.resolve(like.liked);

        if (!author) {
            return Response.json(
                { error: "Author not found" },
                { status: 404 },
            );
        }

        if (!likedNote) {
            return Response.json(
                { error: "Liked Note not found" },
                { status: 404 },
            );
        }

        await author.like(likedNote, like.uri);

        return null;
    }

    /**
     * Handles User entity processing (profile edits).
     *
     * @returns {Promise<Response | null>} - The response.
     */
    private async processUserRequest(): Promise<Response | null> {
        const user = this.body as unknown as VersiaUser;
        // FIXME: Instead of refetching the remote user, we should read the incoming json and update from that
        const updatedAccount = await User.saveFromRemote(user.uri);

        if (!updatedAccount) {
            return Response.json(
                { error: "Failed to update user" },
                { status: 500 },
            );
        }

        return null;
    }

    /**
     * Processes Errors into the appropriate HTTP response.
     *
     * @param {Error} e - The error object.
     * @returns {Response} - The error response.
     */
    private handleError(e: Error): Response {
        if (isValidationError(e)) {
            return Response.json(
                {
                    error: "Failed to process request",
                    error_description: (e as ValidationError).message,
                },
                { status: 400 },
            );
        }

        this.logger.error`${e}`;
        sentry?.captureException(e);

        return Response.json(
            {
                error: "Failed to process request",
                message: (e as Error).message,
            },
            { status: 500 },
        );
    }
}
