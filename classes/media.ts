import type { GetObjectCommandOutput } from "@aws-sdk/client-s3";
import {
	GetObjectCommand,
	PutObjectCommand,
	S3Client,
} from "@aws-sdk/client-s3";
import type { ConfigType } from "~classes/configmanager";
import sharp from "sharp";
import { exists, mkdir } from "fs/promises";
class MediaBackend {
	backend: string;

	constructor(backend: string) {
		this.backend = backend;
	}

	/**
	 * Adds media to the media backend
	 * @param media
	 * @returns The hash of the file in SHA-256 (hex format) with the file extension added to it
	 */
	async addMedia(media: File) {
		const hash = new Bun.SHA256()
			.update(await media.arrayBuffer())
			.digest("hex");

		return `${hash}.${media.name.split(".").pop()}`;
	}

	async convertMedia(media: File, config: ConfigType) {
		const sharpCommand = sharp(await media.arrayBuffer());

		// Rename ".jpg" files to ".jpeg" to avoid sharp errors
		let name = media.name;
		if (media.name.endsWith(".jpg")) {
			name = media.name.replace(".jpg", ".jpeg");
		}

		const fileFormatToConvertTo = config.media.conversion.convert_to;

		switch (fileFormatToConvertTo) {
			case "png":
				return new File(
					[(await sharpCommand.png().toBuffer()).buffer] as any,
					// Replace the file extension with PNG
					name.replace(/\.[^/.]+$/, ".png"),
					{
						type: "image/png",
					}
				);
			case "webp":
				return new File(
					[(await sharpCommand.webp().toBuffer()).buffer] as any,
					// Replace the file extension with WebP
					name.replace(/\.[^/.]+$/, ".webp"),
					{
						type: "image/webp",
					}
				);
			case "jpeg":
				return new File(
					[(await sharpCommand.jpeg().toBuffer()).buffer] as any,
					// Replace the file extension with JPEG
					name.replace(/\.[^/.]+$/, ".jpeg"),
					{
						type: "image/jpeg",
					}
				);
			case "avif":
				return new File(
					[(await sharpCommand.avif().toBuffer()).buffer] as any,
					// Replace the file extension with AVIF
					name.replace(/\.[^/.]+$/, ".avif"),
					{
						type: "image/avif",
					}
				);
			// Needs special build of libvips
			case "jxl":
				return new File(
					[(await sharpCommand.jxl().toBuffer()).buffer] as any,
					// Replace the file extension with JXL
					name.replace(/\.[^/.]+$/, ".jxl"),
					{
						type: "image/jxl",
					}
				);
			case "heif":
				return new File(
					[(await sharpCommand.heif().toBuffer()).buffer] as any,
					// Replace the file extension with HEIF
					name.replace(/\.[^/.]+$/, ".heif"),
					{
						type: "image/heif",
					}
				);
			default:
				return media;
		}
	}

	/**
	 * Retrieves element from media backend by hash
	 * @param hash The hash of the element in SHA-256 hex format
	 * @param extension The extension of the file
	 * @returns The file as a File object
	 */
	// eslint-disable-next-line @typescript-eslint/require-await, @typescript-eslint/no-unused-vars
	async getMediaByHash(
		// eslint-disable-next-line @typescript-eslint/no-unused-vars
		hash: string
	): Promise<File | null> {
		return new File([], "test");
	}
}

/**
 * S3 Backend, stores files in S3
 */
export class S3Backend extends MediaBackend {
	client: S3Client;
	config: ConfigType;

	constructor(config: ConfigType) {
		super("s3");

		this.config = config;

		this.client = new S3Client({
			endpoint: this.config.s3.endpoint,
			region: this.config.s3.region || "auto",
			credentials: {
				accessKeyId: this.config.s3.access_key,
				secretAccessKey: this.config.s3.secret_access_key,
			},
		});
	}

	async addMedia(media: File): Promise<string> {
		if (this.config.media.conversion.convert_images) {
			media = await this.convertMedia(media, this.config);
		}

		const hash = await super.addMedia(media);

		if (!hash) {
			throw new Error("Failed to hash file");
		}

		// Check if file is already present
		const existingFile = await this.getMediaByHash(hash);

		if (existingFile) {
			// File already exists, so return the hash without uploading it
			return hash;
		}

		const command = new PutObjectCommand({
			Bucket: this.config.s3.bucket_name,
			Key: hash,
			Body: Buffer.from(await media.arrayBuffer()),
			ContentType: media.type,
			ContentLength: media.size,
			Metadata: {
				"x-amz-meta-original-name": media.name,
			},
		});

		const response = await this.client.send(command);

		if (response.$metadata.httpStatusCode !== 200) {
			throw new Error("Failed to upload file");
		}

		return hash;
	}

	async getMediaByHash(hash: string): Promise<File | null> {
		const command = new GetObjectCommand({
			Bucket: this.config.s3.bucket_name,
			Key: hash,
		});

		let response: GetObjectCommandOutput;

		try {
			response = await this.client.send(command);
		} catch {
			return null;
		}

		if (response.$metadata.httpStatusCode !== 200) {
			throw new Error("Failed to get file");
		}

		const body = await response.Body?.transformToByteArray();

		if (!body) {
			throw new Error("Failed to get file");
		}

		return new File([body], hash, {
			type: response.ContentType,
		});
	}
}

/**
 * Local backend, stores files on filesystem
 */
export class LocalBackend extends MediaBackend {
	config: ConfigType;

	constructor(config: ConfigType) {
		super("local");

		this.config = config;
	}

	async addMedia(media: File): Promise<string> {
		if (this.config.media.conversion.convert_images) {
			media = await this.convertMedia(media, this.config);
		}

		const hash = await super.addMedia(media);

		if (!(await exists(`${process.cwd()}/uploads`))) {
			await mkdir(`${process.cwd()}/uploads`);
		}

		await Bun.write(Bun.file(`${process.cwd()}/uploads/${hash}`), media);

		return hash;
	}

	async getMediaByHash(hash: string): Promise<File | null> {
		const file = Bun.file(`${process.cwd()}/uploads/${hash}`);

		if (!(await file.exists())) {
			return null;
		}

		return new File([await file.arrayBuffer()], `${hash}`, {
			type: file.type,
		});
	}
}

export const uploadFile = (file: File, config: ConfigType) => {
	const backend = config.media.backend;

	if (backend === "local") {
		return new LocalBackend(config).addMedia(file);
	} else if (backend === "s3") {
		return new S3Backend(config).addMedia(file);
	}
};

export const getFile = (
	hash: string,
	extension: string,
	config: ConfigType
) => {
	const backend = config.media.backend;

	if (backend === "local") {
		return new LocalBackend(config).getMediaByHash(hash);
	} else if (backend === "s3") {
		return new S3Backend(config).getMediaByHash(hash);
	}

	return null;
};
