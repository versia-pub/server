/**
 * @packageDocumentation
 * @module MediaManager
 */

import type { Config } from "~/packages/config-manager/config.type";
import { DiskMediaDriver } from "./drivers/disk.ts";
import type { MediaDriver } from "./drivers/media-driver.ts";
import { S3MediaDriver } from "./drivers/s3.ts";
import { BlurhashPreprocessor } from "./preprocessors/blurhash.ts";
import { ImageConversionPreprocessor } from "./preprocessors/image-conversion.ts";
import type { MediaPreprocessor } from "./preprocessors/media-preprocessor.ts";

/**
 * Manages media operations with support for different storage drivers and preprocessing plugins.
 * @example
 * const mediaManager = new MediaManager(config);
 *
 * const file = new File(["hello"], "hello.txt");
 *
 * const { path, hash, blurhash } = await mediaManager.addFile(file);
 *
 * const retrievedFile = await mediaManager.getFileByHash(hash, fetchHashFromDatabase);
 *
 * await mediaManager.deleteFileByUrl(path);
 */
export class MediaManager {
    private driver: MediaDriver;
    private preprocessors: MediaPreprocessor[] = [];

    /**
     * Creates a new MediaManager instance.
     * @param config - The configuration object.
     */
    public constructor(private config: Config) {
        this.driver = this.initializeDriver();
        this.initializePreprocessors();
    }

    /**
     * Initializes the appropriate media driver based on the configuration.
     * @returns An instance of MediaDriver.
     */
    private initializeDriver(): MediaDriver {
        switch (this.config.media.backend) {
            case "s3":
                return new S3MediaDriver(this.config);
            case "local":
                return new DiskMediaDriver(this.config);
            default:
                throw new Error(
                    `Unsupported media backend: ${this.config.media.backend}`,
                );
        }
    }

    /**
     * Initializes the preprocessors based on the configuration.
     */
    private initializePreprocessors(): void {
        if (this.config.media.conversion.convert_images) {
            this.preprocessors.push(
                new ImageConversionPreprocessor(this.config),
            );
        }
        this.preprocessors.push(new BlurhashPreprocessor());
        // Add other preprocessors here as needed
    }

    /**
     * Adds a file to the media storage.
     * @param file - The file to add.
     * @returns A promise that resolves to the metadata of the uploaded file.
     */
    public async addFile(file: File): Promise<UploadedFileMetadata> {
        let processedFile = file;
        let blurhash: string | null = null;

        for (const preprocessor of this.preprocessors) {
            const result = await preprocessor.process(processedFile);

            if ("blurhash" in result) {
                blurhash = result.blurhash as string;
            }

            processedFile = result.file;
        }

        const uploadResult = await this.driver.addFile(processedFile);
        return { ...uploadResult, blurhash };
    }
    /**
     * Retrieves a file from the media storage by its hash.
     * @param hash - The hash of the file to retrieve.
     * @param databaseHashFetcher - A function to fetch the filename from the database.
     * @returns A promise that resolves to the file or null if not found.
     */
    public getFileByHash(
        hash: string,
        databaseHashFetcher: (sha256: string) => Promise<string | null>,
    ): Promise<File | null> {
        return this.driver.getFileByHash(hash, databaseHashFetcher);
    }

    /**
     * Retrieves a file from the media storage by its filename.
     * @param filename - The name of the file to retrieve.
     * @returns A promise that resolves to the file or null if not found.
     */
    public getFile(filename: string): Promise<File | null> {
        return this.driver.getFile(filename);
    }

    /**
     * Deletes a file from the media storage by its URL.
     * @param url - The URL of the file to delete.
     * @returns A promise that resolves when the file is deleted.
     */
    public deleteFileByUrl(url: string): Promise<void> {
        return this.driver.deleteFileByUrl(url);
    }
}

/**
 * Represents the metadata of an uploaded file.
 */
export interface UploadedFileMetadata {
    uploadedFile: File;
    path: string;
    hash: string;
    blurhash: string | null;
}
