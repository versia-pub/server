# Lysand

![Postgres](https://img.shields.io/badge/postgres-%23316192.svg?style=for-the-badge&logo=postgresql&logoColor=white) ![Bun](https://img.shields.io/badge/Bun-%23000000.svg?style=for-the-badge&logo=bun&logoColor=white) ![VS Code Insiders](https://img.shields.io/badge/VS%20Code%20Insiders-35b393.svg?style=for-the-badge&logo=visual-studio-code&logoColor=white) ![TypeScript](https://img.shields.io/badge/typescript-%23007ACC.svg?style=for-the-badge&logo=typescript&logoColor=white) ![Linux](https://img.shields.io/badge/Linux-FCC624?style=for-the-badge&logo=linux&logoColor=black) ![Docker](https://img.shields.io/badge/docker-%230db7ed.svg?style=for-the-badge&logo=docker&logoColor=white) ![ESLint](https://img.shields.io/badge/ESLint-4B3263?style=for-the-badge&logo=eslint&logoColor=white)

## What is this?

This is a project to create a federated social network based on the [ActivityPub](https://www.w3.org/TR/activitypub/) standard. It is currently in early alpha phase, with very basic federation and API support.

This project aims to be a fully featured social network, with a focus on privacy and security. It will implement the Mastodon API for support with clients that already support Mastodon or Pleroma.

> **Note:** This project is not affiliated with Mastodon or Pleroma, and is not a fork of either project. It is a new project built from the ground up.

## How do I run it?

### Requirements

- The [Bun Runtime](https://bun.sh), version 0.8 or later (use of the latest version is recommended)
- A PostgreSQL database
- (Optional but recommended) A Linux-based operating system

> **Note**: We will not be offerring support to Windows or MacOS users. If you are using one of these operating systems, please use a virtual machine or container to run Lysand.

### Installation

1. Clone this repository

```bash
git clone https://github.com/CPlusPatch/lysand.git
```

2. Install the dependencies

```bash
bun install
```

3. Set up a PostgreSQL database

4. Copy the `config.toml.example` file to `config.toml` and fill in the values (you can leave most things to the default, but you will need to configure things such as the database connection)

### Running

To run the server, simply run the following command:

```bash
bun start
```

## Contributing

Contributions are welcome! Please see the [CONTRIBUTING.md](CONTRIBUTING.md) file for more information.

## Planned Extra Features

- Send notifications to moderators when a report is received
- Email notifications on certain actions

## Federation

> **Warning**: Federation has not been tested outside of automated tests. It is not recommended to use this software in production.

Lysand is currently able to federate basic `Note` objects with `Create`, `Update` and `Delete` activities supported. (as well as `Accept` and `Reject`, but with no tests)

Planned federation features are:
- Activities: `Follow`, `Block`, `Undo`, `Announce`, `Like`, `Dislike`, `Flag`, `Ignore` and more
- Objects: `Emoji` and more

## API

Lysand implements the Mastodon API, with some extensions. The API is currently in early alpha, and is not recommended for use in production.

Working endpoints are:

- `/api/v1/accounts/:id`
- `/api/v1/accounts/:id/statuses`
- `/api/v1/accounts/:id/follow`
- `/api/v1/accounts/:id/unfollow`
- `/api/v1/accounts/:id/block`
- `/api/v1/accounts/:id/unblock`
- `/api/v1/accounts/:id/mute`
- `/api/v1/accounts/:id/unmute`
- `/api/v1/accounts/:id/pin`
- `/api/v1/accounts/:id/unpin`
- `/api/v1/accounts/:id/note`
- `/api/v1/accounts/relationships`
- `/api/v1/accounts/update_credentials`
- `/api/v1/accounts/verify_credentials`
- `/api/v1/accounts/familiar_followers`
- `/api/v1/statuses/:id` (`GET`, `DELETE`)
- `/api/v1/statuses`
- `/api/v1/timelines/public`
- `/api/v1/apps`
- `/api/v1/instance`
- `/api/v1/apps/verify_credentials`
- `/oauth/authorize`
- `/oauth/token`

## Configuration Values

Configuration can be found inside the `config.toml` file. The following values are available:

### Database

- `host`: The hostname or IP address of the database server. Example: `"localhost"`
- `port`: The port number to use for the database connection. Example: `48654`
- `username`: The username to use for the database connection. Example: `"lysand"`
- `password`: The password to use for the database connection. Example: `"mycoolpassword"`
- `database`: The name of the database to use. Example: `"lysand"`

### HTTP

- `base_url`: The base URL for the HTTP server. Example: `"https://lysand.social"`
- `bind`: The hostname or IP address to bind the HTTP server to. Example: `"http://localhost"`
- `bind_port`: The port number to bind the HTTP server to. Example: `"8080"`

#### Security

- `banned_ips`: An array of strings representing banned IPv4 or IPv6 IPs. Wildcards, networks and ranges are supported. Example: `[ "192.168.0.*" ]` (empty array)

### Media

- `backend`: Specifies the backend to use for media storage. Can be "local" or "s3", "local" uploads the file to the local filesystem.
- `deduplicate_media`: When set to true, the hash of media is checked when uploading to avoid duplication.

#### Conversion

- `convert_images`: Whether to convert uploaded images to another format. Example: `true`
- `convert_to`: The format to convert uploaded images to. Example: `"webp"`. Can be "jxl", "webp", "avif", "png", "jpg" or "gif".

### S3

- `endpoint`: The endpoint to use for the S3 server. Example: `"https://s3.example.com"`
- `access_key`: Access key to use for S3
- `secret_access_key`: Secret access key to use for S3
- `bucket_name`: The bucket to use for S3 (can be left empty)
- `region`: The region to use for S3 (can be left empty)
- `public_url`: The public URL to access uploaded media. Example: `"https://cdn.example.com"`

### SMTP

- `server`: The SMTP server to use for sending emails. Example: `"smtp.example.com"`
- `port`: The port number to use for the SMTP server. Example: `465`
- `username`: The username to use for the SMTP server. Example: `"test@example.com"`
- `password`: The password to use for the SMTP server. Example: `"password123"`
- `tls`: Whether to use TLS for the SMTP server. Example: `true`

### Email

- `send_on_report`: Whether to send an email to moderators when a report is received. Example: `false`
- `send_on_suspend`: Whether to send an email to moderators when a user is suspended. Example: `true`
- `send_on_unsuspend`: Whether to send an email to moderators when a user is unsuspended. Example: `false`

### Validation

- `max_displayname_size`: The maximum size of a user's display name, in characters. Example: `30`
- `max_bio_size`: The maximum size of a user's bio, in characters. Example: `160`
- `max_note_size`: The maximum size of a user's note, in characters. Example: `500`
- `max_avatar_size`: The maximum size of a user's avatar image, in bytes. Example: `1048576` (1 MB)
- `max_header_size`: The maximum size of a user's header image, in bytes. Example: `2097152` (2 MB)
- `max_media_size`: The maximum size of a media attachment, in bytes. Example: `5242880` (5 MB)
- `max_media_attachments`: The maximum number of media attachments allowed per post. Example: `4`
- `max_media_description_size`: The maximum size of a media attachment's description, in characters. Example: `100`
- `max_username_size`: The maximum size of a user's username, in characters. Example: `20`
- `username_blacklist`: An array of strings representing usernames that are not allowed to be used by users. Defaults are from Akkoma. Example: `["admin", "moderator"]`
- `blacklist_tempmail`: Whether to blacklist known temporary email providers. Example: `true`
- `email_blacklist`: Additional email providers to blacklist. Example: `["example.com", "test.com"]`
- `url_scheme_whitelist`: An array of strings representing valid URL schemes. URLs that do not use one of these schemes will be parsed as text. Example: `["http", "https"]`
- `allowed_mime_types`: An array of strings representing allowed MIME types for media attachments. Example: `["image/jpeg", "image/png", "video/mp4"]`

### Defaults

- `visibility`: The default visibility for new notes. Example: `"public"`
- `language`: The default language for new notes. Example: `"en"`
- `avatar`: The default avatar URL. Example: `""` (empty string)
- `header`: The default header URL. Example: `""` (empty string)

### ActivityPub

- `use_tombstones`: Whether to use ActivityPub Tombstones instead of deleting objects. Example: `true`
- `fetch_all_collection_members`: Whether to fetch all members of collections (followers, following, etc) when receiving them. Example: `false`
- `reject_activities`: An array of instance domain names without "https" or glob patterns. Rejects all activities from these instances, simply doesn't save them at all. Example: `[ "mastodon.social" ]`
- `force_followers_only`: An array of instance domain names without "https" or glob patterns. Force posts from this instance to be followers only. Example: `[ "mastodon.social" ]`
- `discard_reports`: An array of instance domain names without "https" or glob patterns. Discard all reports from these instances. Example: `[ "mastodon.social" ]`
- `discard_deletes`: An array of instance domain names without "https" or glob patterns. Discard all deletes from these instances. Example: `[ "mastodon.social" ]`
- `discard_updates`: An array of instance domain names without "https" or glob patterns. Discard all updates (edits) from these instances. Example: `[]`
- `discard_banners`: An array of instance domain names without "https" or glob patterns. Discard all banners from these instances. Example: `[ "mastodon.social" ]`
- `discard_avatars`: An array of instance domain names without "https" or glob patterns. Discard all avatars from these instances. Example: `[ "mastodon.social" ]`
- `discard_follows`: An array of instance domain names without "https" or glob patterns. Discard all follow requests from these instances. Example: `[]`
- `force_sensitive`: An array of instance domain names without "https" or glob patterns. Force set these instances' media as sensitive. Example: `[ "mastodon.social" ]`
- `remove_media`: An array of instance domain names without "https" or glob patterns. Remove these instances' media. Example: `[ "mastodon.social" ]`

### Filters

- `note_filters`: An array of regex filters to drop notes from new activities. Example: `["(https?://)?(www\\.)?youtube\\.com/watch\\?v=[a-zA-Z0-9_-]+", "(https?://)?(www\\.)?youtu\\.be/[a-zA-Z0-9_-]+"]`
- `username_filters`: An array of regex filters to drop users from new activities based on their username. Example: `[ "^spammer-[a-z]" ]`
- `displayname_filters`: An array of regex filters to drop users from new activities based on their display name. Example: `[ "^spammer-[a-z]" ]`
- `bio_filters`: An array of regex filters to drop users from new activities based on their bio. Example: `[ "badword" ]`
- `emoji_filters`: An array of regex filters to drop users from new activities based on their emoji usage. Example: `[ ":bademoji:" ]`

### Logging

- `log_requests`: Whether to log all requests. Example: `true`
- `log_requests_verbose`: Whether to log request and their contents. Example: `false`
- `log_filters`: Whether to log all filtered objects. Example: `true`

### Ratelimits

- `duration_coeff`: The amount to multiply every route's duration by. Example: `1.0`
- `max_coeff`: The amount to multiply every route's max by. Example: `1.0`

### Custom Ratelimits

- `"/api/v1/timelines/public"`: An object representing a custom ratelimit for the specified API route. Example: `{ duration = 60, max = 200 }`


## License

This project is licensed under the [AGPL-3.0](LICENSE).