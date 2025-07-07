import { config } from "@versia-server/config";
import { Worker } from "bullmq";
import { Relationship } from "../../db/relationship.ts";
import { User } from "../../db/user.ts";
import { connection } from "../../redis.ts";
import {
    type RelationshipJobData,
    RelationshipJobType,
    relationshipQueue,
} from "./queue.ts";

export const getRelationshipWorker = (): Worker<
    RelationshipJobData,
    void,
    RelationshipJobType
> =>
    new Worker<RelationshipJobData, void, RelationshipJobType>(
        relationshipQueue.name,
        async (job) => {
            switch (job.name) {
                case RelationshipJobType.Unmute: {
                    const { ownerId, subjectId } = job.data;

                    const owner = await User.fromId(ownerId);
                    const subject = await User.fromId(subjectId);

                    if (!(owner && subject)) {
                        await job.log("Users not found");
                        return;
                    }

                    const foundRelationship =
                        await Relationship.fromOwnerAndSubject(owner, subject);

                    if (foundRelationship.data.muting) {
                        await foundRelationship.update({
                            muting: false,
                            mutingNotifications: false,
                        });
                    }

                    await job.log(`✔ Finished unmuting [${subjectId}]`);
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
