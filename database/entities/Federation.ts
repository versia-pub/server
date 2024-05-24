import { debugRequest } from "@api";
import {
    type EntityValidator,
    SignatureConstructor,
} from "@lysand-org/federation";
import { config } from "config-manager";
import type { User } from "~packages/database-interface/user";
import { LogLevel, LogManager } from "~packages/log-manager";

export const localObjectURI = (id: string) =>
    new URL(`/objects/${id}`, config.http.base_url).toString();

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

    const ctor = new SignatureConstructor(privateKey, author.getUri());

    const userInbox = new URL(userToSendTo.getUser().endpoints?.inbox ?? "");

    const request = new Request(userInbox, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Origin: new URL(config.http.base_url).host,
        },
        body: JSON.stringify(object),
    });

    const signed = await ctor.sign(request);

    if (config.debug.federation) {
        // Debug request
        await debugRequest(signed);

        // Log public key
        new LogManager(Bun.stdout).log(
            LogLevel.DEBUG,
            "Inbox.Signature",
            `Sender public key: ${author.getUser().publicKey}`,
        );
    }

    return signed;
};
