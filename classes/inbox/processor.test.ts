import { beforeEach, describe, expect, jest, mock, test } from "bun:test";
import { SignatureValidator } from "@versia/federation";
import type { Entity, Note as VersiaNote } from "@versia/federation/types";
import {
    Instance,
    Note,
    Notification,
    Relationship,
    User,
} from "@versia/kit/db";
import type { SocketAddress } from "bun";
import { ValidationError } from "zod-validation-error";
import { config } from "~/packages/config-manager/index.ts";
import { InboxProcessor } from "./processor.ts";

// Mock dependencies
mock.module("@versia/kit/db", () => ({
    db: {
        insert: jest.fn(
            // Return something with a `.values()` method
            () => ({ values: jest.fn() }),
        ),
    },
    User: {
        resolve: jest.fn(),
        fetchFromRemote: jest.fn(),
        sendFollowAccept: jest.fn(),
    },
    Instance: {
        fromUser: jest.fn(),
        resolve: jest.fn(),
    },
    Note: {
        resolve: jest.fn(),
        fromVersia: jest.fn(),
        fromSql: jest.fn(),
    },
    Relationship: {
        fromOwnerAndSubject: jest.fn(),
    },
    Like: {
        fromSql: jest.fn(),
    },
    Notification: {
        fromSql: jest.fn(),
    },
}));

mock.module("@versia/federation", () => ({
    SignatureValidator: {
        fromStringKey: jest.fn(() => ({
            validate: jest.fn(),
        })),
    },
    EntityValidator: jest.fn(() => ({
        validate: jest.fn(),
    })),
    RequestParserHandler: jest.fn(),
}));

mock.module("~/packages/config-manager/index.ts", () => ({
    config: {
        debug: {
            federation: false,
        },
        federation: {
            blocked: [],
            bridge: {
                enabled: false,
                token: "test-token",
                allowed_ips: [],
            },
        },
    },
}));

describe("InboxProcessor", () => {
    let mockRequest: {
        url: URL;
        method: string;
        body: string;
    };
    let mockBody: Entity;
    let mockSenderInstance: Instance;
    let mockHeaders: {
        signature: string;
        nonce: string;
        authorization?: string;
    };
    let processor: InboxProcessor;

    beforeEach(() => {
        // Reset all mocks
        mock.restore();

        // Setup basic mock context
        mockRequest = {
            url: new URL("https://test.com"),
            method: "POST",
            body: "test-body",
        };

        // Setup basic mock sender
        mockSenderInstance = {
            id: "test-id",
            data: {
                publicKey: {
                    key: "test-key",
                },
            },
        } as unknown as Instance;

        // Setup basic mock headers
        mockHeaders = {
            signature: "test-signature",
            nonce: "test-nonce",
        };

        // Setup basic mock body
        mockBody = {} as Entity;

        // Create processor instance
        processor = new InboxProcessor(
            mockRequest,
            mockBody,
            {
                instance: mockSenderInstance,
                key: "test-key",
            },
            mockHeaders,
            undefined,
            {
                address: "127.0.0.1",
            } as SocketAddress,
        );
    });

    describe("isSignatureValid", () => {
        test("returns true for valid signature", async () => {
            const mockValidator = {
                validate: jest.fn().mockResolvedValue(true),
            };
            SignatureValidator.fromStringKey = jest
                .fn()
                .mockResolvedValue(mockValidator);

            // biome-ignore lint/complexity/useLiteralKeys: Private method
            const result = await processor["isSignatureValid"]();
            expect(result).toBe(true);
            expect(mockValidator.validate).toHaveBeenCalled();
        });

        test("returns false for invalid signature", async () => {
            const mockValidator = {
                validate: jest.fn().mockResolvedValue(false),
            };
            SignatureValidator.fromStringKey = jest
                .fn()
                .mockResolvedValue(mockValidator);

            // biome-ignore lint/complexity/useLiteralKeys: Private method
            const result = await processor["isSignatureValid"]();
            expect(result).toBe(false);
        });
    });

    describe("shouldCheckSignature", () => {
        test("returns true when bridge is disabled", () => {
            // biome-ignore lint/complexity/useLiteralKeys: Private method
            const result = processor["shouldCheckSignature"]();
            expect(result).toBe(true);
        });

        test("returns false for valid bridge request", () => {
            config.federation.bridge.enabled = true;
            config.federation.bridge.token = "valid-token";
            config.federation.bridge.allowed_ips = ["127.0.0.1"];
            mockHeaders.authorization = "Bearer valid-token";

            // biome-ignore lint/complexity/useLiteralKeys: Private method
            const result = processor["shouldCheckSignature"]();
            expect(result).toBe(false);
        });

        test("returns error response for invalid token", () => {
            config.federation.bridge.enabled = true;
            mockHeaders.authorization = "Bearer invalid-token";

            // biome-ignore lint/complexity/useLiteralKeys: Private method
            const result = processor["shouldCheckSignature"]() as {
                code: number;
            };
            expect(result.code).toBe(401);
        });
    });

    describe("processNote", () => {
        test("successfully processes valid note", async () => {
            const mockNote = {
                author: "https://example.com",
                uri: "https://note.example.com",
            };
            const mockAuthor = { id: "test-id" };
            const mockInstance = { id: "test-id" };

            User.resolve = jest.fn().mockResolvedValue(mockAuthor);
            Note.fromVersia = jest.fn().mockResolvedValue(true);
            Instance.resolve = jest.fn().mockResolvedValue(mockInstance);

            // biome-ignore lint/complexity/useLiteralKeys: Private variable
            processor["body"] = mockNote as VersiaNote;
            // biome-ignore lint/complexity/useLiteralKeys: Private method
            const result = await processor["processNote"]();

            expect(User.resolve).toHaveBeenCalledWith(
                new URL("https://example.com"),
            );
            expect(Note.fromVersia).toHaveBeenCalledWith(
                mockNote,
                mockAuthor,
                mockInstance,
            );
            expect(result).toBeNull();
        });

        test("returns 404 when author not found", async () => {
            User.resolve = jest.fn().mockResolvedValue(null);
            const mockNote = {
                author: "https://example.com",
                uri: "https://note.example.com",
            };

            // biome-ignore lint/complexity/useLiteralKeys: Private variable
            processor["body"] = mockNote as VersiaNote;
            // biome-ignore lint/complexity/useLiteralKeys: Private method
            const result = await processor["processNote"]();

            expect(result).toEqual(
                Response.json({ error: "Author not found" }, { status: 404 }),
            );
        });
    });

    describe("processFollowRequest", () => {
        test("successfully processes follow request for unlocked account", async () => {
            const mockFollow = {
                author: "https://example.com",
                followee: "https://followee.note.com",
            };
            const mockAuthor = { id: "author-id" };
            const mockFollowee = {
                id: "followee-id",
                data: { isLocked: false },
                sendFollowAccept: jest.fn(),
                notify: jest.fn(),
            };
            const mockRelationship = {
                data: { following: false },
                update: jest.fn(),
            };

            User.resolve = jest
                .fn()
                .mockResolvedValueOnce(mockAuthor)
                .mockResolvedValueOnce(mockFollowee);
            Relationship.fromOwnerAndSubject = jest
                .fn()
                .mockResolvedValue(mockRelationship);
            Notification.insert = jest.fn();

            // biome-ignore lint/complexity/useLiteralKeys: Private variable
            processor["body"] = mockFollow as unknown as Entity;
            // biome-ignore lint/complexity/useLiteralKeys: Private method
            await processor["processFollowRequest"]();

            expect(mockRelationship.update).toHaveBeenCalledWith({
                following: true,
                requested: false,
                showingReblogs: true,
                notifying: true,
                languages: [],
            });
        });

        test("returns 404 when author not found", async () => {
            User.resolve = jest.fn().mockResolvedValue(null);
            const mockFollow = {
                author: "https://example.com",
                followee: "https://followee.note.com",
            };

            // biome-ignore lint/complexity/useLiteralKeys: Private variable
            processor["body"] = mockFollow as unknown as Entity;
            // biome-ignore lint/complexity/useLiteralKeys: Private method
            const result = await processor["processFollowRequest"]();

            expect(result).toEqual(
                Response.json({ error: "Author not found" }, { status: 404 }),
            );
        });
    });

    describe("processDelete", () => {
        test("successfully deletes a note", async () => {
            const mockDelete = {
                deleted_type: "Note",
                deleted: "https://example.com",
            };
            const mockNote = {
                delete: jest.fn(),
            };

            Note.fromSql = jest.fn().mockResolvedValue(mockNote);

            // biome-ignore lint/complexity/useLiteralKeys: Private variable
            processor["body"] = mockDelete as unknown as Entity;
            // biome-ignore lint/complexity/useLiteralKeys: Private method
            const result = await processor["processDelete"]();

            expect(mockNote.delete).toHaveBeenCalled();
            expect(result).toBeNull();
        });

        test("returns 404 when note not found", async () => {
            const mockDelete = {
                deleted_type: "Note",
                deleted: "https://example.com",
            };

            Note.fromSql = jest.fn().mockResolvedValue(null);

            // biome-ignore lint/complexity/useLiteralKeys: Private variable
            processor["body"] = mockDelete as unknown as Entity;
            // biome-ignore lint/complexity/useLiteralKeys: Private method
            const result = await processor["processDelete"]();

            expect(result).toEqual(
                Response.json(
                    {
                        error: "Note to delete not found or not owned by sender",
                    },
                    { status: 404 },
                ),
            );
        });
    });

    describe("processLikeRequest", () => {
        test("successfully processes like request", async () => {
            const mockLike = {
                author: "https://example.com",
                liked: "https://example.note.com",
                uri: "https://example.com",
            };
            const mockAuthor = {
                like: jest.fn(),
            };
            const mockNote = { id: "note-id" };

            User.resolve = jest.fn().mockResolvedValue(mockAuthor);
            Note.resolve = jest.fn().mockResolvedValue(mockNote);

            // biome-ignore lint/complexity/useLiteralKeys: Private variable
            processor["body"] = mockLike as unknown as Entity;
            // biome-ignore lint/complexity/useLiteralKeys: Private method
            const result = await processor["processLikeRequest"]();

            expect(mockAuthor.like).toHaveBeenCalledWith(
                mockNote,
                "https://example.com",
            );
            expect(result).toBeNull();
        });

        test("returns 404 when author not found", async () => {
            User.resolve = jest.fn().mockResolvedValue(null);
            const mockLike = {
                author: "https://example.com",
                liked: "https://example.note.com",
                uri: "https://example.com",
            };

            // biome-ignore lint/complexity/useLiteralKeys: Private variable
            processor["body"] = mockLike as unknown as Entity;
            // biome-ignore lint/complexity/useLiteralKeys: Private method
            const result = await processor["processLikeRequest"]();

            expect(result).toEqual(
                Response.json({ error: "Author not found" }, { status: 404 }),
            );
        });
    });

    describe("processUserRequest", () => {
        test("successfully processes user update", async () => {
            const mockUser = {
                uri: "https://example.com",
            };
            const mockUpdatedUser = { id: "user-id" };

            User.fetchFromRemote = jest.fn().mockResolvedValue(mockUpdatedUser);

            // biome-ignore lint/complexity/useLiteralKeys: Private variable
            processor["body"] = mockUser as unknown as Entity;
            // biome-ignore lint/complexity/useLiteralKeys: Private method
            const result = await processor["processUserRequest"]();

            expect(User.fetchFromRemote).toHaveBeenCalledWith(
                new URL("https://example.com"),
            );
            expect(result).toBeNull();
        });

        test("returns 500 when update fails", async () => {
            const mockUser = {
                uri: "https://example.com",
            };
            User.fetchFromRemote = jest.fn().mockResolvedValue(null);

            // biome-ignore lint/complexity/useLiteralKeys: Private variable
            processor["body"] = mockUser as unknown as Entity;
            // biome-ignore lint/complexity/useLiteralKeys: Private method
            const result = await processor["processUserRequest"]();

            expect(result).toEqual(
                Response.json(
                    { error: "Failed to update user" },
                    { status: 500 },
                ),
            );
        });
    });

    describe("handleError", () => {
        test("handles validation errors", () => {
            const validationError = new ValidationError("Invalid data");

            // biome-ignore lint/complexity/useLiteralKeys: Private method
            const result = processor["handleError"](validationError);

            expect(result).toEqual(
                Response.json(
                    {
                        error: "Failed to process request",
                        error_description: "Invalid data",
                    },
                    { status: 400 },
                ),
            );
        });

        test("handles general errors", () => {
            const error = new Error("Something went wrong");

            // biome-ignore lint/complexity/useLiteralKeys: Private method
            const result = processor["handleError"](error);

            expect(result).toEqual(
                Response.json(
                    {
                        error: "Failed to process request",
                        message: "Something went wrong",
                    },
                    { status: 500 },
                ),
            );
        });
    });
});
