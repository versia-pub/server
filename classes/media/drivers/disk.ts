/**
 * @packageDocumentation
 * @module MediaManager/Drivers
 */

import { rm } from "node:fs/promises";
import { join } from "node:path";
import type { Config } from "config-manager";
import { MediaHasher } from "../media-hasher";
import type { UploadedFileMetadata } from "../media-manager";
import type { MediaDriver } from "./media-driver";

/**
 * Implements the MediaDriver interface for disk storage.
 */
export class DiskMediaDriver implements MediaDriver {
    private mediaHasher: MediaHasher;

    /**
     * Creates a new DiskMediaDriver instance.
     * @param config - The configuration object.
     */
    constructor(private config: Config) {
        this.mediaHasher = new MediaHasher();
    }

    /**
     * @inheritdoc
     */
    public async addFile(
        file: File,
    ): Promise<Omit<UploadedFileMetadata, "blurhash">> {
        // Sometimes the file name is not available, so we generate a random name
        const fileName = file.name ?? crypto.randomUUID();

        const hash = await this.mediaHasher.getMediaHash(file);
        const path = join(hash, fileName);
        const fullPath = join(this.config.media.local_uploads_folder, path);

        await Bun.write(fullPath, await file.arrayBuffer());

        return {
            uploadedFile: file,
            path,
            hash,
        };
    }

    /**
     * @inheritdoc
     */
    public async getFileByHash(
        hash: string,
        databaseHashFetcher: (sha256: string) => Promise<string | null>,
    ): Promise<File | null> {
        const filename = await databaseHashFetcher(hash);
        if (!filename) {
            return null;
        }
        return this.getFile(filename);
    }

    /**
     * @inheritdoc
     */
    public async getFile(filename: string): Promise<File | null> {
        const fullPath = join(this.config.media.local_uploads_folder, filename);
        try {
            const file = Bun.file(fullPath);
            if (await file.exists()) {
                return new File([await file.arrayBuffer()], filename, {
                    type: file.type,
                    lastModified: file.lastModified,
                });
            }
        } catch {
            // File doesn't exist or can't be read
        }
        return null;
    }

    /**
     * @inheritdoc
     */
    public async deleteFileByUrl(url: string): Promise<void> {
        const urlObj = new URL(url);
        const hash = urlObj.pathname.split("/").at(-2);
        if (!hash) {
            throw new Error("Invalid URL");
        }
        const dirPath = join(this.config.media.local_uploads_folder, hash);
        await rm(dirPath, { recursive: true });
    }
}
