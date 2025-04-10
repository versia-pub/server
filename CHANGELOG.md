# `0.8.0` • Federation 2: Electric Boogaloo (unreleased)

## Backwards Compatibility

Versia Server `0.8.0` is **not** backwards-compatible with `0.7.0`. This release includes some breaking changes to the database schema and configuration file.

Please see [Database Changes](#database-changes) and [New Configuration](#new-configuration) for more information.

## Features

### Federation

-   [x] 🦄 Updated to [`Versia 0.5`](https://versia.pub/changelog).
-   [x] 📦 Added support for new Versia features:
    -   [x] [**Instance Messaging Extension**](https://versia.pub/extensions/instance-messaging)
    -   [x] [**Shared Inboxes**](https://versia.pub/federation#inboxes)
-   [x] 🔗 Changed entity URIs to be more readable (`example.org/objects/:id` → `example.org/{notes,likes,...}/:id`)

### API

-   [x] 📲 Added [Push Notifications](https://docs.joinmastodon.org/methods/push) support.
-   [x] 📖 Overhauled OpenAPI schemas to match [Mastodon API docs](https://docs.joinmastodon.org)
-   [x] 👷 Improved [**Roles API**](https://server.versia.pub/api/roles) to allow for full role control (create, update, delete, assign).
-   [x] ✏️ `<div>` and `<span>` tags are now allowed in Markdown.
-   [x] 🔥 Removed nonstandard `/api/v1/accounts/id` endpoint (the same functionality was already possible with other endpoints).
-   [x] ✨️ Implemented rate limiting support for API endpoints.
-   [x] 🔒 Implemented `is_indexable` and `is_hiding_collections` fields to the [**Accounts API**](https://docs.joinmastodon.org/methods/accounts/#update_credentials).
-   [x] ✨️ Muting other users now lets you specify a duration, after which the mute will be automatically removed.

### CLI

-   [x] ⌨️ New commands!
    -   [x] ✨️ `cli user token` to generate API tokens.
-   [x] 👷 Error messages are now prettier!

### Frontend

The way frontend is built and served has been changed. In the past, it was required to have a second process serving a frontend, which `versia-server` would proxy requests to. This is no longer the case.

Versia Server now serves static files directly from a configurable path, and `versia-fe` has been updated to support this.

### Backend

-   [x] 🚀 Upgraded Bun to `1.2.9`
-   [x] 🔥 Removed dependency on the `pg_uuidv7` extension. Versia Server can now be used with "vanilla" PostgreSQL.
-   [x] 🖼️ Simplified media pipeline: this will improve S3 performance
    -   [ ] 📈 It is now possible to disable media proxying for your CDN (offloading considerable bandwidth to your more optimized CDN).
-   [x] 👷 Outbound federation, inbox processing, data fetching and media processing are now handled by a queue system.
    -   [x] 🌐 An administration panel is available at `/admin/queues` to monitor and manage queues.
-   [x] 🔥 Removed support for **from-source** installations, as Versia Server is designed around containerization and maintaining support was a large burden.

## New Configuration

Configuration parsing and validation has been overhauled. Unfortunately, this means that since a bunch of options have been renamed, you'll need to redownload [the default configuration file](config/config.example.toml) and reapply your changes.

## Database Changes

Various media-related attributes have been merged into a single `Medias` table. This will require a migration in order to preserve the old data.

Since very few instances are running `0.7.0`, we have decided to "rawdog it" instead of making a proper migration script (as that would take a ton of time that we don't have).

In the case that you've been running secret instances in the shadows, let us know and we'll help you out.

## Bug Fixes

-   🐛 All URIs in custom Markdown text are now correctly proxied.
-   🐛 Fixed several issues with the [ActivityPub Federation Bridge](https://github.com/versia-pub/activitypub) preventing it from operating properly.
-   🐛 Fixed incorrect content-type on some media when using S3.
-   🐛 All media content-type is now correctly fetched, instead of guessed from the file extension as before.
-   🐛 Fixed OpenAPI schema generation and `/docs` endpoint.
-   🐛 Logs folder is now automatically created if it doesn't exist.
-   🐛 Media hosted on the configured S3 bucket and on the local filesystem is no longer unnecessarily proxied.

# `0.7.0` • The Auth and APIs Update

> [!WARNING]
> This release marks the rename of the project from `Lysand` to `Versia`.

## Backwards Compatibility

Versia Server `0.7.0` is backwards compatible with `0.6.0`. However, some new features may not be available to older clients. Notably, `versia-fe` has had major improvements and will not work with `0.6.0`.

## Features

-   Upgraded Bun to `1.1.34`. This brings performance upgrades and better stability.
-   Added support for the [ActivityPub Federation Bridge](https://github.com/versia-pub/activitypub).
-   Added support for the [Sonic](https://github.com/valeriansaliou/sonic) search indexer.
-   Note deletions are now federated.
-   Note edits are now federated.
-   Added support for [Sentry](https://sentry.io).
-   Added option for more federation debug logging.
-   Added [**Roles API**](https://server.versia.pub/api/roles).
-   Added [**Permissions API**](https://server.versia.pub/api/roles) and enabled it for every route.
-   Added [**TOS and Privacy Policy**](https://server.versia.pub/api/mastodon) endpoints.
-   Added [**Challenge API**](https://server.versia.pub/api/challenges). (basically CAPTCHAS). This can be enabled/disabled by administrators. No `versia-fe` support yet.
-   Added ability to refetch user data from remote instances.
-   Added ability to change the `username` of a user. ([Mastodon API extension](https://server.versia.pub/api/mastodon#api-v1-accounts-update-credentials)).
-   Added an endpoint to get a user by its username.
-   Add OpenID Connect registration support. Admins can now disable username/password registration entirely and still allow users to sign up via OpenID Connect.
-   Add option to never convert vector images to a raster format.
-   Refactor logging system to be more robust and easier to use. Log files are now automatically rotated.
-   Add support for HTTP proxies.
-   Add support for serving Versia over a Tor hidden service.
-   Add global server error handler, to properly return 500 error messages to clients.
-   Sign all federation HTTP requests.
-   Add JSON schema for configuration file.
-   Rewrite federation stack
-   Updated federation to Versia 0.4
-   Implement OAuth2 token revocation
-   Add new **Plugin API**

## Plugin System

A new plugin system for extending Versia Server has been added in this release!

> [!NOTE]
>
> This is an internal feature and is not documented. Support for third-party plugins will be given on a "if we have time" basis, until the API is fully stabilized and documented

Plugins using this framework support:

-   [x] Plugin hotswapping and hotreloading
-   [x] Manifest files (JSON, JSON5, JSONC supported) with metadata (JSON schema provided)
-   [x] Installation by dropping a folder into the plugins/ directory
-   [x] Support for plugins having their own NPM dependencies
-   [x] Support for storing plugins' configuration in the main config.toml (single source of truth)
-   [x] Schema-based strict config validation (plugins can specify their own schemas)
-   [x] Full type-safety
-   [x] Custom hooks
-   [x] FFI compatibility (with `bun:ffi` or Node's FFI)
-   [x] Custom API route registration or overriding or middlewaring
-   [x] Automatic OpenAPI schema generation for all installed plugins
-   [x] End-to-end and unit testing supported
-   [x] Automatic user input validation for API routes with schemas (specify a schema for the route and the server will take care of validating everything)
-   [x] Access to internal database abstractions
-   [x] Support for sending raw SQL to database (type-safe!)
-   [x] Plugin autoload on startup with override controls (enable/disable)

As a demonstration of the power of this system and an effort to modularize the codebase further, OpenID functionality has been moved to a plugin. This plugin is required for login.

## Bug Fixes

-   Fix favouriting/unfavouriting sometimes returning negative counts.
-   Non-images will now properly be uploaded to object storage.
-   Make account searches case-insensitive
-   Fix image decoding error when passing media through proxy.
-   OpenID Connect now correctly remembers and passes `state` parameter.
-   OpenID Connect will not reject some correct but weird redirect URIs.
-   Markdown posts will not have invisible anchor tags anymore (this messed up accessibility).
-   Reverse proxies incorrectly reporting an HTTPS request as HTTP will now be handled correctly during OpenID Connect flows.
-   API Relationships will now correctly return `requested_by`.
-   Make process wait for Ctrl+C to exit on error, instead of exiting immediately. This fixes some issues with Docker restarting endlessly.
-   Animated media will now stay animated when uploaded.
-   Some instance metadata will no longer be missing from `/api/v2/instabnce` endpoint. In fact, it will now be more complete than Mastodon's implementation.
-   The Origin HTTP header will no longer be used to determine the origin of a request. This was a security issue.
-   New notes will no longer incorrectly be federated to _all_ remote users at once.
-   Fix [Elk Client](https://elk.zone/) not being able to log in.

## Removals

-   Remove old logging system, to be replaced by a new one.
-   Removed Meilisearch support, in favor of Sonic. Follow instructions in the [installation guide](https://server.versia.pub/setup/installation) to set up Sonic.
-   Removed explicit Glitch-FE support. Glitch-FE will still work, but must be hosted separately like any other frontend.

## Miscellaneous

-   Remove Node.js from Docker build.
-   Update all dependencies.
