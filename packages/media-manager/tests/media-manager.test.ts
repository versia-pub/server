// FILEPATH: /home/jessew/Dev/lysand/packages/media-manager/media-converter.test.ts
import { beforeEach, describe, expect, it } from "bun:test";
import { ConvertableMediaFormats, MediaConverter } from "../media-converter";

describe("MediaConverter", () => {
    let mediaConverter: MediaConverter;

    beforeEach(() => {
        mediaConverter = new MediaConverter(
            ConvertableMediaFormats.JPG,
            ConvertableMediaFormats.PNG,
        );
    });

    it("should initialize with correct formats", () => {
        expect(mediaConverter.fromFormat).toEqual(ConvertableMediaFormats.JPG);
        expect(mediaConverter.toFormat).toEqual(ConvertableMediaFormats.PNG);
    });

    it("should check if media is convertable", () => {
        expect(mediaConverter.isConvertable()).toBe(true);
        mediaConverter.toFormat = ConvertableMediaFormats.JPG;
        expect(mediaConverter.isConvertable()).toBe(false);
    });

    it("should replace file name extension", () => {
        const fileName = "test.jpg";
        const expectedFileName = "test.png";
        // Written like this because it's a private function
        expect(mediaConverter.getReplacedFileName(fileName)).toEqual(
            expectedFileName,
        );
    });

    describe("Filename extractor", () => {
        it("should extract filename from path", () => {
            const path = "path/to/test.jpg";
            const expectedFileName = "test.jpg";
            expect(mediaConverter.extractFilenameFromPath(path)).toEqual(
                expectedFileName,
            );
        });

        it("should handle escaped slashes", () => {
            const path = "path/to/test\\/test.jpg";
            const expectedFileName = "test\\/test.jpg";
            expect(mediaConverter.extractFilenameFromPath(path)).toEqual(
                expectedFileName,
            );
        });
    });

    it("should convert media", async () => {
        const file = Bun.file(`${__dirname}/megamind.jpg`);

        const convertedFile = await mediaConverter.convert(
            file as unknown as File,
        );

        expect(convertedFile.name).toEqual("megamind.png");
        expect(convertedFile.type).toEqual(
            `image/${ConvertableMediaFormats.PNG}`,
        );
    });
});
