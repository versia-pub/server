import { randomString } from "@/math";
import { Flags } from "@oclif/core";
import chalk from "chalk";
import ora from "ora";
import { Token } from "~/classes/database/token";
import { UserFinderCommand } from "~/cli/classes";
import { formatArray } from "~/cli/utils/format";

export default class UserToken extends UserFinderCommand<typeof UserToken> {
    public static override description = "Generates access tokens for users";

    public static override examples = [
        "<%= config.bin %> <%= command.id %> johngastron --type username",
        "<%= config.bin %> <%= command.id %> 018ec11c-c6cb-7a67-bd20-a4c81bf42912",
        '<%= config.bin %> <%= command.id %> "*badword*" --pattern --type username',
    ];

    public static override flags = {
        format: Flags.string({
            char: "f",
            description: "Output format",
            options: ["json", "csv"],
            exclusive: ["pretty-dates"],
        }),
        limit: Flags.integer({
            char: "n",
            description: "Limit the number of users",
            default: 200,
        }),
    };

    public static override args = {
        identifier: UserFinderCommand.baseArgs.identifier,
    };

    public async run(): Promise<void> {
        const { flags } = await this.parse(UserToken);

        const foundUsers = await this.findUsers();
        const users = foundUsers.filter((u) => u.isLocal());

        if (!users || users.length === 0) {
            this.log(chalk.bold(`${chalk.red("✗")} No users found`));

            if (foundUsers.length > 0) {
                this.log(
                    chalk.bold(
                        `${chalk.yellow("✗")} Found ${chalk.yellow(
                            foundUsers.length,
                        )} user(s) but none are local`,
                    ),
                );
            }

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
                    users.map((u) => u.data),
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

        const spinner = ora("Generating access tokens").start();
        const tokens = await Promise.all(
            users.map(
                async (u) =>
                    await Token.insert({
                        accessToken: randomString(64, "base64url"),
                        code: null,
                        scope: "read write follow",
                        tokenType: "Bearer",
                        userId: u.id,
                    }),
            ),
        );

        spinner.succeed();

        this.log(chalk.bold(`${chalk.green("✓")} Tokens generated`));

        this.log(
            formatArray(
                tokens.map((t) => t.data),
                ["accessToken", "userId"],
                flags.format as "json" | "csv" | undefined,
            ),
        );

        this.exit(0);
    }
}
