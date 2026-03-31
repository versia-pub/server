import { afterAll, describe, expect, test } from "bun:test";
import { sign } from "@versia/sdk/crypto";
import * as VersiaEntities from "@versia/sdk/entities";
import { config } from "@versia-server/config";
import { Instance, Note, Reaction, User } from "@versia-server/kit/db";
import { Notes, Reactions, Users } from "@versia-server/kit/tables";
import {
    fakeRequest,
    generateClient,
    getTestUsers,
} from "@versia-server/tests";
import { randomUUIDv7, sleep } from "bun";
import {
    clearMocks,
    disableRealRequests,
    enableRealRequests,
    mock,
} from "bun-bagel";
import { and, eq, isNull } from "drizzle-orm";

const instanceUrl = new URL("https://versia.example.com");
const noteId = randomUUIDv7();
const userId = randomUUIDv7();
const shareId = randomUUIDv7();
const reactionId = randomUUIDv7();
const reaction2Id = randomUUIDv7();

const instanceKeys = await crypto.subtle.generateKey("Ed25519", true, [
    "sign",
    "verify",
]);

const inboxUrl = new URL("/.versia/v0.6/inbox", config.http.base_url);
const { users, deleteUsers } = await getTestUsers(1);

disableRealRequests();

mock(new URL("/.well-known/versia", instanceUrl).href, {
    response: {
        headers: {
            "Content-Type": "application/json",
        },
        data: {
            versions: ["0.6.0"],
        },
    },
});

mock(new URL("/.versia/v0.6/instance", instanceUrl).href, {
    response: {
        headers: {
            "Content-Type": "application/vnd.versia+json; charset=utf-8",
        },
        data: new VersiaEntities.InstanceMetadata({
            type: "InstanceMetadata",
            name: "Versia",
            description: "Versia instance",
            created_at: new Date().toISOString(),
            domain: instanceUrl.hostname,
            software: {
                name: "Versia",
                version: "1.0.0",
            },
            compatibility: {
                extensions: [],
                versions: ["0.6.0"],
            },
            public_key: {
                algorithm: "ed25519",
                key: Buffer.from(
                    await crypto.subtle.exportKey(
                        "spki",
                        instanceKeys.publicKey,
                    ),
                ).toString("base64"),
            },
        }).toJSON(),
    },
});

mock(new URL(`/.versia/v0.6/entities/User/${userId}`, instanceUrl).href, {
    response: {
        headers: {
            "Content-Type": "application/vnd.versia+json; charset=utf-8",
        },
        data: new VersiaEntities.User({
            id: userId,
            created_at: "2025-04-18T10:32:01.427Z",
            type: "User",
            username: "testuser",
            fields: [],
            manually_approves_followers: false,
            indexable: true,
        }).toJSON(),
    },
});

afterAll(async () => {
    // Delete the instance in database
    const instance = await Instance.resolve(instanceUrl.hostname);

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
        const exampleNote = new VersiaEntities.Note({
            id: noteId,
            created_at: "2025-04-18T10:32:01.427Z",
            type: "Note",
            extensions: {
                "pub.versia:custom_emojis": {
                    emojis: [],
                },
            },
            previews: [],
            attachments: [],
            author: userId,
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
            group: "public",
            is_sensitive: false,
            mentions: [],
            quotes: null,
            replies_to: null,
            subject: "",
        });

        const signedRequest = await sign(
            instanceKeys.privateKey,
            instanceUrl,
            new Request(inboxUrl, {
                method: "POST",
                headers: {
                    "Content-Type":
                        "application/vnd.versia+json; charset=utf-8",
                    Accept: "application/vnd.versia+json",
                    "User-Agent": "Versia/1.0.0",
                },
                body: JSON.stringify(exampleNote.toJSON()),
            }),
        );

        const response = await fakeRequest(inboxUrl, {
            method: "POST",
            headers: signedRequest.headers,
            body: signedRequest.body,
        });

        console.log(await response.text());

        expect(response.status).toBe(200);

        await sleep(500);

        // Check if note was created in the database
        const note = await Note.fromSql(
            eq(Notes.remoteId, exampleNote.data.id),
        );

        expect(note).not.toBeNull();
    });

    test("should correctly process Share", async () => {
        const exampleRequest = new VersiaEntities.Share({
            id: shareId,
            created_at: "2025-04-18T10:32:01.427Z",
            type: "pub.versia:share/Share",
            author: userId,
            shared: noteId,
        });

        const signedRequest = await sign(
            instanceKeys.privateKey,
            instanceUrl,
            new Request(inboxUrl, {
                method: "POST",
                headers: {
                    "Content-Type":
                        "application/vnd.versia+json; charset=utf-8",
                    Accept: "application/vnd.versia+json",
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

        const dbNote = await Note.fromSql(eq(Notes.remoteId, noteId));

        if (!dbNote) {
            throw new Error("DBNote not found");
        }

        // Check if share was created in the database
        const share = await Note.fromSql(
            and(
                eq(Notes.reblogId, dbNote.id),
                eq(Notes.remoteId, shareId),
                eq(Notes.authorId, dbNote.data.authorId),
            ),
        );

        expect(share).not.toBeNull();
    });

    test("should correctly process Reaction", async () => {
        const exampleRequest = new VersiaEntities.Reaction({
            id: reactionId,
            created_at: "2025-04-18T10:32:01.427Z",
            type: "pub.versia:reactions/Reaction",
            author: userId,
            object: noteId,
            content: "👍",
        });

        const signedRequest = await sign(
            instanceKeys.privateKey,
            instanceUrl,
            new Request(inboxUrl, {
                method: "POST",
                headers: {
                    "Content-Type":
                        "application/vnd.versia+json; charset=utf-8",
                    Accept: "application/vnd.versia+json",
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

        const dbNote = await Note.fromSql(eq(Notes.remoteId, noteId));

        if (!dbNote) {
            throw new Error("DBNote not found");
        }

        // Find the remote user who reacted by URI
        const remoteUser = await User.fromSql(eq(Users.remoteId, userId));

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
            type: "pub.versia:reactions/Reaction",
            author: userId,
            object: noteId,
            content: ":neocat:",
            extensions: {
                "pub.versia:custom_emojis": {
                    emojis: [
                        {
                            name: ":neocat:",
                            url: {
                                "image/webp": {
                                    hash: "e06240155d2cb90e8dc05327d023585ab9d47216ff547ad72aaf75c485fe9649",
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
            instanceKeys.privateKey,
            instanceUrl,
            new Request(inboxUrl, {
                method: "POST",
                headers: {
                    "Content-Type":
                        "application/vnd.versia+json; charset=utf-8",
                    Accept: "application/vnd.versia+json",
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

        const dbNote = await Note.fromSql(eq(Notes.remoteId, noteId));

        if (!dbNote) {
            throw new Error("DBNote not found");
        }

        // Find the remote user who reacted by URI
        const remoteUser = await User.fromSql(eq(Users.remoteId, userId));

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
        // First check that the note exists in the database
        const noteToDelete = await Note.fromSql(eq(Notes.remoteId, noteId));

        expect(noteToDelete).not.toBeNull();

        // Create a Delete request
        const exampleRequest = new VersiaEntities.Delete({
            created_at: new Date().toISOString(),
            type: "Delete",
            author: userId,
            deleted_type: "Note",
            deleted: noteId,
        });

        const signedRequest = await sign(
            instanceKeys.privateKey,
            instanceUrl,
            new Request(inboxUrl, {
                method: "POST",
                headers: {
                    "Content-Type":
                        "application/vnd.versia+json; charset=utf-8",
                    Accept: "application/vnd.versia+json",
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
        const noteExists = await Note.fromSql(eq(Notes.remoteId, noteId));

        expect(noteExists).toBeNull();
    });
});
