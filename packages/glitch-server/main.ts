import { join } from "node:path";
import { config } from "config-manager";
import type { LogManager, MultiLogManager } from "~packages/log-manager";
import { languages } from "./glitch-languages";

export const handleGlitchRequest = async (
    req: Request,
    logger: LogManager | MultiLogManager,
): Promise<Response | null> => {
    const url = new URL(req.url);
    let path = url.pathname;

    // Strip leading /web from path
    if (path.startsWith("/web")) path = path.slice(4);

    // Redirect / to /index.html
    if (path === "/" || path === "") path = "/index.html";
    // If path doesn't have an extension (e.g. /about), serve index.html
    // Also check if Accept header contains text/html
    if (!path.includes(".") && req.headers.get("Accept")?.includes("text/html"))
        path = "/index.html";

    const file = Bun.file(join(config.frontend.glitch.assets, path));

    if (await file.exists()) {
        let fileContents = await file.text();

        for (const server of config.frontend.glitch.server) {
            fileContents = fileContents.replace(
                `${new URL(server).origin}/`,
                "/",
            );
        }

        fileContents = fileContents.replaceAll(
            "Glitch-soc is free open source software forked from Mastodon.",
            "Lysand is free and open-source software using the Glitch-Soc frontend.",
        );
        fileContents = fileContents.replaceAll("Mastodon", "Lysand");
        fileContents = fileContents.replaceAll(
            "Lysand is free, open-source software, and a trademark of Mastodon gGmbH.",
            "This is not a Mastodon instance.",
        );
        fileContents = fileContents.replaceAll(
            "joinmastodon.org",
            "lysand.org",
        );

        // Check if file is index
        if (path === "/index.html") {
            // Find script id="initial-state" and replace its contents with custom json
            const rewriter = new HTMLRewriter()
                .on("script#initial-state", {
                    element(element) {
                        element.setInnerContent(
                            JSON.stringify({
                                meta: {
                                    access_token: null,
                                    activity_api_enabled: true,
                                    admin: null,
                                    domain: new URL(config.http.base_url).host,
                                    limited_federation_mode: false,
                                    locale: "en",
                                    mascot: "https://media.tech.lgbt/site_uploads/files/000/000/004/original/1a16a73feb5c2463.png",
                                    profile_directory: true,
                                    registrations_open: true,
                                    repository: "lysand-org/lysand",
                                    search_enabled: true,
                                    single_user_mode: false,
                                    source_url:
                                        "https://github.com/lysand-org/lysand",
                                    sso_redirect: null,
                                    status_page_url: null,
                                    streaming_api_base_url: null,
                                    timeline_preview: true,
                                    title: config.instance.name,
                                    trends_as_landing_page: false,
                                    trends_enabled: true,
                                    version: "4.3.0-alpha.3+glitch",
                                    auto_play_gif: null,
                                    display_media: null,
                                    reduce_motion: null,
                                    use_blurhash: null,
                                },
                                compose: { text: "" },
                                accounts: {},
                                media_attachments: {
                                    accept_content_types:
                                        config.validation.allowed_mime_types,
                                },
                                settings: {},
                                max_feed_hashtags: 4,
                                poll_limits: {
                                    max_options:
                                        config.validation.max_poll_options,
                                    max_option_chars:
                                        config.validation.max_poll_option_size,
                                    min_expiration:
                                        config.validation.min_poll_duration,
                                    max_expiration:
                                        config.validation.max_poll_duration,
                                },
                                languages: languages,
                                push_subscription: null,
                                role: null,
                            }),
                        );
                    },
                })
                .transform(new Response(fileContents));

            fileContents = await rewriter.text();
        }
        return new Response(fileContents, {
            headers: {
                "Content-Type": `${file.type}; charset=utf-8`,
                "Content-Length": String(file.size),
                Date: new Date().toUTCString(),
            },
        });
    }

    return null;
};
