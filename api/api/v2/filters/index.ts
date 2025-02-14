import { apiRoute, auth, jsonOrForm, reusedResponses } from "@/api";
import { createRoute, z } from "@hono/zod-openapi";
import { db } from "@versia/kit/db";
import { FilterKeywords, Filters, RolePermissions } from "@versia/kit/tables";
import type { SQL } from "drizzle-orm";
import {
    FilterKeyword as FilterKeywordSchema,
    Filter as FilterSchema,
} from "~/classes/schemas/filters";

const routeGet = createRoute({
    method: "get",
    path: "/api/v2/filters",
    summary: "View all filters",
    description: "Obtain a list of all filter groups for the current user.",
    externalDocs: {
        url: "https://docs.joinmastodon.org/methods/filters/#get",
    },
    tags: ["Filters"],
    middleware: [
        auth({
            auth: true,
            permissions: [RolePermissions.ManageOwnFilters],
        }),
        jsonOrForm(),
    ] as const,
    responses: {
        200: {
            description: "Filters",
            content: {
                "application/json": {
                    schema: z.array(FilterSchema),
                },
            },
        },
        401: reusedResponses[401],
    },
});

const routePost = createRoute({
    method: "post",
    path: "/api/v2/filters",
    summary: "Create a filter",
    description: "Create a filter group with the given parameters.",
    externalDocs: {
        url: "https://docs.joinmastodon.org/methods/filters/#create",
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
        body: {
            content: {
                "application/json": {
                    schema: z.object({
                        context: FilterSchema.shape.context,
                        title: FilterSchema.shape.title,
                        filter_action: FilterSchema.shape.filter_action,
                        expires_in: z.coerce
                            .number()
                            .int()
                            .min(60)
                            .max(60 * 60 * 24 * 365 * 5)
                            .optional()
                            .openapi({
                                description:
                                    "How many seconds from now should the filter expire?",
                            }),
                        keywords_attributes: z
                            .array(
                                FilterKeywordSchema.pick({
                                    keyword: true,
                                    whole_word: true,
                                }),
                            )
                            .optional(),
                    }),
                },
            },
        },
    },
    responses: {
        200: {
            description: "Created filter",
            content: {
                "application/json": {
                    schema: FilterSchema,
                },
            },
        },
        ...reusedResponses,
    },
});

export default apiRoute((app) => {
    app.openapi(routeGet, async (context) => {
        const { user } = context.get("auth");

        const userFilters = await db.query.Filters.findMany({
            where: (filter, { eq }): SQL | undefined =>
                eq(filter.userId, user.id),
            with: {
                keywords: true,
            },
        });

        return context.json(
            userFilters.map((filter) => ({
                id: filter.id,
                title: filter.title,
                context: filter.context,
                expires_at: filter.expireAt
                    ? new Date(Date.now() + filter.expireAt).toISOString()
                    : null,
                filter_action: filter.filterAction,
                keywords: filter.keywords.map((keyword) => ({
                    id: keyword.id,
                    keyword: keyword.keyword,
                    whole_word: keyword.wholeWord,
                })),
                statuses: [],
            })),
            200,
        );
    });

    app.openapi(routePost, async (context) => {
        const { user } = context.get("auth");
        const {
            title,
            context: ctx,
            filter_action,
            expires_in,
            keywords_attributes,
        } = context.req.valid("json");

        const newFilter = (
            await db
                .insert(Filters)
                .values({
                    title: title,
                    context: ctx,
                    filterAction: filter_action,
                    expireAt: new Date(
                        Date.now() + (expires_in ?? 0),
                    ).toISOString(),
                    userId: user.id,
                })
                .returning()
        )[0];

        if (!newFilter) {
            throw new Error("Failed to create filter");
        }

        const insertedKeywords =
            keywords_attributes && keywords_attributes.length > 0
                ? await db
                      .insert(FilterKeywords)
                      .values(
                          keywords_attributes?.map((keyword) => ({
                              filterId: newFilter.id,
                              keyword: keyword.keyword,
                              wholeWord: keyword.whole_word ?? false,
                          })) ?? [],
                      )
                      .returning()
                : [];

        return context.json(
            {
                id: newFilter.id,
                title: newFilter.title,
                context: newFilter.context,
                expires_at: expires_in
                    ? new Date(Date.now() + expires_in).toISOString()
                    : null,
                filter_action: newFilter.filterAction,
                keywords: insertedKeywords.map((keyword) => ({
                    id: keyword.id,
                    keyword: keyword.keyword,
                    whole_word: keyword.wholeWord,
                })),
                statuses: [],
            },
            200,
        );
    });
});
