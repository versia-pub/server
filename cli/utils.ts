import { Instance, User } from "@versia-server/kit/db";
import { parseUserAddress } from "@versia-server/kit/parsers";
import { Users } from "@versia-server/kit/tables";
import { and, eq, isNull } from "drizzle-orm";

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
