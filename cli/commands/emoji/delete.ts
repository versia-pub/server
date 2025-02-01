import confirm from "@inquirer/confirm";
import { Flags } from "@oclif/core";
import chalk from "chalk";
import ora from "ora";
import { EmojiFinderCommand } from "~/cli/classes";
import { formatArray } from "~/cli/utils/format";

export default class EmojiDelete extends EmojiFinderCommand<
    typeof EmojiDelete
> {
    public static override args = {
        identifier: EmojiFinderCommand.baseArgs.identifier,
    };

    public static override description = "Deletes an emoji";

    public static override examples = [
        "<%= config.bin %> <%= command.id %> baba_yassie",
        '<%= config.bin %> <%= command.id %> "baba\\*" --pattern',
    ];

    public static override flags = {
        confirm: Flags.boolean({
            description:
                "Ask for confirmation before deleting the emoji (default yes)",
            allowNo: true,
            default: true,
        }),
    };

    public async run(): Promise<void> {
        const { flags } = await this.parse(EmojiDelete);

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
                formatArray(
                    emojis.map((e) => e.data),
                    ["id", "shortcode", "alt", "contentType", "instanceUrl"],
                ),
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

        for (const emoji of emojis) {
            spinner.text = `Deleting emoji ${chalk.gray(emoji.data.shortcode)} (${
                emojis.findIndex((e) => e.id === emoji.id) + 1
            }/${emojis.length})`;

            await emoji.delete();
        }

        spinner.succeed("Emoji(s) deleted");

        this.exit(0);
    }
}
