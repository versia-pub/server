import { Args, Flags } from "@oclif/core";
import chalk from "chalk";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { EmojiFinderCommand } from "~cli/classes";
import { formatArray } from "~cli/utils/format";
import { db } from "~drizzle/db";
import { Emojis } from "~drizzle/schema";
import confirm from "@inquirer/confirm";
import ora from "ora";

export default class EmojiDelete extends EmojiFinderCommand<
    typeof EmojiDelete
> {
    static override args = {
        identifier: EmojiFinderCommand.baseArgs.identifier,
    };

    static override description = "Deletes an emoji";

    static override examples = [
        "<%= config.bin %> <%= command.id %> baba_yassie",
        '<%= config.bin %> <%= command.id %> "baba\\*" --pattern',
    ];

    static override flags = {
        confirm: Flags.boolean({
            description:
                "Ask for confirmation before deleting the emoji (default yes)",
            allowNo: true,
            default: true,
        }),
    };

    public async run(): Promise<void> {
        const { flags, args } = await this.parse(EmojiDelete);

        const emojis = await this.findEmojis();

        if (!emojis || emojis.length === 0) {
            this.log(chalk.bold(`${chalk.red("✗")} No emojis found`));
            this.exit(1);
        }

        // Display user
        flags.print &&
            this.log(
                chalk.bold(
                    `${chalk.green("✓")} Found ${chalk.green(
                        emojis.length,
                    )} emoji(s)`,
                ),
            );

        flags.print &&
            this.log(
                formatArray(emojis, [
                    "id",
                    "shortcode",
                    "alt",
                    "contentType",
                    "instanceUrl",
                ]),
            );

        if (flags.confirm) {
            const choice = await confirm({
                message: `Are you sure you want to delete these emojis? ${chalk.red(
                    "This is irreversible.",
                )}`,
            });

            if (!choice) {
                this.log(chalk.bold(`${chalk.red("✗")} Aborted operation`));
                return this.exit(1);
            }
        }

        const spinner = ora("Deleting emoji(s)").start();

        await db.delete(Emojis).where(
            inArray(
                Emojis.id,
                emojis.map((e) => e.id),
            ),
        );

        spinner.succeed();

        this.log(chalk.bold(`${chalk.green("✓")} Emoji(s) deleted`));

        this.exit(0);
    }
}