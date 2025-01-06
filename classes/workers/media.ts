import { Attachment } from "@versia/kit/db";
import { Worker } from "bullmq";
import { config } from "~/packages/config-manager";
import { connection } from "~/utils/redis.ts";
import { MediaManager } from "../media/media-manager.ts";
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

                    const attachment = await Attachment.fromId(attachmentId);

                    if (!attachment) {
                        throw new Error(
                            `Attachment not found: [${attachmentId}]`,
                        );
                    }

                    const processor = new ImageConversionPreprocessor(config);

                    const hash = attachment?.data.sha256;

                    if (!hash) {
                        throw new Error(
                            `Attachment [${attachmentId}] has no hash, cannot process.`,
                        );
                    }

                    // Download the file and process it.
                    const blob = await (
                        await fetch(attachment.data.url)
                    ).blob();

                    const file = new File([blob], filename);

                    const { file: processedFile } =
                        await processor.process(file);

                    const mediaManager = new MediaManager(config);

                    const { path, uploadedFile } =
                        await mediaManager.addFile(processedFile);

                    const url = Attachment.getUrl(path);

                    const sha256 = new Bun.SHA256();

                    await attachment.update({
                        url,
                        sha256: sha256
                            .update(await uploadedFile.arrayBuffer())
                            .digest("hex"),
                        mimeType: uploadedFile.type,
                        size: uploadedFile.size,
                    });
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
