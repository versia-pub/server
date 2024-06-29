import { Args, Flags } from "@oclif/core";
import ora from "ora";
import { SonicIndexType, searchManager } from "~/classes/search/search-manager";
import { BaseCommand } from "~/cli/base";
import { config } from "~/packages/config-manager";

export default class IndexRebuild extends BaseCommand<typeof IndexRebuild> {
    static override args = {
        type: Args.string({
            description: "Index category to rebuild",
            options: ["accounts", "statuses"],
            required: true,
        }),
    };

    static override description = "Rebuild search indexes";

    static override examples = ["<%= config.bin %> <%= command.id %>"];

    static override flags = {
        "batch-size": Flags.integer({
            char: "b",
            description: "Number of items to process in each batch",
            default: 100,
        }),
    };

    public async run(): Promise<void> {
        const { flags, args } = await this.parse(IndexRebuild);

        if (!config.sonic.enabled) {
            this.error("Sonic search is disabled");
            this.exit(1);
        }

        await searchManager.connect();

        const spinner = ora("Rebuilding search indexes").start();

        switch (args.type) {
            case "accounts":
                await searchManager.rebuildSearchIndexes(
                    [SonicIndexType.Accounts],
                    flags["batch-size"],
                    (progress) => {
                        spinner.text = `Rebuilding search indexes (${(progress * 100).toFixed(2)}%)`;
                    },
                );
                break;
            case "statuses":
                await searchManager.rebuildSearchIndexes(
                    [SonicIndexType.Statuses],
                    flags["batch-size"],
                    (progress) => {
                        spinner.text = `Rebuilding search indexes (${(progress * 100).toFixed(2)}%)`;
                    },
                );
                break;
            default: {
                this.error("Invalid index type");
            }
        }

        spinner.succeed("Search indexes rebuilt");

        this.exit(0);
    }
}
