# `0.7.0` (unreleased)

> [!WARNING]
> This release marks the rename of the project from `Lysand` to `Versia`.

## Backwards Compatibility

Versia Server `0.7.0` is backwards compatible with `0.6.0`. However, some new features may not be available to older clients. Notably, `versia-fe` has had major improvements and will not work with `0.6.0`.

## Features

- Upgraded Bun to `1.1.34`. This brings performance upgrades and better stability.
- Added support for the [ActivityPub Federation Bridge](https://github.com/versia-pub/activitypub).
- Added support for the [Sonic](https://github.com/valeriansaliou/sonic) search indexer.
- Note deletions are now federated.
- Note edits are now federated.
- Added support for [Sentry](https://sentry.io).
- Added option for more federation debug logging.
- Added [**Roles API**](https://server.versia.pub/api/roles).
- Added [**Permissions API**](https://server.versia.pub/api/roles) and enabled it for every route.
- Added [**TOS and Privacy Policy**](https://server.versia.pub/api/mastodon) endpoints.
- Added [**Challenge API**](https://server.versia.pub/api/challenges). (basically CAPTCHAS). This can be enabled/disabled by administrators. No `versia-fe` support yet.
- Added ability to refetch user data from remote instances.
- Added ability to change the `username` of a user. ([Mastodon API extension](https://server.versia.pub/api/mastodon#api-v1-accounts-update-credentials)).
- Added an endpoint to get a user by its username.
- Add OpenID Connect registration support. Admins can now disable username/password registration entirely and still allow users to sign up via OpenID Connect.
- Add option to never convert vector images to a raster format.
- Refactor logging system to be more robust and easier to use. Log files are now automatically rotated.
- Add support for HTTP proxies.
- Add support for serving Versia over a Tor hidden service.
- Add global server error handler, to properly return 500 error messages to clients.
- Sign all federation HTTP requests.
- Add JSON schema for configuration file.
- Rewrite federation stack
- Updated federation to Versia 0.4
- Implement OAuth2 token revocation
- Add new **Plugin API**

## Plugin System

A new plugin system for extending Versia Server has been added in this release!

> [!NOTE]
> 
> This is an internal feature and is not documented. Support for third-party plugins will be given on a "if we have time" basis, until the API is fully stabilized and documented

Plugins using this framework support:

- [x] Plugin hotswapping and hotreloading
- [x] Manifest files (JSON, JSON5, JSONC supported) with metadata (JSON schema provided)
- [x] Installation by dropping a folder into the plugins/ directory
- [x] Support for plugins having their own NPM dependencies
- [x] Support for storing plugins' configuration in the main config.toml (single source of truth)
- [x] Schema-based strict config validation (plugins can specify their own schemas)
- [x] Full type-safety
- [x] Custom hooks
- [x] FFI compatibility (with `bun:ffi` or Node's FFI)
- [x] Custom API route registration or overriding or middlewaring
- [x] Automatic OpenAPI schema generation for all installed plugins
- [x] End-to-end and unit testing supported
- [x] Automatic user input validation for API routes with schemas (specify a schema for the route and the server will take care of validating everything)
- [x] Access to internal database abstractions
- [x] Support for sending raw SQL to database (type-safe!)
- [x] Plugin autoload on startup with override controls (enable/disable)

As a demonstration of the power of this system and an effort to modularize the codebase further, OpenID functionality has been moved to a plugin. This plugin is required for login.

## Bug Fixes

- Fix favouriting/unfavouriting sometimes returning negative counts.
- Non-images will now properly be uploaded to object storage.
- Make account searches case-insensitive
- Fix image decoding error when passing media through proxy.
- OpenID Connect now correctly remembers and passes `state` parameter.
- OpenID Connect will not reject some correct but weird redirect URIs.
- Markdown posts will not have invisible anchor tags anymore (this messed up accessibility).
- Reverse proxies incorrectly reporting an HTTPS request as HTTP will now be handled correctly during OpenID Connect flows.
- API Relationships will now correctly return `requested_by`.
- Make process wait for Ctrl+C to exit on error, instead of exiting immediately. This fixes some issues with Docker restarting endlessly.
- Animated media will now stay animated when uploaded.
- Some instance metadata will no longer be missing from `/api/v2/instabnce` endpoint. In fact, it will now be more complete than Mastodon's implementation.
- The Origin HTTP header will no longer be used to determine the origin of a request. This was a security issue.
- New notes will no longer incorrectly be federated to *all* remote users at once.
- Fix [Elk Client](https://elk.zone/) not being able to log in.

## Removals

- Remove old logging system, to be replaced by a new one.
- Removed Meilisearch support, in favor of Sonic. Follow instructions in the [installation guide](https://server.versia.pub/setup/installation) to set up Sonic.
- Removed explicit Glitch-FE support. Glitch-FE will still work, but must be hosted separately like any other frontend.

## Miscellaneous

- Remove Node.js from Docker build.
- Update all dependencies.