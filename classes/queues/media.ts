import { Media } from "@versia/kit/db";
import { connection } from "@versia/kit/redis";
import { config } from "@versia-server/config";
import { Queue, Worker } from "bullmq";
import { calculateBlurhash } from "../media/preprocessors/blurhash.ts";
import { convertImage } from "../media/preprocessors/image-conversion.ts";

export enum MediaJobType {
    ConvertMedia = "convertMedia",
    CalculateMetadata = "calculateMetadata",
}

export type MediaJobData = {
    attachmentId: string;
    filename: string;
};

export const mediaQueue = new Queue<MediaJobData, void, MediaJobType>("media", {
    connection,
});

export const getMediaWorker = (): Worker<MediaJobData, void, MediaJobType> =>
    new Worker<MediaJobData, void, MediaJobType>(
        mediaQueue.name,
        async (job) => {
            switch (job.name) {
                case MediaJobType.ConvertMedia: {
                    const { attachmentId, filename } = job.data;

                    await job.log(`Fetching attachment ID [${attachmentId}]`);

                    const attachment = await Media.fromId(attachmentId);

                    if (!attachment) {
                        throw new Error(
                            `Attachment not found: [${attachmentId}]`,
                        );
                    }

                    await job.log(`Processing attachment [${attachmentId}]`);
                    await job.log(
                        `Fetching file from [${attachment.getUrl()}]`,
                    );

                    // Download the file and process it.
                    const blob = await (
                        await fetch(attachment.getUrl())
                    ).blob();

                    const file = new File([blob], filename);

                    await job.log(`Converting attachment [${attachmentId}]`);

                    const processedFile = await convertImage(
                        file,
                        config.media.conversion.convert_to,
                        {
                            convertVectors:
                                config.media.conversion.convert_vectors,
                        },
                    );

                    await job.log(`Uploading attachment [${attachmentId}]`);

                    await attachment.updateFromFile(processedFile);

                    await job.log(
                        `✔ Finished processing attachment [${attachmentId}]`,
                    );

                    break;
                }
                case MediaJobType.CalculateMetadata: {
                    // Calculate blurhash
                    const { attachmentId } = job.data;

                    await job.log(`Fetching attachment ID [${attachmentId}]`);

                    const attachment = await Media.fromId(attachmentId);

                    if (!attachment) {
                        throw new Error(
                            `Attachment not found: [${attachmentId}]`,
                        );
                    }

                    await job.log(`Processing attachment [${attachmentId}]`);
                    await job.log(
                        `Fetching file from [${attachment.getUrl()}]`,
                    );

                    // Download the file and process it.
                    const blob = await (
                        await fetch(attachment.getUrl())
                    ).blob();

                    // Filename is not important for blurhash
                    const file = new File([blob], "");

                    await job.log(`Generating blurhash for [${attachmentId}]`);

                    const blurhash = await calculateBlurhash(file);

                    await attachment.update({
                        blurhash,
                    });

                    await job.log(
                        `✔ Finished processing attachment [${attachmentId}]`,
                    );

                    break;
                }
            }
        },
        {
            connection,
            removeOnComplete: {
                age: config.queues.media?.remove_after_complete_seconds,
            },
            removeOnFail: {
                age: config.queues.media?.remove_after_failure_seconds,
            },
        },
    );
