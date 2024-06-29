/**
 * @packageDocumentation
 * @module Tests/S3MediaDriver
 */

import { beforeEach, describe, expect, it, mock } from "bun:test";
import type { S3Client } from "@bradenmacdonald/s3-lite-client";
import type { Config } from "config-manager";
import type { MediaHasher } from "../media-hasher";
import { S3MediaDriver } from "./s3";

describe("S3MediaDriver", () => {
    let s3Driver: S3MediaDriver;
    let mockConfig: Config;
    let mockS3Client: S3Client;
    let mockMediaHasher: MediaHasher;

    beforeEach(() => {
        mockConfig = {
            s3: {
                endpoint: "s3.amazonaws.com",
                region: "us-west-2",
                bucket_name: "test-bucket",
                access_key: "test-key",
                secret_access_key: "test-secret",
            },
        } as Config;

        mockS3Client = mock(() => ({
            putObject: mock(() => Promise.resolve()),
            getObject: mock(() =>
                Promise.resolve({
                    arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)),
                    headers: new Headers({ "Content-Type": "image/webp" }),
                }),
            ),
            statObject: mock(() => Promise.resolve()),
            deleteObject: mock(() => Promise.resolve()),
        }))() as unknown as S3Client;

        mockMediaHasher = mock(() => ({
            getMediaHash: mock(() => Promise.resolve("testhash")),
        }))();

        s3Driver = new S3MediaDriver(mockConfig);
        // @ts-expect-error: Replacing private property for testing
        s3Driver.s3Client = mockS3Client;
        // @ts-expect-error: Replacing private property for testing
        s3Driver.mediaHasher = mockMediaHasher;
    });

    it("should add a file", async () => {
        const file = new File(["test"], "test.webp", { type: "image/webp" });
        const result = await s3Driver.addFile(file);

        expect(mockMediaHasher.getMediaHash).toHaveBeenCalledWith(file);
        expect(mockS3Client.putObject).toHaveBeenCalledWith(
            "testhash/test.webp",
            expect.any(ReadableStream),
            { size: file.size },
        );
        expect(result).toEqual({
            uploadedFile: file,
            path: "testhash/test.webp",
            hash: "testhash",
        });
    });

    it("should handle a Blob instead of a File", async () => {
        const file = new Blob(["test"], { type: "image/webp" });
        const result = await s3Driver.addFile(file as File);

        expect(mockMediaHasher.getMediaHash).toHaveBeenCalledWith(file);
        expect(mockS3Client.putObject).toHaveBeenCalledWith(
            expect.stringContaining("testhash"),
            expect.any(ReadableStream),
            { size: file.size },
        );
        expect(result).toEqual({
            uploadedFile: expect.any(Blob),
            path: expect.stringContaining("testhash"),
            hash: "testhash",
        });
    });

    it("should get a file by hash", async () => {
        const hash = "testhash";
        const databaseHashFetcher = mock(() => Promise.resolve("test.webp"));
        const result = await s3Driver.getFileByHash(hash, databaseHashFetcher);

        expect(databaseHashFetcher).toHaveBeenCalledWith(hash);
        expect(mockS3Client.statObject).toHaveBeenCalledWith("test.webp");
        expect(mockS3Client.getObject).toHaveBeenCalledWith("test.webp");
        expect(result).toBeInstanceOf(File);
        expect(result?.name).toBe("test.webp");
        expect(result?.type).toBe("image/webp");
    });

    it("should get a file by filename", async () => {
        const filename = "test.webp";
        const result = await s3Driver.getFile(filename);

        expect(mockS3Client.statObject).toHaveBeenCalledWith(filename);
        expect(mockS3Client.getObject).toHaveBeenCalledWith(filename);
        expect(result).toBeInstanceOf(File);
        expect(result?.name).toBe(filename);
        expect(result?.type).toBe("image/webp");
    });

    it("should delete a file by URL", async () => {
        const url = "https://test-bucket.s3.amazonaws.com/test/test.webp";
        await s3Driver.deleteFileByUrl(url);

        expect(mockS3Client.deleteObject).toHaveBeenCalledWith(
            "test/test.webp",
        );
    });
});
