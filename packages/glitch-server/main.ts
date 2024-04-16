import { join } from "node:path";
import { redirect } from "@response";
import type { BunFile } from "bun";
import { config } from "config-manager";
import {
    type UserWithRelations,
    retrieveUserFromToken,
    userToAPI,
} from "~database/entities/User";
import type { LogManager, MultiLogManager } from "~packages/log-manager";
import { languages } from "./glitch-languages";

const handleManifestRequest = async () => {
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
            url_template: "share?title={title}\u0026text={text}\u0026url={url}",
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
};

const handleSignInRequest = async (
    req: Request,
    path: string,
    url: URL,
    user: UserWithRelations | null,
    accessToken: string,
) => {
    if (req.method === "POST") {
        if (url.searchParams.get("error")) {
            const fileContents = await Bun.file(
                join(config.frontend.glitch.assets, "/auth/sign_in.html"),
            ).text();

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

            return returnFile(
                Bun.file(
                    join(config.frontend.glitch.assets, "/auth/sign_in.html"),
                ),
                await brandingTransforms(
                    await rewriter.text(),
                    accessToken,
                    user,
                ),
            );
        }
        return redirect("/api/auth/mastodon-login", 307);
    }

    const file = Bun.file(
        join(config.frontend.glitch.assets, "/auth/sign_in.html"),
    );

    return returnFile(
        file,
        await htmlTransforms(
            await brandingTransforms(await file.text(), accessToken, user),
            accessToken,
            user,
        ),
    );
};

const handleSignOutRequest = async (req: Request) => {
    if (req.method === "POST") {
        return redirect("/api/auth/mastodon-logout", 307);
    }

    return redirect("/", 307);
};

const returnFile = async (file: BunFile, content?: string) => {
    return new Response(content ?? (await file.text()), {
        headers: {
            "Content-Type": `${file.type}; charset=utf-8`,
            "Content-Length": String(file.size),
            Date: new Date().toUTCString(),
        },
    });
};

const handleDefaultRequest = async (
    req: Request,
    path: string,
    user: UserWithRelations | null,
    accessToken: string,
) => {
    const file = Bun.file(join(config.frontend.glitch.assets, path));

    if (await file.exists()) {
        const transformedText = await brandingTransforms(
            path.endsWith(".html")
                ? await htmlTransforms(await file.text(), accessToken, user)
                : await file.text(),
            accessToken,
            user,
        );

        return returnFile(file, transformedText);
    }

    return null;
};

const brandingTransforms = async (
    fileContents: string,
    accessToken: string,
    user: UserWithRelations | null,
) => {
    let newFileContents = fileContents;
    for (const server of config.frontend.glitch.server) {
        newFileContents = newFileContents.replaceAll(
            `${new URL(server).origin}/`,
            "/",
        );
        newFileContents = newFileContents.replaceAll(
            new URL(server).host,
            new URL(config.http.base_url).host,
        );
    }

    newFileContents = newFileContents.replaceAll(
        "Glitch-soc is free open source software forked from Mastodon.",
        "Lysand is free and open-source software using the Glitch-Soc frontend.",
    );
    newFileContents = newFileContents.replaceAll("Mastodon", "Lysand");
    newFileContents = newFileContents.replaceAll(
        "Lysand is free, open-source software, and a trademark of Mastodon gGmbH.",
        "This is not a Mastodon instance.",
    );

    newFileContents = newFileContents.replaceAll(
        "joinmastodon.org",
        "lysand.org",
    );

    return newFileContents;
};

const htmlTransforms = async (
    fileContents: string,
    accessToken: string,
    user: UserWithRelations | null,
) => {
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
                            source_url: "https://github.com/lysand-org/lysand",
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
                            max_options: config.validation.max_poll_options,
                            max_option_chars:
                                config.validation.max_poll_option_size,
                            min_expiration: config.validation.min_poll_duration,
                            max_expiration: config.validation.max_poll_duration,
                        },
                        languages: languages,
                        push_subscription: null,
                        role: null,
                    }),
                );
            },
        })
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

    return rewriter.text();
};

export const handleGlitchRequest = async (
    req: Request,
    logger: LogManager | MultiLogManager,
): Promise<Response | null> => {
    const url = new URL(req.url);
    let path = url.pathname;
    const accessToken =
        req.headers.get("Cookie")?.match(/_session_id=(.*?)(;|$)/)?.[1] ?? "";
    const user = await retrieveUserFromToken(accessToken ?? "");

    // Strip leading /web from path
    if (path.startsWith("/web")) path = path.slice(4);

    if (path === "/manifest") {
        return handleManifestRequest();
    }

    if (path === "/auth/sign_in") {
        return handleSignInRequest(req, path, url, user, accessToken);
    }

    if (path === "/auth/sign_out") {
        return handleSignOutRequest(req);
    }

    if (
        req.headers.get("Accept")?.includes("text/html") &&
        !path.includes(".")
    ) {
        path = "/index.html";
    }

    return handleDefaultRequest(req, path, user, accessToken);
};
