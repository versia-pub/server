import os from "node:os";
import { Flags } from "@oclif/core";
import { BaseCommand } from "~/cli/base";

export default class Start extends BaseCommand<typeof Start> {
    static override args = {};

    static override description = "Starts Lysand";

    static override examples = [
        "<%= config.bin %> <%= command.id %> --threads 4",
        "<%= config.bin %> <%= command.id %> --all-threads",
    ];

    static override flags = {
        threads: Flags.integer({
            char: "t",
            description: "Number of threads to use",
            default: 1,
            exclusive: ["all-threads"],
        }),
        "all-threads": Flags.boolean({
            description: "Use all available threads",
            default: false,
            exclusive: ["threads"],
        }),
        silent: Flags.boolean({
            description: "Don't show logs in console",
            default: false,
        }),
    };

    public async run(): Promise<void> {
        const { flags } = await this.parse(Start);

        const numCpus = flags["all-threads"] ? os.cpus().length : flags.threads;

        // Check if index is a JS or TS file (depending on the environment)
        const index = (await Bun.file("index.ts").exists())
            ? "index.ts"
            : "index.js";

        await import("../../setup");

        for (let i = 0; i < numCpus; i++) {
            new Worker(index, {
                type: "module",
            });
        }
    }
}
