import { Args } from "@oclif/core";
import { Attachment, Emoji } from "@versia/kit/db";
import { Emojis } from "@versia/kit/tables";
import chalk from "chalk";
import { and, eq, isNull } from "drizzle-orm";
import ora from "ora";
import { MediaManager } from "~/classes/media/media-manager";
import { BaseCommand } from "~/cli/base";
import { config } from "~/packages/config-manager";

export default class EmojiAdd extends BaseCommand<typeof EmojiAdd> {
    public static override args = {
        shortcode: Args.string({
            description: "Shortcode of the emoji",
            required: true,
        }),
        file: Args.string({
            description: "Path to the image file (can be an URL)",
            required: true,
        }),
    };

    public static override description = "Adds a new emoji";

    public static override examples = [
        "<%= config.bin %> <%= command.id %> baba_yassie ./emojis/baba_yassie.png",
        "<%= config.bin %> <%= command.id %> baba_yassie https://example.com/emojis/baba_yassie.png",
    ];

    public static override flags = {};

    public async run(): Promise<void> {
        const { args } = await this.parse(EmojiAdd);

        // Check if emoji already exists
        const existingEmoji = await Emoji.fromSql(
            and(
                eq(Emojis.shortcode, args.shortcode),
                isNull(Emojis.instanceId),
            ),
        );

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
                // @ts-expect-error Proxy is a Bun-specific feature
                proxy: config.http.proxy.address,
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

        const mediaManager = new MediaManager(config);

        const spinner = ora("Uploading emoji").start();

        const uploaded = await mediaManager.addFile(file).catch((e: Error) => {
            spinner.fail();
            this.log(`${chalk.red("✗")} Error: ${chalk.red(e.message)}`);
            return null;
        });

        if (!uploaded) {
            return this.exit(1);
        }

        spinner.succeed();

        await Emoji.insert({
            shortcode: args.shortcode,
            url: Attachment.getUrl(uploaded.path),
            visibleInPicker: true,
            contentType: uploaded.uploadedFile.type,
        });

        this.log(
            `${chalk.green("✓")} Created emoji ${chalk.green(
                args.shortcode,
            )} with url ${chalk.blue(
                chalk.underline(Attachment.getUrl(uploaded.path)),
            )}`,
        );

        this.exit(0);
    }
}
