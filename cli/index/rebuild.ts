import { config } from "@versia-server/config";
import { SonicIndexType, searchManager } from "@versia-server/kit/search";
// @ts-expect-error - Root import is required or the Clec type definitions won't work
// biome-ignore lint/correctness/noUnusedImports: Root import is required or the Clec type definitions won't work
import { defineCommand, type Root } from "clerc";
import ora from "ora";

export const rebuildIndexCommand = defineCommand(
    {
        name: "index rebuild",
        description: "Rebuild the search index.",
        parameters: ["<type>"],
        flags: {
            "batch-size": {
                description: "Number of records to process at once",
                type: Number,
                alias: "b",
                default: 100,
            },
        },
    },
    async (context) => {
        const { "batch-size": batchSize } = context.flags;
        const { type } = context.parameters;

        if (!config.search.enabled) {
            throw new Error(
                "Search is not enabled in the instance configuration.",
            );
        }

        const spinner = ora("Rebuilding search indexes").start();

        switch (type) {
            case "accounts":
                await searchManager.rebuildSearchIndexes(
                    [SonicIndexType.Accounts],
                    batchSize,
                    (progress) => {
                        spinner.text = `Rebuilding search indexes (${(progress * 100).toFixed(2)}%)`;
                    },
                );
                break;
            case "statuses":
                await searchManager.rebuildSearchIndexes(
                    [SonicIndexType.Statuses],
                    batchSize,
                    (progress) => {
                        spinner.text = `Rebuilding search indexes (${(progress * 100).toFixed(2)}%)`;
                    },
                );
                break;
            default: {
                throw new Error(
                    "Invalid index type. Can be 'accounts' or 'statuses'.",
                );
            }
        }

        spinner.succeed("Search indexes rebuilt");
    },
);
