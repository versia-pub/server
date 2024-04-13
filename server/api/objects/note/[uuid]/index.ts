import { apiRoute, applyConfig } from "@api";
import { errorResponse, jsonResponse } from "@response";
import type * as Lysand from "lysand-types";
import { client } from "~database/datasource";
import { statusToLysand } from "~database/entities/Status";
import { userToLysand } from "~database/entities/User";
import { statusAndUserRelations } from "~database/entities/relations";

export const meta = applyConfig({
    allowedMethods: ["GET"],
    auth: {
        required: false,
    },
    ratelimits: {
        duration: 60,
        max: 500,
    },
    route: "/objects/note/:uuid",
});

export default apiRoute(async (req, matchedRoute, extraData) => {
    const uuid = matchedRoute.params.uuid;

    const status = await client.status.findUnique({
        where: {
            id: uuid,
        },
        include: statusAndUserRelations,
    });

    if (!status) {
        return errorResponse("Note not found", 404);
    }

    const config = await extraData.configManager.getConfig();

    const output = statusToLysand(status);

    const privateKey = await crypto.subtle.importKey(
        "pkcs8",
        Uint8Array.from(atob(status.author.privateKey ?? ""), (c) =>
            c.charCodeAt(0),
        ),
        "Ed25519",
        false,
        ["sign"],
    );

    const digest = await crypto.subtle.digest(
        "SHA-256",
        new TextEncoder().encode(JSON.stringify(output)),
    );

    const userInbox = new URL(
        "http://lysand.localhost:8080/users/018ec11c-c6cb-7a67-bd20-a4c81bf42912/inbox",
    );

    const date = new Date();

    const signature = await crypto.subtle.sign(
        "Ed25519",
        privateKey,
        new TextEncoder().encode(
            `(request-target): post ${userInbox.pathname}\n` +
                `host: ${userInbox.host}\n` +
                `date: ${date.toISOString()}\n` +
                `digest: SHA-256=${btoa(
                    String.fromCharCode(...new Uint8Array(digest)),
                )}\n`,
        ),
    );

    const signatureBase64 = btoa(
        String.fromCharCode(...new Uint8Array(signature)),
    );

    return jsonResponse({
        Date: date.toISOString(),
        Origin: "example.com",
        Signature: `keyId="https://example.com/users/${status.author.id}",algorithm="ed25519",headers="(request-target) host date digest",signature="${signatureBase64}"`,
        post: output,
    });
});
