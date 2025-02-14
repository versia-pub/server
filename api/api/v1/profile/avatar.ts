import { apiRoute, auth, reusedResponses } from "@/api";
import { createRoute } from "@hono/zod-openapi";
import { RolePermissions } from "@versia/kit/tables";
import { Account } from "~/classes/schemas/account";

const route = createRoute({
    method: "delete",
    path: "/api/v1/profile/avatar",
    summary: "Delete profile avatar",
    description: "Deletes the avatar associated with the user’s profile.",
    externalDocs: {
        url: "https://docs.joinmastodon.org/methods/profile/#delete-profile-avatar",
    },
    tags: ["Profile"],
    middleware: [
        auth({
            auth: true,
            permissions: [RolePermissions.ManageOwnAccount],
            scopes: ["write:account"],
        }),
    ] as const,
    responses: {
        200: {
            description:
                "The avatar was successfully deleted from the user’s profile. If there were no avatar associated with the profile, the response will still indicate a successful deletion.",
            content: {
                "application/json": {
                    // TODO: Return a CredentialAccount
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
