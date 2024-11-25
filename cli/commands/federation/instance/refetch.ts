import { Args } from "@oclif/core";
import { Instance } from "@versia/kit/db";
import { Instances } from "@versia/kit/tables";
import { eq } from "drizzle-orm";
import ora from "ora";
import { BaseCommand } from "~/cli/base";
import { FetchJobType, fetchQueue } from "~/worker";

export default class FederationInstanceRefetch extends BaseCommand<
    typeof FederationInstanceRefetch
> {
    public static override args = {
        url: Args.string({
            description: "URL of the remote instance",
            required: true,
        }),
    };

    public static override description =
        "Refetches metadata from remote instances";

    public static override examples = ["<%= config.bin %> <%= command.id %>"];

    public static override flags = {};

    public async run(): Promise<void> {
        const { args } = await this.parse(FederationInstanceRefetch);

        const spinner = ora("Refetching instance metadata").start();

        const host = new URL(args.url).host;

        const instance = await Instance.fromSql(eq(Instances.baseUrl, host));

        if (!instance) {
            throw new Error("Instance not found");
        }

        await fetchQueue.add(FetchJobType.Instance, {
            uri: args.url,
        });

        spinner.succeed("Task added to queue");

        this.exit(0);
    }
}
