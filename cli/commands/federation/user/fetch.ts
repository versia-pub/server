import { parseUserAddress, userAddressValidator } from "@/api";
import { Args } from "@oclif/core";
import chalk from "chalk";
import ora from "ora";
import { Instance } from "~/classes/database/instance";
import { User } from "~/classes/database/user";
import { BaseCommand } from "~/cli/base";

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

        const manager = await User.getFederationRequester();

        const uri = await User.webFinger(manager, username, host);

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
