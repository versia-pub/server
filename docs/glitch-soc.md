# Enabling Glitch-Soc

Versia Server supports the use of the Glitch-Soc fork of Mastodon's frontend. Here's how to do it:

1. Download the latest Glitch FE package from [the releases page](https://github.com/lysand-org/server/releases) (it should be named `glitch.tar.gz` and be inside the assets of a normal Versia Server release).
2. Extract the contents of the package into a folder, which you can name `glitch` for simplicity. (if using Docker, now is the time to mount that folder into the container, for example with `-v /path/to/glitch:/app/dist/glitch`)
3. Change the config to enable Glitch-FE:
    ```toml
    [frontend]
    # Enable custom frontends (warning: not enabling this or Glitch will make Versia Server only accessible via the Mastodon API)
    # Frontends also control the OAuth flow, so if you disable this, you will need to use the Mastodon frontend
    enabled = true
    # The URL to reach the frontend at (should be on a local network)
    url = "http://localhost:3000"

    [frontend.glitch]
    # Enable the Glitch frontend integration
    enabled = true
    # Glitch assets folder
    assets = "glitch"
    # Server the assets were ripped from (and any eventual CDNs)
    server = ["https://tech.lgbt"]
    ```
    The `server` option can be left as-is, unless you have downloaded your own `index.html` file from a different Glitch instance.
4. Start Versia Server and navigate to `/` to see the Glitch frontend in action.

## How is this package created?

Glitch-FE is a React single-page app, which dynamically creates an `index.html` file on every request and builds all the other assets at build time.

The package static files were taken from a build of Glitch-Soc, while the index.html file was taken from [the tech.lgbt instance](https://tech.lgbt) with `cURL`.

Then, the paths in the `index.html` file were replaced with the correct paths for the static files (as they have different hashes in their names from the ones in the Glitch-Soc build).

At runtime, Versia Server dynamically edits the index.html file to replace the content with correct data, as well as disabling `integrity` checks on the script/link tags.

In the future, I'll find a way to make this less hacky and more user-friendly, but for now, this is the best I can do.