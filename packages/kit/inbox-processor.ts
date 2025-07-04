import { EntitySorter, type JSONObject } from "@versia/sdk";
import { verify } from "@versia/sdk/crypto";
import * as VersiaEntities from "@versia/sdk/entities";
import { config } from "@versia-server/config";
import { federationInboxLogger } from "@versia-server/logging";
import type { SocketAddress } from "bun";
import { Glob } from "bun";
import chalk from "chalk";
import { and, eq } from "drizzle-orm";
import { matches } from "ip-matching";
import { isValidationError } from "zod-validation-error";
import { ApiError } from "./api-error.ts";
import type { Instance } from "./db/instance.ts";
import { Like } from "./db/like.ts";
import { Note } from "./db/note.ts";
import { Reaction } from "./db/reaction.ts";
import { Relationship } from "./db/relationship.ts";
import { User } from "./db/user.ts";
import { Likes, Notes } from "./tables/schema.ts";

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
        private request: Request,
        private body: JSONObject,
        private sender: {
            instance: Instance;
            key: CryptoKey;
        } | null,
        private authorizationHeader?: string,
        private requestIp: SocketAddress | null = null,
    ) {}

    /**
     * Verifies the request signature.
     *
     * @returns {Promise<boolean>} - Whether the signature is valid.
     */
    private isSignatureValid(): Promise<boolean> {
        if (!this.sender) {
            throw new Error("Sender is not defined");
        }

        return verify(this.sender.key, this.request);
    }

    /**
     * Determines if signature checks can be skipped.
     * Useful for requests from federation bridges.
     *
     * @returns {boolean} - Whether to skip signature checks.
     */
    private shouldCheckSignature(): boolean {
        if (config.federation.bridge) {
            const token = this.authorizationHeader?.split("Bearer ")[1];

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
            federationInboxLogger.debug`Processing request from potential bridge`;

        if (this.sender && isDefederated(this.sender.instance.data.baseUrl)) {
            // Return 201 to avoid
            // 1. Leaking defederated instance information
            // 2. Preventing the sender from thinking the message was not delivered and retrying
            return;
        }

        federationInboxLogger.debug`Instance ${chalk.gray(
            this.sender?.instance.data.baseUrl,
        )} is not defederated`;

        const shouldCheckSignature = this.shouldCheckSignature();

        shouldCheckSignature
            ? federationInboxLogger.debug`Checking signature`
            : federationInboxLogger.debug`Skipping signature check`;

        if (shouldCheckSignature) {
            const isValid = await this.isSignatureValid();

            if (!isValid) {
                throw new ApiError(401, "Signature is not valid");
            }
        }

        shouldCheckSignature && federationInboxLogger.debug`Signature is valid`;

        try {
            await new EntitySorter(this.body)
                .on(VersiaEntities.Note, (n) => InboxProcessor.processNote(n))
                .on(VersiaEntities.Follow, (f) =>
                    InboxProcessor.processFollowRequest(f),
                )
                .on(VersiaEntities.FollowAccept, (f) =>
                    InboxProcessor.processFollowAccept(f),
                )
                .on(VersiaEntities.FollowReject, (f) =>
                    InboxProcessor.processFollowReject(f),
                )
                .on(VersiaEntities.Like, (l) =>
                    InboxProcessor.processLikeRequest(l),
                )
                .on(VersiaEntities.Delete, (d) =>
                    InboxProcessor.processDelete(d),
                )
                .on(VersiaEntities.User, (u) => InboxProcessor.processUser(u))
                .on(VersiaEntities.Share, (s) => InboxProcessor.processShare(s))
                .on(VersiaEntities.Reaction, (r) =>
                    InboxProcessor.processReaction(r),
                )
                .sort(() => {
                    throw new ApiError(400, "Unknown entity type");
                });
        } catch (e) {
            return this.handleError(e as Error);
        }
    }

    /**
     * Handles Reaction entity processing
     *
     * @param {VersiaEntities.Reaction} reaction - The Reaction entity to process.
     * @returns {Promise<void>}
     */
    private static async processReaction(
        reaction: VersiaEntities.Reaction,
    ): Promise<void> {
        const author = await User.resolve(new URL(reaction.data.author));
        const note = await Note.resolve(new URL(reaction.data.object));

        if (!author) {
            throw new ApiError(404, "Author not found");
        }

        if (!note) {
            throw new ApiError(404, "Note not found");
        }

        await Reaction.fromVersia(reaction, author, note);
    }

    /**
     * Handles Note entity processing
     *
     * @param {VersiaNote} note - The Note entity to process.
     * @returns {Promise<void>}
     */
    private static async processNote(note: VersiaEntities.Note): Promise<void> {
        // If note has a blocked word
        if (
            Object.values(note.content?.data ?? {})
                .flatMap((c) => c.content)
                .some((content) =>
                    config.validation.filters.note_content.some((filter) =>
                        filter.test(content),
                    ),
                )
        ) {
            // Drop silently
            return;
        }

        await Note.fromVersia(note);
    }

    /**
     * Handles User entity processing.
     *
     * @param {VersiaUser} user - The User entity to process.
     * @returns {Promise<void>}
     */
    private static async processUser(user: VersiaEntities.User): Promise<void> {
        if (
            config.validation.filters.username.some((filter) =>
                filter.test(user.data.username),
            ) ||
            (user.data.display_name &&
                config.validation.filters.displayname.some((filter) =>
                    filter.test(user.data.display_name ?? ""),
                ))
        ) {
            // Drop silently
            return;
        }

        if (
            Object.values(user.bio?.data ?? {})
                .flatMap((c) => c.content)
                .some((content) =>
                    config.validation.filters.bio.some((filter) =>
                        filter.test(content),
                    ),
                )
        ) {
            // Drop silently
            return;
        }

        await User.fromVersia(user);
    }

    /**
     * Handles Follow entity processing.
     *
     * @param {VersiaFollow} follow - The Follow entity to process.
     * @returns {Promise<void>}
     */
    private static async processFollowRequest(
        follow: VersiaEntities.Follow,
    ): Promise<void> {
        const author = await User.resolve(new URL(follow.data.author));
        const followee = await User.resolve(new URL(follow.data.followee));

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
            await followee.acceptFollowRequest(author);
        }
    }

    /**
     * Handles FollowAccept entity processing
     *
     * @param {VersiaFollowAccept} followAccept - The FollowAccept entity to process.
     * @returns {Promise<void>}
     */
    private static async processFollowAccept(
        followAccept: VersiaEntities.FollowAccept,
    ): Promise<void> {
        const author = await User.resolve(new URL(followAccept.data.author));
        const follower = await User.resolve(
            new URL(followAccept.data.follower),
        );

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
     * @param {VersiaFollowReject} followReject - The FollowReject entity to process.
     * @returns {Promise<void>}
     */
    private static async processFollowReject(
        followReject: VersiaEntities.FollowReject,
    ): Promise<void> {
        const author = await User.resolve(new URL(followReject.data.author));
        const follower = await User.resolve(
            new URL(followReject.data.follower),
        );

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
     * Handles Share entity processing.
     *
     * @param {VersiaShare} share - The Share entity to process.
     * @returns {Promise<void>}
     */
    private static async processShare(
        share: VersiaEntities.Share,
    ): Promise<void> {
        const author = await User.resolve(new URL(share.data.author));
        const sharedNote = await Note.resolve(new URL(share.data.shared));

        if (!author) {
            throw new ApiError(404, "Author not found");
        }

        if (!sharedNote) {
            throw new ApiError(404, "Shared Note not found");
        }

        await sharedNote.reblog(author, "public", new URL(share.data.uri));
    }

    /**
     * Handles Delete entity processing.
     *
     * @param {VersiaDelete} delete_ - The Delete entity to process.
     * @returns {Promise<void>}
     */ // JS doesn't allow the use of `delete` as a variable name
    public static async processDelete(
        delete_: VersiaEntities.Delete,
    ): Promise<void> {
        const toDelete = delete_.data.deleted;

        const author = delete_.data.author
            ? await User.resolve(new URL(delete_.data.author))
            : null;

        switch (delete_.data.deleted_type) {
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

                const likeAuthor = await User.fromId(like.data.likerId);
                const liked = await Note.fromId(like.data.likedId);

                if (!liked) {
                    throw new ApiError(
                        404,
                        "Liked Note not found or not owned by sender",
                    );
                }

                if (!likeAuthor) {
                    throw new ApiError(404, "Like author not found");
                }

                await liked.unlike(likeAuthor);

                return;
            }
            case "pub.versia:shares/Share": {
                if (!author) {
                    throw new ApiError(404, "Author not found");
                }

                const reblog = await Note.fromSql(
                    and(eq(Notes.uri, toDelete), eq(Notes.authorId, author.id)),
                );

                if (!reblog) {
                    throw new ApiError(
                        404,
                        "Share not found or not owned by sender",
                    );
                }

                const reblogged = await Note.fromId(
                    reblog.data.reblogId,
                    author.id,
                );

                if (!reblogged) {
                    throw new ApiError(
                        404,
                        "Share not found or not owned by sender",
                    );
                }

                await reblogged.unreblog(author);
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
     * @param {VersiaLikeExtension} like - The Like entity to process.
     * @returns {Promise<void>}
     */
    private static async processLikeRequest(
        like: VersiaEntities.Like,
    ): Promise<void> {
        const author = await User.resolve(new URL(like.data.author));
        const likedNote = await Note.resolve(new URL(like.data.liked));

        if (!author) {
            throw new ApiError(404, "Author not found");
        }

        if (!likedNote) {
            throw new ApiError(404, "Liked Note not found");
        }

        await likedNote.like(author, new URL(like.data.uri));
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

        federationInboxLogger.error`${e}`;

        throw new ApiError(500, "Failed to process request", e.message);
    }
}
