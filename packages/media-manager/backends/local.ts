import type { Config } from "config-manager";
import { MediaBackend, MediaBackendType, MediaHasher } from "..";
import type { ConvertableMediaFormats } from "../media-converter";
import { MediaConverter } from "../media-converter";

export class LocalMediaBackend extends MediaBackend {
    constructor(config: Config) {
        super(config, MediaBackendType.LOCAL);
    }

    public async addFile(file: File) {
        let convertedFile = file;
        if (this.shouldConvertImages(this.config)) {
            const fileExtension = file.name.split(".").pop();
            const mediaConverter = new MediaConverter(
                fileExtension as ConvertableMediaFormats,
                this.config.media.conversion
                    .convert_to as ConvertableMediaFormats,
            );
            convertedFile = await mediaConverter.convert(file);
        }

        const hash = await new MediaHasher().getMediaHash(convertedFile);

        const newFile = Bun.file(
            `${this.config.media.local_uploads_folder}/${hash}`,
        );

        if (await newFile.exists()) {
            throw new Error("File already exists");
        }

        await Bun.write(newFile, convertedFile);

        return {
            uploadedFile: convertedFile,
            path: `./uploads/${convertedFile.name}`,
            hash: hash,
        };
    }

    public async getFileByHash(
        hash: string,
        databaseHashFetcher: (sha256: string) => Promise<string | null>,
    ): Promise<File | null> {
        const filename = await databaseHashFetcher(hash);

        if (!filename) return null;

        return this.getFile(filename);
    }

    public async getFile(filename: string): Promise<File | null> {
        const file = Bun.file(
            `${this.config.media.local_uploads_folder}/${filename}`,
        );

        if (!(await file.exists())) return null;

        return new File([await file.arrayBuffer()], filename, {
            type: file.type,
            lastModified: file.lastModified,
        });
    }
}
