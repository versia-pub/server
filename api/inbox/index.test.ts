import { afterAll, describe, expect, test } from "bun:test";
import { randomUUIDv7, sleep } from "bun";
import {
    clearMocks,
    disableRealRequests,
    enableRealRequests,
    mock,
} from "bun-bagel";
import { and, eq } from "drizzle-orm";
import { Instance } from "~/classes/database/instance";
import { Note } from "~/classes/database/note";
import { User } from "~/classes/database/user";
import { config } from "~/config";
import { Notes } from "~/drizzle/schema";
import { sign } from "~/packages/sdk/crypto";
import * as VersiaEntities from "~/packages/sdk/entities";
import { fakeRequest } from "~/tests/utils";

const instanceUrl = new URL("https://versia.example.com");
const noteId = randomUUIDv7();
const userId = randomUUIDv7();
const shareId = randomUUIDv7();
const userKeys = await User.generateKeys();
const privateKey = await crypto.subtle.importKey(
    "pkcs8",
    Buffer.from(userKeys.private_key, "base64"),
    "Ed25519",
    false,
    ["sign"],
);
const instanceKeys = await User.generateKeys();
const inboxUrl = new URL("/inbox", config.http.base_url);

disableRealRequests();

mock(new URL("/.well-known/versia", instanceUrl).href, {
    response: {
        headers: {
            "Content-Type": "application/json",
        },
        data: new VersiaEntities.InstanceMetadata({
            type: "InstanceMetadata",
            name: "Versia",
            description: "Versia instance",
            created_at: new Date().toISOString(),
            host: instanceUrl.hostname,
            software: {
                name: "Versia",
                version: "1.0.0",
            },
            compatibility: {
                extensions: [],
                versions: ["0.5.0"],
            },
            public_key: {
                algorithm: "ed25519",
                key: instanceKeys.public_key,
            },
        }).toJSON(),
    },
});

mock(new URL(`/users/${userId}`, instanceUrl).href, {
    response: {
        headers: {
            "Content-Type": "application/json",
        },
        data: new VersiaEntities.User({
            id: userId,
            created_at: "2025-04-18T10:32:01.427Z",
            uri: new URL(`/users/${userId}`, instanceUrl).href,
            type: "User",
            username: "testuser",
            public_key: {
                algorithm: "ed25519",
                key: userKeys.public_key,
                actor: new URL(`/users/${userId}`, instanceUrl).href,
            },
            inbox: new URL(`/users/${userId}/inbox`, instanceUrl).href,
            collections: {
                featured: new URL(`/users/${userId}/featured`, instanceUrl)
                    .href,
                followers: new URL(`/users/${userId}/followers`, instanceUrl)
                    .href,
                following: new URL(`/users/${userId}/following`, instanceUrl)
                    .href,
                outbox: new URL(`/users/${userId}/outbox`, instanceUrl).href,
            },
        }).toJSON(),
    },
});

afterAll(async () => {
    // Delete the instance in database
    const instance = await Instance.resolve(instanceUrl);

    if (!instance) {
        throw new Error("Instance not found");
    }

    await instance.delete();
    clearMocks();
    enableRealRequests();
});

describe("Inbox Tests", () => {
    test("should correctly process inbox request", async () => {
        const exampleRequest = new VersiaEntities.Note({
            id: noteId,
            created_at: "2025-04-18T10:32:01.427Z",
            uri: new URL(`/notes/${noteId}`, instanceUrl).href,
            type: "Note",
            extensions: {
                "pub.versia:custom_emojis": {
                    emojis: [],
                },
            },
            attachments: [],
            author: new URL(`/users/${userId}`, instanceUrl).href,
            content: {
                "text/html": {
                    content: "<p>Hello!</p>",
                    remote: false,
                },
                "text/plain": {
                    content: "Hello!",
                    remote: false,
                },
            },
            collections: {
                replies: new URL(`/notes/${noteId}/replies`, instanceUrl).href,
                quotes: new URL(`/notes/${noteId}/quotes`, instanceUrl).href,
            },
            group: "public",
            is_sensitive: false,
            mentions: [],
            quotes: null,
            replies_to: null,
            subject: "",
        });

        const signedRequest = await sign(
            privateKey,
            new URL(exampleRequest.data.author),
            new Request(inboxUrl, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Accept: "application/json",
                    "User-Agent": "Versia/1.0.0",
                },
                body: JSON.stringify(exampleRequest.toJSON()),
            }),
        );

        const response = await fakeRequest(inboxUrl, {
            method: "POST",
            headers: signedRequest.headers,
            body: signedRequest.body,
        });

        expect(response.status).toBe(200);

        await sleep(500);

        // Check if note was created in the database
        const note = await Note.fromSql(eq(Notes.uri, exampleRequest.data.uri));

        expect(note).not.toBeNull();
    });

    test("should correctly process Share", async () => {
        const exampleRequest = new VersiaEntities.Share({
            id: shareId,
            created_at: "2025-04-18T10:32:01.427Z",
            uri: new URL(`/shares/${shareId}`, instanceUrl).href,
            type: "pub.versia:share/Share",
            author: new URL(`/users/${userId}`, instanceUrl).href,
            shared: new URL(`/notes/${noteId}`, instanceUrl).href,
        });

        const signedRequest = await sign(
            privateKey,
            new URL(exampleRequest.data.author),
            new Request(inboxUrl, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Accept: "application/json",
                    "User-Agent": "Versia/1.0.0",
                },
                body: JSON.stringify(exampleRequest.toJSON()),
            }),
        );

        const response = await fakeRequest(inboxUrl, {
            method: "POST",
            headers: signedRequest.headers,
            body: signedRequest.body,
        });

        expect(response.status).toBe(200);

        await sleep(500);

        const dbNote = await Note.fromSql(
            eq(Notes.uri, new URL(`/notes/${noteId}`, instanceUrl).href),
        );

        if (!dbNote) {
            throw new Error("DBNote not found");
        }

        // Check if share was created in the database
        const share = await Note.fromSql(
            and(
                eq(Notes.reblogId, dbNote.id),
                eq(Notes.authorId, dbNote.data.authorId),
            ),
        );

        expect(share).not.toBeNull();
    });

    test("should correctly process Delete for Note", async () => {
        const deleteId = randomUUIDv7();

        // First check that the note exists in the database
        const noteToDelete = await Note.fromSql(
            eq(Notes.uri, new URL(`/notes/${noteId}`, instanceUrl).href),
        );

        expect(noteToDelete).not.toBeNull();

        // Create a Delete request
        const exampleRequest = new VersiaEntities.Delete({
            id: deleteId,
            created_at: new Date().toISOString(),
            type: "Delete",
            author: new URL(`/users/${userId}`, instanceUrl).href,
            deleted_type: "Note",
            deleted: new URL(`/notes/${noteId}`, instanceUrl).href,
        });

        // The author field is non-null in our test case, so we can safely assert it as a string
        const authorUrl = exampleRequest.data.author as string;

        const signedRequest = await sign(
            privateKey,
            new URL(authorUrl),
            new Request(inboxUrl, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Accept: "application/json",
                    "User-Agent": "Versia/1.0.0",
                },
                body: JSON.stringify(exampleRequest.toJSON()),
            }),
        );

        const response = await fakeRequest(inboxUrl, {
            method: "POST",
            headers: signedRequest.headers,
            body: signedRequest.body,
        });

        expect(response.status).toBe(200);

        await sleep(500);

        // Verify that the note was deleted from the database
        const noteExists = await Note.fromSql(
            eq(Notes.uri, new URL(`/notes/${noteId}`, instanceUrl).href),
        );

        expect(noteExists).toBeNull();
    });
});
