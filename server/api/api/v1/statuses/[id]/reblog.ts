/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { apiRoute, applyConfig } from "@api";
import { errorResponse, jsonResponse } from "@response";
import { client } from "~database/datasource";
import { isViewableByUser, statusToAPI } from "~database/entities/Status";
import type { UserWithRelations } from "~database/entities/User";
import { statusAndUserRelations } from "~database/entities/relations";

export const meta = applyConfig({
    allowedMethods: ["POST"],
    ratelimits: {
        max: 100,
        duration: 60,
    },
    route: "/api/v1/statuses/:id/reblog",
    auth: {
        required: true,
    },
});

/**
 * Reblogs a post
 */
export default apiRoute<{
    visibility: "public" | "unlisted" | "private";
}>(async (req, matchedRoute, extraData) => {
    const id = matchedRoute.params.id;
    const config = await extraData.configManager.getConfig();

    const { user } = extraData.auth;

    if (!user) return errorResponse("Unauthorized", 401);

    const { visibility = "public" } = extraData.parsedRequest;

    const status = await client.status.findUnique({
        where: { id },
        include: statusAndUserRelations,
    });

    // Check if user is authorized to view this status (if it's private)
    if (!status || !isViewableByUser(status, user))
        return errorResponse("Record not found", 404);

    const existingReblog = await client.status.findFirst({
        where: {
            authorId: user.id,
            reblogId: status.id,
        },
    });

    if (existingReblog) {
        return errorResponse("Already reblogged", 422);
    }

    const newReblog = await client.status.create({
        data: {
            authorId: user.id,
            reblogId: status.id,
            isReblog: true,
            uri: `${config.http.base_url}/statuses/FAKE-${crypto.randomUUID()}`,
            visibility,
            sensitive: false,
        },
        include: statusAndUserRelations,
    });

    await client.status.update({
        where: { id: newReblog.id },
        data: {
            uri: `${config.http.base_url}/statuses/${newReblog.id}`,
        },
        include: statusAndUserRelations,
    });

    // Create notification for reblog if reblogged user is on the same instance
    if ((status.author as UserWithRelations).instanceId === user.instanceId) {
        await client.notification.create({
            data: {
                accountId: user.id,
                notifiedId: status.authorId,
                type: "reblog",
                statusId: status.reblogId,
            },
        });
    }

    return jsonResponse(
        await statusToAPI(
            {
                ...newReblog,
                uri: `${config.http.base_url}/statuses/${newReblog.id}`,
            },
            user,
        ),
    );
});
