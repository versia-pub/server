import {
	GetObjectCommand,
	GetObjectCommandOutput,
	PutObjectCommand,
	S3Client,
} from "@aws-sdk/client-s3";
import { ConfigType } from "@config";

class MediaBackend {
	backend: string;

	constructor(backend: string) {
		this.backend = backend;
	}

	/**
	 * Adds media to the media backend
	 * @param media
	 * @returns The hash of the file in SHA-256 (hex format)
	 */
	async addMedia(media: File) {
		const hash = new Bun.SHA256()
			.update(await media.arrayBuffer())
			.digest("hex");

		return hash;
	}
	/**
	 * Retrieves element from media backend by hash
	 * @param hash The hash of the element in SHA-256 hex format
	 * @returns The file as a File object
	 */
	// eslint-disable-next-line @typescript-eslint/require-await, @typescript-eslint/no-unused-vars
	async getMediaByHash(
		// eslint-disable-next-line @typescript-eslint/no-unused-vars
		hash: string,
		// eslint-disable-next-line @typescript-eslint/no-unused-vars
		extension: string
	): Promise<File | null> {
		return new File([], "test");
	}
}

/**
 * S3 Backend, stores files in S3
 */
export class S3Backend extends MediaBackend {
	endpoint: string;
	bucket: string;
	region: string;
	accessKey: string;
	secretKey: string;
	publicUrl: string;
	client: S3Client;

	constructor(config: ConfigType) {
		super("s3");

		this.endpoint = config.s3.endpoint;
		this.bucket = config.s3.bucket_name;
		this.region = config.s3.region;
		this.accessKey = config.s3.access_key;
		this.secretKey = config.s3.secret_access_key;
		this.publicUrl = config.s3.public_url;

		this.client = new S3Client({
			endpoint: this.endpoint,
			region: this.region || "auto",
			credentials: {
				accessKeyId: this.accessKey,
				secretAccessKey: this.secretKey,
			},
		});
	}

	async addMedia(media: File): Promise<string> {
		const hash = await super.addMedia(media);

		if (!hash) {
			throw new Error("Failed to hash file");
		}

		// Check if file is already present
		const existingFile = await this.getMediaByHash(
			hash,
			media.name.split(".").pop() || ""
		);

		if (existingFile) {
			// File already exists, so return the hash without uploading it
			return hash;
		}

		const command = new PutObjectCommand({
			Bucket: this.bucket,
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

	async getMediaByHash(
		hash: string,
		extension: string
	): Promise<File | null> {
		const command = new GetObjectCommand({
			Bucket: this.bucket,
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

		return new File([body], `${hash}.${extension}`, {
			type: response.ContentType,
		});
	}
}

/**
 * Local backend, stores files on filesystem
 */
export class LocalBackend extends MediaBackend {
	constructor() {
		super("local");
	}

	async addMedia(media: File): Promise<string> {
		const hash = await super.addMedia(media);

		await Bun.write(Bun.file(`${process.cwd()}/uploads/${hash}`), media);

		return hash;
	}

	async getMediaByHash(
		hash: string,
		extension: string
	): Promise<File | null> {
		const file = Bun.file(`${process.cwd()}/uploads/${hash}`);

		if (!(await file.exists())) {
			return null;
		}

		return new File([await file.arrayBuffer()], `${hash}.${extension}`, {
			type: file.type,
		});
	}
}
