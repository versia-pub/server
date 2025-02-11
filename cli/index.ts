import { configureLoggers } from "@/loggers";
import { execute } from "@oclif/core";
import Start from "./commands/start.ts";

await configureLoggers();

// Use "explicit" oclif strategy to avoid issues with oclif's module resolver and bundling
export const commands = {
    "user:list": (await import("./commands/user/list.ts")).default,
    "user:delete": (await import("./commands/user/delete.ts")).default,
    "user:create": (await import("./commands/user/create.ts")).default,
    "user:reset": (await import("./commands/user/reset.ts")).default,
    "user:refetch": (await import("./commands/user/refetch.ts")).default,
    "emoji:add": (await import("./commands/emoji/add.ts")).default,
    "emoji:delete": (await import("./commands/emoji/delete.ts")).default,
    "emoji:list": (await import("./commands/emoji/list.ts")).default,
    "emoji:import": (await import("./commands/emoji/import.ts")).default,
    "index:rebuild": (await import("./commands/index/rebuild.ts")).default,
    "federation:instance:refetch": (
        await import("./commands/federation/instance/refetch.ts")
    ).default,
    "federation:user:finger": (
        await import("./commands/federation/user/finger.ts")
    ).default,
    "federation:user:fetch": (
        await import("./commands/federation/user/fetch.ts")
    ).default,
    "generate-keys": (await import("./commands/generate-keys.ts")).default,
    start: Start,
    "notes:recalculate": (await import("./commands/notes/recalculate.ts"))
        .default,
};

if (import.meta.path === Bun.main) {
    await execute({ dir: import.meta.url });
}
