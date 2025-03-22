import { apiRoute, auth, reusedResponses } from "@/api";
import { createRoute } from "@hono/zod-openapi";
import { Account } from "@versia/client/schemas";
import { RolePermission } from "@versia/client/schemas";

const route = createRoute({
    method: "delete",
    path: "/api/v1/profile/header",
    summary: "Delete profile header",
    description: "Deletes the header image associated with the user’s profile.",
    externalDocs: {
        url: "https://docs.joinmastodon.org/methods/profile/#delete-profile-header",
    },
    tags: ["Profiles"],
    middleware: [
        auth({
            auth: true,
            permissions: [RolePermission.ManageOwnAccount],
            scopes: ["write:account"],
        }),
    ] as const,
    responses: {
        200: {
            description:
                "The header was successfully deleted from the user’s profile. If there were no header associated with the profile, the response will still indicate a successful deletion.",
            content: {
                "application/json": {
                    schema: Account,
                },
            },
        },
        ...reusedResponses,
    },
});

export default apiRoute((app) =>
    app.openapi(route, async (context) => {
        const { user } = context.get("auth");

        await user.header?.delete();

        return context.json(user.toApi(true), 200);
    }),
);
