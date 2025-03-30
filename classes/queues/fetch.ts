import { Instance } from "@versia/kit/db";
import { Instances } from "@versia/kit/tables";
import { Queue } from "bullmq";
import { Worker } from "bullmq";
import { eq } from "drizzle-orm";
import { config } from "~/config.ts";
import { connection } from "~/utils/redis.ts";

export enum FetchJobType {
    Instance = "instance",
    User = "user",
    Note = "user",
}

export type FetchJobData = {
    uri: string;
    refetcher?: string;
};

export const fetchQueue = new Queue<FetchJobData, void, FetchJobType>("fetch", {
    connection,
});

export const getFetchWorker = (): Worker<FetchJobData, void, FetchJobType> =>
    new Worker<FetchJobData, void, FetchJobType>(
        fetchQueue.name,
        async (job) => {
            switch (job.name) {
                case FetchJobType.Instance: {
                    const { uri } = job.data;

                    await job.log(`Fetching instance metadata from [${uri}]`);

                    // Check if exists
                    const host = new URL(uri).host;

                    const existingInstance = await Instance.fromSql(
                        eq(Instances.baseUrl, host),
                    );

                    if (existingInstance) {
                        await job.log(
                            "Instance is known, refetching remote data.",
                        );

                        await existingInstance.updateFromRemote();

                        await job.log(
                            `Instance [${uri}] successfully refetched`,
                        );

                        return;
                    }

                    await Instance.resolve(new URL(uri));

                    await job.log(
                        `✔ Finished fetching instance metadata from [${uri}]`,
                    );
                }
            }
        },
        {
            connection,
            removeOnComplete: {
                age: config.queues.fetch?.remove_after_complete_seconds,
            },
            removeOnFail: {
                age: config.queues.fetch?.remove_after_failure_seconds,
            },
        },
    );
