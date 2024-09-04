# `0.7.0` (unreleased)

> [!WARNING]
> This release marks the rename of the project from `Lysand` to `Versia`.

## Backwards Compatibility

Versia Server `0.7.0` is backwards compatible with `0.6.0`. However, some new features may not be available to older clients. Notably, `versia-fe` has had major improvements and will not work with `0.6.0`.

## Features

- Upgraded Bun to `1.1.26`. This brings performance upgrades and better stability.
- Added support for the [ActivityPub Federation Bridge](https://github.com/versia-pub/activitypub).
- Added support for the [Sonic](https://github.com/valeriansaliou/sonic) search indexer.
- Note deletions are now federated.
- Note edits are now federated.
- Added support for [Sentry](https://sentry.io).
- Added option for more federation debug logging.
- Added [**Roles API**](docs/api/roles.md).
- Added [**Permissions API**](docs/api/roles.md) and enabled it for every route.
- Added [**TOS and Privacy Policy**](docs/api/mastodon.md) endpoints.
- Added [**Challenge API**](docs/api/challenges.md). (basically CAPTCHAS). This can be enabled/disabled by administrators. No `versia-fe` support yet.
- Added ability to refetch user data from remote instances.
- Added ability to change the `username` of a user. ([Mastodon API extension](docs/api/mastodon.md)).
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

## Removals

- Remove old logging system, to be replaced by a new one.
- Removed Meilisearch support, in favor of Sonic. Follow instructions in the [installation guide](docs/installation.md) to set up Sonic.
- Removed explicit Glitch-FE support. Glitch-FE will still work, but must be hosted separately like any other frontend.

## Miscellaneous

- Remove Node.js from Docker build.
- Update all dependencies.