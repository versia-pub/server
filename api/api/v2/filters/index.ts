import { apiRoute, applyConfig, auth, jsonOrForm } from "@/api";
import { createRoute } from "@hono/zod-openapi";
import { db } from "@versia/kit/db";
import { FilterKeywords, Filters, RolePermissions } from "@versia/kit/tables";
import type { SQL } from "drizzle-orm";
import { z } from "zod";
import { ApiError } from "~/classes/errors/api-error";
import { ErrorSchema } from "~/types/api";
export const meta = applyConfig({
    route: "/api/v2/filters",
    ratelimits: {
        max: 60,
        duration: 60,
    },
    auth: {
        required: true,
    },
    permissions: {
        required: [RolePermissions.ManageOwnFilters],
    },
});

export const schemas = {
    json: z.object({
        title: z.string().trim().min(1).max(100),
        context: z
            .array(
                z.enum([
                    "home",
                    "notifications",
                    "public",
                    "thread",
                    "account",
                ]),
            )
            .min(1),
        filter_action: z.enum(["warn", "hide"]).optional().default("warn"),
        expires_in: z.coerce
            .number()
            .int()
            .min(60)
            .max(60 * 60 * 24 * 365 * 5)
            .optional(),
        keywords_attributes: z
            .array(
                z.object({
                    keyword: z.string().trim().min(1).max(100),
                    whole_word: z
                        .string()
                        .transform((v) =>
                            ["true", "1", "on"].includes(v.toLowerCase()),
                        )
                        .optional(),
                }),
            )
            .optional(),
    }),
};

const filterSchema = z.object({
    id: z.string(),
    title: z.string(),
    context: z.array(z.string()),
    expires_at: z.string().nullable(),
    filter_action: z.enum(["warn", "hide"]),
    keywords: z.array(
        z.object({
            id: z.string(),
            keyword: z.string(),
            whole_word: z.boolean(),
        }),
    ),
    statuses: z.array(z.string()),
});

const routeGet = createRoute({
    method: "get",
    path: "/api/v2/filters",
    summary: "Get filters",
    middleware: [auth(meta.auth, meta.permissions), jsonOrForm()],
    responses: {
        200: {
            description: "Filters",
            content: {
                "application/json": {
                    schema: z.array(filterSchema),
                },
            },
        },
        401: {
            description: "Unauthorized",
            content: {
                "application/json": {
                    schema: ErrorSchema,
                },
            },
        },
    },
});

const routePost = createRoute({
    method: "post",
    path: "/api/v2/filters",
    summary: "Create filter",
    middleware: [auth(meta.auth, meta.permissions), jsonOrForm()],
    request: {
        body: {
            content: {
                "application/json": {
                    schema: schemas.json,
                },
            },
        },
    },
    responses: {
        200: {
            description: "Filter created",
            content: {
                "application/json": {
                    schema: filterSchema,
                },
            },
        },
        401: {
            description: "Unauthorized",
            content: {
                "application/json": {
                    schema: ErrorSchema,
                },
            },
        },
    },
});

export default apiRoute((app) => {
    app.openapi(routeGet, async (context) => {
        const { user } = context.get("auth");

        if (!user) {
            throw new ApiError(401, "Unauthorized");
        }

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

        if (!user) {
            throw new ApiError(401, "Unauthorized");
        }

        const newFilter = (
            await db
                .insert(Filters)
                .values({
                    title: title ?? "",
                    context: ctx ?? [],
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
            } as {
                id: string;
                title: string;
                context: string[];
                expires_at: string;
                filter_action: "warn" | "hide";
                keywords: {
                    id: string;
                    keyword: string;
                    whole_word: boolean;
                }[];
                statuses: [];
            },
            200,
        );
    });
});
