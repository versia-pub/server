export const response = (
    data: BodyInit | null = null,
    status = 200,
    headers: Record<string, string> = {},
) => {
    return new Response(data, {
        headers: {
            "Content-Type": "application/json",
            "X-Frame-Options": "DENY",
            "X-Permitted-Cross-Domain-Policies": "none",
            "Access-Control-Allow-Credentials": "true",
            "Access-Control-Allow-Headers":
                "Authorization,Content-Type,Idempotency-Key",
            "Access-Control-Allow-Methods": "POST,PUT,DELETE,GET,PATCH,OPTIONS",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Expose-Headers":
                "Link,X-RateLimit-Reset,X-RateLimit-Limit,X-RateLimit-Remaining,X-Request-Id,Idempotency-Key",
            // CSP should follow  Content Security Policy directive: "connect-src 'self' blob: https: wss:".
            "Content-Security-Policy":
                "default-src 'none'; frame-ancestors 'none'; form-action 'none'",
            ...headers,
        },
        status,
    });
};

export const clientResponse = (
    data: BodyInit | null = null,
    status = 200,
    headers: Record<string, string> = {},
) => {
    return response(data, status, {
        ...headers,
        "Content-Security-Policy": "", //"default-src 'none'; frame-ancestors 'none'; form-action 'self'; connect-src 'self' blob: https: wss:; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; object-src 'none'; media-src 'self'; frame-src 'none'; worker-src 'self'; manifest-src 'self'; prefetch-src 'self'; base-uri 'none';",
    });
};

export const jsonResponse = (
    data: object,
    status = 200,
    headers: Record<string, string> = {},
) => {
    return response(JSON.stringify(data), status, {
        "Content-Type": "application/json",
        ...headers,
    });
};

export const xmlResponse = (data: string, status = 200) => {
    return response(data, status, {
        "Content-Type": "application/xml",
    });
};

export const errorResponse = (error: string, status = 500) => {
    return jsonResponse(
        {
            error: error,
        },
        status,
    );
};

export const redirect = (url: string | URL, status = 302) => {
    return response(null, status, {
        Location: url.toString(),
    });
};
