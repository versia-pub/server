import { Command } from "@oclif/core";
import { setupDatabase } from "~drizzle/db";
import { consoleLogger } from "@loggers";

export abstract class BaseCommand<T extends typeof Command> extends Command {
    protected async init(): Promise<void> {
        await super.init();

        await setupDatabase(consoleLogger, false);
    }
}
