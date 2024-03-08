import { S3Client } from "@bradenmacdonald/s3-lite-client";
import type { ConvertableMediaFormats } from "../media-converter";
import { MediaConverter } from "../media-converter";
import { MediaBackend, MediaBackendType, MediaHasher } from "..";
import type { ConfigType } from "config-manager";

export class S3MediaBackend extends MediaBackend {
	constructor(
		private config: ConfigType,
		private s3Client = new S3Client({
			endPoint: config.s3.endpoint,
			useSSL: true,
			region: config.s3.region || "auto",
			bucket: config.s3.bucket_name,
			accessKey: config.s3.access_key,
			secretKey: config.s3.secret_access_key,
		})
	) {
		super(MediaBackendType.S3);
	}

	public async addFile(file: File) {
		if (this.shouldConvertImages(this.config)) {
			const fileExtension = file.name.split(".").pop();
			const mediaConverter = new MediaConverter(
				fileExtension as ConvertableMediaFormats,
				this.config.media.conversion
					.convert_to as ConvertableMediaFormats
			);
			file = await mediaConverter.convert(file);
		}

		const hash = await new MediaHasher().getMediaHash(file);

		await this.s3Client.putObject(file.name, file.stream(), {
			size: file.size,
		});

		return {
			uploadedFile: file,
			hash: hash,
		};
	}

	public async getFileByHash(
		hash: string,
		databaseHashFetcher: (sha256: string) => Promise<string | null>
	): Promise<File | null> {
		const filename = await databaseHashFetcher(hash);

		if (!filename) return null;

		return this.getFile(filename);
	}

	public async getFile(filename: string): Promise<File | null> {
		try {
			await this.s3Client.statObject(filename);
		} catch {
			return null;
		}

		const file = await this.s3Client.getObject(filename);

		return new File([await file.arrayBuffer()], filename, {
			type: file.headers.get("Content-Type") || "undefined",
		});
	}
}
