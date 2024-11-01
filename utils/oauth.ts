import type { Application } from "@versia/kit/db";

/**
 * Check if an OAuth application is valid for a route
 * @param application The OAuth application
 * @param routeScopes The scopes required for the route
 * @returns Whether the OAuth application is valid for the route
 */
export const checkIfOauthIsValid = (
    application: Application,
    routeScopes: string[],
) => {
    if (routeScopes.length === 0) {
        return true;
    }

    const hasAllWriteScopes =
        application.data.scopes.split(" ").includes("write:*") ||
        application.data.scopes.split(" ").includes("write");

    const hasAllReadScopes =
        application.data.scopes.split(" ").includes("read:*") ||
        application.data.scopes.split(" ").includes("read");

    if (hasAllWriteScopes && hasAllReadScopes) {
        return true;
    }

    let nonMatchedScopes = routeScopes;

    if (hasAllWriteScopes) {
        // Filter out all write scopes as valid
        nonMatchedScopes = routeScopes.filter(
            (scope) => !scope.startsWith("write:"),
        );
    }

    if (hasAllReadScopes) {
        // Filter out all read scopes as valid
        nonMatchedScopes = routeScopes.filter(
            (scope) => !scope.startsWith("read:"),
        );
    }

    // If there are still scopes left, check if they match
    // If there are no scopes left, return true
    if (nonMatchedScopes.length === 0) {
        return true;
    }

    // If there are scopes left, check if they match
    return nonMatchedScopes.every((scope) =>
        application.data.scopes.split(" ").includes(scope),
    );
};
