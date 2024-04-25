import type * as Lysand from "lysand-types";
import { fromZodError } from "zod-validation-error";
import { schemas } from "./schemas";

const types = [
    "Note",
    "User",
    "Reaction",
    "Poll",
    "Vote",
    "VoteResult",
    "Report",
    "ServerMetadata",
    "Like",
    "Dislike",
    "Follow",
    "FollowAccept",
    "FollowReject",
    "Announce",
    "Undo",
];

/**
 * Validates an incoming Lysand object using Zod, and returns the object if it is valid.
 */
export class EntityValidator {
    constructor(private entity: Lysand.Entity) {}

    /**
     * Validates the entity.
     */
    validate<ExpectedType>() {
        // Check if type is valid
        if (!this.entity.type) {
            throw new Error("Entity type is required");
        }

        const schema = this.matchSchema(this.getType());

        const output = schema.safeParse(this.entity);

        if (!output.success) {
            throw fromZodError(output.error);
        }

        return output.data as ExpectedType;
    }

    getType() {
        // Check if type is valid, return TypeScript type
        if (!this.entity.type) {
            throw new Error("Entity type is required");
        }

        if (!types.includes(this.entity.type)) {
            throw new Error(`Unknown entity type: ${this.entity.type}`);
        }

        return this.entity.type as (typeof types)[number];
    }

    matchSchema(type: string) {
        switch (type) {
            case "Note":
                return schemas.Note;
            case "User":
                return schemas.User;
            case "Reaction":
                return schemas.Reaction;
            case "Poll":
                return schemas.Poll;
            case "Vote":
                return schemas.Vote;
            case "VoteResult":
                return schemas.VoteResult;
            case "Report":
                return schemas.Report;
            case "ServerMetadata":
                return schemas.ServerMetadata;
            case "Like":
                return schemas.Like;
            case "Dislike":
                return schemas.Dislike;
            case "Follow":
                return schemas.Follow;
            case "FollowAccept":
                return schemas.FollowAccept;
            case "FollowReject":
                return schemas.FollowReject;
            case "Announce":
                return schemas.Announce;
            case "Undo":
                return schemas.Undo;
            default:
                throw new Error(`Unknown entity type: ${type}`);
        }
    }
}

export class SignatureValidator {
    constructor(
        private public_key: CryptoKey,
        private signature: string,
        private date: string,
        private method: string,
        private url: URL,
        private body: string,
    ) {}

    static async fromStringKey(
        public_key: string,
        signature: string,
        date: string,
        method: string,
        url: URL,
        body: string,
    ) {
        return new SignatureValidator(
            await crypto.subtle.importKey(
                "spki",
                Buffer.from(public_key, "base64"),
                "Ed25519",
                false,
                ["verify"],
            ),
            signature,
            date,
            method,
            url,
            body,
        );
    }
    async validate() {
        const signature = this.signature
            .split("signature=")[1]
            .replace(/"/g, "");

        const digest = await crypto.subtle.digest(
            "SHA-256",
            new TextEncoder().encode(this.body),
        );

        const expectedSignedString =
            `(request-target): ${this.method.toLowerCase()} ${
                this.url.pathname
            }\n` +
            `host: ${this.url.host}\n` +
            `date: ${this.date}\n` +
            `digest: SHA-256=${Buffer.from(new Uint8Array(digest)).toString(
                "base64",
            )}\n`;

        // Check if signed string is valid
        const isValid = await crypto.subtle.verify(
            "Ed25519",
            this.public_key,
            Buffer.from(signature, "base64"),
            new TextEncoder().encode(expectedSignedString),
        );

        return isValid;
    }
}

export class SignatureConstructor {
    constructor(
        private private_key: CryptoKey,
        private url: URL,
        private authorUri: URL,
    ) {}

    static async fromStringKey(private_key: string, url: URL, authorUri: URL) {
        return new SignatureConstructor(
            await crypto.subtle.importKey(
                "pkcs8",
                Buffer.from(private_key, "base64"),
                "Ed25519",
                false,
                ["sign"],
            ),
            url,
            authorUri,
        );
    }

    async sign(method: string, body: string) {
        const digest = await crypto.subtle.digest(
            "SHA-256",
            new TextEncoder().encode(body),
        );

        const date = new Date();

        const signature = await crypto.subtle.sign(
            "Ed25519",
            this.private_key,
            new TextEncoder().encode(
                `(request-target): ${method.toLowerCase()} ${
                    this.url.pathname
                }\n` +
                    `host: ${this.url.host}\n` +
                    `date: ${date.toISOString()}\n` +
                    `digest: SHA-256=${Buffer.from(
                        new Uint8Array(digest),
                    ).toString("base64")}\n`,
            ),
        );

        const signatureBase64 = Buffer.from(new Uint8Array(signature)).toString(
            "base64",
        );

        return {
            date: date.toISOString(),
            signature: `keyId="${this.authorUri.toString()}",algorithm="ed25519",headers="(request-target) host date digest",signature="${signatureBase64}"`,
        };
    }
}

/**
 * Extends native fetch with object signing
 * Make sure to format your JSON in Canonical JSON format!
 * @param url URL to fetch
 * @param options Standard Web Fetch API options
 * @param privateKey Author private key in base64
 * @param authorUri Author URI
 * @param baseUrl Base URL of this server
 * @returns Fetch response
 */
export const signedFetch = async (
    url: string | URL,
    options: RequestInit,
    privateKey: string,
    authorUri: string | URL,
    baseUrl: string | URL,
) => {
    const urlObj = new URL(url);
    const authorUriObj = new URL(authorUri);

    const signature = await SignatureConstructor.fromStringKey(
        privateKey,
        urlObj,
        authorUriObj,
    );

    const { date, signature: signatureHeader } = await signature.sign(
        options.method ?? "GET",
        options.body?.toString() || "",
    );

    return fetch(url, {
        ...options,
        headers: {
            Date: date,
            Origin: new URL(baseUrl).origin,
            Signature: signatureHeader,
            "Content-Type": "application/json; charset=utf-8",
            Accept: "application/json",
            ...options.headers,
        },
    });
};
