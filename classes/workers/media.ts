import { Media } from "@versia/kit/db";
import { Worker } from "bullmq";
import { config } from "~/packages/config-manager";
import { connection } from "~/utils/redis.ts";
import { MediaManager } from "../media/media-manager.ts";
import { BlurhashPreprocessor } from "../media/preprocessors/blurhash.ts";
import { ImageConversionPreprocessor } from "../media/preprocessors/image-conversion.ts";
import {
    type MediaJobData,
    MediaJobType,
    mediaQueue,
} from "../queues/media.ts";

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

                    const processor = new ImageConversionPreprocessor(config);

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

                    const { file: processedFile } =
                        await processor.process(file);

                    const mediaManager = new MediaManager(config);

                    await job.log(`Uploading attachment [${attachmentId}]`);

                    const { path, uploadedFile } =
                        await mediaManager.addFile(processedFile);

                    const url = Media.getUrl(path);

                    await attachment.update({
                        content: await Media.fileToContentFormat(
                            uploadedFile,
                            url,
                            {
                                description:
                                    attachment.data.content[0].description ||
                                    undefined,
                            },
                        ),
                    });

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

                    const blurhashProcessor = new BlurhashPreprocessor();

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

                    const { blurhash } = await blurhashProcessor.process(file);

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
                age: config.queues.media.remove_on_complete,
            },
            removeOnFail: {
                age: config.queues.media.remove_on_failure,
            },
        },
    );
