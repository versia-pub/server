import os from "node:os";
import { Flags } from "@oclif/core";
import { BaseCommand } from "~/cli/base";

export default class Start extends BaseCommand<typeof Start> {
    static override args = {};

    static override description = "Starts Versia Server";

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

        // Resolves the path to the main module
        const resolved = import.meta.resolve("../../index");

        process.env.NUM_CPUS = String(numCpus);
        process.env.SILENT = flags.silent ? "true" : "false";

        await import(resolved);
    }
}
