import { RolePermission } from "@versia/client/schemas";
import { describeRoute } from "hono-openapi";
import { resolver, validator } from "hono-openapi/zod";
import { z } from "zod";
import { apiRoute, auth, handleZodError, withUserParam } from "@/api";
import { getFeed } from "@/rss";
import { ApiError } from "~/classes/errors/api-error";

export default apiRoute((app) =>
    app.get(
        "/api/v1/accounts/:id/feed.atom",
        describeRoute({
            summary: "Get account's Atom feed",
            description:
                "Statuses posted to the given account, in Atom 1.0 format.",
            tags: ["Accounts"],
            responses: {
                200: {
                    description: "Statuses posted to the given account.",
                    content: {
                        "application/atom+xml": {
                            schema: resolver(z.any()),
                        },
                    },
                },
                404: ApiError.accountNotFound().schema,
                422: ApiError.validationFailed().schema,
            },
        }),
        withUserParam,
        auth({
            auth: false,
            permissions: [
                RolePermission.ViewNotes,
                RolePermission.ViewAccounts,
            ],
            scopes: ["read:statuses"],
        }),
        validator(
            "query",
            z.object({
                page: z.coerce.number().default(0).openapi({
                    description: "Page number to fetch. Defaults to 0.",
                    example: 2,
                }),
            }),
            handleZodError,
        ),
        async (context) => {
            const otherUser = context.get("user");

            const { page } = context.req.valid("query");

            const feed = await getFeed(otherUser, page);

            context.header("Content-Type", "application/atom+xml");

            return context.body(feed.atom1(), 200);
        },
    ),
);
