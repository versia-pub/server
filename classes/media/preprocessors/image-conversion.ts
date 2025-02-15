/**
 * @packageDocumentation
 * @module MediaManager/Preprocessors
 */

import sharp from "sharp";
import { config } from "~/config.ts";

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
 * Checks if a file is convertible.
 * @param file - The file to check.
 * @returns True if the file is convertible, false otherwise.
 */
const isConvertible = (file: File): boolean => {
    if (
        file.type === "image/svg+xml" &&
        !config.media.conversion.convert_vectors
    ) {
        return false;
    }
    return supportedInputFormats.includes(file.type);
};

/**
 * Extracts the filename from a path.
 * @param path - The path to extract the filename from.
 * @returns The extracted filename.
 */
const extractFilenameFromPath = (path: string): string => {
    const pathParts = path.split(/(?<!\\)\//);
    return pathParts[pathParts.length - 1];
};

/**
 * Replaces the file extension in the filename.
 * @param fileName - The original filename.
 * @param newExtension - The new extension.
 * @returns The filename with the new extension.
 */
const getReplacedFileName = (fileName: string, newExtension: string): string =>
    extractFilenameFromPath(fileName).replace(/\.[^/.]+$/, `.${newExtension}`);

/**
 * Converts an image file to the format specified in the configuration.
 *
 * @param file - The image file to convert.
 * @returns The converted image file.
 */
export const convertImage = async (file: File): Promise<File> => {
    if (!isConvertible(file)) {
        return file;
    }

    const targetFormat = config.media.conversion.convert_to;
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

    return new File(
        [convertedBuffer],
        getReplacedFileName(file.name, commandName),
        {
            type: targetFormat,
            lastModified: Date.now(),
        },
    );
};
