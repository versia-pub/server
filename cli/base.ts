import { Command } from "@oclif/core";
import { setupDatabase } from "~/drizzle/db";

export abstract class BaseCommand<_T extends typeof Command> extends Command {
    protected async init(): Promise<void> {
        await super.init();

        await setupDatabase(false);
    }
}
