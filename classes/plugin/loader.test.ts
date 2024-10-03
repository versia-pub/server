import {
    afterEach,
    beforeEach,
    describe,
    expect,
    jest,
    mock,
    test,
} from "bun:test";
import { ZodError, type ZodTypeAny, z } from "zod";
import { Plugin } from "~/packages/plugin-kit";
import { type Manifest, manifestSchema } from "~/packages/plugin-kit/schema";
import { PluginLoader } from "./loader";

const mockReaddir = jest.fn();
const mockGetLogger = jest.fn(() => ({
    fatal: jest.fn(),
}));
const mockParseJSON5 = jest.fn();
const mockParseJSONC = jest.fn();
const mockFromZodError = jest.fn();

mock.module("node:fs/promises", () => ({
    readdir: mockReaddir,
}));

mock.module("@logtape/logtape", () => ({
    getLogger: mockGetLogger,
}));

mock.module("confbox", () => ({
    parseJSON5: mockParseJSON5,
    parseJSONC: mockParseJSONC,
}));

mock.module("zod-validation-error", () => ({
    fromZodError: mockFromZodError,
}));

describe("PluginLoader", () => {
    let pluginLoader: PluginLoader;

    beforeEach(() => {
        pluginLoader = new PluginLoader();
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    test("getDirectories should return directories", async () => {
        mockReaddir.mockResolvedValue([
            { name: "dir1", isDirectory: () => true },
            { name: "file1", isDirectory: () => false },
            { name: "dir2", isDirectory: () => true },
        ]);

        // biome-ignore lint/complexity/useLiteralKeys: Private method
        const directories = await PluginLoader["getDirectories"]("/some/path");
        expect(directories).toEqual(["dir1", "dir2"]);
    });

    test("findManifestFile should return manifest file if found", async () => {
        mockReaddir.mockResolvedValue(["manifest.json", "otherfile.txt"]);

        const manifestFile =
            // biome-ignore lint/complexity/useLiteralKeys: Private method
            await PluginLoader["findManifestFile"]("/some/path");
        expect(manifestFile).toBe("manifest.json");
    });

    test("hasEntrypoint should return true if entrypoint file is found", async () => {
        mockReaddir.mockResolvedValue(["index.ts", "otherfile.txt"]);

        // biome-ignore lint/complexity/useLiteralKeys: Private method
        const hasEntrypoint = await PluginLoader["hasEntrypoint"]("/some/path");
        expect(hasEntrypoint).toBe(true);
    });

    test("parseManifestFile should parse JSON manifest", async () => {
        const manifestContent = { name: "test-plugin" };
        Bun.file = jest.fn().mockReturnValue({
            text: () => Promise.resolve(JSON.stringify(manifestContent)),
        });

        // biome-ignore lint/complexity/useLiteralKeys: Private method
        const manifest = await pluginLoader["parseManifestFile"](
            "/some/path/manifest.json",
            "manifest.json",
        );
        expect(manifest).toEqual(manifestContent);
    });

    test("findPlugins should return plugin directories with valid manifest and entrypoint", async () => {
        mockReaddir
            .mockResolvedValueOnce([
                { name: "plugin1", isDirectory: () => true },
                { name: "plugin2", isDirectory: () => true },
            ])
            .mockResolvedValue(["manifest.json", "index.ts"]);

        const plugins = await pluginLoader.findPlugins("/some/path");
        expect(plugins).toEqual(["plugin1", "plugin2"]);
    });

    test("parseManifest should parse and validate manifest", async () => {
        const manifestContent: Manifest = {
            name: "test-plugin",
            version: "1.1.0",
            description: "Doobaee",
        };
        mockReaddir.mockResolvedValue(["manifest.json"]);
        Bun.file = jest.fn().mockReturnValue({
            text: () => Promise.resolve(JSON.stringify(manifestContent)),
        });
        manifestSchema.safeParseAsync = jest.fn().mockResolvedValue({
            success: true,
            data: manifestContent,
        });

        const manifest = await pluginLoader.parseManifest(
            "/some/path",
            "plugin1",
        );
        expect(manifest).toEqual(manifestContent);
    });

    test("parseManifest should throw error if manifest is missing", async () => {
        mockReaddir.mockResolvedValue([]);

        await expect(
            pluginLoader.parseManifest("/some/path", "plugin1"),
        ).rejects.toThrow("Plugin plugin1 is missing a manifest file");
    });

    test("parseManifest should throw error if manifest is invalid", async () => {
        // @ts-expect-error trying to cause a type error here
        const manifestContent: Manifest = {
            name: "test-plugin",
            version: "1.1.0",
        };
        mockReaddir.mockResolvedValue(["manifest.json"]);
        Bun.file = jest.fn().mockReturnValue({
            text: () => Promise.resolve(JSON.stringify(manifestContent)),
        });
        manifestSchema.safeParseAsync = jest.fn().mockResolvedValue({
            success: false,
            error: new ZodError([]),
        });

        await expect(
            pluginLoader.parseManifest("/some/path", "plugin1"),
        ).rejects.toThrow();
    });

    test("loadPlugin should load and return a Plugin instance", async () => {
        const mockPlugin = new Plugin(z.object({}));
        mock.module("/some/path/index.ts", () => ({
            default: mockPlugin,
        }));

        const plugin = await pluginLoader.loadPlugin("/some/path", "index.ts");
        expect(plugin).toBeInstanceOf(Plugin);
    });

    test("loadPlugin should throw error if default export is not a Plugin", async () => {
        mock.module("/some/path/index.ts", () => ({
            default: "cheese",
        }));

        await expect(
            pluginLoader.loadPlugin("/some/path", "index.ts"),
        ).rejects.toThrow("Entrypoint is not a Plugin");
    });

    test("loadPlugins should load all plugins in a directory", async () => {
        const manifestContent: Manifest = {
            name: "test-plugin",
            version: "1.1.0",
            description: "Doobaee",
        };
        const mockPlugin = new Plugin(z.object({}));

        mockReaddir
            .mockResolvedValueOnce([
                { name: "plugin1", isDirectory: () => true },
                { name: "plugin2", isDirectory: () => true },
            ])
            .mockResolvedValue(["manifest.json", "index.ts"]);
        Bun.file = jest.fn().mockReturnValue({
            text: () => Promise.resolve(JSON.stringify(manifestContent)),
        });
        manifestSchema.safeParseAsync = jest.fn().mockResolvedValue({
            success: true,
            data: manifestContent,
        });
        mock.module("/some/path/plugin1/index", () => ({
            default: mockPlugin,
        }));
        mock.module("/some/path/plugin2/index", () => ({
            default: mockPlugin,
        }));

        const plugins = await pluginLoader.loadPlugins("/some/path");
        expect(plugins).toEqual([
            {
                manifest: manifestContent,
                plugin: mockPlugin as unknown as Plugin<ZodTypeAny>,
            },
            {
                manifest: manifestContent,
                plugin: mockPlugin as unknown as Plugin<ZodTypeAny>,
            },
        ]);
    });
});
