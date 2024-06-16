/**
 * @packageDocumentation
 * @module MediaManager
 * @description Handles media conversion between formats
 */
import sharp from "sharp";

export const supportedMediaFormats = [
    "image/png",
    "image/jpeg",
    "image/webp",
    "image/avif",
    "image/svg+xml",
    "image/gif",
    "image/tiff",
];

export const supportedOutputFormats = [
    "image/jpeg",
    "image/png",
    "image/webp",
    "image/avif",
    "image/gif",
    "image/tiff",
];

/**
 * Handles media conversion between formats
 */
export class MediaConverter {
    /**
     * Returns whether the media is convertable
     * @returns Whether the media is convertable
     */
    public isConvertable(file: File) {
        return supportedMediaFormats.includes(file.type);
    }

    /**
     * Returns the file name with the extension replaced
     * @param fileName File name to replace
     * @returns File name with extension replaced
     */
    private getReplacedFileName(fileName: string, newExtension: string) {
        return this.extractFilenameFromPath(fileName).replace(
            /\.[^/.]+$/,
            `.${newExtension}`,
        );
    }

    /**
     * Extracts the filename from a path
     * @param path Path to extract filename from
     * @returns Extracted filename
     */
    private extractFilenameFromPath(path: string) {
        // Don't count escaped slashes as path separators
        const pathParts = path.split(/(?<!\\)\//);
        return pathParts[pathParts.length - 1];
    }

    /**
     * Converts media to the specified format
     * @param media Media to convert
     * @returns Converted media
     */
    public async convert(
        media: File,
        toMime: (typeof supportedMediaFormats)[number],
    ) {
        if (!this.isConvertable(media)) {
            return media;
        }

        if (!supportedOutputFormats.includes(toMime)) {
            throw new Error(
                `Unsupported image output format: ${toMime}. Supported formats: ${supportedOutputFormats.join(
                    ", ",
                )}`,
            );
        }

        const sharpCommand = sharp(await media.arrayBuffer(), {
            animated: true,
        });

        const commandName = toMime.split("/")[1] as
            | "jpeg"
            | "png"
            | "webp"
            | "avif"
            | "gif"
            | "tiff";

        const convertedBuffer = await sharpCommand[commandName]().toBuffer();

        // Convert the buffer to a BlobPart
        const buffer = new Blob([convertedBuffer]);

        return new File(
            [buffer],
            this.getReplacedFileName(media.name || "image", commandName),
            {
                type: toMime,
                lastModified: Date.now(),
            },
        );
    }
}
