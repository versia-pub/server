import { parseUserAddress } from "@/api";
import { and, eq, isNull } from "drizzle-orm";
import { Instance } from "~/classes/database/instance";
import { User } from "~/classes/database/user";
import { Users } from "~/drizzle/schema";

export const retrieveUser = async (
    usernameOrHandle: string,
): Promise<User | null> => {
    const { username, domain } = parseUserAddress(usernameOrHandle);

    const instance = domain ? await Instance.resolveFromHost(domain) : null;

    const user = await User.fromSql(
        and(
            eq(Users.username, username),
            instance
                ? eq(Users.instanceId, instance.data.id)
                : isNull(Users.instanceId),
        ),
    );

    return user;
};
