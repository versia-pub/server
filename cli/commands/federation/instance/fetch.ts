import { Args } from "@oclif/core";
import ora from "ora";
import { BaseCommand } from "~/cli/base";
import { formatArray } from "~/cli/utils/format";
import { Instance } from "~/packages/database-interface/instance";

export default class FederationInstanceFetch extends BaseCommand<
    typeof FederationInstanceFetch
> {
    static override args = {
        url: Args.string({
            description: "URL of the remote instance",
            required: true,
        }),
    };

    static override description = "Fetch metadata from remote instances";

    static override examples = ["<%= config.bin %> <%= command.id %>"];

    static override flags = {};

    public async run(): Promise<void> {
        const { args } = await this.parse(FederationInstanceFetch);

        const spinner = ora("Fetching instance metadata").start();

        const data = await Instance.fetchMetadata(args.url);

        if (!data) {
            spinner.fail("Failed to fetch instance metadata");
            this.exit(1);
        }

        spinner.succeed("Fetched instance metadata");

        const { metadata, protocol } = data;

        this.log(
            formatArray(
                [{ ...metadata, protocol }],
                ["name", "description", "version", "protocol"],
            ),
        );

        this.exit(0);
    }
}
