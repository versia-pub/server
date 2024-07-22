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

export default class FederationUserFetch extends BaseCommand<
    typeof FederationUserFetch
> {
    static override args = {
        address: Args.string({
            description: "Address of remote user (name@host.com)",
            required: true,
        }),
    };

    static override description = "Fetch remote users";

    static override examples = ["<%= config.bin %> <%= command.id %>"];

    static override flags = {};

    public async run(): Promise<void> {
        const { args } = await this.parse(FederationUserFetch);

        // Check if the address is valid
        if (!args.address.match(userAddressValidator)) {
            this.log(
                "Invalid address. Please check the address format and try again. For example: name@host.com",
            );

            this.exit(1);
        }

        const spinner = ora("Fetching user").start();

        const { username, domain: host } = parseUserAddress(args.address);

        // Check instance exists, if not, create it
        await Instance.resolve(`https://${host}`);

        const requester = await User.getServerActor();

        const signatureConstructor = await SignatureConstructor.fromStringKey(
            requester.data.privateKey ?? "",
            requester.getUri(),
        );
        const manager = new FederationRequester(
            new URL(`https://${host}`),
            signatureConstructor,
        );

        const uri = await User.webFinger(manager, username);

        const newUser = await User.resolve(uri);

        if (newUser) {
            spinner.succeed();
            this.log(chalk.green(`User found: ${newUser.getUri()}`));
        } else {
            spinner.fail();
            this.log(chalk.red("User not found"));
        }

        this.exit(0);
    }
}
