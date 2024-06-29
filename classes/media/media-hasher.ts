/**
 * @packageDocumentation
 * @module MediaManager/Utils
 */

/**
 * Utility class for hashing media files.
 */
export class MediaHasher {
    /**
     * Generates a SHA-256 hash for a given file.
     * @param file - The file to hash.
     * @returns A promise that resolves to the SHA-256 hash of the file in hex format.
     */
    public async getMediaHash(file: File): Promise<string> {
        const arrayBuffer = await file.arrayBuffer();
        const hash = new Bun.SHA256().update(arrayBuffer).digest("hex");
        return hash;
    }
}
