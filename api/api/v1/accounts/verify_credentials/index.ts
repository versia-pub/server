import { apiRoute, auth, reusedResponses } from "@/api";
import { createRoute } from "@hono/zod-openapi";
import { Account } from "@versia/client/schemas";

const route = createRoute({
    method: "get",
    path: "/api/v1/accounts/verify_credentials",
    summary: "Verify account credentials",
    description: "Test to make sure that the user token works.",
    externalDocs: {
        url: "https://docs.joinmastodon.org/methods/accounts/#verify_credentials",
    },
    tags: ["Accounts"],
    middleware: [
        auth({
            auth: true,
            scopes: ["read:accounts"],
        }),
    ] as const,
    responses: {
        200: {
            // TODO: Implement CredentialAccount
            description:
                "Note the extra source property, which is not visible on accounts other than your own. Also note that plain-text is used within source and HTML is used for their corresponding properties such as note and fields.",
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
    app.openapi(route, (context) => {
        // TODO: Add checks for disabled/unverified accounts
        const { user } = context.get("auth");

        return context.json(user.toApi(true), 200);
    }),
);
