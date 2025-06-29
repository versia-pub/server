import { completionsPlugin } from "@clerc/plugin-completions";
import { friendlyErrorPlugin } from "@clerc/plugin-friendly-error";
import { helpPlugin } from "@clerc/plugin-help";
import { notFoundPlugin } from "@clerc/plugin-not-found";
import { versionPlugin } from "@clerc/plugin-version";
import { setupDatabase } from "@versia-server/kit/db";
import { Clerc } from "clerc";
import { searchManager } from "~/classes/search/search-manager.ts";
import pkg from "../package.json" with { type: "json" };
import { rebuildIndexCommand } from "./index/rebuild.ts";
import { refetchInstanceCommand } from "./instance/refetch.ts";
import { createUserCommand } from "./user/create.ts";
import { deleteUserCommand } from "./user/delete.ts";
import { refetchUserCommand } from "./user/refetch.ts";
import { generateTokenCommand } from "./user/token.ts";

await setupDatabase(false);
await searchManager.connect(true);

Clerc.create()
    .scriptName("cli")
    .name("Versia Server CLI")
    .description("CLI interface for Versia Server")
    .version(pkg.version)
    .use(helpPlugin())
    .use(versionPlugin())
    .use(completionsPlugin())
    .use(notFoundPlugin())
    .use(friendlyErrorPlugin())
    .command(createUserCommand)
    .command(deleteUserCommand)
    .command(generateTokenCommand)
    .command(refetchUserCommand)
    .command(rebuildIndexCommand)
    .command(refetchInstanceCommand)
    .parse();
