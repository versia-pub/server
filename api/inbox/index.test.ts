import { afterAll, describe, expect, test } from "bun:test";
import { randomUUIDv7, sleep } from "bun";
import {
    clearMocks,
    disableRealRequests,
    enableRealRequests,
    mock,
} from "bun-bagel";
import { and, eq, isNull } from "drizzle-orm";
import { Instance } from "~/classes/database/instance";
import { Note } from "~/classes/database/note";
import { Reaction } from "~/classes/database/reaction";
import { User } from "~/classes/database/user";
import { config } from "~/config";
import { Notes, Reactions, Users } from "~/drizzle/schema";
import { sign } from "~/packages/sdk/crypto";
import * as VersiaEntities from "~/packages/sdk/entities";
import { fakeRequest, generateClient, getTestUsers } from "~/tests/utils";

const instanceUrl = new URL("https://versia.example.com");
const noteId = randomUUIDv7();
const userId = randomUUIDv7();
const shareId = randomUUIDv7();
const reactionId = randomUUIDv7();
const reaction2Id = randomUUIDv7();
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
const { users, deleteUsers } = await getTestUsers(1);

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
    await deleteUsers();
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

    test("should correctly process Reaction", async () => {
        const exampleRequest = new VersiaEntities.Reaction({
            id: reactionId,
            created_at: "2025-04-18T10:32:01.427Z",
            uri: new URL(`/reactions/${reactionId}`, instanceUrl).href,
            type: "pub.versia:reactions/Reaction",
            author: new URL(`/users/${userId}`, instanceUrl).href,
            object: new URL(`/notes/${noteId}`, instanceUrl).href,
            content: "👍",
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

        // Find the remote user who reacted by URI
        const remoteUser = await User.fromSql(
            eq(Users.uri, new URL(`/users/${userId}`, instanceUrl).href),
        );

        if (!remoteUser) {
            throw new Error("Remote user not found");
        }

        // Check if reaction was created in the database
        const reaction = await Reaction.fromSql(
            and(
                eq(Reactions.noteId, dbNote.id),
                eq(Reactions.authorId, remoteUser.id),
                eq(Reactions.emojiText, "👍"),
            ),
        );

        expect(reaction).not.toBeNull();

        // Check if API returns the reaction correctly
        await using client = await generateClient(users[1]);

        const { data, ok } = await client.getStatusReactions(dbNote.id);

        expect(ok).toBe(true);
        expect(data).toContainEqual(
            expect.objectContaining({
                name: "👍",
                count: 1,
                me: false,
                remote: false,
            }),
        );
    });

    test("should correctly process Reaction with custom emoji", async () => {
        const exampleRequest = new VersiaEntities.Reaction({
            id: reaction2Id,
            created_at: "2025-04-18T10:32:01.427Z",
            uri: new URL(`/reactions/${reaction2Id}`, instanceUrl).href,
            type: "pub.versia:reactions/Reaction",
            author: new URL(`/users/${userId}`, instanceUrl).href,
            object: new URL(`/notes/${noteId}`, instanceUrl).href,
            content: ":neocat:",
            extensions: {
                "pub.versia:custom_emojis": {
                    emojis: [
                        {
                            name: ":neocat:",
                            url: {
                                "image/webp": {
                                    hash: {
                                        sha256: "e06240155d2cb90e8dc05327d023585ab9d47216ff547ad72aaf75c485fe9649",
                                    },
                                    size: 4664,
                                    width: 256,
                                    height: 256,
                                    remote: true,
                                    content:
                                        "https://cdn.cpluspatch.com/versia-cpp/e06240155d2cb90e8dc05327d023585ab9d47216ff547ad72aaf75c485fe9649/neocat.webp",
                                },
                            },
                        },
                    ],
                },
            },
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

        // Find the remote user who reacted by URI
        const remoteUser = await User.fromSql(
            eq(Users.uri, new URL(`/users/${userId}`, instanceUrl).href),
        );

        if (!remoteUser) {
            throw new Error("Remote user not found");
        }

        // Check if reaction was created in the database
        const reaction = await Reaction.fromSql(
            and(
                eq(Reactions.noteId, dbNote.id),
                eq(Reactions.authorId, remoteUser.id),
                isNull(Reactions.emojiText), // Custom emoji reactions have emojiText as NULL
            ),
        );

        expect(reaction).not.toBeNull();

        // Check if API returns the reaction correctly
        await using client = await generateClient(users[1]);

        const { data, ok } = await client.getStatusReactions(dbNote.id);

        expect(ok).toBe(true);
        expect(data).toContainEqual(
            expect.objectContaining({
                name: ":neocat@versia.example.com:",
                count: 1,
                me: false,
                remote: true,
            }),
        );
    });

    test("should correctly process Delete", async () => {
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
