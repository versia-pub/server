import { Args, Flags } from "@oclif/core";
import chalk from "chalk";
import { and, inArray, isNull } from "drizzle-orm";
import { lookup } from "mime-types";
import ora from "ora";
import { unzip } from "unzipit";
import { BaseCommand } from "~/cli/base";
import { getUrl } from "~/database/entities/Attachment";
import { db } from "~/drizzle/db";
import { Emojis } from "~/drizzle/schema";
import { config } from "~/packages/config-manager";
import { MediaBackend } from "~/packages/media-manager";

type MetaType = {
    emojis: {
        fileName: string;
        emoji: {
            name: string;
        };
    }[];
};

export default class EmojiImport extends BaseCommand<typeof EmojiImport> {
    static override args = {
        path: Args.string({
            description: "Path to the emoji archive (can be an URL)",
            required: true,
        }),
    };

    static override description =
        "Imports emojis from a zip file (which can be fetched from a zip URL, e.g. for Pleroma emoji packs)";

    static override examples = [
        "<%= config.bin %> <%= command.id %> https://volpeon.ink/emojis/neocat/neocat.zip",
        "<%= config.bin %> <%= command.id %> export.zip",
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
        const { args } = await this.parse(EmojiImport);

        // Check if path ends in .zip, warn the user if it doesn't
        if (!args.path.endsWith(".zip")) {
            this.log(
                `${chalk.yellow(
                    "⚠",
                )} The path you provided does not end in .zip, this may not be a zip file. Proceeding anyway.`,
            );
        }

        let file: File | null = null;

        if (URL.canParse(args.path)) {
            const spinner = ora(
                `Downloading pack from ${chalk.blue(
                    chalk.underline(args.path),
                )}`,
            ).start();

            const response = await fetch(args.path, {
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
                new URL(args.path).pathname.split("/").pop() ?? "archive";

            file = new File([await response.blob()], filename, {
                type:
                    response.headers.get("Content-Type") ??
                    "application/octet-stream",
            });

            spinner.succeed();
        } else {
            const bunFile = Bun.file(args.path);
            file = new File(
                [await bunFile.arrayBuffer()],
                args.path.split("/").pop() ?? "archive",
                {
                    type: bunFile.type,
                },
            );
        }

        const unzipSpinner = ora("Unzipping pack").start();

        const { entries: unzipped } = await unzip(file);

        unzipSpinner.succeed();

        const entries = Object.entries(unzipped);

        // Check if a meta.json file exists
        const metaExists = entries.find(([name]) => name === "meta.json");

        if (metaExists) {
            this.log(`${chalk.green("✓")} Detected Pleroma meta.json, parsing`);
        }

        const meta = metaExists
            ? ((await metaExists[1].json()) as MetaType)
            : ({
                  emojis: entries.map(([name]) => ({
                      fileName: name,
                      emoji: {
                          name: name.split(".")[0],
                      },
                  })),
              } as MetaType);

        // Get all emojis that already exist
        const existingEmojis = await db
            .select()
            .from(Emojis)
            .where(
                and(
                    isNull(Emojis.instanceId),
                    inArray(
                        Emojis.shortcode,
                        meta.emojis.map((e) => e.emoji.name),
                    ),
                ),
            );

        // Filter out existing emojis
        const newEmojis = meta.emojis.filter(
            (e) => !existingEmojis.find((ee) => ee.shortcode === e.emoji.name),
        );

        existingEmojis.length > 0 &&
            this.log(
                `${chalk.yellow("⚠")} Emojis with shortcode ${chalk.yellow(
                    existingEmojis.map((e) => e.shortcode).join(", "),
                )} already exist in the database and will not be imported`,
            );

        if (newEmojis.length === 0) {
            this.log(`${chalk.red("✗")} No new emojis to import`);
            this.exit(1);
        }

        this.log(
            `${chalk.green("✓")} Found ${chalk.green(
                newEmojis.length,
            )} new emoji(s)`,
        );

        const importSpinner = ora("Importing emojis").start();

        const media = await MediaBackend.fromBackendType(
            config.media.backend,
            config,
        );

        const successfullyImported: MetaType["emojis"] = [];

        for (const emoji of newEmojis) {
            importSpinner.text = `Uploading ${chalk.gray(emoji.emoji.name)} (${
                newEmojis.indexOf(emoji) + 1
            }/${newEmojis.length})`;
            const zipEntry = unzipped[emoji.fileName];

            if (!zipEntry) {
                this.log(
                    `${chalk.red(
                        "✗",
                    )} Could not find file for emoji ${chalk.red(
                        emoji.emoji.name,
                    )}`,
                );
                continue;
            }

            const fileName = emoji.fileName.split("/").pop() ?? "emoji";
            const contentType = lookup(fileName) || "application/octet-stream";

            const newFile = new File([await zipEntry.arrayBuffer()], fileName, {
                type: contentType,
            });

            const uploaded = await media.addFile(newFile).catch((e: Error) => {
                this.log(
                    `${chalk.red("✗")} Error uploading ${chalk.red(
                        emoji.emoji.name,
                    )}: ${chalk.red(e.message)}`,
                );
                return null;
            });

            if (!uploaded) {
                continue;
            }

            await db
                .insert(Emojis)
                .values({
                    shortcode: emoji.emoji.name,
                    url: getUrl(uploaded.path, config),
                    visibleInPicker: true,
                    contentType: uploaded.uploadedFile.type,
                })
                .execute();

            successfullyImported.push(emoji);
        }

        importSpinner.succeed("Imported emojis");

        successfullyImported.length > 0 &&
            this.log(
                `${chalk.green("✓")} Successfully imported ${chalk.green(
                    successfullyImported.length,
                )} emoji(s)`,
            );

        newEmojis.length - successfullyImported.length > 0 &&
            this.log(
                `${chalk.yellow("⚠")} Failed to import ${chalk.yellow(
                    newEmojis.length - successfullyImported.length,
                )} emoji(s): ${chalk.yellow(
                    newEmojis
                        .filter((e) => !successfullyImported.includes(e))
                        .map((e) => e.emoji.name)
                        .join(", "),
                )}`,
            );

        if (successfullyImported.length === 0) {
            this.exit(1);
        }

        this.exit(0);
    }
}
