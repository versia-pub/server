import { Args } from "@oclif/core";
import chalk from "chalk";
import { BaseCommand } from "~/cli/base";
import { db } from "~drizzle/db";

export default class EmojiAdd extends BaseCommand<typeof EmojiAdd> {
    static override args = {
        shortcode: Args.string({
            description: "Shortcode of the emoji",
            required: true,
        }),
        file: Args.string({
            description: "Path to the image file (can be an URL)",
            required: true,
        }),
    };

    static override description = "Adds a new emoji";

    static override examples = ["<%= config.bin %> <%= command.id %>"];

    static override flags = {};

    public async run(): Promise<void> {
        const { flags, args } = await this.parse(EmojiAdd);

        // Check if emoji already exists
        const existingEmoji = await db.query.Emojis.findFirst({
            where: (Emojis, { eq }) => eq(Emojis.shortcode, args.shortcode),
        });

        if (existingEmoji) {
            this.log(
                `${chalk.red("✗")} Emoji with shortcode ${chalk.red(
                    args.shortcode,
                )} already exists`,
            );
            this.exit(1);
        }

        /* if (!user) {
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
                    user.getUser().username,
                )} with id ${chalk.green(user.id)}`,
            );

        this.log(
            formatArray(
                [user.getUser()],
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

        if (!flags.format && !flags["set-password"]) {
            const link = "";

            this.log(
                flags.format
                    ? link
                    : `\nPassword reset link for ${chalk.bold(
                          `@${user.getUser().username}`,
                      )}: ${chalk.underline(chalk.blue(link))}\n`,
            );

            const qrcode = renderUnicodeCompact(link, {
                border: 2,
            });

            // Pad all lines of QR code with spaces

            this.log(`  ${qrcode.replaceAll("\n", "\n  ")}`);
        } */

        this.exit(0);
    }
}
