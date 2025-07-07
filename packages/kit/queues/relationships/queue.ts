import { Queue } from "bullmq";
import { connection } from "../../redis.ts";

export enum RelationshipJobType {
    Unmute = "unmute",
}

export type RelationshipJobData = {
    ownerId: string;
    subjectId: string;
};

export const relationshipQueue = new Queue<
    RelationshipJobData,
    void,
    RelationshipJobType
>("relationships", {
    connection,
});
