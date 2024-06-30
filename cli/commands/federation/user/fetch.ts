import { SignatureConstructor } from "@lysand-org/federation";
import { FederationRequester } from "@lysand-org/federation/requester";
import { Args } from "@oclif/core";
import chalk from "chalk";
import ora from "ora";
import { BaseCommand } from "~/cli/base";
import { User } from "~/packages/database-interface/user";

export default class FederationUserFetch extends BaseCommand<
    typeof FederationUserFetch
> {
    static override args = {
        address: Args.string({
            description: "Address of remote user (name@host.com)",
            required: true,
        }),
    };

    static override description = "Fetch the URL of remote users via WebFinger";

    static override examples = ["<%= config.bin %> <%= command.id %>"];

    static override flags = {};

    public async run(): Promise<void> {
        const { args } = await this.parse(FederationUserFetch);

        const spinner = ora("Fetching user URI").start();

        const [username, host] = args.address.split("@");

        const requester = await User.getServerActor();

        const signatureConstructor = await SignatureConstructor.fromStringKey(
            requester.data.privateKey ?? "",
            requester.getUri(),
        );
        const manager = new FederationRequester(
            new URL(`https://${host}`),
            signatureConstructor,
        );

        const uri = await manager.webFinger(username);

        spinner.succeed("Fetched user URI");

        this.log(`URI: ${chalk.blueBright(uri)}`);

        this.exit(0);
    }
}
