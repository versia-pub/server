/**
 * @packageDocumentation
 * @module MediaManager/Preprocessors
 */

import sharp from "sharp";
import type { Config } from "~/packages/config-manager/config.type";
import type { MediaPreprocessor } from "./media-preprocessor";

/**
 * Supported input media formats.
 */
const supportedInputFormats = [
    "image/png",
    "image/jpeg",
    "image/webp",
    "image/avif",
    "image/svg+xml",
    "image/gif",
    "image/tiff",
];

/**
 * Supported output media formats.
 */
const supportedOutputFormats = [
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/avif",
    "image/gif",
    "image/tiff",
];

/**
 * Implements the MediaPreprocessor interface for image conversion.
 */
export class ImageConversionPreprocessor implements MediaPreprocessor {
    /**
     * Creates a new ImageConversionPreprocessor instance.
     * @param config - The configuration object.
     */
    constructor(private config: Config) {}

    /**
     * @inheritdoc
     */
    public async process(file: File): Promise<{ file: File }> {
        if (!this.isConvertible(file)) {
            return { file };
        }

        const targetFormat = this.config.media.conversion.convert_to;
        if (!supportedOutputFormats.includes(targetFormat)) {
            throw new Error(`Unsupported output format: ${targetFormat}`);
        }

        const sharpCommand = sharp(await file.arrayBuffer(), {
            animated: true,
        });
        const commandName = targetFormat.split("/")[1] as
            | "jpeg"
            | "png"
            | "webp"
            | "avif"
            | "gif"
            | "tiff";
        const convertedBuffer = await sharpCommand[commandName]().toBuffer();

        return {
            file: new File(
                [convertedBuffer],
                this.getReplacedFileName(file.name, commandName),
                {
                    type: targetFormat,
                    lastModified: Date.now(),
                },
            ),
        };
    }

    /**
     * Checks if a file is convertible.
     * @param file - The file to check.
     * @returns True if the file is convertible, false otherwise.
     */
    private isConvertible(file: File): boolean {
        if (
            file.type === "image/svg+xml" &&
            !this.config.media.conversion.convert_vector
        ) {
            return false;
        }
        return supportedInputFormats.includes(file.type);
    }

    /**
     * Replaces the file extension in the filename.
     * @param fileName - The original filename.
     * @param newExtension - The new extension.
     * @returns The filename with the new extension.
     */
    private getReplacedFileName(
        fileName: string,
        newExtension: string,
    ): string {
        return this.extractFilenameFromPath(fileName).replace(
            /\.[^/.]+$/,
            `.${newExtension}`,
        );
    }

    /**
     * Extracts the filename from a path.
     * @param path - The path to extract the filename from.
     * @returns The extracted filename.
     */
    private extractFilenameFromPath(path: string): string {
        const pathParts = path.split(/(?<!\\)\//);
        return pathParts[pathParts.length - 1];
    }
}
