import { describe, expect, it } from "bun:test";
import sharp from "sharp";
import { convertImage } from "./image-conversion.ts";

describe("ImageConversionPreprocessor", () => {
    it("should convert a JPEG image to WebP", async () => {
        const inputBuffer = await sharp({
            create: {
                width: 100,
                height: 100,
                channels: 3,
                background: { r: 255, g: 0, b: 0 },
            },
        })
            .jpeg()
            .toBuffer();

        const inputFile = new File([inputBuffer as BlobPart], "test.jpg", {
            type: "image/jpeg",
        });
        const result = await convertImage(inputFile, "image/webp");

        expect(result.type).toBe("image/webp");
        expect(result.name).toBe("test.webp");

        const resultBuffer = await result.arrayBuffer();
        const metadata = await sharp(resultBuffer).metadata();
        expect(metadata.format).toBe("webp");
    });

    it("should not convert SVG when convert_vector is false", async () => {
        const svgContent =
            '<svg xmlns="http://www.w3.org/2000/svg"><rect width="100" height="100" fill="red"/></svg>';
        const inputFile = new File([svgContent], "test.svg", {
            type: "image/svg+xml",
        });
        const result = await convertImage(inputFile, "image/webp");

        expect(result).toBe(inputFile);
    });

    it("should convert SVG when convert_vector is true", async () => {
        const svgContent =
            '<svg xmlns="http://www.w3.org/2000/svg"><rect width="100" height="100" fill="red"/></svg>';
        const inputFile = new File([svgContent], "test.svg", {
            type: "image/svg+xml",
        });
        const result = await convertImage(inputFile, "image/webp", {
            convertVectors: true,
        });

        expect(result.type).toBe("image/webp");
        expect(result.name).toBe("test.webp");
    });

    it("should not convert unsupported file types", async () => {
        const inputFile = new File(["test content"], "test.txt", {
            type: "text/plain",
        });
        const result = await convertImage(inputFile, "image/webp");

        expect(result).toBe(inputFile);
    });

    it("should throw an error for unsupported output format", async () => {
        const inputBuffer = await sharp({
            create: {
                width: 100,
                height: 100,
                channels: 3,
                background: { r: 255, g: 0, b: 0 },
            },
        })
            .png()
            .toBuffer();

        const inputFile = new File([inputBuffer as BlobPart], "test.png", {
            type: "image/png",
        });

        await expect(convertImage(inputFile, "image/bmp")).rejects.toThrow(
            "Unsupported output format: image/bmp",
        );
    });

    it("should convert animated GIF to WebP while preserving animation", async () => {
        // Create a simple animated GIF
        const inputBuffer = await sharp({
            create: {
                width: 100,
                height: 100,
                channels: 4,
                background: { r: 255, g: 0, b: 0, alpha: 1 },
            },
        })
            .gif()
            .toBuffer();

        const inputFile = new File([inputBuffer as BlobPart], "animated.gif", {
            type: "image/gif",
        });
        const result = await convertImage(inputFile, "image/webp");

        expect(result.type).toBe("image/webp");
        expect(result.name).toBe("animated.webp");

        const resultBuffer = await result.arrayBuffer();
        const metadata = await sharp(resultBuffer).metadata();
        expect(metadata.format).toBe("webp");
    });

    it("should handle files with spaces in the name", async () => {
        const inputBuffer = await sharp({
            create: {
                width: 100,
                height: 100,
                channels: 3,
                background: { r: 255, g: 0, b: 0 },
            },
        })
            .png()
            .toBuffer();

        const inputFile = new File(
            [inputBuffer as BlobPart],
            "test image with spaces.png",
            { type: "image/png" },
        );
        const result = await convertImage(inputFile, "image/webp");

        expect(result.type).toBe("image/webp");
        expect(result.name).toBe("test image with spaces.webp");
    });
});
