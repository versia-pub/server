import type { ConvertableMediaFormats } from "../media-converter";
import { MediaConverter } from "../media-converter";
import { MediaBackend, MediaBackendType, MediaHasher } from "..";
import type { ConfigType } from "config-manager";

export class LocalMediaBackend extends MediaBackend {
	constructor(config: ConfigType) {
		super(config, MediaBackendType.LOCAL);
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

		const newFile = Bun.file(
			`${this.config.media.local_uploads_folder}/${hash}`
		);

		if (await newFile.exists()) {
			throw new Error("File already exists");
		}

		await Bun.write(newFile, file);

		return {
			uploadedFile: file,
			path: `./uploads/${file.name}`,
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
		const file = Bun.file(
			`${this.config.media.local_uploads_folder}/${filename}`
		);

		if (!(await file.exists())) return null;

		return new File([await file.arrayBuffer()], filename, {
			type: file.type,
			lastModified: file.lastModified,
		});
	}
}
