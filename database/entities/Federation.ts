import type { EntityValidator } from "@lysand-org/federation";
import { config } from "config-manager";
import type { User } from "~packages/database-interface/user";

export const localObjectURI = (id: string) => `/objects/${id}`;

export const objectToInboxRequest = async (
    object: typeof EntityValidator.$Entity,
    author: User,
    userToSendTo: User,
): Promise<Request> => {
    if (userToSendTo.isLocal() || !userToSendTo.getUser().endpoints?.inbox) {
        throw new Error("UserToSendTo has no inbox or is a local user");
    }

    if (author.isRemote()) {
        throw new Error("Author is a remote user");
    }

    const privateKey = await crypto.subtle.importKey(
        "pkcs8",
        Buffer.from(author.getUser().privateKey ?? "", "base64"),
        "Ed25519",
        false,
        ["sign"],
    );

    const digest = await crypto.subtle.digest(
        "SHA-256",
        new TextEncoder().encode(JSON.stringify(object)),
    );

    const userInbox = new URL(userToSendTo.getUser().endpoints?.inbox ?? "");

    const date = new Date();

    const signature = await crypto.subtle.sign(
        "Ed25519",
        privateKey,
        new TextEncoder().encode(
            `(request-target): post ${userInbox.pathname}\n` +
                `host: ${userInbox.host}\n` +
                `date: ${date.toISOString()}\n` +
                `digest: SHA-256=${Buffer.from(new Uint8Array(digest)).toString(
                    "base64",
                )}\n`,
        ),
    );

    const signatureBase64 = Buffer.from(new Uint8Array(signature)).toString(
        "base64",
    );

    return new Request(userInbox, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Date: date.toISOString(),
            Origin: new URL(config.http.base_url).host,
            Signature: `keyId="${author.getUri()}",algorithm="ed25519",headers="(request-target) host date digest",signature="${signatureBase64}"`,
        },
        body: JSON.stringify(object),
    });
};
