import confirm from "@inquirer/confirm";
import { Flags } from "@oclif/core";
import chalk from "chalk";
import { sql } from "drizzle-orm";
import ora from "ora";
import { Note } from "~/classes/database/note";
import { BaseCommand } from "~/cli/base";
import { Notes } from "~/drizzle/schema";

export default class NoteRecalculate extends BaseCommand<
    typeof NoteRecalculate
> {
    public static override description = "Recalculate all notes";

    public static override examples = ["<%= config.bin %> <%= command.id %>"];

    public static override flags = {
        confirm: Flags.boolean({
            description:
                "Ask for confirmation before the recalculation (default yes)",
            allowNo: true,
            default: true,
        }),
    };

    public async run(): Promise<void> {
        const { flags } = await this.parse(NoteRecalculate);

        const noteCount = await Note.getCount();

        if (flags.confirm) {
            const choice = await confirm({
                message: `Recalculate ${chalk.gray(noteCount)} notes? ${chalk.red(
                    "This might take a while.",
                )}`,
            });

            if (!choice) {
                this.log(chalk.bold(`${chalk.red("✗")} Aborted operation`));
                return this.exit(1);
            }
        }

        const spinner = ora("Recalculating notes").start();
        let done = false;
        let count = 0;
        const pageSize = 100;

        while (done === false) {
            spinner.text = `Fetching next ${chalk.gray(pageSize)} notes`;

            const notes = await Note.manyFromSql(
                sql`EXISTS (SELECT 1 FROM "Users" WHERE "Users"."id" = ${Notes.authorId} AND "Users"."instanceId" IS NULL)`,
                undefined,
                pageSize,
                count,
            );

            for (const note of notes) {
                spinner.text = `Recalculating note ${chalk.gray(
                    count,
                )}/${chalk.gray(noteCount)}`;

                await note.updateFromData({
                    author: note.author,
                    content: {
                        [note.data.contentType]: {
                            content: note.data.content,
                            remote: false,
                        },
                    },
                });

                count++;
            }

            if (notes.length < pageSize) {
                done = true;
            }
        }

        spinner.succeed("Recalculated all notes");

        this.exit(0);
    }
}
