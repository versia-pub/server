// FILEPATH: /home/jessew/Dev/lysand/packages/media-manager/backends/s3.test.ts
import { MediaBackend, MediaBackendType, MediaHasher } from "..";
import type { S3Client } from "@bradenmacdonald/s3-lite-client";
import { beforeEach, describe, jest, it, expect, spyOn } from "bun:test";
import { S3MediaBackend } from "../backends/s3";
import type { ConfigType } from "config-manager";
import { ConvertableMediaFormats, MediaConverter } from "../media-converter";
import { LocalMediaBackend } from "../backends/local";

type DeepPartial<T> = {
	[P in keyof T]?: DeepPartial<T[P]>;
};

describe("MediaBackend", () => {
	let mediaBackend: MediaBackend;
	let mockConfig: ConfigType;

	beforeEach(() => {
		mediaBackend = new MediaBackend(MediaBackendType.S3);
		mockConfig = {
			media: {
				conversion: {
					convert_images: true,
				},
			},
		} as ConfigType;
	});

	it("should initialize with correct backend type", () => {
		expect(mediaBackend.getBackendType()).toEqual(MediaBackendType.S3);
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
			mediaBackend.getFileByHash(mockHash, databaseHashFetcher)
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
	let mockConfig: DeepPartial<ConfigType>;
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
					convert_to: ConvertableMediaFormats.PNG,
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
		} as Partial<S3Client>;
		s3MediaBackend = new S3MediaBackend(
			mockConfig as ConfigType,
			mockS3Client as S3Client
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
			mockFile.name,
			expect.any(ReadableStream),
			{ size: mockFile.size }
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
			databaseHashFetcher
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
});

describe("LocalMediaBackend", () => {
	let localMediaBackend: LocalMediaBackend;
	let mockConfig: ConfigType;
	let mockFile: File;
	let mockMediaHasher: MediaHasher;

	beforeEach(() => {
		mockConfig = {
			media: {
				conversion: {
					convert_images: true,
					convert_to: ConvertableMediaFormats.PNG,
				},
				local_uploads_folder: "./uploads",
			},
		} as ConfigType;
		mockFile = Bun.file(__dirname + "/megamind.jpg") as unknown as File;
		mockMediaHasher = new MediaHasher();
		localMediaBackend = new LocalMediaBackend(mockConfig);
	});

	it("should initialize with correct type", () => {
		expect(localMediaBackend.getBackendType()).toEqual(
			MediaBackendType.LOCAL
		);
	});

	it("should add file", async () => {
		const mockHash = "test-hash";
		spyOn(mockMediaHasher, "getMediaHash").mockResolvedValue(mockHash);
		const mockMediaConverter = new MediaConverter(
			ConvertableMediaFormats.JPG,
			ConvertableMediaFormats.PNG
		);
		spyOn(mockMediaConverter, "convert").mockResolvedValue(mockFile);
		// @ts-expect-error This is a mock
		spyOn(Bun, "file").mockImplementationOnce(() => ({
			exists: () => Promise.resolve(false),
		}));
		spyOn(Bun, "write").mockImplementationOnce(() =>
			Promise.resolve(mockFile.size)
		);

		const result = await localMediaBackend.addFile(mockFile);

		expect(result.uploadedFile).toEqual(mockFile);
		expect(result.path).toEqual(`./uploads/megamind.png`);
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
			databaseHashFetcher
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
});
