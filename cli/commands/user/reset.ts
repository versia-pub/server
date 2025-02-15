import confirm from "@inquirer/confirm";
import { Flags } from "@oclif/core";
import chalk from "chalk";
import { renderUnicodeCompact } from "uqr";
import { UserFinderCommand } from "~/cli/classes";
import { formatArray } from "~/cli/utils/format";
import { config } from "~/config.ts";

export default class UserReset extends UserFinderCommand<typeof UserReset> {
    public static override description = "Resets users' passwords";

    public static override examples = [
        "<%= config.bin %> <%= command.id %> johngastron --type username",
        "<%= config.bin %> <%= command.id %> 018ec11c-c6cb-7a67-bd20-a4c81bf42912",
    ];

    public static override flags = {
        confirm: Flags.boolean({
            description:
                "Ask for confirmation before deleting the user (default yes)",
            allowNo: true,
            default: true,
        }),
        limit: Flags.integer({
            char: "n",
            description: "Limit the number of users",
            default: 1,
        }),
        raw: Flags.boolean({
            description:
                "Only output the password reset link (implies --no-print and --no-confirm)",
        }),
    };

    public static override args = {
        identifier: UserFinderCommand.baseArgs.identifier,
    };

    public async run(): Promise<void> {
        const { flags } = await this.parse(UserReset);

        const users = await this.findUsers();

        if (!users || users.length === 0) {
            this.log(chalk.bold(`${chalk.red("✗")} No users found`));
            this.exit(1);
        }

        // Display user
        !flags.raw &&
            this.log(
                chalk.bold(
                    `${chalk.green("✓")} Found ${chalk.green(
                        users.length,
                    )} user(s)`,
                ),
            );

        !flags.raw &&
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

        if (flags.confirm && !flags.raw) {
            const choice = await confirm({
                message: `Reset these users's passwords? ${chalk.red(
                    "This is irreversible.",
                )}`,
            });

            if (!choice) {
                this.log(chalk.bold(`${chalk.red("✗")} Aborted operation`));
                return this.exit(1);
            }
        }

        for (const user of users) {
            const token = await user.resetPassword();

            const link = new URL(
                `${config.frontend.routes.password_reset}?${new URLSearchParams(
                    {
                        token,
                    },
                ).toString()}`,
                config.http.base_url,
            ).toString();

            !flags.raw &&
                this.log(
                    `${chalk.green("✓")} Password reset for ${
                        users.length
                    } user(s)`,
                );

            this.log(
                flags.raw
                    ? link
                    : `\nPassword reset link for ${chalk.bold(
                          `@${user.data.username}`,
                      )}: ${chalk.underline(chalk.blue(link))}\n`,
            );

            const qrcode = renderUnicodeCompact(link, {
                border: 2,
            });

            // Pad all lines of QR code with spaces

            !flags.raw && this.log(`  ${qrcode.replaceAll("\n", "\n  ")}`);
        }

        this.exit(0);
    }
}
