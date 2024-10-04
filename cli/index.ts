import { configureLoggers } from "@/loggers";
import { execute } from "@oclif/core";
import EmojiAdd from "./commands/emoji/add.ts";
import EmojiDelete from "./commands/emoji/delete.ts";
import EmojiImport from "./commands/emoji/import.ts";
import EmojiList from "./commands/emoji/list.ts";
import FederationInstanceFetch from "./commands/federation/instance/fetch.ts";
import FederationUserFetch from "./commands/federation/user/fetch.ts";
import FederationUserFinger from "./commands/federation/user/finger.ts";
import IndexRebuild from "./commands/index/rebuild.ts";
import Start from "./commands/start.ts";
import UserCreate from "./commands/user/create.ts";
import UserDelete from "./commands/user/delete.ts";
import UserList from "./commands/user/list.ts";
import UserRefetch from "./commands/user/refetch.ts";
import UserReset from "./commands/user/reset.ts";

await configureLoggers();

// Use "explicit" oclif strategy to avoid issues with oclif's module resolver and bundling
export const commands = {
    "user:list": UserList,
    "user:delete": UserDelete,
    "user:create": UserCreate,
    "user:reset": UserReset,
    "user:refetch": UserRefetch,
    "emoji:add": EmojiAdd,
    "emoji:delete": EmojiDelete,
    "emoji:list": EmojiList,
    "emoji:import": EmojiImport,
    "index:rebuild": IndexRebuild,
    "federation:instance:fetch": FederationInstanceFetch,
    "federation:user:finger": FederationUserFinger,
    "federation:user:fetch": FederationUserFetch,
    start: Start,
};

if (import.meta.path === Bun.main) {
    await execute({ dir: import.meta.url });
}
