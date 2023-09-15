# Lysand

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

## Federation

> **Warning**: Federation has not been tested outside of automated tests. It is not recommended to use this software in production.

Lysand is currently able to federate basic `Note` objects with `Create`, `Update` and `Delete` activities supported.

Planned federation features are:
- Activities: `Follow`, `Accept`, `Reject`, `Block`, `Undo`, `Announce`, `Like`, `Dislike`, `Flag`, `Ignore` and more
- Objects: `Emoji` and more

## API

Lysand implements the Mastodon API, with some extensions. The API is currently in early alpha, and is not recommended for use in production.

Working endpoints are:

- `/v1/accounts/:id`
- `/v1/accounts/:id/statuses`
- `/v1/accounts/update_credentials`
- `/v1/apps`
- `/oauth/authorize`
- `/oauth/token`


## License

This project is licensed under the [AGPL-3.0](LICENSE).
```