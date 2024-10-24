import input from "@inquirer/input";
import { Args, Flags } from "@oclif/core";
import chalk from "chalk";
import { eq } from "drizzle-orm";
import { renderUnicodeCompact } from "uqr";
import { User } from "~/classes/database/user";
import { BaseCommand } from "~/cli/base";
import { formatArray } from "~/cli/utils/format";
import { Users } from "~/drizzle/schema";

export default class UserCreate extends BaseCommand<typeof UserCreate> {
    static override args = {
        username: Args.string({
            description: "Username",
            required: true,
        }),
    };

    static override description = "Creates a new user";

    static override examples = [
        "<%= config.bin %> <%= command.id %> johngastron --email joe@gamer.com",
        "<%= config.bin %> <%= command.id %> bimbobaggins",
    ];

    static override flags = {
        format: Flags.string({
            char: "f",
            description:
                "Output format (when set, no password reset link is generated)",
            options: ["json", "csv"],
        }),
        admin: Flags.boolean({
            char: "a",
            description: "Admin user",
            allowNo: true,
            default: false,
        }),
        email: Flags.string({
            char: "e",
            description: "Email",
        }),
        "verify-email": Flags.boolean({
            description: "Send email verification",
            default: true,
            allowNo: true,
        }),
        "set-password": Flags.boolean({
            description: "Type password instead of getting a reset link",
            default: false,
            exclusive: ["format"],
        }),
    };

    public async run(): Promise<void> {
        const { flags, args } = await this.parse(UserCreate);

        // Check if user already exists
        const existingUser = await User.fromSql(
            eq(Users.username, args.username),
        );

        if (existingUser) {
            this.log(
                `${chalk.red("✗")} User ${chalk.red(
                    args.username,
                )} already exists`,
            );
            this.exit(1);
        }

        let password: string | null = null;

        if (flags["set-password"]) {
            const password1 = await input({
                message: "Please enter the user's password:",
                // Set whatever the user types to stars
                transformer: (value) => "*".repeat(value.length),
            });

            const password2 = await input({
                message: "Please confirm the user's password:",
                // Set whatever the user types to stars
                transformer: (value) => "*".repeat(value.length),
            });

            if (password1 !== password2) {
                this.log(
                    `${chalk.red(
                        "✗",
                    )} Passwords do not match. Please try again.`,
                );
                this.exit(1);
            }

            password = password1;
        }

        // TODO: Add password resets

        const user = await User.fromDataLocal({
            email: flags.email ?? undefined,
            password: password ?? undefined,
            username: args.username,
            admin: flags.admin,
            skipPasswordHash: !password,
        });

        if (!user) {
            this.log(
                `${chalk.red("✗")} Failed to create user ${chalk.red(
                    args.username,
                )}`,
            );
            this.exit(1);
        }

        !flags.format &&
            this.log(
                `${chalk.green("✓")} Created user ${chalk.green(
                    user.data.username,
                )} with id ${chalk.green(user.id)}`,
            );

        this.log(
            formatArray(
                [user.data],
                [
                    "id",
                    "username",
                    "displayName",
                    "createdAt",
                    "updatedAt",
                    "isAdmin",
                ],
                flags.format as "json" | "csv" | undefined,
            ),
        );

        if (!(flags.format || flags["set-password"])) {
            const link = "";

            this.log(
                flags.format
                    ? link
                    : `\nPassword reset link for ${chalk.bold(
                          `@${user.data.username}`,
                      )}: ${chalk.underline(chalk.blue(link))}\n`,
            );

            const qrcode = renderUnicodeCompact(link, {
                border: 2,
            });

            // Pad all lines of QR code with spaces

            this.log(`  ${qrcode.replaceAll("\n", "\n  ")}`);
        }

        this.exit(0);
    }
}
