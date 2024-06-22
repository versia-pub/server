import { describe, expect, it } from "bun:test";
import { z } from "zod";
import { Plugin, PluginConfigManager } from "../plugin";
import type { Manifest } from "../schema";

describe("Manifest parsing tests", () => {
    it("should parse a valid manifest", () => {
        const manifest: Manifest = {
            name: "plugin",
            version: "1.0.0",
            description: "A test plugin",
            authors: [
                {
                    name: "Author",
                    email: "bob@joe.com",
                    url: "https://example.com",
                },
            ],
            repository: {
                type: "git",
                url: "https://example.com",
            },
        };

        const plugin = new Plugin(
            manifest,
            new PluginConfigManager(z.string()),
        );

        expect(plugin.getManifest()).toEqual(manifest);
    });

    it("should throw an error for an invalid manifest", () => {
        const manifest = {
            name: "plugin",
            silly: "Manifest",
        };

        expect(
            () =>
                new Plugin(
                    manifest as unknown as Manifest,
                    new PluginConfigManager(z.string()),
                ),
        ).toThrowError(
            `Validation error: Required at "version"; Required at "description"`,
        );
    });
});
