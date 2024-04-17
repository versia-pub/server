import { parse } from "qs";

/**
 * RequestParser
 * Parses Request object into a JavaScript object
 * based on the Content-Type header
 * @param request Request object
 * @returns JavaScript object of type T
 */
export class RequestParser {
    constructor(public request: Request) {}

    /**
     * Parse request body into a JavaScript object
     * @returns JavaScript object of type T
     * @throws Error if body is invalid
     */
    async toObject<T>() {
        try {
            switch (await this.determineContentType()) {
                case "application/json":
                    return this.parseJson<T>();
                case "application/x-www-form-urlencoded":
                    return this.parseFormUrlencoded<T>();
                case "multipart/form-data":
                    return this.parseFormData<T>();
                default:
                    return this.parseQuery<T>();
            }
        } catch {
            return {} as T;
        }
    }

    /**
     * Determine body content type
     * If there is no Content-Type header, automatically
     * guess content type. Cuts off after ";" character
     * @returns Content-Type header value, or empty string if there is no body
     * @throws Error if body is invalid
     * @private
     */
    private async determineContentType() {
        const content_type = this.request.headers.get("Content-Type");

        if (content_type?.startsWith("application/json")) {
            return "application/json";
        }

        if (content_type?.startsWith("application/x-www-form-urlencoded")) {
            return "application/x-www-form-urlencoded";
        }

        if (content_type?.startsWith("multipart/form-data")) {
            return "multipart/form-data";
        }

        // Check if body is valid JSON
        try {
            await this.request.json();
            return "application/json";
        } catch {
            // This is not JSON
        }

        // Check if body is valid FormData
        try {
            await this.request.formData();
            return "multipart/form-data";
        } catch {
            // This is not FormData
        }

        if (content_type) {
            return content_type.split(";")[0] ?? "";
        }

        if (this.request.body) {
            throw new Error("Invalid body");
        }

        // If there is no body, return query parameters
        return "";
    }

    /**
     * Parse FormData body into a JavaScript object
     * @returns JavaScript object of type T
     * @private
     * @throws Error if body is invalid
     */
    private async parseFormData<T>(): Promise<Partial<T>> {
        const formData = await this.request.formData();
        const result: Partial<T> = {};

        // Check if there are any files in the FormData
        if (
            Array.from(formData.values()).some((value) => value instanceof Blob)
        ) {
            for (const [key, value] of formData.entries()) {
                if (value instanceof Blob) {
                    result[key as keyof T] = value as T[keyof T];
                } else if (key.endsWith("[]")) {
                    const arrayKey = key.slice(0, -2) as keyof T;
                    if (!result[arrayKey]) {
                        result[arrayKey] = [] as T[keyof T];
                    }

                    (result[arrayKey] as FormDataEntryValue[]).push(value);
                } else {
                    result[key as keyof T] = value as T[keyof T];
                }
            }
        } else {
            // Convert to URLSearchParams and parse as query
            const searchParams = new URLSearchParams([
                ...formData.entries(),
            ] as [string, string][]);

            const parsed = parse(searchParams.toString(), {
                parseArrays: true,
                interpretNumericEntities: true,
            });

            return castBooleanObject(
                parsed as PossiblyRecursiveObject,
            ) as Partial<T>;
        }

        return result;
    }

    /**
     * Parse application/x-www-form-urlencoded body into a JavaScript object
     * @returns JavaScript object of type T
     * @private
     * @throws Error if body is invalid
     */
    private async parseFormUrlencoded<T>(): Promise<Partial<T>> {
        const formData = await this.request.formData();
        const result: Partial<T> = {};

        for (const [key, value] of formData.entries()) {
            if (key.endsWith("[]")) {
                const arrayKey = key.slice(0, -2) as keyof T;
                if (!result[arrayKey]) {
                    result[arrayKey] = [] as T[keyof T];
                }

                (result[arrayKey] as FormDataEntryValue[]).push(value);
            } else {
                result[key as keyof T] = value as T[keyof T];
            }
        }

        return result;
    }

    /**
     * Parse JSON body into a JavaScript object
     * @returns JavaScript object of type T
     * @private
     * @throws Error if body is invalid
     */
    private async parseJson<T>(): Promise<T> {
        return (await this.request.json()) as T;
    }

    /**
     * Parse query parameters into a JavaScript object
     * @private
     * @throws Error if body is invalid
     * @returns JavaScript object of type T
     */
    private parseQuery<T>(): Partial<T> {
        const parsed = parse(
            new URL(this.request.url).searchParams.toString(),
            {
                parseArrays: true,
                interpretNumericEntities: true,
            },
        );

        return castBooleanObject(
            parsed as PossiblyRecursiveObject,
        ) as Partial<T>;
    }
}

interface PossiblyRecursiveObject {
    [key: string]:
        | PossiblyRecursiveObject[]
        | PossiblyRecursiveObject
        | string
        | string[]
        | boolean;
}

// Recursive
const castBooleanObject = (value: PossiblyRecursiveObject | string) => {
    if (typeof value === "string") {
        return castBoolean(value);
    }

    for (const key in value) {
        const child = value[key];
        if (Array.isArray(child)) {
            value[key] = child.map((v) => castBooleanObject(v)) as string[];
        } else if (typeof child === "object") {
            value[key] = castBooleanObject(child);
        } else {
            value[key] = castBoolean(child as string);
        }
    }

    return value;
};

const castBoolean = (value: string) => {
    if (["true"].includes(value)) {
        return true;
    }

    if (["false"].includes(value)) {
        return false;
    }

    return value;
};
