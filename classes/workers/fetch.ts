import { Instance } from "@versia/kit/db";
import { Instances } from "@versia/kit/tables";
import { Worker } from "bullmq";
import { eq } from "drizzle-orm";
import { config } from "~/packages/config-manager";
import { connection } from "~/utils/redis.ts";
import {
    type FetchJobData,
    FetchJobType,
    fetchQueue,
} from "../queues/fetch.ts";

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
                age: config.queues.fetch.remove_on_complete,
            },
            removeOnFail: {
                age: config.queues.fetch.remove_on_failure,
            },
        },
    );
