import { beforeEach, describe, expect, it, jest, mock, spyOn } from "bun:test";
import type { S3Client } from "@jsr/bradenmacdonald__s3-lite-client";
import type { Config } from "config-manager";
import {
    LocalMediaBackend,
    MediaBackend,
    MediaBackendType,
    MediaHasher,
    S3MediaBackend,
} from "..";
import { MediaConverter } from "../media-converter";

type DeepPartial<T> = {
    [P in keyof T]?: DeepPartial<T[P]>;
};

describe("MediaBackend", () => {
    let mediaBackend: MediaBackend;
    let mockConfig: Config;

    beforeEach(() => {
        mockConfig = {
            media: {
                conversion: {
                    convert_images: true,
                },
            },
        } as Config;
        mediaBackend = new MediaBackend(mockConfig, MediaBackendType.S3);
    });

    it("should initialize with correct backend type", () => {
        expect(mediaBackend.getBackendType()).toEqual(MediaBackendType.S3);
    });

    describe("fromBackendType", () => {
        it("should return a LocalMediaBackend instance for LOCAL backend type", async () => {
            const backend = await MediaBackend.fromBackendType(
                MediaBackendType.LOCAL,
                mockConfig,
            );
            expect(backend).toBeInstanceOf(LocalMediaBackend);
        });

        it("should return a S3MediaBackend instance for S3 backend type", async () => {
            const backend = await MediaBackend.fromBackendType(
                MediaBackendType.S3,
                {
                    s3: {
                        endpoint: "localhost:4566",
                        region: "us-east-1",
                        bucket_name: "test-bucket",
                        access_key: "test-access",
                        public_url: "test",
                        secret_access_key: "test-secret",
                    },
                } as Config,
            );
            expect(backend).toBeInstanceOf(S3MediaBackend);
        });

        it("should throw an error for unknown backend type", () => {
            expect(
                // @ts-expect-error This is a test
                MediaBackend.fromBackendType("unknown", mockConfig),
            ).rejects.toThrow("Unknown backend type: unknown");
        });
    });

    it("should check if images should be converted", () => {
        expect(mediaBackend.shouldConvertImages(mockConfig)).toBe(true);
        mockConfig.media.conversion.convert_images = false;
        expect(mediaBackend.shouldConvertImages(mockConfig)).toBe(false);
    });

    it("should throw error when calling getFileByHash", () => {
        const mockHash = "test-hash";
        const databaseHashFetcher = jest.fn().mockResolvedValue("test.jpg");

        expect(
            mediaBackend.getFileByHash(mockHash, databaseHashFetcher),
        ).rejects.toThrow(Error);
    });

    it("should throw error when calling getFile", () => {
        const mockFilename = "test.jpg";

        expect(mediaBackend.getFile(mockFilename)).rejects.toThrow(Error);
    });

    it("should throw error when calling addFile", () => {
        const mockFile = new File([""], "test.jpg");

        expect(mediaBackend.addFile(mockFile)).rejects.toThrow();
    });
});

describe("S3MediaBackend", () => {
    let s3MediaBackend: S3MediaBackend;
    let mockS3Client: Partial<S3Client>;
    let mockConfig: DeepPartial<Config>;
    let mockFile: File;
    let mockMediaHasher: MediaHasher;

    beforeEach(() => {
        mockConfig = {
            s3: {
                endpoint: "http://localhost:4566",
                region: "us-east-1",
                bucket_name: "test-bucket",
                access_key: "test-access-key",
                secret_access_key: "test-secret-access-key",
                public_url: "test",
            },
            media: {
                conversion: {
                    convert_to: "image/png",
                },
            },
        };
        mockFile = new File([new TextEncoder().encode("test")], "test.jpg");
        mockMediaHasher = new MediaHasher();
        mockS3Client = {
            putObject: jest.fn().mockResolvedValue({}),
            statObject: jest.fn().mockResolvedValue({}),
            getObject: jest.fn().mockResolvedValue({
                blob: jest.fn().mockResolvedValue(new Blob()),
                headers: new Headers({ "Content-Type": "image/jpeg" }),
            }),
            deleteObject: jest.fn().mockResolvedValue({}),
        } as Partial<S3Client>;
        s3MediaBackend = new S3MediaBackend(
            mockConfig as Config,
            mockS3Client as S3Client,
        );
    });

    it("should initialize with correct type", () => {
        expect(s3MediaBackend.getBackendType()).toEqual(MediaBackendType.S3);
    });

    it("should add file", async () => {
        const mockHash = "test-hash";
        spyOn(mockMediaHasher, "getMediaHash").mockResolvedValue(mockHash);

        const result = await s3MediaBackend.addFile(mockFile);

        expect(result.uploadedFile).toEqual(mockFile);
        expect(result.hash).toHaveLength(64);
        expect(mockS3Client.putObject).toHaveBeenCalledWith(
            expect.stringContaining(mockFile.name),
            expect.any(ReadableStream),
            { size: mockFile.size },
        );
    });

    it("should get file by hash", async () => {
        const mockHash = "test-hash";
        const mockFilename = "test.jpg";
        const databaseHashFetcher = jest.fn().mockResolvedValue(mockFilename);
        mockS3Client.statObject = jest.fn().mockResolvedValue({});
        mockS3Client.getObject = jest.fn().mockResolvedValue({
            arrayBuffer: jest.fn().mockResolvedValue(new ArrayBuffer(10)),
            headers: new Headers({ "Content-Type": "image/jpeg" }),
        });

        const file = await s3MediaBackend.getFileByHash(
            mockHash,
            databaseHashFetcher,
        );

        expect(file).not.toBeNull();
        expect(file?.name).toEqual(mockFilename);
        expect(file?.type).toEqual("image/jpeg");
    });

    it("should get file", async () => {
        const mockFilename = "test.jpg";
        mockS3Client.statObject = jest.fn().mockResolvedValue({});
        mockS3Client.getObject = jest.fn().mockResolvedValue({
            arrayBuffer: jest.fn().mockResolvedValue(new ArrayBuffer(10)),
            headers: new Headers({ "Content-Type": "image/jpeg" }),
        });

        const file = await s3MediaBackend.getFile(mockFilename);

        expect(file).not.toBeNull();
        expect(file?.name).toEqual(mockFilename);
        expect(file?.type).toEqual("image/jpeg");
    });

    it("should delete file", async () => {
        // deleteFileByUrl
        // Upload file first
        const mockHash = "test-hash";
        spyOn(mockMediaHasher, "getMediaHash").mockResolvedValue(mockHash);
        const result = await s3MediaBackend.addFile(mockFile);
        const url = result.path;

        await s3MediaBackend.deleteFileByUrl(`http://localhost:4566/${url}`);

        expect(mockS3Client.deleteObject).toHaveBeenCalledWith(
            expect.stringContaining(url),
        );
    });
});

describe("LocalMediaBackend", () => {
    let localMediaBackend: LocalMediaBackend;
    let mockConfig: Config;
    let mockFile: File;
    let mockMediaHasher: MediaHasher;

    beforeEach(() => {
        mockConfig = {
            media: {
                conversion: {
                    convert_images: true,
                    convert_to: "image/png",
                },
                local_uploads_folder: "./uploads",
            },
        } as Config;
        mockFile = Bun.file(`${__dirname}/megamind.jpg`) as unknown as File;
        mockMediaHasher = new MediaHasher();
        localMediaBackend = new LocalMediaBackend(mockConfig);
    });

    it("should initialize with correct type", () => {
        expect(localMediaBackend.getBackendType()).toEqual(
            MediaBackendType.LOCAL,
        );
    });

    it("should add file", async () => {
        const mockHash = "test-hash";
        spyOn(mockMediaHasher, "getMediaHash").mockResolvedValue(mockHash);
        const mockMediaConverter = new MediaConverter();
        spyOn(mockMediaConverter, "convert").mockResolvedValue(mockFile);
        // @ts-expect-error This is a mock
        spyOn(Bun, "file").mockImplementationOnce(() => ({
            exists: () => Promise.resolve(false),
        }));
        spyOn(Bun, "write").mockImplementationOnce(() =>
            Promise.resolve(mockFile.size),
        );

        const result = await localMediaBackend.addFile(mockFile);

        expect(result.uploadedFile).toEqual(mockFile);
        expect(result.path).toEqual(expect.stringContaining("megamind.png"));
        expect(result.hash).toHaveLength(64);
    });

    it("should get file by hash", async () => {
        const mockHash = "test-hash";
        const mockFilename = "test.jpg";
        const databaseHashFetcher = jest.fn().mockResolvedValue(mockFilename);
        // @ts-expect-error This is a mock
        spyOn(Bun, "file").mockImplementationOnce(() => ({
            exists: () => Promise.resolve(true),
            arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)),
            type: "image/jpeg",
            lastModified: 123456789,
        }));

        const file = await localMediaBackend.getFileByHash(
            mockHash,
            databaseHashFetcher,
        );

        expect(file).not.toBeNull();
        expect(file?.name).toEqual(mockFilename);
        expect(file?.type).toEqual("image/jpeg");
    });

    it("should get file", async () => {
        const mockFilename = "test.jpg";
        // @ts-expect-error This is a mock
        spyOn(Bun, "file").mockImplementationOnce(() => ({
            exists: () => Promise.resolve(true),
            arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)),
            type: "image/jpeg",
            lastModified: 123456789,
        }));

        const file = await localMediaBackend.getFile(mockFilename);

        expect(file).not.toBeNull();
        expect(file?.name).toEqual(mockFilename);
        expect(file?.type).toEqual("image/jpeg");
    });

    it("should delete file", async () => {
        // deleteByUrl
        const mockHash = "test-hash";
        spyOn(mockMediaHasher, "getMediaHash").mockResolvedValue(mockHash);
        await localMediaBackend.addFile(mockFile);
        const rmMock = jest.fn().mockResolvedValue(Promise.resolve());

        // Spy on fs/promises rm
        mock.module("fs/promises", () => {
            return {
                rm: rmMock,
            };
        });

        await localMediaBackend.deleteFileByUrl(
            "http://localhost:4566/test-hash",
        );

        expect(rmMock).toHaveBeenCalledWith(
            `${mockConfig.media.local_uploads_folder}/${mockHash}`,
            { recursive: true },
        );
    });
});
