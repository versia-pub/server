/**
 * @packageDocumentation
 * @module MediaManager/Preprocessors
 */

/**
 * Represents a media preprocessor.
 */
export interface MediaPreprocessor {
    /**
     * Processes a file before it's stored.
     * @param file - The file to process.
     * @returns A promise that resolves to the processed file.
     */
    process(file: File): Promise<{ file: File } & Record<string, unknown>>;
}
