import { apiRoute, applyConfig } from "@api";
import { errorResponse, response } from "@response";
import { client } from "~database/datasource";
import { userRelations } from "~database/entities/relations";
import type * as Lysand from "lysand-types";
import { createNewStatus } from "~database/entities/Status";
import type { APIStatus } from "~types/entities/status";
import {
    followAcceptToLysand,
    getRelationshipToOtherUser,
    resolveUser,
} from "~database/entities/User";
import { objectToInboxRequest } from "~database/entities/Federation";

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

    const user = await client.user.findUnique({
        where: {
            id: uuid,
        },
        include: userRelations,
    });

    if (!user) {
        return errorResponse("User not found", 404);
    }

    const config = await extraData.configManager.getConfig();

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

    console.log(body);

    // Add sent data to database
    switch (body.type) {
        case "Note": {
            const note = body as Lysand.Note;

            const account = await resolveUser(note.author);

            if (!account) {
                return errorResponse("Author not found", 400);
            }

            await createNewStatus(
                account,
                note.content ?? {
                    "text/plain": {
                        content: "",
                    },
                },
                note.visibility as APIStatus["visibility"],
                note.is_sensitive ?? false,
                note.subject ?? "",
                [],
                note.uri,
                // TODO: Resolve mentions
                [],
                // TODO: Add attachments
                [],
                // TODO: Resolve replies and quoting
                undefined,
                undefined,
            );

            return response("Note created", 201);
        }
        case "Follow": {
            const follow = body as Lysand.Follow;

            const account = await resolveUser(follow.author);

            if (!account) {
                return errorResponse("Author not found", 400);
            }

            const relationship = await getRelationshipToOtherUser(
                account,
                user,
            );

            // Check if already following
            if (relationship.following) {
                return response("Already following", 200);
            }

            await client.relationship.update({
                where: { id: relationship.id },
                data: {
                    following: !user.isLocked,
                    requested: user.isLocked,
                    showingReblogs: true,
                    notifying: true,
                    languages: [],
                },
            });

            await client.notification.create({
                data: {
                    accountId: account.id,
                    type: user.isLocked ? "follow_request" : "follow",
                    notifiedId: user.id,
                },
            });

            if (!user.isLocked) {
                // Federate FollowAccept
                // TODO: Make database job
                const request = await objectToInboxRequest(
                    followAcceptToLysand(account, user),
                    user,
                    account,
                );

                // Send request
                const response = await fetch(request);

                if (!response.ok) {
                    console.error(await response.text());
                    throw new Error(
                        `Failed to federate follow accept from ${user.id} to ${account.uri}`,
                    );
                }
            }

            return response("Follow request sent", 200);
        }
        case "FollowAccept": {
            const followAccept = body as Lysand.FollowAccept;

            const account = await resolveUser(followAccept.author);

            if (!account) {
                return errorResponse("Author not found", 400);
            }

            const relationship = await getRelationshipToOtherUser(
                user,
                account,
            );

            if (!relationship.requested) {
                return response("There is no follow request to accept", 200);
            }

            await client.relationship.update({
                where: { id: relationship.id },
                data: {
                    following: true,
                    requested: false,
                },
            });

            return response("Follow request accepted", 200);
        }
        default: {
            return errorResponse("Unknown object type", 400);
        }
    }

    //return jsonResponse(userToLysand(user));
});
