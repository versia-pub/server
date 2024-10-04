/**
 * @packageDocumentation
 * @module MediaManager/Drivers
 */

import { S3Client } from "@bradenmacdonald/s3-lite-client";
import type { Config } from "~/packages/config-manager/config.type";
import { getMediaHash } from "../media-hasher.ts";
import type { UploadedFileMetadata } from "../media-manager.ts";
import type { MediaDriver } from "./media-driver.ts";

/**
 * Implements the MediaDriver interface for S3 storage.
 */
export class S3MediaDriver implements MediaDriver {
    private s3Client: S3Client;

    /**
     * Creates a new S3MediaDriver instance.
     * @param config - The configuration object.
     */
    constructor(config: Config) {
        this.s3Client = new S3Client({
            endPoint: config.s3.endpoint,
            useSSL: true,
            region: config.s3.region || "auto",
            bucket: config.s3.bucket_name,
            accessKey: config.s3.access_key,
            secretKey: config.s3.secret_access_key,
        });
    }

    /**
     * @inheritdoc
     */
    public async addFile(
        file: File,
    ): Promise<Omit<UploadedFileMetadata, "blurhash">> {
        // Sometimes the file name is not available, so we generate a random name
        const fileName = file.name ?? crypto.randomUUID();

        const hash = await getMediaHash(file);
        const path = `${hash}/${fileName}`;

        await this.s3Client.putObject(path, file.stream(), {
            size: file.size,
        });

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
        try {
            await this.s3Client.statObject(filename);
            const file = await this.s3Client.getObject(filename);
            const arrayBuffer = await file.arrayBuffer();
            return new File([arrayBuffer], filename, {
                type: file.headers.get("Content-Type") || undefined,
            });
        } catch {
            return null;
        }
    }

    /**
     * @inheritdoc
     */
    public async deleteFileByUrl(url: string): Promise<void> {
        const urlObj = new URL(url);
        const path = urlObj.pathname.slice(1); // Remove leading slash
        await this.s3Client.deleteObject(path);
    }
}
