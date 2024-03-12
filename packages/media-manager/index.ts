import type { ConfigType } from "config-manager";

export enum MediaBackendType {
	LOCAL = "local",
	S3 = "s3",
}

interface UploadedFileMetadata {
	uploadedFile: File;
	path?: string;
	hash: string;
}

export class MediaHasher {
	/**
	 * Returns the SHA-256 hash of a file in hex format
	 * @param media The file to hash
	 * @returns The SHA-256 hash of the file in hex format
	 */
	public async getMediaHash(media: File) {
		const hash = new Bun.SHA256()
			.update(await media.arrayBuffer())
			.digest("hex");

		return hash;
	}
}

export class MediaBackend {
	constructor(
		public config: ConfigType,
		public backend: MediaBackendType
	) {}

	static async fromBackendType(
		backend: MediaBackendType,
		config: ConfigType
	): Promise<MediaBackend> {
		switch (backend) {
			case MediaBackendType.LOCAL:
				return new (await import("./backends/local")).LocalMediaBackend(
					config
				);
			case MediaBackendType.S3:
				return new (await import("./backends/s3")).S3MediaBackend(
					config
				);
			default:
				throw new Error(`Unknown backend type: ${backend as any}`);
		}
	}

	public getBackendType() {
		return this.backend;
	}

	public shouldConvertImages(config: ConfigType) {
		return config.media.conversion.convert_images;
	}

	/**
	 * Fetches file from backend from SHA-256 hash
	 * @param file SHA-256 hash of wanted file
	 * @param databaseHashFetcher Function that takes in a sha256 hash as input and outputs the filename of that file in the database
	 * @returns The file as a File object
	 */
	public getFileByHash(
		// eslint-disable-next-line @typescript-eslint/no-unused-vars
		file: string,
		// eslint-disable-next-line @typescript-eslint/no-unused-vars
		databaseHashFetcher: (sha256: string) => Promise<string>
	): Promise<File | null> {
		return Promise.reject(
			new Error("Do not call MediaBackend directly: use a subclass")
		);
	}

	/**
	 * Fetches file from backend from filename
	 * @param filename File name
	 * @returns The file as a File object
	 */
	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	public getFile(filename: string): Promise<File | null> {
		return Promise.reject(
			new Error("Do not call MediaBackend directly: use a subclass")
		);
	}

	/**
	 * Adds file to backend
	 * @param file File to add
	 * @returns Metadata about the uploaded file
	 */
	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	public addFile(file: File): Promise<UploadedFileMetadata> {
		return Promise.reject(
			new Error("Do not call MediaBackend directly: use a subclass")
		);
	}
}
