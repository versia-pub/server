import type { Status, User, Prisma } from "@prisma/client";

export async function fetchTimeline<T extends User | Status>(
    model: Prisma.StatusDelegate | Prisma.UserDelegate,
    args: Prisma.StatusFindManyArgs | Prisma.UserFindManyArgs,
    req: Request,
) {
    // @ts-expect-error This is a hack to get around the fact that Prisma doesn't have a common base type for all models
    const objects = (await model.findMany(args)) as T[];

    // Constuct HTTP Link header (next and prev) only if there are more statuses
    const linkHeader = [];

    if (objects.length > 0) {
        // Check if there are statuses before the first one
        // @ts-expect-error This is a hack to get around the fact that Prisma doesn't have a common base type for all models
        const objectsBefore = await model.findMany({
            where: {
                id: {
                    gt: objects[0].id,
                },
                ...args.where,
            },
            take: 1,
        });

        if (objectsBefore.length > 0) {
            const urlWithoutQuery = req.url.split("?")[0];
            // Add prev link
            linkHeader.push(
                `<${urlWithoutQuery}?min_id=${objects[0].id}>; rel="prev"`,
            );
        }

        if (objects.length < (args.take ?? Number.POSITIVE_INFINITY)) {
            // Check if there are statuses after the last one
            // @ts-expect-error This is a hack to get around the fact that Prisma doesn't have a common base type for all models
            const objectsAfter = await model.findMany({
                where: {
                    id: {
                        lt: objects.at(-1)?.id,
                    },
                    ...args.where,
                },
                take: 1,
            });

            if (objectsAfter.length > 0) {
                const urlWithoutQuery = req.url.split("?")[0];
                // Add next link
                linkHeader.push(
                    `<${urlWithoutQuery}?max_id=${
                        objects.at(-1)?.id
                    }>; rel="next"`,
                );
            }
        }
    }

    return {
        link: linkHeader.join(", "),
        objects,
    };
}
