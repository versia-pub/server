import { Instance } from "@versia-server/kit/db";
import { FetchJobType, fetchQueue } from "@versia-server/kit/queues/fetch";
import { Instances } from "@versia-server/kit/tables";
import chalk from "chalk";
// @ts-expect-error - Root import is required or the Clec type definitions won't work
// biome-ignore lint/correctness/noUnusedImports: Root import is required or the Clec type definitions won't work
import { defineCommand, type Root } from "clerc";
import { eq } from "drizzle-orm";

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
