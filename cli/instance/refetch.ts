import { defineCommand } from "@clerc/core";
import { Instance } from "@versia-server/kit/db";
import { FetchJobType, fetchQueue } from "@versia-server/kit/queues/fetch";
import { Instances } from "@versia-server/kit/tables";
import chalk from "chalk";
import { eq } from "drizzle-orm";

export const refetchInstanceCommand = defineCommand({
    name: "instance refetch",
    description: "Refetches metadata from remote instances.",
    parameters: ["<url_or_host>"],
    handler: async (context) => {
        const { url_or_host } = context.parameters;

        const host = URL.canParse(url_or_host)
            ? new URL(url_or_host).host
            : url_or_host;

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
});
