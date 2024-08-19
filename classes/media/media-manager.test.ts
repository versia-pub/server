/**
 * @packageDocumentation
 * @module Tests/MediaManager
 */

import { beforeEach, describe, expect, it, mock } from "bun:test";
import type { Config } from "~/packages/config-manager/config.type";
import { MediaBackendType } from "~/packages/config-manager/config.type";
import { DiskMediaDriver } from "./drivers/disk";
import { S3MediaDriver } from "./drivers/s3";
import { MediaManager } from "./media-manager";
import type { ImageConversionPreprocessor } from "./preprocessors/image-conversion";

describe("MediaManager", () => {
    let mediaManager: MediaManager;
    let mockConfig: Config;
    let mockS3Driver: S3MediaDriver;
    let mockImagePreprocessor: ImageConversionPreprocessor;

    beforeEach(() => {
        mockConfig = {
            media: {
                backend: "s3",
                conversion: {
                    convert_images: true,
                    convert_to: "image/webp",
                },
            },
            s3: {
                endpoint: "s3.amazonaws.com",
                region: "us-west-2",
                bucket_name: "test-bucket",
                access_key: "test-key",
                secret_access_key: "test-secret",
            },
        } as Config;

        mockS3Driver = mock(() => ({
            addFile: mock(() =>
                Promise.resolve({
                    uploadedFile: new File(["hey"], "test.webp"),
                    path: "test/test.webp",
                    hash: "testhash",
                }),
            ),
            getFileByHash: mock(() => {
                return Promise.resolve(new File(["hey"], "test.webp"));
            }),
            getFile: mock(() =>
                Promise.resolve(new File(["hey"], "test.webp")),
            ),
            deleteFileByUrl: mock(() => Promise.resolve()),
        }))() as unknown as S3MediaDriver;

        mockImagePreprocessor = mock(() => ({
            process: mock((_: File) =>
                Promise.resolve(new File(["hey"], "test.webp")),
            ),
        }))() as unknown as ImageConversionPreprocessor;

        mediaManager = new MediaManager(mockConfig);
        // @ts-expect-error: Accessing private property for testing
        mediaManager.driver = mockS3Driver;
        // @ts-expect-error: Accessing private property for testing
        mediaManager.preprocessors = [mockImagePreprocessor];
    });

    it("should initialize with the correct driver based on config", () => {
        const s3Manager = new MediaManager(mockConfig);
        // @ts-expect-error: Accessing private property for testing
        expect(s3Manager.driver).toBeInstanceOf(S3MediaDriver);

        mockConfig.media.backend = MediaBackendType.Local;
        const diskManager = new MediaManager(mockConfig);
        // @ts-expect-error: Accessing private property for testing
        expect(diskManager.driver).toBeInstanceOf(DiskMediaDriver);
    });

    it("should add a file with preprocessing", async () => {
        const file = new File(["test"], "test.jpg", { type: "image/jpeg" });
        const result = await mediaManager.addFile(file);

        expect(mockImagePreprocessor.process).toHaveBeenCalledWith(file);
        expect(mockS3Driver.addFile).toHaveBeenCalled();
        expect(result).toEqual({
            uploadedFile: new File(["hey"], "test.webp"),
            path: "test/test.webp",
            hash: "testhash",
            blurhash: null,
        });
    });

    it("should get a file by hash", async () => {
        const hash = "testhash";
        const databaseHashFetcher = mock(() => Promise.resolve("test.webp"));
        const result = await mediaManager.getFileByHash(
            hash,
            databaseHashFetcher,
        );

        expect(mockS3Driver.getFileByHash).toHaveBeenCalledWith(
            hash,
            databaseHashFetcher,
        );
        expect(result).toBeInstanceOf(File);
        expect(result?.name).toBe("test.webp");
    });

    it("should get a file by filename", async () => {
        const filename = "test.webp";
        const result = await mediaManager.getFile(filename);

        expect(mockS3Driver.getFile).toHaveBeenCalledWith(filename);
        expect(result).toBeInstanceOf(File);
        expect(result?.name).toBe("test.webp");
    });

    it("should delete a file by URL", async () => {
        const url = "https://test-bucket.s3.amazonaws.com/test/test.webp";
        await mediaManager.deleteFileByUrl(url);

        expect(mockS3Driver.deleteFileByUrl).toHaveBeenCalledWith(url);
    });
});
