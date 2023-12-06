import type { Application } from "@prisma/client";

/**
 * Check if an OAuth application is valid for a route
 * @param application The OAuth application
 * @param routeScopes The scopes required for the route
 * @returns Whether the OAuth application is valid for the route
 */
export const checkIfOauthIsValid = (
	application: Application,
	routeScopes: string[]
) => {
	if (routeScopes.length === 0) {
		return true;
	}

	const hasAllWriteScopes =
		application.scopes.split(" ").includes("write:*") ||
		application.scopes.split(" ").includes("write");

	const hasAllReadScopes =
		application.scopes.split(" ").includes("read:*") ||
		application.scopes.split(" ").includes("read");

	if (hasAllWriteScopes && hasAllReadScopes) {
		return true;
	}

	let nonMatchedScopes = routeScopes;

	if (hasAllWriteScopes) {
		// Filter out all write scopes as valid
		nonMatchedScopes = routeScopes.filter(
			scope => !scope.startsWith("write:")
		);
	}

	if (hasAllReadScopes) {
		// Filter out all read scopes as valid
		nonMatchedScopes = routeScopes.filter(
			scope => !scope.startsWith("read:")
		);
	}

	// If there are still scopes left, check if they match
	// If there are no scopes left, return true
	if (nonMatchedScopes.length === 0) {
		return true;
	}

	// If there are scopes left, check if they match
	if (
		nonMatchedScopes.every(scope =>
			application.scopes.split(" ").includes(scope)
		)
	) {
		return true;
	}

	return false;
};

export const oauthCodeVerifiers: Record<string, string> = {};
