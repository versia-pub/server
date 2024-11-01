import { User } from "@versia/kit/db";
import chalk from "chalk";
import { BaseCommand } from "~/cli/base";

export default class GenerateKeys extends BaseCommand<typeof GenerateKeys> {
    static override args = {};

    static override description = "Generates keys to use in Versia Server";

    static override flags = {};

    public async run(): Promise<void> {
        const { public_key, private_key } = await User.generateKeys();

        this.log(`Generated public key: ${chalk.gray(public_key)}`);
        this.log(`Generated private key: ${chalk.gray(private_key)}`);
    }
}
