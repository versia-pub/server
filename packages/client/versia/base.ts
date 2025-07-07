import { DEFAULT_UA } from "./constants.ts";

type HttpVerb = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
type ConvertibleObject = {
    [key: string]:
        | string
        | number
        | boolean
        | File
        | undefined
        | null
        | ConvertibleObject[]
        | ConvertibleObject;
};

/**
 * Output of a request. Contains the data and headers.
 * @template ReturnType The type of the data returned by the request.
 */
export interface Output<ReturnType> {
    data: ReturnType;
    ok: boolean;
    raw: Response;
}

const objectToFormData = (
    obj: ConvertibleObject,
    formData = new FormData(),
    parentKey = "",
): FormData => {
    if (obj === undefined || obj === null) {
        return formData;
    }

    for (const key of Object.keys(obj)) {
        const value = obj[key];
        const fullKey = parentKey ? `${parentKey}[${key}]` : key;

        if (value === undefined || value === null) {
            continue;
        }

        if (value instanceof File) {
            formData.append(fullKey, value as Blob);
        } else if (Array.isArray(value)) {
            for (const [index, item] of value.entries()) {
                const arrayKey = `${fullKey}[${index}]`;

                if (item instanceof File) {
                    formData.append(arrayKey, item);
                } else if (typeof item === "object") {
                    objectToFormData(item, formData, arrayKey);
                } else {
                    formData.append(arrayKey, String(item));
                }
            }
        } else if (typeof value === "object") {
            objectToFormData(value, formData, fullKey);
        } else {
            formData.append(fullKey, String(value));
        }
    }

    return formData;
};

/**
 * Wrapper around Error, useful for detecting if an error
 * is due to a failed request.
 *
 * Throws if the request returns invalid or unexpected data.
 */
export class ResponseError<
    ReturnType = {
        error?: string;
    },
> extends Error {
    public constructor(
        public response: Output<ReturnType>,
        message: string,
    ) {
        super(message);
        this.name = "ResponseError";
    }
}

export class BaseClient {
    public constructor(
        protected baseUrl: URL,
        private readonly accessToken?: string,
        private readonly options: {
            globalCatch?: (error: ResponseError) => void;
            throwOnError?: boolean;
        } = {},
    ) {}

    public get url(): URL {
        return this.baseUrl;
    }

    public get token(): string | undefined {
        return this.accessToken;
    }

    /** Overridable by testing */
    // biome-ignore lint/nursery/useReadonlyClassProperties: Overridable by testing
    private fetch = (...args: Parameters<typeof fetch>) => fetch(...args);

    private async request<ReturnType>(
        request: Request,
    ): Promise<Output<ReturnType>> {
        const result = await this.fetch(request);
        const isJson = result.headers
            .get("Content-Type")
            ?.includes("application/json");

        if (!result.ok && this.options.throwOnError) {
            const error = isJson
                ? await result.clone().json()
                : await result.clone().text();
            throw new ResponseError(
                {
                    data: error,
                    ok: false,
                    raw: result,
                },
                `Request failed (${result.status}): ${
                    error.error || error.message || result.statusText
                }`,
            );
        }

        return {
            data: isJson
                ? await result.clone().json()
                : (await result.clone().text()) || null,
            ok: result.ok,
            raw: result,
        };
    }

    private constructRequest(
        path: string,
        method: HttpVerb,
        body?: object | FormData,
        extra?: RequestInit,
    ): Request {
        const headers = new Headers({
            "User-Agent": DEFAULT_UA,
        });

        if (this.accessToken) {
            headers.set("Authorization", `Bearer ${this.accessToken}`);
        }
        if (body && !(body instanceof FormData)) {
            headers.set("Content-Type", "application/json; charset=utf-8");
        } // else: let FormData set the content type, as it knows best (boundary, etc.)

        for (const [key, value] of Object.entries(extra?.headers || {})) {
            headers.set(key, value);
        }

        return new Request(new URL(path, this.baseUrl).toString(), {
            method,
            headers,
            body: body
                ? body instanceof FormData
                    ? body
                    : JSON.stringify(body)
                : undefined,
            ...extra,
        });
    }

    public get<ReturnType = void>(
        path: string,
        extra?: RequestInit,
    ): Promise<Output<ReturnType>> {
        return this.request<ReturnType>(
            this.constructRequest(path, "GET", undefined, extra),
        ).catch((e) => {
            this.options.globalCatch?.(e);
            throw e;
        });
    }

    public post<ReturnType = void>(
        path: string,
        body?: object,
        extra?: RequestInit,
    ): Promise<Output<ReturnType>> {
        return this.request<ReturnType>(
            this.constructRequest(path, "POST", body, extra),
        ).catch((e) => {
            this.options.globalCatch?.(e);
            throw e;
        });
    }

    public postForm<ReturnType = void>(
        path: string,
        body: FormData | ConvertibleObject,
        extra?: RequestInit,
    ): Promise<Output<ReturnType>> {
        return this.request<ReturnType>(
            this.constructRequest(
                path,
                "POST",
                body instanceof FormData ? body : objectToFormData(body),
                extra,
            ),
        ).catch((e) => {
            this.options.globalCatch?.(e);
            throw e;
        });
    }

    public put<ReturnType = void>(
        path: string,
        body?: object,
        extra?: RequestInit,
    ): Promise<Output<ReturnType>> {
        return this.request<ReturnType>(
            this.constructRequest(path, "PUT", body, extra),
        ).catch((e) => {
            this.options.globalCatch?.(e);
            throw e;
        });
    }

    public putForm<ReturnType = void>(
        path: string,
        body: FormData | ConvertibleObject,
        extra?: RequestInit,
    ): Promise<Output<ReturnType>> {
        return this.request<ReturnType>(
            this.constructRequest(
                path,
                "PUT",
                body instanceof FormData ? body : objectToFormData(body),
                extra,
            ),
        ).catch((e) => {
            this.options.globalCatch?.(e);
            throw e;
        });
    }

    public patch<ReturnType = void>(
        path: string,
        body?: object,
        extra?: RequestInit,
    ): Promise<Output<ReturnType>> {
        return this.request<ReturnType>(
            this.constructRequest(path, "PATCH", body, extra),
        ).catch((e) => {
            this.options.globalCatch?.(e);
            throw e;
        });
    }

    public patchForm<ReturnType = void>(
        path: string,
        body: FormData | ConvertibleObject,
        extra?: RequestInit,
    ): Promise<Output<ReturnType>> {
        return this.request<ReturnType>(
            this.constructRequest(
                path,
                "PATCH",
                body instanceof FormData ? body : objectToFormData(body),
                extra,
            ),
        ).catch((e) => {
            this.options.globalCatch?.(e);
            throw e;
        });
    }

    public delete<ReturnType = void>(
        path: string,
        body?: object,
        extra?: RequestInit,
    ): Promise<Output<ReturnType>> {
        return this.request<ReturnType>(
            this.constructRequest(path, "DELETE", body, extra),
        ).catch((e) => {
            this.options.globalCatch?.(e);
            throw e;
        });
    }

    public deleteForm<ReturnType = void>(
        path: string,
        body: FormData | ConvertibleObject,
        extra?: RequestInit,
    ): Promise<Output<ReturnType>> {
        return this.request<ReturnType>(
            this.constructRequest(
                path,
                "DELETE",
                body instanceof FormData ? body : objectToFormData(body),
                extra,
            ),
        ).catch((e) => {
            this.options.globalCatch?.(e);
            throw e;
        });
    }
}
