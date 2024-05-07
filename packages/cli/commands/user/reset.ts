import { Flags } from "@oclif/core";
import chalk from "chalk";
import { formatArray } from "~packages/cli/utils/format";
import confirm from "@inquirer/confirm";
import { renderUnicodeCompact } from "uqr";
import { UserFinderCommand } from "~packages/cli/classes";

export default class UserReset extends UserFinderCommand<typeof UserReset> {
    static override description = "Resets users' passwords";

    static override examples = [
        "<%= config.bin %> <%= command.id %> johngastron --type username",
        "<%= config.bin %> <%= command.id %> 018ec11c-c6cb-7a67-bd20-a4c81bf42912",
    ];

    static override flags = {
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

    static override args = {
        identifier: UserFinderCommand.baseArgs.identifier,
    };

    public async run(): Promise<void> {
        const { flags, args } = await this.parse(UserReset);

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

        const link = "https://example.com/reset-password";

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
                      "@testuser",
                  )}: ${chalk.underline(chalk.blue(link))}\n`,
        );

        const qrcode = renderUnicodeCompact(link, {
            border: 2,
        });

        // Pad all lines of QR code with spaces

        !flags.raw && this.log(`  ${qrcode.replaceAll("\n", "\n  ")}`);

        this.exit(0);
    }
}
