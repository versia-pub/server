import { config } from "~/config.ts";

export class ProxiableUrl extends URL {
    private isAllowedOrigin(): boolean {
        const allowedOrigins: URL[] = [config.http.base_url].concat(
            config.s3?.public_url ?? [],
        );

        return allowedOrigins.some((origin) =>
            this.hostname.endsWith(origin.hostname),
        );
    }

    public get proxied(): string {
        // Don't proxy from CDN and self, since those sources are trusted
        if (this.isAllowedOrigin()) {
            return this.href;
        }

        const urlAsBase64Url = Buffer.from(this.href).toString("base64url");

        return new URL(`/media/proxy/${urlAsBase64Url}`, config.http.base_url)
            .href;
    }
}
