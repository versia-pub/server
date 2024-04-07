import { apiRoute, applyConfig } from "@api";
import { errorResponse, jsonResponse } from "@response";
import { client } from "~database/datasource";
import { statusToAPI } from "~database/entities/Status";
import { statusAndUserRelations } from "~database/entities/relations";

export const meta = applyConfig({
    allowedMethods: ["GET"],
    route: "/api/v1/favourites",
    ratelimits: {
        max: 100,
        duration: 60,
    },
    auth: {
        required: true,
    },
});

export default apiRoute<{
    max_id?: string;
    since_id?: string;
    min_id?: string;
    limit?: number;
}>(async (req, matchedRoute, extraData) => {
    const { user } = extraData.auth;

    const { limit = 20, max_id, min_id, since_id } = extraData.parsedRequest;

    if (limit < 1 || limit > 40) {
        return errorResponse("Limit must be between 1 and 40", 400);
    }

    if (!user) return errorResponse("Unauthorized", 401);

    const objects = await client.status.findMany({
        where: {
            id: {
                lt: max_id ?? undefined,
                gte: since_id ?? undefined,
                gt: min_id ?? undefined,
            },
            likes: {
                some: {
                    likerId: user.id,
                },
            },
        },
        include: statusAndUserRelations,
        take: Number(limit),
        orderBy: {
            id: "desc",
        },
    });

    // Constuct HTTP Link header (next and prev)
    const linkHeader = [];
    if (objects.length > 0) {
        const urlWithoutQuery = req.url.split("?")[0];
        linkHeader.push(
            `<${urlWithoutQuery}?max_id=${objects.at(-1)?.id}>; rel="next"`,
            `<${urlWithoutQuery}?min_id=${objects[0].id}>; rel="prev"`,
        );
    }

    return jsonResponse(
        await Promise.all(
            objects.map(async (status) => statusToAPI(status, user)),
        ),
        200,
        {
            Link: linkHeader.join(", "),
        },
    );
});
