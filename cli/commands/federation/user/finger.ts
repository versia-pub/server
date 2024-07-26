import { parseUserAddress, userAddressValidator } from "@/api";
import {
    FederationRequester,
    SignatureConstructor,
} from "@lysand-org/federation";
import { Args } from "@oclif/core";
import chalk from "chalk";
import ora from "ora";
import { BaseCommand } from "~/cli/base";
import { Instance } from "~/packages/database-interface/instance";
import { User } from "~/packages/database-interface/user";

export default class FederationUserFinger extends BaseCommand<
    typeof FederationUserFinger
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
        const { args } = await this.parse(FederationUserFinger);

        // Check if the address is valid
        if (!args.address.match(userAddressValidator)) {
            this.log(
                "Invalid address. Please check the address format and try again. For example: name@host.com",
            );

            this.exit(1);
        }

        const spinner = ora("Fetching user URI").start();

        const { username, domain: host } = parseUserAddress(args.address);

        // Check instance exists, if not, create it
        await Instance.resolve(`https://${host}`);

        const requester = await User.getServerActor();

        const signatureConstructor = await SignatureConstructor.fromStringKey(
            requester.data.privateKey ?? "",
            requester.getUri(),
        );
        const manager = new FederationRequester(signatureConstructor);

        const uri = await User.webFinger(manager, username, host);

        spinner.succeed("Fetched user URI");

        this.log(`URI: ${chalk.blueBright(uri)}`);

        this.exit(0);
    }
}
