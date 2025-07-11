import { config } from "@versia-server/config";
import { Worker } from "bullmq";
import { eq } from "drizzle-orm";
import { Instance } from "../../db/instance.ts";
import { connection } from "../../redis.ts";
import { Instances } from "../../tables/schema.ts";
import { type FetchJobData, FetchJobType, fetchQueue } from "./queue.ts";

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
