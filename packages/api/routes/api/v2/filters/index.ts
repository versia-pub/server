import {
    FilterKeyword as FilterKeywordSchema,
    Filter as FilterSchema,
    RolePermission,
} from "@versia/client/schemas";
import { ApiError } from "@versia/kit";
import { db } from "@versia/kit/db";
import { FilterKeywords, Filters } from "@versia/kit/tables";
import { randomUUIDv7 } from "bun";
import { eq, type SQL } from "drizzle-orm";
import { describeRoute } from "hono-openapi";
import { resolver, validator } from "hono-openapi/zod";
import { z } from "zod";
import { apiRoute, auth, handleZodError, jsonOrForm } from "@/api";

export default apiRoute((app) => {
    app.get(
        "/api/v2/filters",
        describeRoute({
            summary: "View all filters",
            description:
                "Obtain a list of all filter groups for the current user.",
            externalDocs: {
                url: "https://docs.joinmastodon.org/methods/filters/#get",
            },
            tags: ["Filters"],
            responses: {
                200: {
                    description: "Filters",
                    content: {
                        "application/json": {
                            schema: resolver(z.array(FilterSchema)),
                        },
                    },
                },
                401: ApiError.missingAuthentication().schema,
            },
        }),
        auth({
            auth: true,
            permissions: [RolePermission.ManageOwnFilters],
        }),
        async (context) => {
            const { user } = context.get("auth");

            const userFilters = await db.query.Filters.findMany({
                where: (filter): SQL | undefined => eq(filter.userId, user.id),
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
        },
    );

    app.post(
        "/api/v2/filters",
        describeRoute({
            summary: "Create a filter",
            description: "Create a filter group with the given parameters.",
            externalDocs: {
                url: "https://docs.joinmastodon.org/methods/filters/#create",
            },
            tags: ["Filters"],
            responses: {
                200: {
                    description: "Created filter",
                    content: {
                        "application/json": {
                            schema: resolver(FilterSchema),
                        },
                    },
                },
                401: ApiError.missingAuthentication().schema,
                422: ApiError.validationFailed().schema,
            },
        }),
        auth({
            auth: true,
            permissions: [RolePermission.ManageOwnFilters],
        }),
        jsonOrForm(),
        validator(
            "json",
            z.object({
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
            handleZodError,
        ),
        async (context) => {
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
                        id: randomUUIDv7(),
                        title,
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
                                  id: randomUUIDv7(),
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
        },
    );
});
