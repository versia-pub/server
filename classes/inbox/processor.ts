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
import { Instance, Like, Note, Relationship, User } from "@versia/kit/db";
import { Likes, Notes } from "@versia/kit/tables";
import type { SocketAddress } from "bun";
import { Glob } from "bun";
import chalk from "chalk";
import { eq } from "drizzle-orm";
import { matches } from "ip-matching";
import { isValidationError } from "zod-validation-error";
import { config } from "~/config.ts";
import { ApiError } from "../errors/api-error.ts";

/**
 * Checks if the hostname is defederated using glob matching.
 * @param {string} hostname - The hostname to check. Can contain glob patterns.
 * @returns {boolean} - True if defederated, false otherwise.
 */
function isDefederated(hostname: string): boolean {
    const pattern = new Glob(hostname);

    return (
        config.federation.blocked.find(
            (blocked) => pattern.match(blocked.toString()) !== null,
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
 * await processor.process();
 * ```
 */
export class InboxProcessor {
    /**
     * Creates a new InboxProcessor instance.
     *
     * @param request Request object.
     * @param body Entity JSON body.
     * @param sender Sender of the request's instance and key (from Versia-Signed-By header). Null if request is from a bridge.
     * @param headers Various request headers.
     * @param logger LogTape logger instance.
     * @param requestIp Request IP address. Grabs it from the Hono context if not provided.
     */
    public constructor(
        private request: {
            url: URL;
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
            signedAt?: Date;
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

        if (config.debug?.federation) {
            this.logger.debug`Sender public key: ${chalk.gray(
                this.sender.key,
            )}`;
        }

        const validator = await SignatureValidator.fromStringKey(
            this.sender.key,
        );

        if (!(this.headers.signature && this.headers.signedAt)) {
            throw new Error("Missing signature or signature timestamp");
        }

        // HACK: Making a fake Request object instead of passing the values directly is necessary because otherwise the validation breaks for some unknown reason
        const isValid = await validator.validate(
            new Request(this.request.url, {
                method: this.request.method,
                headers: {
                    "Versia-Signature": this.headers.signature,
                    "Versia-Signed-At": (
                        this.headers.signedAt.getTime() / 1000
                    ).toString(),
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
     * @returns {boolean} - Whether to skip signature checks.
     */
    private shouldCheckSignature(): boolean {
        if (config.federation.bridge) {
            const token = this.headers.authorization?.split("Bearer ")[1];

            if (token) {
                return this.isRequestFromBridge(token);
            }
        }

        return true;
    }

    /**
     * Checks if a request is from a federation bridge.
     *
     * @param token - Authorization token to check.
     * @returns {boolean} - Whether the request is from a federation bridge.
     */
    private isRequestFromBridge(token: string): boolean {
        if (!config.federation.bridge) {
            throw new ApiError(
                500,
                "Bridge is not configured.",
                "Please remove the Authorization header.",
            );
        }

        if (token !== config.federation.bridge.token) {
            throw new ApiError(
                401,
                "Invalid token.",
                "Please use the correct token, or remove the Authorization header.",
            );
        }

        if (config.federation.bridge.allowed_ips.length === 0) {
            return true;
        }

        if (!this.requestIp) {
            throw new ApiError(
                500,
                "The request IP address could not be determined.",
                "This may be due to an incorrectly configured reverse proxy.",
            );
        }

        for (const ip of config.federation.bridge.allowed_ips) {
            if (matches(ip, this.requestIp.address)) {
                return true;
            }
        }

        throw new ApiError(
            403,
            "The request is not from a trusted bridge IP address.",
            "Remove the Authorization header if you are not trying to access this API as a bridge.",
        );
    }

    /**
     * Performs request processing.
     *
     * @returns {Promise<void>}
     * @throws {ApiError} - If there is an error processing the request.
     */
    public async process(): Promise<void> {
        !this.sender &&
            this.logger.debug`Processing request from potential bridge`;

        if (this.sender && isDefederated(this.sender.instance.data.baseUrl)) {
            // Return 201 to avoid
            // 1. Leaking defederated instance information
            // 2. Preventing the sender from thinking the message was not delivered and retrying
            return;
        }

        this.logger.debug`Instance ${chalk.gray(
            this.sender?.instance.data.baseUrl,
        )} is not defederated`;

        const shouldCheckSignature = this.shouldCheckSignature();

        shouldCheckSignature
            ? this.logger.debug`Checking signature`
            : this.logger.debug`Skipping signature check`;

        if (shouldCheckSignature) {
            const isValid = await this.isSignatureValid();

            if (!isValid) {
                throw new ApiError(401, "Signature is not valid");
            }
        }

        shouldCheckSignature && this.logger.debug`Signature is valid`;

        const validator = new EntityValidator();
        const handler = new RequestParserHandler(this.body, validator);

        try {
            return await handler.parseBody<void>({
                note: (): Promise<void> => this.processNote(),
                follow: (): Promise<void> => this.processFollowRequest(),
                followAccept: (): Promise<void> => this.processFollowAccept(),
                followReject: (): Promise<void> => this.processFollowReject(),
                "pub.versia:likes/Like": (): Promise<void> =>
                    this.processLikeRequest(),
                delete: (): Promise<void> => this.processDelete(),
                user: (): Promise<void> => this.processUserRequest(),
                unknown: (): void => {
                    throw new ApiError(400, "Unknown entity type");
                },
            });
        } catch (e) {
            return this.handleError(e as Error);
        }
    }

    /**
     * Handles Note entity processing.
     *
     * @returns {Promise<void>}
     */
    private async processNote(): Promise<void> {
        const note = this.body as VersiaNote;
        const author = await User.resolve(new URL(note.author));
        const instance = await Instance.resolve(new URL(note.uri));

        if (!instance) {
            throw new ApiError(404, "Instance not found");
        }

        if (!author) {
            throw new ApiError(404, "Author not found");
        }

        await Note.fromVersia(note, author, instance);
    }

    /**
     * Handles Follow entity processing.
     *
     * @returns {Promise<void>}
     */
    private async processFollowRequest(): Promise<void> {
        const follow = this.body as unknown as VersiaFollow;
        const author = await User.resolve(new URL(follow.author));
        const followee = await User.resolve(new URL(follow.followee));

        if (!author) {
            throw new ApiError(404, "Author not found");
        }

        if (!followee) {
            throw new ApiError(404, "Followee not found");
        }

        const foundRelationship = await Relationship.fromOwnerAndSubject(
            author,
            followee,
        );

        if (foundRelationship.data.following) {
            return;
        }

        await foundRelationship.update({
            // If followee is not "locked" (doesn't manually approves follow requests), set following to true
            following: !followee.data.isLocked,
            requested: followee.data.isLocked,
            showingReblogs: true,
            notifying: true,
            languages: [],
        });

        await followee.notify(
            followee.data.isLocked ? "follow_request" : "follow",
            author,
        );

        if (!followee.data.isLocked) {
            await followee.sendFollowAccept(author);
        }
    }

    /**
     * Handles FollowAccept entity processing
     *
     * @returns {Promise<void>}
     */
    private async processFollowAccept(): Promise<void> {
        const followAccept = this.body as unknown as VersiaFollowAccept;
        const author = await User.resolve(new URL(followAccept.author));
        const follower = await User.resolve(new URL(followAccept.follower));

        if (!author) {
            throw new ApiError(404, "Author not found");
        }

        if (!follower) {
            throw new ApiError(404, "Follower not found");
        }

        const foundRelationship = await Relationship.fromOwnerAndSubject(
            follower,
            author,
        );

        if (!foundRelationship.data.requested) {
            return;
        }

        await foundRelationship.update({
            requested: false,
            following: true,
        });
    }

    /**
     * Handles FollowReject entity processing
     *
     * @returns {Promise<void>}
     */
    private async processFollowReject(): Promise<void> {
        const followReject = this.body as unknown as VersiaFollowReject;
        const author = await User.resolve(new URL(followReject.author));
        const follower = await User.resolve(new URL(followReject.follower));

        if (!author) {
            throw new ApiError(404, "Author not found");
        }

        if (!follower) {
            throw new ApiError(404, "Follower not found");
        }

        const foundRelationship = await Relationship.fromOwnerAndSubject(
            follower,
            author,
        );

        if (!foundRelationship.data.requested) {
            return;
        }

        await foundRelationship.update({
            requested: false,
            following: false,
        });
    }

    /**
     * Handles Delete entity processing.
     *
     * @returns {Promise<void>}
     */
    public async processDelete(): Promise<void> {
        // JS doesn't allow the use of `delete` as a variable name
        const delete_ = this.body as unknown as VersiaDelete;
        const toDelete = delete_.deleted;

        const author = delete_.author
            ? await User.resolve(new URL(delete_.author))
            : null;

        switch (delete_.deleted_type) {
            case "Note": {
                const note = await Note.fromSql(
                    eq(Notes.uri, toDelete),
                    author ? eq(Notes.authorId, author.id) : undefined,
                );

                if (!note) {
                    throw new ApiError(
                        404,
                        "Note to delete not found or not owned by sender",
                    );
                }

                await note.delete();
                return;
            }
            case "User": {
                const userToDelete = await User.resolve(new URL(toDelete));

                if (!userToDelete) {
                    throw new ApiError(404, "User to delete not found");
                }

                if (!author || userToDelete.id === author.id) {
                    await userToDelete.delete();
                    return;
                }

                throw new ApiError(400, "Cannot delete other users than self");
            }
            case "pub.versia:likes/Like": {
                const like = await Like.fromSql(
                    eq(Likes.uri, toDelete),
                    author ? eq(Likes.likerId, author.id) : undefined,
                );

                if (!like) {
                    throw new ApiError(
                        404,
                        "Like not found or not owned by sender",
                    );
                }

                await like.delete();
                return;
            }
            default: {
                throw new ApiError(
                    400,
                    `Deletion of object ${toDelete} not implemented`,
                );
            }
        }
    }

    /**
     * Handles Like entity processing.
     *
     * @returns {Promise<void>}
     */
    private async processLikeRequest(): Promise<void> {
        const like = this.body as unknown as VersiaLikeExtension;
        const author = await User.resolve(new URL(like.author));
        const likedNote = await Note.resolve(new URL(like.liked));

        if (!author) {
            throw new ApiError(404, "Author not found");
        }

        if (!likedNote) {
            throw new ApiError(404, "Liked Note not found");
        }

        await author.like(likedNote, like.uri);
    }

    /**
     * Handles User entity processing (profile edits).
     *
     * @returns {Promise<void>}
     */
    private async processUserRequest(): Promise<void> {
        const user = this.body as unknown as VersiaUser;
        const instance = await Instance.resolve(new URL(user.uri));

        if (!instance) {
            throw new ApiError(404, "Instance not found");
        }

        await User.fromVersia(user, instance);
    }

    /**
     * Processes Errors into the appropriate HTTP response.
     *
     * @param {Error} e - The error object.
     * @returns {void}
     * @throws {ApiError} - The error response.
     */
    private handleError(e: Error): void {
        if (isValidationError(e)) {
            throw new ApiError(400, "Failed to process request", e.message);
        }

        this.logger.error`${e}`;
        sentry?.captureException(e);

        throw new ApiError(500, "Failed to process request", e.message);
    }
}
