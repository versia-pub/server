import { join } from "node:path";
import { redirect } from "@response";
import { config } from "config-manager";
import { retrieveUserFromToken, userToAPI } from "~database/entities/User";
import type { LogManager, MultiLogManager } from "~packages/log-manager";
import { languages } from "./glitch-languages";

export const handleGlitchRequest = async (
    req: Request,
    logger: LogManager | MultiLogManager,
): Promise<Response | null> => {
    const url = new URL(req.url);
    let path = url.pathname;
    const accessToken = req.headers
        .get("Cookie")
        ?.match(/_session_id=(.*?)(;|$)/)?.[1];
    const user = await retrieveUserFromToken(accessToken ?? "");

    // Strip leading /web from path
    if (path.startsWith("/web")) path = path.slice(4);

    if (path === "/manifest") {
        const manifest = {
            id: "/home",
            name: config.instance.name,
            short_name: config.instance.name,
            icons: [
                {
                    src: "/packs/media/icons/android-chrome-36x36-e67f2bc645cc669c04ffcbc17203aeac.png",
                    sizes: "36x36",
                    type: "image/png",
                    purpose: "any maskable",
                },
                {
                    src: "/packs/media/icons/android-chrome-48x48-d3afc36e9388913fb6add2476a556f67.png",
                    sizes: "48x48",
                    type: "image/png",
                    purpose: "any maskable",
                },
                {
                    src: "/packs/media/icons/android-chrome-72x72-23ee104da45dc5388d59b8b0fad866f2.png",
                    sizes: "72x72",
                    type: "image/png",
                    purpose: "any maskable",
                },
                {
                    src: "/packs/media/icons/android-chrome-96x96-fb2abfd885ab5de94025e09f6f9408b5.png",
                    sizes: "96x96",
                    type: "image/png",
                    purpose: "any maskable",
                },
                {
                    src: "/packs/media/icons/android-chrome-144x144-99b386f89a3a2a22440964eba3b9f242.png",
                    sizes: "144x144",
                    type: "image/png",
                    purpose: "any maskable",
                },
                {
                    src: "/packs/media/icons/android-chrome-192x192-8b4d35fdd9b5fa4592056ce687c9d0ba.png",
                    sizes: "192x192",
                    type: "image/png",
                    purpose: "any maskable",
                },
                {
                    src: "/packs/media/icons/android-chrome-256x256-fecf6504157e3b195dd0e604cd711730.png",
                    sizes: "256x256",
                    type: "image/png",
                    purpose: "any maskable",
                },
                {
                    src: "/packs/media/icons/android-chrome-384x384-dc559d916be51de4965dd7b8abf9c7c8.png",
                    sizes: "384x384",
                    type: "image/png",
                    purpose: "any maskable",
                },
                {
                    src: "/packs/media/icons/android-chrome-512x512-85515d059c83f47d8e77e0703ebb7ff5.png",
                    sizes: "512x512",
                    type: "image/png",
                    purpose: "any maskable",
                },
            ],
            theme_color: "#191b22",
            background_color: "#191b22",
            display: "standalone",
            start_url: "/",
            scope: "/",
            share_target: {
                url_template:
                    "share?title={title}\u0026text={text}\u0026url={url}",
                action: "share",
                method: "GET",
                enctype: "application/x-www-form-urlencoded",
                params: { title: "title", text: "text", url: "url" },
            },
            shortcuts: [
                { name: "Compose new post", url: "/publish" },
                { name: "Notifications", url: "/notifications" },
                { name: "Explore", url: "/explore" },
            ],
        };

        return new Response(JSON.stringify(manifest), {
            headers: {
                "Content-Type": "application/json; charset=utf-8",
                "Content-Length": String(JSON.stringify(manifest).length),
                Date: new Date().toUTCString(),
            },
        });
    }

    if (path === "/auth/sign_in") {
        if (req.method === "POST") {
            return redirect("/api/auth/mastodon-login", 307);
        }
        path = "/auth/sign_in.html";
    }

    if (path === "/auth/sign_out") {
        if (req.method === "POST") {
            return redirect("/api/auth/mastodon-logout", 307);
        }
    }

    // Redirect / to /index.html
    if (path === "/" || path === "") path = "/index.html";
    // If path doesn't have an extension (e.g. /about), serve index.html
    // Also check if Accept header contains text/html
    if (!path.includes(".") && req.headers.get("Accept")?.includes("text/html"))
        path = "/index.html";

    const file = Bun.file(join(config.frontend.glitch.assets, path));

    if (await file.exists()) {
        let fileContents = await file.text();

        if (path === "/auth/sign_in.html" && url.searchParams.get("error")) {
            // Insert error message as first child of form.form_container
            const rewriter = new HTMLRewriter()
                .on("div.form-container", {
                    element(element) {
                        element.prepend(
                            ` <div class='flash-message alert'>
                            <strong>${decodeURIComponent(
                                url.searchParams.get("error") ?? "",
                            )}</strong>
                        </div>`,
                            {
                                html: true,
                            },
                        );
                    },
                })
                .transform(new Response(fileContents));

            fileContents = await rewriter.text();
        }
        for (const server of config.frontend.glitch.server) {
            fileContents = fileContents.replaceAll(
                `${new URL(server).origin}/`,
                "/",
            );
            fileContents = fileContents.replaceAll(
                new URL(server).host,
                new URL(config.http.base_url).host,
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

        // Strip integrity attributes from script and link tags
        const rewriter = new HTMLRewriter()
            .on("script", {
                element(element) {
                    element.removeAttribute("integrity");
                },
            })
            .on("link", {
                element(element) {
                    element.removeAttribute("integrity");
                },
            })
            .transform(new Response(fileContents));

        fileContents = await rewriter.text();

        // Check if file is index
        if (path === "/index.html") {
            // Find script id="initial-state" and replace its contents with custom json
            const rewriter = new HTMLRewriter()
                .on("script#initial-state", {
                    element(element) {
                        element.setInnerContent(
                            JSON.stringify({
                                meta: {
                                    access_token: accessToken || null,
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
                                    streaming_api_base_url: `wss://${
                                        new URL(config.http.base_url).host
                                    }`,
                                    timeline_preview: true,
                                    title: config.instance.name,
                                    trends_as_landing_page: false,
                                    trends_enabled: true,
                                    version: "4.3.0-alpha.3+glitch",
                                    auto_play_gif: null,
                                    display_media: null,
                                    reduce_motion: null,
                                    use_blurhash: null,
                                    me: user ? user.id : undefined,
                                },
                                compose: user
                                    ? {
                                          text: "",
                                          me: user.id,
                                          default_privacy: "public",
                                          default_sensitive: false,
                                          default_language: "en",
                                      }
                                    : {
                                          text: "",
                                      },
                                accounts: user
                                    ? {
                                          [user.id]: userToAPI(user, true),
                                      }
                                    : {},
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
