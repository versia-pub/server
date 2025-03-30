import { htmlToText } from "@/content_types.ts";
import { Note, PushSubscription, Token, User } from "@versia/kit/db";
import { Queue } from "bullmq";
import { Worker } from "bullmq";
import { sendNotification } from "web-push";
import { config } from "~/config.ts";
import { connection } from "~/utils/redis.ts";

export enum PushJobType {
    Notify = "notify",
}

export type PushJobData = {
    psId: string;
    type: string;
    relatedUserId: string;
    noteId?: string;
    notificationId: string;
};

export const pushQueue = new Queue<PushJobData, void, PushJobType>("push", {
    connection,
});

export const getPushWorker = (): Worker<PushJobData, void, PushJobType> =>
    new Worker<PushJobData, void, PushJobType>(
        pushQueue.name,
        async (job) => {
            const {
                data: { psId, relatedUserId, type, noteId, notificationId },
            } = job;

            if (!config.notifications.push) {
                await job.log("Push notifications are disabled");
                return;
            }

            await job.log(
                `Sending push notification for note [${notificationId}]`,
            );

            const ps = await PushSubscription.fromId(psId);

            if (!ps) {
                throw new Error(
                    `Could not resolve push subscription ID ${psId}`,
                );
            }

            const token = await Token.fromId(ps.data.tokenId);

            if (!token) {
                throw new Error(
                    `Could not resolve token ID ${ps.data.tokenId}`,
                );
            }

            const relatedUser = await User.fromId(relatedUserId);

            if (!relatedUser) {
                throw new Error(
                    `Could not resolve related user ID ${relatedUserId}`,
                );
            }

            const note = noteId ? await Note.fromId(noteId) : null;

            const truncate = (str: string, len: number): string => {
                if (str.length <= len) {
                    return str;
                }

                return `${str.slice(0, len)}...`;
            };

            const name = truncate(
                relatedUser.data.displayName || relatedUser.data.username,
                50,
            );

            let title = name;

            switch (type) {
                case "mention":
                    title = `${name} mentioned you`;
                    break;
                case "reply":
                    title = `${name} replied to you`;
                    break;
                case "favourite":
                    title = `${name} liked your note`;
                    break;
                case "reblog":
                    title = `${name} reblogged your note`;
                    break;
                case "follow":
                    title = `${name} followed you`;
                    break;
                case "follow_request":
                    title = `${name} requested to follow you`;
                    break;
                case "poll":
                    title = "Poll ended";
                    break;
            }

            const body = note
                ? htmlToText(note.data.spoilerText || note.data.content)
                : htmlToText(relatedUser.data.note);

            await sendNotification(
                {
                    endpoint: ps.data.endpoint,
                    keys: {
                        auth: ps.data.authSecret,
                        p256dh: ps.data.publicKey,
                    },
                },
                JSON.stringify({
                    access_token: token.data.accessToken,
                    // FIXME
                    preferred_locale: "en-US",
                    notification_id: notificationId,
                    notification_type: type,
                    icon: relatedUser.getAvatarUrl(),
                    title,
                    body: truncate(body, 140),
                }),
                {
                    vapidDetails: {
                        subject:
                            config.notifications.push.subject ||
                            config.http.base_url.origin,
                        privateKey:
                            config.notifications.push.vapid_keys.private,
                        publicKey: config.notifications.push.vapid_keys.public,
                    },
                    contentEncoding: "aesgcm",
                },
            );

            await job.log(
                `✔ Finished delivering push notification for note [${notificationId}]`,
            );
        },
        {
            connection,
            removeOnComplete: {
                age: config.queues.push?.remove_after_complete_seconds,
            },
            removeOnFail: {
                age: config.queues.push?.remove_after_failure_seconds,
            },
        },
    );
