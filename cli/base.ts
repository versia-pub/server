import { Command } from "@oclif/core";
import { searchManager } from "~/classes/search/search-manager";
import { setupDatabase } from "~/drizzle/db";

export abstract class BaseCommand<_T extends typeof Command> extends Command {
    protected async init(): Promise<void> {
        await super.init();

        await setupDatabase(false);
        await searchManager.connect(true);
    }
}
