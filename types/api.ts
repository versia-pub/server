export interface APIRouteMeta {
	allowedMethods: ("GET" | "POST" | "PUT" | "DELETE" | "PATCH")[];
	ratelimits: {
		max: number;
		duration: number;
	};
	route: string;
	auth: {
		required: boolean;
		requiredOnMethods?: ("GET" | "POST" | "PUT" | "DELETE" | "PATCH")[];
		oauthPermissions?: string[];
	};
}
