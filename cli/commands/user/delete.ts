import confirm from "@inquirer/confirm";
import { Flags } from "@oclif/core";
import chalk from "chalk";
import ora from "ora";
import { UserFinderCommand } from "~/cli/classes";
import { formatArray } from "~/cli/utils/format";

export default class UserDelete extends UserFinderCommand<typeof UserDelete> {
    static override description = "Deletes users";

    static override examples = [
        "<%= config.bin %> <%= command.id %> johngastron --type username",
        "<%= config.bin %> <%= command.id %> 018ec11c-c6cb-7a67-bd20-a4c81bf42912",
        '<%= config.bin %> <%= command.id %> "*badword*" --pattern --type username',
    ];

    static override flags = {
        confirm: Flags.boolean({
            description:
                "Ask for confirmation before deleting the user (default yes)",
            allowNo: true,
            default: true,
        }),
    };

    static override args = {
        identifier: UserFinderCommand.baseArgs.identifier,
    };

    public async run(): Promise<void> {
        const { flags, args } = await this.parse(UserDelete);

        const users = await this.findUsers();

        if (!users || users.length === 0) {
            this.log(chalk.bold(`${chalk.red("✗")} No users found`));
            this.exit(1);
        }

        // Display user
        flags.print &&
            this.log(
                chalk.bold(
                    `${chalk.green("✓")} Found ${chalk.green(
                        users.length,
                    )} user(s)`,
                ),
            );

        flags.print &&
            this.log(
                formatArray(
                    users.map((u) => u.getUser()),
                    [
                        "id",
                        "username",
                        "displayName",
                        "createdAt",
                        "updatedAt",
                        "isAdmin",
                    ],
                ),
            );

        if (flags.confirm) {
            const choice = await confirm({
                message: `Are you sure you want to delete these users? ${chalk.red(
                    "This is irreversible.",
                )}`,
            });

            if (!choice) {
                this.log(chalk.bold(`${chalk.red("✗")} Aborted operation`));
                return this.exit(1);
            }
        }

        const spinner = ora("Deleting user(s)").start();

        for (const user of users) {
            await user.delete();
        }

        spinner.succeed();

        this.log(chalk.bold(`${chalk.green("✓")} User(s) deleted`));

        this.exit(0);
    }
}
