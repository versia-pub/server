import { apiRoute, applyConfig, auth, jsonOrForm } from "@/api";
import { createRoute } from "@hono/zod-openapi";
import { db } from "@versia/kit/db";
import { FilterKeywords, Filters, RolePermissions } from "@versia/kit/tables";
import { type SQL, and, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { ApiError } from "~/classes/errors/api-error";
import { ErrorSchema } from "~/types/api";

export const meta = applyConfig({
    route: "/api/v2/filters/:id",
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
    param: z.object({
        id: z.string().uuid(),
    }),
    json: z.object({
        title: z.string().trim().min(1).max(100).optional(),
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
            .optional(),
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
                    keyword: z.string().trim().min(1).max(100).optional(),
                    id: z.string().uuid().optional(),
                    whole_word: z
                        .string()
                        .transform((v) =>
                            ["true", "1", "on"].includes(v.toLowerCase()),
                        )
                        .optional(),
                    // biome-ignore lint/style/useNamingConvention: _destroy is a Mastodon API imposed variable name
                    _destroy: z
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
    path: "/api/v2/filters/{id}",
    summary: "Get filter",
    middleware: [
        auth({
            auth: true,
            permissions: [RolePermissions.ManageOwnFilters],
        }),
    ] as const,
    request: {
        params: schemas.param,
    },
    responses: {
        200: {
            description: "Filter",
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
        404: {
            description: "Filter not found",
            content: {
                "application/json": {
                    schema: ErrorSchema,
                },
            },
        },
    },
});

const routePut = createRoute({
    method: "put",
    path: "/api/v2/filters/{id}",
    summary: "Update filter",
    middleware: [
        auth({
            auth: true,
            permissions: [RolePermissions.ManageOwnFilters],
        }),
        jsonOrForm(),
    ] as const,
    request: {
        params: schemas.param,
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
            description: "Filter updated",
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
        404: {
            description: "Filter not found",
            content: {
                "application/json": {
                    schema: ErrorSchema,
                },
            },
        },
    },
});

const routeDelete = createRoute({
    method: "delete",
    path: "/api/v2/filters/{id}",
    summary: "Delete filter",
    middleware: [
        auth({
            auth: true,
            permissions: [RolePermissions.ManageOwnFilters],
        }),
    ] as const,
    request: {
        params: schemas.param,
    },
    responses: {
        204: {
            description: "Filter deleted",
        },
        401: {
            description: "Unauthorized",
            content: {
                "application/json": {
                    schema: ErrorSchema,
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
    },
});

export default apiRoute((app) => {
    app.openapi(routeGet, async (context) => {
        const { user } = context.get("auth");
        const { id } = context.req.valid("param");

        if (!user) {
            throw new ApiError(401, "Unauthorized");
        }

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

        if (!user) {
            throw new ApiError(401, "Unauthorized");
        }

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

        if (!user) {
            throw new ApiError(401, "Unauthorized");
        }

        await db
            .delete(Filters)
            .where(and(eq(Filters.userId, user.id), eq(Filters.id, id)));

        return context.body(null, 204);
    });
});
