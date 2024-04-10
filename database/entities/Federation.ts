import type { User } from "@prisma/client";
import type * as Lysand from "lysand-types";
import { config } from "config-manager";
import { getUserUri } from "./User";

export const objectToInboxRequest = async (
    object: Lysand.Entity,
    author: User,
    userToSendTo: User,
): Promise<Request> => {
    if (!userToSendTo.instanceId || !userToSendTo.endpoints.inbox) {
        throw new Error("UserToSendTo has no inbox or is a local user");
    }

    if (author.instanceId) {
        throw new Error("Author is a remote user");
    }

    const privateKey = await crypto.subtle.importKey(
        "pkcs8",
        Uint8Array.from(atob(author.privateKey ?? ""), (c) => c.charCodeAt(0)),
        "Ed25519",
        false,
        ["sign"],
    );

    const digest = await crypto.subtle.digest(
        "SHA-256",
        new TextEncoder().encode(JSON.stringify(object)),
    );

    const userInbox = new URL(userToSendTo.endpoints.inbox);

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

    return new Request(userInbox, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Date: date.toISOString(),
            Origin: new URL(config.http.base_url).host,
            Signature: `keyId="${getUserUri(
                author,
            )}",algorithm="ed25519",headers="(request-target) host date digest",signature="${signatureBase64}"`,
        },
        body: JSON.stringify(object),
    });
};
