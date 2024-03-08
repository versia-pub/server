/**
 * @packageDocumentation
 * @module MediaManager
 * @description Handles media conversion between formats
 */
import sharp from "sharp";

export enum ConvertableMediaFormats {
	PNG = "png",
	WEBP = "webp",
	JPEG = "jpeg",
	JPG = "jpg",
	AVIF = "avif",
	JXL = "jxl",
	HEIF = "heif",
}

/**
 * Handles media conversion between formats
 */
export class MediaConverter {
	constructor(
		public fromFormat: ConvertableMediaFormats,
		public toFormat: ConvertableMediaFormats
	) {}

	/**
	 * Returns whether the media is convertable
	 * @returns Whether the media is convertable
	 */
	public isConvertable() {
		return (
			this.fromFormat !== this.toFormat &&
			Object.values(ConvertableMediaFormats).includes(this.fromFormat)
		);
	}

	/**
	 * Returns the file name with the extension replaced
	 * @param fileName File name to replace
	 * @returns File name with extension replaced
	 */
	private getReplacedFileName(fileName: string) {
		return this.extractFilenameFromPath(fileName).replace(
			new RegExp(`\\.${this.fromFormat}$`),
			`.${this.toFormat}`
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
	public async convert(media: File) {
		if (!this.isConvertable()) {
			return media;
		}

		const sharpCommand = sharp(await media.arrayBuffer());

		// Calculate newFilename before changing formats to prevent errors with jpg files
		const newFilename = this.getReplacedFileName(media.name);

		if (this.fromFormat === ConvertableMediaFormats.JPG) {
			this.fromFormat = ConvertableMediaFormats.JPEG;
		}

		if (this.toFormat === ConvertableMediaFormats.JPG) {
			this.toFormat = ConvertableMediaFormats.JPEG;
		}

		const convertedBuffer = await sharpCommand[this.toFormat]().toBuffer();

		// Convert the buffer to a BlobPart
		const buffer = new Blob([convertedBuffer]);

		return new File([buffer], newFilename, {
			type: `image/${this.toFormat}`,
			lastModified: Date.now(),
		});
	}
}
