import { Flags } from "@oclif/core";
import { db } from "@versia/kit/db";
import { Emojis, Instances, Users } from "@versia/kit/tables";
import { and, eq, getTableColumns, isNotNull, isNull } from "drizzle-orm";
import { BaseCommand } from "~/cli/base";
import { formatArray } from "~/cli/utils/format";

export default class EmojiList extends BaseCommand<typeof EmojiList> {
    public static override args = {};

    public static override description = "List all emojis";

    public static override examples = [
        "<%= config.bin %> <%= command.id %> --format json --local",
        "<%= config.bin %> <%= command.id %>",
    ];

    public static override flags = {
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
        username: Flags.string({
            char: "u",
            description: "Filter by username",
        }),
    };

    public async run(): Promise<void> {
        const { flags } = await this.parse(EmojiList);

        const emojis = await db
            .select({
                ...getTableColumns(Emojis),
                instanceUrl: Instances.baseUrl,
                owner: Users.username,
            })
            .from(Emojis)
            .leftJoin(Instances, eq(Emojis.instanceId, Instances.id))
            .leftJoin(Users, eq(Emojis.ownerId, Users.id))
            .where(
                and(
                    flags.local ? isNull(Emojis.instanceId) : undefined,
                    flags.remote ? isNotNull(Emojis.instanceId) : undefined,
                    flags.username
                        ? eq(Users.username, flags.username)
                        : undefined,
                ),
            );

        const keys = [
            "id",
            "shortcode",
            "alt",
            "contentType",
            "instanceUrl",
            "owner",
        ];

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
