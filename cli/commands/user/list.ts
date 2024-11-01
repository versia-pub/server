import { Flags } from "@oclif/core";
import { User } from "@versia/kit/db";
import { Users } from "@versia/kit/tables";
import { and, eq, isNotNull, isNull } from "drizzle-orm";
import { BaseCommand } from "~/cli/base";
import { formatArray } from "~/cli/utils/format";

export default class UserList extends BaseCommand<typeof UserList> {
    static override args = {};

    static override description = "List all users";

    static override examples = [
        "<%= config.bin %> <%= command.id %> --format json --local",
        "<%= config.bin %> <%= command.id %>",
    ];

    static override flags = {
        format: Flags.string({
            char: "f",
            description: "Output format",
            options: ["json", "csv"],
            exclusive: ["pretty-dates"],
        }),
        local: Flags.boolean({
            char: "l",
            description: "Local users only",
            exclusive: ["remote"],
        }),
        remote: Flags.boolean({
            char: "r",
            description: "Remote users only",
            exclusive: ["local"],
        }),
        limit: Flags.integer({
            char: "n",
            description: "Limit the number of users",
            default: 200,
        }),
        admin: Flags.boolean({
            char: "a",
            description: "Admin users only",
            allowNo: true,
        }),
        "pretty-dates": Flags.boolean({
            char: "p",
            description: "Pretty print dates",
        }),
    };

    public async run(): Promise<void> {
        const { flags } = await this.parse(UserList);

        const users = await User.manyFromSql(
            and(
                flags.local ? isNull(Users.instanceId) : undefined,
                flags.remote ? isNotNull(Users.instanceId) : undefined,
                flags.admin ? eq(Users.isAdmin, flags.admin) : undefined,
            ),
            undefined,
            flags.limit,
        );

        const keys = [
            "id",
            "username",
            "displayName",
            "createdAt",
            "updatedAt",
            "isAdmin",
        ];

        this.log(
            formatArray(
                users.map((u) => u.data),
                keys,
                flags.format as "json" | "csv" | undefined,
                flags["pretty-dates"],
            ),
        );

        this.exit(0);
    }
}
