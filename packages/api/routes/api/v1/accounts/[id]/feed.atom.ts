import { RolePermission } from "@versia/client/schemas";
import { ApiError } from "@versia-server/kit";
import {
    apiRoute,
    auth,
    handleZodError,
    withUserParam,
} from "@versia-server/kit/api";
import { describeRoute, resolver, validator } from "hono-openapi";
import { z } from "zod/v4";
import { getFeed } from "@/rss";

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
                page: z.coerce.number().default(0).meta({
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
