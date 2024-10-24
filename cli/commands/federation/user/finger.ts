import { parseUserAddress, userAddressValidator } from "@/api";
import { Args } from "@oclif/core";
import chalk from "chalk";
import ora from "ora";
import { Instance } from "~/classes/database/instance";
import { User } from "~/classes/database/user";
import { BaseCommand } from "~/cli/base";

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

        const manager = await User.getFederationRequester();

        const uri = await User.webFinger(manager, username, host);

        spinner.succeed("Fetched user URI");

        this.log(`URI: ${chalk.blueBright(uri)}`);

        this.exit(0);
    }
}
