<p align="center">
  <a href="https://versia.pub"><img src="https://cdn.versia.pub/branding/logo-dark.svg" alt="Versia Logo" height="110"></a>
</p>

<center><h1><code>@versia/client</code></h1></center>

TypeScript client API for Versia and Mastodon servers.

## Efficiency

The built output of the package is not even `32 KB` in size, making it a lightweight and efficient solution for your Versia needs. Installing the package adds around `5 MB` to your `node_modules` folder, but this does not affect the final bundle size.

Compilation (bundling/minifying) time is a few seconds, almost all of which is spent on type-checking. The actual compilation time is less than a tenth of a second.

## Usage

This application may be used in the same was as [`megalodon`](https://github.com/h3poteto/megalodon).

Initialize the client with the following code:

```typescript
import { Client } from "@versia/client";

const baseUrl = new URL("https://versia.social");
const accessToken = "...";

const client = new Client(baseUrl, accessToken);
```

The client can then be used to interact with the server:

```typescript
const { data: status } = await client.postStatus("Hey there!");
```

```typescript
const { data: posts } = await client.getHomeTimeline();
```

Use your editor's IntelliSense to see all available methods and properties. JSDoc comments are always available. Method names are the same as with Megalodon, but with slight parameter changes in some cases.

All methods have a special `extra` parameter that can be used to pass additional parameters to the underlying HTTP request. This can be used to pass query parameters, headers, etc.:

```typescript
// extra is a RequestInit, the same as the second parameter of native fetch
const { data: posts } = await client.getHomeTimeline({
    headers: { "User-Agent": "MyApp/3" },
    signal: new AbortSignal(),
});
```

## Getting Started

### Prerequisites

#### For Usage

See the [**Compatibility**](#compatibility) section for the supported environments. Any package manager can be used to install the packages.

#### For Development

-   [**Bun**](https://bun.sh) version `1.1.8` or higher.
-   Either the [**Linux**](https://www.linux.org) or [**macOS**](https://www.apple.com/macos) operating systems. ([**Windows**](https://www.microsoft.com/windows) will work, but is not officially supported.)

### Compatibility

This library is built for JavaScript runtimes with the support for:

-   [**ES Modules**](https://nodejs.org/api/esm.html)
-   [**ECMAScript 2020**](https://www.ecma-international.org/ecma-262/11.0/index.html)

#### Runtimes

-   **Node.js**: 14.0+ is the minimum, but only Node.js 20.0+ (LTS) is officially supported.
-   **Deno**: Support is unknown. 1.0+ is expected to work.
-   **Bun**: Bun 1.1.8 is the minimum-supported version. As Bun is rapidly evolving, this may change. Previous versions may also work.

#### Browsers

Consequently, this library is compatible without any bundling in the following browser versions:

-   **Chrome**: 80+
-   **Edge**: 80+
-   **Firefox**: 74+
-   **Safari**: 13.1+
-   **Opera**: 67+
-   **Internet Explorer**: None

If you are targeting older browsers, please don't, you are doing yourself a disservice.

Transpilation to non-ES Module environments is not officially supported, but should be simple with the use of a bundler like [**Parcel**](https://parceljs.org) or [**Rollup**](https://rollupjs.org).

### Installation

Package is distributed as a scoped package on the NPM registry and [JSR](https://jsr.io).

We strongly recommend using JSR over NPM for all your packages that are available on it.

```bash
# NPM version
deno add npm:@versia/client # For Deno
npm install @versia/client # For NPM
yarn add @versia/client # For Yarn
pnpm add @versia/client # For PNPM
bun add @versia/client # For Bun

# JSR version
deno add @versia/client # For Deno
npx jsr add @versia/client # For JSR
yarn dlx jsr add @versia/client # For Yarn
pnpm dlx jsr add @versia/client # For PNPM
bunx jsr add @versia/client # For Bun
```

#### From Source

If you want to install from source, you can clone [this repository](https://github.com/versia-pub/api) and run the following commands:

```bash
bun install # Install dependencies

bun run build # Build the packages
```

The built package will be in the `client/dist` folder.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

### Projects

-   [**Bun**](https://bun.sh): Thanks to the Bun team for creating an amazing JavaScript runtime.
-   [**TypeScript**](https://www.typescriptlang.org): TypeScript is the backbone of this project.
-   [**Node.js**](https://nodejs.org): Node.js created the idea of JavaScript on the server.

### People

-   [**April John**](https://github.com/cutestnekoaqua): Creator and maintainer of the Versia Server ActivityPub bridge.
