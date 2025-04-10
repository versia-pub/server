import chalk from "chalk";
// @ts-expect-error - Root import is required or the Clec type definitions won't work
// biome-ignore lint/correctness/noUnusedImports: Root import is required or the Clec type definitions won't work
import { defineCommand, type Root } from "clerc";
import { eq } from "drizzle-orm";
import { Instance } from "~/classes/database/instance.ts";
import { FetchJobType, fetchQueue } from "~/classes/queues/fetch.ts";
import { Instances } from "~/drizzle/schema.ts";

export const refetchInstanceCommand = defineCommand(
    {
        name: "instance refetch",
        description: "Refetches metadata from remote instances.",
        parameters: ["<url_or_host>"],
    },
    async (context) => {
        const { urlOrHost } = context.parameters;

        const host = URL.canParse(urlOrHost)
            ? new URL(urlOrHost).host
            : urlOrHost;

        const instance = await Instance.fromSql(eq(Instances.baseUrl, host));

        if (!instance) {
            throw new Error(`Instance ${chalk.gray(host)} not found.`);
        }

        await fetchQueue.add(FetchJobType.Instance, {
            uri: new URL(`https://${instance.data.baseUrl}`).origin,
        });

        console.info(
            `Refresh job enqueued for ${chalk.gray(instance.data.baseUrl)}.`,
        );
    },
);
