// TODO: Refactor into smaller packages
import { apiRoute, applyConfig } from "@api";
import { getBestContentType } from "@content_types";
import { errorResponse, jsonResponse } from "@response";
import { client } from "~database/datasource";
import { parseEmojis } from "~database/entities/Emoji";
import { createLike, deleteLike } from "~database/entities/Like";
import { createFromObject } from "~database/entities/Object";
import { createNewStatus, fetchFromRemote } from "~database/entities/Status";
import { parseMentionsUris } from "~database/entities/User";
import {
    statusAndUserRelations,
    userRelations,
} from "~database/entities/relations";
import type {
    Announce,
    Like,
    LysandAction,
    LysandPublication,
    Patch,
    Undo,
} from "~types/lysand/Object";

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

/**
 * ActivityPub user inbox endpoint
 */
export default apiRoute(async (req, matchedRoute, extraData) => {
    const username = matchedRoute.params.username;

    const config = await extraData.configManager.getConfig();

    /*     try {
        if (
            config.activitypub.reject_activities.includes(
                new URL(req.headers.get("Origin") ?? "").hostname,
            )
        ) {
            // Discard request
            return jsonResponse({});
        }
    } catch (e) {
        console.error(
            `[-] Error parsing Origin header of incoming Activity from ${req.headers.get(
                "Origin",
            )}`,
        );
        console.error(e);
    } */

    // Process request body
    const body = (await req.json()) as LysandPublication | LysandAction;

    const author = await client.user.findUnique({
        where: {
            username,
        },
        include: userRelations,
    });

    if (!author) {
        // TODO: Add new author to database
        return errorResponse("Author not found", 404);
    }

    // Verify HTTP signature
    /*    if (config.activitypub.authorized_fetch) {
        // Check if date is older than 30 seconds
        const origin = req.headers.get("Origin");

        if (!origin) {
            return errorResponse("Origin header is required", 401);
        }

        const date = req.headers.get("Date");

        if (!date) {
            return errorResponse("Date header is required", 401);
        }

        if (new Date(date).getTime() < Date.now() - 30000) {
            return errorResponse("Date is too old (max 30 seconds)", 401);
        }

        const signatureHeader = req.headers.get("Signature");

        if (!signatureHeader) {
            return errorResponse("Signature header is required", 401);
        }

        const signature = signatureHeader
            .split("signature=")[1]
            .replace(/"/g, "");

        const digest = await crypto.subtle.digest(
            "SHA-256",
            new TextEncoder().encode(await req.text()),
        );

        const expectedSignedString =
            `(request-target): ${req.method.toLowerCase()} ${req.url}\n` +
            `host: ${req.url}\n` +
            `date: ${date}\n` +
            `digest: SHA-256=${Buffer.from(digest).toString("base64")}`;

        // author.public_key is base64 encoded raw public key
        const publicKey = await crypto.subtle.importKey(
            "spki",
            Buffer.from(author.publicKey, "base64"),
            "Ed25519",
            false,
            ["verify"],
        );

        // Check if signed string is valid
        const isValid = await crypto.subtle.verify(
            "Ed25519",
            publicKey,
            Buffer.from(signature, "base64"),
            new TextEncoder().encode(expectedSignedString),
        );

        if (!isValid) {
            return errorResponse("Invalid signature", 401);
        }
    } */

    // Get the object's ActivityPub type
    const type = body.type;

    switch (type) {
        case "Note": {
            // Store the object in the LysandObject table
            await createFromObject(body);

            const content = getBestContentType(body.contents);

            const emojis = await parseEmojis(content?.content || "");

            const newStatus = await createNewStatus(author);

            const newStatus = await createNewStatus({
                account: author,
                content: content?.content || "",
                content_type: content?.content_type,
                application: null,
                // TODO: Add visibility
                visibility: "public",
                spoiler_text: body.subject || "",
                sensitive: body.is_sensitive,
                uri: body.uri,
                emojis: emojis,
                mentions: await parseMentionsUris(body.mentions),
            });

            // If there is a reply, fetch all the reply parents and add them to the database
            if (body.replies_to.length > 0) {
                newStatus.inReplyToPostId =
                    (await fetchFromRemote(body.replies_to[0]))?.id || null;
            }

            // Same for quotes
            if (body.quotes.length > 0) {
                newStatus.quotingPostId =
                    (await fetchFromRemote(body.quotes[0]))?.id || null;
            }

            await client.status.update({
                where: {
                    id: newStatus.id,
                },
                data: {
                    inReplyToPostId: newStatus.inReplyToPostId,
                    quotingPostId: newStatus.quotingPostId,
                },
            });

            break;
        }
        case "Patch": {
            const patch = body as Patch;
            // Store the object in the LysandObject table
            await createFromObject(patch);

            // Edit the status

            const content = getBestContentType(patch.contents);

            const emojis = await parseEmojis(content?.content || "");

            const status = await client.status.findUnique({
                where: {
                    uri: patch.patched_id,
                },
                include: statusAndUserRelations,
            });

            if (!status) {
                return errorResponse("Status not found", 404);
            }

            status.content = content?.content || "";
            status.contentType = content?.content_type || "text/plain";
            status.spoilerText = patch.subject || "";
            status.sensitive = patch.is_sensitive;
            status.emojis = emojis;

            // If there is a reply, fetch all the reply parents and add them to the database
            if (body.replies_to.length > 0) {
                status.inReplyToPostId =
                    (await fetchFromRemote(body.replies_to[0]))?.id || null;
            }

            // Same for quotes
            if (body.quotes.length > 0) {
                status.quotingPostId =
                    (await fetchFromRemote(body.quotes[0]))?.id || null;
            }

            await client.status.update({
                where: {
                    id: status.id,
                },
                data: {
                    content: status.content,
                    contentType: status.contentType,
                    spoilerText: status.spoilerText,
                    sensitive: status.sensitive,
                    emojis: {
                        connect: status.emojis.map((emoji) => ({
                            id: emoji.id,
                        })),
                    },
                    inReplyToPostId: status.inReplyToPostId,
                    quotingPostId: status.quotingPostId,
                },
            });
            break;
        }
        case "Like": {
            const like = body as Like;
            // Store the object in the LysandObject table
            await createFromObject(body);

            const likedStatus = await client.status.findUnique({
                where: {
                    uri: like.object,
                },
                include: statusAndUserRelations,
            });

            if (!likedStatus) {
                return errorResponse("Status not found", 404);
            }

            await createLike(author, likedStatus);

            break;
        }
        case "Dislike": {
            // Store the object in the LysandObject table
            await createFromObject(body);

            return jsonResponse({
                info: "Dislikes are not supported by this software",
            });
        }
        case "Follow": {
            // Store the object in the LysandObject table
            await createFromObject(body);
            break;
        }
        case "FollowAccept": {
            // Store the object in the LysandObject table
            await createFromObject(body);
            break;
        }
        case "FollowReject": {
            // Store the object in the LysandObject table
            await createFromObject(body);
            break;
        }
        case "Announce": {
            const announce = body as Announce;
            // Store the object in the LysandObject table
            await createFromObject(body);

            const rebloggedStatus = await client.status.findUnique({
                where: {
                    uri: announce.object,
                },
                include: statusAndUserRelations,
            });

            if (!rebloggedStatus) {
                return errorResponse("Status not found", 404);
            }

            // Create new reblog
            await client.status.create({
                data: {
                    authorId: author.id,
                    reblogId: rebloggedStatus.id,
                    isReblog: true,
                    uri: body.uri,
                    visibility: rebloggedStatus.visibility,
                    sensitive: false,
                },
                include: statusAndUserRelations,
            });

            // Create notification
            await client.notification.create({
                data: {
                    accountId: author.id,
                    notifiedId: rebloggedStatus.authorId,
                    type: "reblog",
                    statusId: rebloggedStatus.id,
                },
            });
            break;
        }
        case "Undo": {
            const undo = body as Undo;
            // Store the object in the LysandObject table
            await createFromObject(body);

            const object = await client.lysandObject.findUnique({
                where: {
                    uri: undo.object,
                },
            });

            if (!object) {
                return errorResponse("Object not found", 404);
            }

            switch (object.type) {
                case "Like": {
                    const status = await client.status.findUnique({
                        where: {
                            uri: undo.object,
                            authorId: author.id,
                        },
                        include: statusAndUserRelations,
                    });

                    if (!status) {
                        return errorResponse("Status not found", 404);
                    }

                    await deleteLike(author, status);
                    break;
                }
                case "Announce": {
                    await client.status.delete({
                        where: {
                            uri: undo.object,
                            authorId: author.id,
                        },
                        include: statusAndUserRelations,
                    });
                    break;
                }
                case "Note": {
                    await client.status.delete({
                        where: {
                            uri: undo.object,
                            authorId: author.id,
                        },
                        include: statusAndUserRelations,
                    });
                    break;
                }
                default: {
                    return errorResponse("Invalid object type", 400);
                }
            }
            break;
        }
        case "Extension": {
            // Store the object in the LysandObject table
            await createFromObject(body);
            break;
        }
        default: {
            return errorResponse("Invalid type", 400);
        }
    }

    return jsonResponse({});
});
