import { Instance, User } from "@versia/kit/db";
import { Users } from "@versia/kit/tables";
import { and, eq, isNull } from "drizzle-orm";
import { parseUserAddress } from "@/api";

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
