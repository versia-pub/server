// FILEPATH: /home/jessew/Dev/lysand/packages/media-manager/media-converter.test.ts
import { beforeEach, describe, expect, it } from "bun:test";
import { MediaConverter } from "../media-converter";

describe("MediaConverter", () => {
    let mediaConverter: MediaConverter;

    beforeEach(() => {
        mediaConverter = new MediaConverter();
    });

    it("should replace file name extension", () => {
        const fileName = "test.jpg";
        const expectedFileName = "test.png";
        // Written like this because it's a private function
        // @ts-ignore
        expect(mediaConverter.getReplacedFileName(fileName, "png")).toEqual(
            expectedFileName,
        );
    });

    describe("Filename extractor", () => {
        it("should extract filename from path", () => {
            const path = "path/to/test.jpg";
            const expectedFileName = "test.jpg";
            // @ts-ignore
            expect(mediaConverter.extractFilenameFromPath(path)).toEqual(
                expectedFileName,
            );
        });

        it("should handle escaped slashes", () => {
            const path = "path/to/test\\/test.jpg";
            const expectedFileName = "test\\/test.jpg";
            // @ts-ignore
            expect(mediaConverter.extractFilenameFromPath(path)).toEqual(
                expectedFileName,
            );
        });
    });

    it("should convert media", async () => {
        const file = Bun.file(`${__dirname}/megamind.jpg`);

        const convertedFile = await mediaConverter.convert(
            file as unknown as File,
            "image/png",
        );

        expect(convertedFile.name).toEqual("megamind.png");
        expect(convertedFile.type).toEqual("image/png");
    });
});
