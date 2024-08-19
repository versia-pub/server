/**
 * @packageDocumentation
 * @module Tests/DiskMediaDriver
 */

import {
    type Mock,
    beforeEach,
    describe,
    expect,
    it,
    mock,
    spyOn,
} from "bun:test";
import * as fs from "node:fs/promises";
import * as path from "node:path";
import type { Config } from "~/packages/config-manager/config.type";
import type { MediaHasher } from "../media-hasher";
import { DiskMediaDriver } from "./disk";

describe("DiskMediaDriver", () => {
    let diskDriver: DiskMediaDriver;
    let mockConfig: Config;
    let mockMediaHasher: MediaHasher;
    let bunWriteSpy: Mock<typeof Bun.write>;

    beforeEach(() => {
        mockConfig = {
            media: {
                local_uploads_folder: "/test/uploads",
            },
        } as Config;

        mockMediaHasher = mock(() => ({
            getMediaHash: mock(() => Promise.resolve("testhash")),
        }))();

        diskDriver = new DiskMediaDriver(mockConfig);
        // @ts-expect-error: Replacing private property for testing
        diskDriver.mediaHasher = mockMediaHasher;

        // Mock fs.promises methods
        mock.module("node:fs/promises", () => ({
            writeFile: mock(() => Promise.resolve()),
            rm: mock(() => {
                return Promise.resolve();
            }),
        }));

        spyOn(Bun, "file").mockImplementation(
            mock(() => ({
                exists: mock(() => Promise.resolve(true)),
                arrayBuffer: mock(() => Promise.resolve(new ArrayBuffer(8))),
                type: "image/webp",
                lastModified: Date.now(),
            })) as unknown as typeof Bun.file,
        );

        bunWriteSpy = spyOn(Bun, "write").mockImplementation(
            mock(() => Promise.resolve(0)),
        );
    });

    it("should add a file", async () => {
        const file = new File(["test"], "test.webp", { type: "image/webp" });
        const result = await diskDriver.addFile(file);

        expect(mockMediaHasher.getMediaHash).toHaveBeenCalledWith(file);
        expect(bunWriteSpy).toHaveBeenCalledWith(
            path.join("/test/uploads", "testhash", "test.webp"),
            expect.any(ArrayBuffer),
        );
        expect(result).toEqual({
            uploadedFile: file,
            path: path.join("testhash", "test.webp"),
            hash: "testhash",
        });
    });

    it("should properly handle a Blob instead of a File", async () => {
        const file = new Blob(["test"], { type: "image/webp" });
        const result = await diskDriver.addFile(file as File);

        expect(mockMediaHasher.getMediaHash).toHaveBeenCalledWith(file);
        expect(bunWriteSpy).toHaveBeenCalledWith(
            expect.stringContaining("testhash"),
            expect.any(ArrayBuffer),
        );
        expect(result).toEqual({
            uploadedFile: expect.any(Blob),
            path: expect.stringContaining("testhash"),
            hash: "testhash",
        });
    });

    it("should get a file by hash", async () => {
        const hash = "testhash";
        const databaseHashFetcher = mock(() => Promise.resolve("test.webp"));
        const result = await diskDriver.getFileByHash(
            hash,
            databaseHashFetcher,
        );

        expect(databaseHashFetcher).toHaveBeenCalledWith(hash);
        expect(Bun.file).toHaveBeenCalledWith(
            path.join("/test/uploads", "test.webp"),
        );
        expect(result).toBeInstanceOf(File);
        expect(result?.name).toBe("test.webp");
        expect(result?.type).toBe("image/webp");
    });

    it("should get a file by filename", async () => {
        const filename = "test.webp";
        const result = await diskDriver.getFile(filename);

        expect(Bun.file).toHaveBeenCalledWith(
            path.join("/test/uploads", filename),
        );
        expect(result).toBeInstanceOf(File);
        expect(result?.name).toBe(filename);
        expect(result?.type).toBe("image/webp");
    });

    it("should delete a file by URL", async () => {
        const url = "http://localhost:3000/uploads/testhash/test.webp";
        await diskDriver.deleteFileByUrl(url);

        expect(fs.rm).toHaveBeenCalledWith(
            path.join("/test/uploads", "testhash"),
            { recursive: true },
        );
    });
});
