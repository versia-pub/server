import { describe, expect, it } from "bun:test";
import { mockModule } from "@versia-server/tests";
import sharp from "sharp";
import { calculateBlurhash } from "./blurhash.ts";

describe("BlurhashPreprocessor", () => {
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

        const inputFile = new File([inputBuffer as BlobPart], "test.png", {
            type: "image/png",
        });
        const result = await calculateBlurhash(inputFile);

        expect(result).toBeTypeOf("string");
        expect(result).not.toBe("");
    });

    it("should return null blurhash for an invalid image", async () => {
        const invalidFile = new File(["invalid image data"], "invalid.png", {
            type: "image/png",
        });
        const result = await calculateBlurhash(invalidFile);

        expect(result).toBeNull();
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

        const inputFile = new File([inputBuffer as BlobPart], "test.png", {
            type: "image/png",
        });

        using __ = await mockModule("blurhash", () => ({
            encode: (): void => {
                throw new Error("Test error");
            },
        }));

        const result = await calculateBlurhash(inputFile);

        expect(result).toBeNull();
    });
});
