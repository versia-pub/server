import { Command } from "@oclif/core";

export abstract class BaseCommand<T extends typeof Command> extends Command {
    protected async init(): Promise<void> {
        await super.init();

        const { setupDatabase } = await import("~drizzle/db");
        const { consoleLogger } = await import("@loggers");

        (async () => {
            await setupDatabase(consoleLogger, false);
        })();
    }
}
