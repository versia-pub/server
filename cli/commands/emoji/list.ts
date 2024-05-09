import { Flags } from "@oclif/core";
import { and, eq, getTableColumns, isNotNull, isNull } from "drizzle-orm";
import { BaseCommand } from "~cli/base";
import { formatArray } from "~cli/utils/format";
import { db } from "~drizzle/db";
import { Emojis, Instances } from "~drizzle/schema";

export default class EmojiList extends BaseCommand<typeof EmojiList> {
    static override args = {};

    static override description = "List all emojis";

    static override examples = [
        "<%= config.bin %> <%= command.id %> --format json --local",
        "<%= config.bin %> <%= command.id %>",
    ];

    static override flags = {
        format: Flags.string({
            char: "f",
            description: "Output format",
            options: ["json", "csv"],
        }),
        local: Flags.boolean({
            char: "l",
            description: "Local emojis only",
            exclusive: ["remote"],
        }),
        remote: Flags.boolean({
            char: "r",
            description: "Remote emojis only",
            exclusive: ["local"],
        }),
        limit: Flags.integer({
            char: "n",
            description: "Limit the number of emojis",
            default: 200,
        }),
    };

    public async run(): Promise<void> {
        const { flags } = await this.parse(EmojiList);

        const emojis = await db
            .select({
                ...getTableColumns(Emojis),
                instanceUrl: Instances.baseUrl,
            })
            .from(Emojis)
            .leftJoin(Instances, eq(Emojis.instanceId, Instances.id))
            .where(
                and(
                    flags.local ? isNull(Emojis.instanceId) : undefined,
                    flags.remote ? isNotNull(Emojis.instanceId) : undefined,
                ),
            );

        const keys = ["id", "shortcode", "alt", "contentType", "instanceUrl"];

        this.log(
            formatArray(
                emojis,
                keys,
                flags.format as "json" | "csv" | undefined,
            ),
        );

        this.exit(0);
    }
}
