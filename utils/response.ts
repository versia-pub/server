import { config } from "~/packages/config-manager";

export const response = (
    data: BodyInit | null = null,
    status = 200,
    headers: Record<string, string> = {},
) => {
    return new Response(data, {
        headers: {
            "X-Frame-Options": "DENY",
            "X-Content-Type-Options": "nosniff",
            "Referrer-Policy": "no-referrer",
            "Strict-Transport-Security": "max-age=3153600",
            "X-Permitted-Cross-Domain-Policies": "none",
            "Access-Control-Allow-Credentials": "true",
            "Access-Control-Allow-Headers":
                "Authorization,Content-Type,Idempotency-Key",
            "Access-Control-Allow-Methods": "POST,PUT,DELETE,GET,PATCH,OPTIONS",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Expose-Headers":
                "Link,X-RateLimit-Reset,X-RateLimit-Limit,X-RateLimit-Remaining,X-Request-Id,Idempotency-Key",
            "Content-Security-Policy":
                "default-src 'none'; frame-ancestors 'none'; form-action 'none'",
            ...headers,
        },
        status,
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

export const redirect = (
    url: string | URL,
    status = 302,
    extraHeaders: Record<string, string> = {},
) => {
    return response(null, status, {
        Location: url.toString(),
        ...extraHeaders,
    });
};

export const proxyUrl = (url: string | null = null) => {
    const urlAsBase64Url = Buffer.from(url || "").toString("base64url");
    return url
        ? new URL(
              `/media/proxy/${urlAsBase64Url}`,
              config.http.base_url,
          ).toString()
        : url;
};
