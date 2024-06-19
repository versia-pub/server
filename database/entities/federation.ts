import { debugRequest } from "@/api";
import { SignatureConstructor } from "@lysand-org/federation";
import type { Entity, Undo } from "@lysand-org/federation/types";
import { config } from "config-manager";
import type { User } from "~/packages/database-interface/user";
import { LogLevel, LogManager } from "~/packages/log-manager";

export const localObjectUri = (id: string) =>
    new URL(`/objects/${id}`, config.http.base_url).toString();

export const objectToInboxRequest = async (
    object: Entity,
    author: User,
    userToSendTo: User,
): Promise<Request> => {
    if (userToSendTo.isLocal() || !userToSendTo.data.endpoints?.inbox) {
        throw new Error("UserToSendTo has no inbox or is a local user");
    }

    if (author.isRemote()) {
        throw new Error("Author is a remote user");
    }

    const privateKey = await crypto.subtle.importKey(
        "pkcs8",
        Buffer.from(author.data.privateKey ?? "", "base64"),
        "Ed25519",
        false,
        ["sign"],
    );

    const ctor = new SignatureConstructor(privateKey, author.getUri());

    const userInbox = new URL(userToSendTo.data.endpoints?.inbox ?? "");

    const request = new Request(userInbox, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Origin: new URL(config.http.base_url).host,
        },
        body: JSON.stringify(object),
    });

    const { request: signed, signedString } = await ctor.sign(request);

    if (config.debug.federation) {
        // Debug request
        await debugRequest(signed);

        // Log public key
        new LogManager(Bun.stdout).log(
            LogLevel.Debug,
            "Inbox.Signature",
            `Sender public key: ${author.data.publicKey}`,
        );

        // Log signed string
        new LogManager(Bun.stdout).log(
            LogLevel.Debug,
            "Inbox.Signature",
            `Signed string:\n${signedString}`,
        );
    }

    return signed;
};

export const undoFederationRequest = (undoer: User, uri: string): Undo => {
    const id = crypto.randomUUID();
    return {
        type: "Undo",
        id,
        author: undoer.getUri(),
        created_at: new Date().toISOString(),
        object: uri,
        uri: new URL(`/undos/${id}`, config.http.base_url).toString(),
    };
};
