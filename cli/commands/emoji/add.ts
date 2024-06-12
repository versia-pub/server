import { Args } from "@oclif/core";
import chalk from "chalk";
import ora from "ora";
import { BaseCommand } from "~/cli/base";
import { getUrl } from "~/database/entities/Attachment";
import { db } from "~/drizzle/db";
import { Emojis } from "~/drizzle/schema";
import { config } from "~/packages/config-manager";
import { MediaBackend } from "~/packages/media-manager";

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

    static override examples = [
        "<%= config.bin %> <%= command.id %> baba_yassie ./emojis/baba_yassie.png",
        "<%= config.bin %> <%= command.id %> baba_yassie https://example.com/emojis/baba_yassie.png",
    ];

    static override flags = {};

    public async run(): Promise<void> {
        const { args } = await this.parse(EmojiAdd);

        // Check if emoji already exists
        const existingEmoji = await db.query.Emojis.findFirst({
            where: (Emojis, { eq, and, isNull }) =>
                and(
                    eq(Emojis.shortcode, args.shortcode),
                    isNull(Emojis.instanceId),
                ),
        });

        if (existingEmoji) {
            this.log(
                `${chalk.red("✗")} Emoji with shortcode ${chalk.red(
                    args.shortcode,
                )} already exists`,
            );
            this.exit(1);
        }

        let file: File | null = null;

        if (URL.canParse(args.file)) {
            const spinner = ora(
                `Downloading emoji from ${chalk.blue(
                    chalk.underline(args.file),
                )}`,
            ).start();

            const response = await fetch(args.file, {
                headers: {
                    "Accept-Encoding": "identity",
                },
            });

            if (!response.ok) {
                spinner.fail();
                this.log(
                    `${chalk.red("✗")} Request returned status code ${chalk.red(
                        response.status,
                    )}`,
                );
                this.exit(1);
            }

            const filename =
                new URL(args.file).pathname.split("/").pop() ?? "emoji";

            file = new File([await response.blob()], filename, {
                type:
                    response.headers.get("Content-Type") ??
                    "application/octet-stream",
            });

            spinner.succeed();
        } else {
            const bunFile = Bun.file(args.file);
            file = new File(
                [await bunFile.arrayBuffer()],
                args.file.split("/").pop() ?? "emoji",
                {
                    type: bunFile.type,
                },
            );
        }

        const media = await MediaBackend.fromBackendType(
            config.media.backend,
            config,
        );

        const spinner = ora("Uploading emoji").start();

        const uploaded = await media.addFile(file).catch((e: Error) => {
            spinner.fail();
            this.log(`${chalk.red("✗")} Error: ${chalk.red(e.message)}`);
            return null;
        });

        if (!uploaded) {
            return this.exit(1);
        }

        spinner.succeed();

        const emoji = await db
            .insert(Emojis)
            .values({
                shortcode: args.shortcode,
                url: getUrl(uploaded.path, config),
                visibleInPicker: true,
                contentType: uploaded.uploadedFile.type,
            })
            .returning();

        if (!emoji || emoji.length === 0) {
            this.log(
                `${chalk.red("✗")} Failed to create emoji ${chalk.red(
                    args.shortcode,
                )}`,
            );
            this.exit(1);
        }

        this.log(
            `${chalk.green("✓")} Created emoji ${chalk.green(
                args.shortcode,
            )} with url ${chalk.blue(
                chalk.underline(getUrl(uploaded.path, config)),
            )}`,
        );

        this.exit(0);
    }
}
