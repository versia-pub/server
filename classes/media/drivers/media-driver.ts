/**
 * @packageDocumentation
 * @module MediaManager/Drivers
 */

import type { UploadedFileMetadata } from "../media-manager";

/**
 * Represents a media storage driver.
 */
export interface MediaDriver {
    /**
     * Adds a file to the media storage.
     * @param file - The file to add.
     * @returns A promise that resolves to the metadata of the uploaded file.
     */
    addFile(file: File): Promise<Omit<UploadedFileMetadata, "blurhash">>;

    /**
     * Retrieves a file from the media storage by its hash.
     * @param hash - The hash of the file to retrieve.
     * @param databaseHashFetcher - A function to fetch the filename from the database.
     * @returns A promise that resolves to the file or null if not found.
     */
    getFileByHash(
        hash: string,
        databaseHashFetcher: (sha256: string) => Promise<string | null>,
    ): Promise<File | null>;

    /**
     * Retrieves a file from the media storage by its filename.
     * @param filename - The name of the file to retrieve.
     * @returns A promise that resolves to the file or null if not found.
     */
    getFile(filename: string): Promise<File | null>;

    /**
     * Deletes a file from the media storage by its URL.
     * @param url - The URL of the file to delete.
     * @returns A promise that resolves when the file is deleted.
     */
    deleteFileByUrl(url: string): Promise<void>;
}
