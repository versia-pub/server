import { apiRoute, auth, jsonOrForm, reusedResponses } from "@/api";
import { createRoute, z } from "@hono/zod-openapi";
import { db } from "@versia/kit/db";
import { FilterKeywords, Filters, RolePermissions } from "@versia/kit/tables";
import { type SQL, and, eq, inArray } from "drizzle-orm";
import { ApiError } from "~/classes/errors/api-error";
import {
    FilterKeyword as FilterKeywordSchema,
    Filter as FilterSchema,
} from "~/classes/schemas/filters";
import { zBoolean } from "~/packages/config-manager/config.type";
import { ErrorSchema } from "~/types/api";

const routeGet = createRoute({
    method: "get",
    path: "/api/v2/filters/{id}",
    summary: "View a specific filter",
    externalDocs: {
        url: "Obtain a single filter group owned by the current user.",
    },
    tags: ["Filters"],
    middleware: [
        auth({
            auth: true,
            permissions: [RolePermissions.ManageOwnFilters],
        }),
    ] as const,
    request: {
        params: z.object({
            id: FilterSchema.shape.id,
        }),
    },
    responses: {
        200: {
            description: "Filter",
            content: {
                "application/json": {
                    schema: FilterSchema,
                },
            },
        },
        404: {
            description: "Filter not found",
            content: {
                "application/json": {
                    schema: ErrorSchema,
                },
            },
        },
        401: reusedResponses[401],
    },
});

const routePut = createRoute({
    method: "put",
    path: "/api/v2/filters/{id}",
    summary: "Update a filter",
    description: "Update a filter group with the given parameters.",
    externalDocs: {
        url: "https://docs.joinmastodon.org/methods/filters/#update",
    },
    tags: ["Filters"],
    middleware: [
        auth({
            auth: true,
            permissions: [RolePermissions.ManageOwnFilters],
        }),
        jsonOrForm(),
    ] as const,
    request: {
        params: z.object({
            id: FilterSchema.shape.id,
        }),
        body: {
            content: {
                "application/json": {
                    schema: z
                        .object({
                            context: FilterSchema.shape.context,
                            title: FilterSchema.shape.title,
                            filter_action: FilterSchema.shape.filter_action,
                            expires_in: z.coerce
                                .number()
                                .int()
                                .min(60)
                                .max(60 * 60 * 24 * 365 * 5)
                                .openapi({
                                    description:
                                        "How many seconds from now should the filter expire?",
                                }),
                            keywords_attributes: z.array(
                                FilterKeywordSchema.pick({
                                    keyword: true,
                                    whole_word: true,
                                    id: true,
                                })
                                    .extend({
                                        // biome-ignore lint/style/useNamingConvention: _destroy is a Mastodon API imposed variable name
                                        _destroy: zBoolean
                                            .default(false)
                                            .openapi({
                                                description:
                                                    "If true, will remove the keyword with the given ID.",
                                            }),
                                    })
                                    .partial(),
                            ),
                        })
                        .partial(),
                },
            },
        },
    },
    responses: {
        200: {
            description: "Filter updated",
            content: {
                "application/json": {
                    schema: FilterSchema,
                },
            },
        },
        404: {
            description: "Filter not found",
            content: {
                "application/json": {
                    schema: ErrorSchema,
                },
            },
        },
        ...reusedResponses,
    },
});

const routeDelete = createRoute({
    method: "delete",
    path: "/api/v2/filters/{id}",
    summary: "Delete a filter",
    description: "Delete a filter group with the given id.",
    externalDocs: {
        url: "https://docs.joinmastodon.org/methods/filters/#delete",
    },
    tags: ["Filters"],
    middleware: [
        auth({
            auth: true,
            permissions: [RolePermissions.ManageOwnFilters],
        }),
    ] as const,
    request: {
        params: z.object({
            id: FilterSchema.shape.id,
        }),
    },
    responses: {
        200: {
            description: "Filter successfully deleted",
        },
        404: {
            description: "Filter not found",
            content: {
                "application/json": {
                    schema: ErrorSchema,
                },
            },
        },
        401: reusedResponses[401],
    },
});

export default apiRoute((app) => {
    app.openapi(routeGet, async (context) => {
        const { user } = context.get("auth");
        const { id } = context.req.valid("param");

        const userFilter = await db.query.Filters.findFirst({
            where: (filter, { eq, and }): SQL | undefined =>
                and(eq(filter.userId, user.id), eq(filter.id, id)),
            with: {
                keywords: true,
            },
        });

        if (!userFilter) {
            throw new ApiError(404, "Filter not found");
        }

        return context.json(
            {
                id: userFilter.id,
                title: userFilter.title,
                context: userFilter.context,
                expires_at: userFilter.expireAt
                    ? new Date(userFilter.expireAt).toISOString()
                    : null,
                filter_action: userFilter.filterAction,
                keywords: userFilter.keywords.map((keyword) => ({
                    id: keyword.id,
                    keyword: keyword.keyword,
                    whole_word: keyword.wholeWord,
                })),
                statuses: [],
            },
            200,
        );
    });

    app.openapi(routePut, async (context) => {
        const { user } = context.get("auth");
        const { id } = context.req.valid("param");
        const {
            title,
            context: ctx,
            filter_action,
            expires_in,
            keywords_attributes,
        } = context.req.valid("json");

        await db
            .update(Filters)
            .set({
                title,
                context: ctx ?? [],
                filterAction: filter_action,
                expireAt: new Date(
                    Date.now() + (expires_in ?? 0),
                ).toISOString(),
            })
            .where(and(eq(Filters.userId, user.id), eq(Filters.id, id)));

        const toUpdate = keywords_attributes
            ?.filter((keyword) => keyword.id && !keyword._destroy)
            .map((keyword) => ({
                keyword: keyword.keyword,
                wholeWord: keyword.whole_word ?? false,
                id: keyword.id,
            }));

        const toDelete = keywords_attributes
            ?.filter((keyword) => keyword._destroy && keyword.id)
            .map((keyword) => keyword.id ?? "");

        if (toUpdate && toUpdate.length > 0) {
            for (const keyword of toUpdate) {
                await db
                    .update(FilterKeywords)
                    .set(keyword)
                    .where(
                        and(
                            eq(FilterKeywords.filterId, id),
                            eq(FilterKeywords.id, keyword.id ?? ""),
                        ),
                    );
            }
        }

        if (toDelete && toDelete.length > 0) {
            await db
                .delete(FilterKeywords)
                .where(
                    and(
                        eq(FilterKeywords.filterId, id),
                        inArray(FilterKeywords.id, toDelete),
                    ),
                );
        }

        const updatedFilter = await db.query.Filters.findFirst({
            where: (filter, { eq, and }): SQL | undefined =>
                and(eq(filter.userId, user.id), eq(filter.id, id)),
            with: {
                keywords: true,
            },
        });

        if (!updatedFilter) {
            throw new Error("Failed to update filter");
        }

        return context.json(
            {
                id: updatedFilter.id,
                title: updatedFilter.title,
                context: updatedFilter.context,
                expires_at: updatedFilter.expireAt
                    ? new Date(updatedFilter.expireAt).toISOString()
                    : null,
                filter_action: updatedFilter.filterAction,
                keywords: updatedFilter.keywords.map((keyword) => ({
                    id: keyword.id,
                    keyword: keyword.keyword,
                    whole_word: keyword.wholeWord,
                })),
                statuses: [],
            },
            200,
        );
    });

    app.openapi(routeDelete, async (context) => {
        const { user } = context.get("auth");
        const { id } = context.req.valid("param");

        await db
            .delete(Filters)
            .where(and(eq(Filters.userId, user.id), eq(Filters.id, id)));

        return context.body(null, 204);
    });
});
