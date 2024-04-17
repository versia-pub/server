import { apiRoute, applyConfig } from "@api";
import { dualLogger } from "@loggers";
import { errorResponse, response } from "@response";
import { eq } from "drizzle-orm";
import type * as Lysand from "lysand-types";
import { resolveNote } from "~database/entities/Status";
import {
    findFirstUser,
    getRelationshipToOtherUser,
    resolveUser,
    sendFollowAccept,
} from "~database/entities/User";
import { db } from "~drizzle/db";
import { notification, relationship } from "~drizzle/schema";
import { LogLevel } from "~packages/log-manager";

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

export default apiRoute(async (req, matchedRoute, extraData) => {
    const uuid = matchedRoute.params.uuid;

    const user = await findFirstUser({
        where: (user, { eq }) => eq(user.id, uuid),
    });

    if (!user) {
        return errorResponse("User not found", 404);
    }

    // Process incoming request
    const body = extraData.parsedRequest as Lysand.Entity;

    // Verify request signature
    // TODO: Check if instance is defederated
    // biome-ignore lint/correctness/noConstantCondition: Temporary
    if (true) {
        // request is a Request object containing the previous request

        const signatureHeader = req.headers.get("Signature");
        const origin = req.headers.get("Origin");
        const date = req.headers.get("Date");

        if (!signatureHeader) {
            return errorResponse("Missing Signature header", 400);
        }

        if (!origin) {
            return errorResponse("Missing Origin header", 400);
        }

        if (!date) {
            return errorResponse("Missing Date header", 400);
        }

        const signature = signatureHeader
            .split("signature=")[1]
            .replace(/"/g, "");

        const digest = await crypto.subtle.digest(
            "SHA-256",
            new TextEncoder().encode(JSON.stringify(body)),
        );

        const keyId = signatureHeader
            .split("keyId=")[1]
            .split(",")[0]
            .replace(/"/g, "");

        console.log(`Resolving keyId ${keyId}`);

        const sender = await resolveUser(keyId);

        if (!sender) {
            return errorResponse("Invalid keyId", 400);
        }

        const public_key = await crypto.subtle.importKey(
            "spki",
            Uint8Array.from(atob(sender.publicKey), (c) => c.charCodeAt(0)),
            "Ed25519",
            false,
            ["verify"],
        );

        const expectedSignedString =
            `(request-target): ${req.method.toLowerCase()} ${
                new URL(req.url).pathname
            }\n` +
            `host: ${new URL(req.url).host}\n` +
            `date: ${date}\n` +
            `digest: SHA-256=${btoa(
                String.fromCharCode(...new Uint8Array(digest)),
            )}\n`;

        // Check if signed string is valid
        const isValid = await crypto.subtle.verify(
            "Ed25519",
            public_key,
            Uint8Array.from(atob(signature), (c) => c.charCodeAt(0)),
            new TextEncoder().encode(expectedSignedString),
        );

        if (!isValid) {
            return errorResponse("Invalid signature", 400);
        }
    }

    // Add sent data to database
    switch (body.type) {
        case "Note": {
            const note = body as Lysand.Note;

            const account = await resolveUser(note.author);

            if (!account) {
                return errorResponse("Author not found", 400);
            }

            const newStatus = await resolveNote(undefined, note).catch((e) => {
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
            const follow = body as Lysand.Follow;

            const account = await resolveUser(follow.author);

            if (!account) {
                return errorResponse("Author not found", 400);
            }

            const foundRelationship = await getRelationshipToOtherUser(
                account,
                user,
            );

            // Check if already following
            if (foundRelationship.following) {
                return response("Already following", 200);
            }

            await db
                .update(relationship)
                .set({
                    following: !user.isLocked,
                    requested: user.isLocked,
                    showingReblogs: true,
                    notifying: true,
                    languages: [],
                })
                .where(eq(relationship.id, foundRelationship.id));

            await db.insert(notification).values({
                accountId: account.id,
                type: user.isLocked ? "follow_request" : "follow",
                notifiedId: user.id,
            });

            if (!user.isLocked) {
                // Federate FollowAccept
                await sendFollowAccept(account, user);
            }

            return response("Follow request sent", 200);
        }
        case "FollowAccept": {
            const followAccept = body as Lysand.FollowAccept;

            console.log(followAccept);

            const account = await resolveUser(followAccept.author);

            if (!account) {
                return errorResponse("Author not found", 400);
            }

            console.log(account);

            const foundRelationship = await getRelationshipToOtherUser(
                user,
                account,
            );

            console.log(foundRelationship);

            if (!foundRelationship.requested) {
                return response("There is no follow request to accept", 200);
            }

            await db
                .update(relationship)
                .set({
                    following: true,
                    requested: false,
                })
                .where(eq(relationship.id, foundRelationship.id));

            return response("Follow request accepted", 200);
        }
        case "FollowReject": {
            const followReject = body as Lysand.FollowReject;

            const account = await resolveUser(followReject.author);

            if (!account) {
                return errorResponse("Author not found", 400);
            }

            const foundRelationship = await getRelationshipToOtherUser(
                user,
                account,
            );

            if (!foundRelationship.requested) {
                return response("There is no follow request to reject", 200);
            }

            await db
                .update(relationship)
                .set({
                    requested: false,
                    following: false,
                })
                .where(eq(relationship.id, foundRelationship.id));

            return response("Follow request rejected", 200);
        }
        default: {
            return errorResponse("Unknown object type", 400);
        }
    }

    //return jsonResponse(userToLysand(user));
});
