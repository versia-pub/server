import { beforeEach, describe, expect, it, mock } from "bun:test";
import sharp from "sharp";
import { BlurhashPreprocessor } from "./blurhash.ts";

describe("BlurhashPreprocessor", () => {
    let preprocessor: BlurhashPreprocessor;

    beforeEach(() => {
        preprocessor = new BlurhashPreprocessor();
    });

    it("should calculate blurhash for a valid image", async () => {
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

        const inputFile = new File([inputBuffer], "test.png", {
            type: "image/png",
        });
        const result = await preprocessor.process(inputFile);

        expect(result.file).toBe(inputFile);
        expect(result.blurhash).toBeTypeOf("string");
        expect(result.blurhash).not.toBe("");
    });

    it("should return null blurhash for an invalid image", async () => {
        const invalidFile = new File(["invalid image data"], "invalid.png", {
            type: "image/png",
        });
        const result = await preprocessor.process(invalidFile);

        expect(result.file).toBe(invalidFile);
        expect(result.blurhash).toBeNull();
    });

    it("should handle errors during blurhash calculation", async () => {
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

        const inputFile = new File([inputBuffer], "test.png", {
            type: "image/png",
        });

        mock.module("blurhash", () => ({
            encode: (): void => {
                throw new Error("Test error");
            },
        }));

        const result = await preprocessor.process(inputFile);

        expect(result.file).toBe(inputFile);
        expect(result.blurhash).toBeNull();
    });
});
