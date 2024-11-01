import { Args } from "@oclif/core";
import { Instance } from "@versia/kit/db";
import ora from "ora";
import { BaseCommand } from "~/cli/base";
import { formatArray } from "~/cli/utils/format";

export default class FederationInstanceFetch extends BaseCommand<
    typeof FederationInstanceFetch
> {
    public static override args = {
        url: Args.string({
            description: "URL of the remote instance",
            required: true,
        }),
    };

    public static override description = "Fetch metadata from remote instances";

    public static override examples = ["<%= config.bin %> <%= command.id %>"];

    public static override flags = {};

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
