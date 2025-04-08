<p align="center">
  <a href="https://versia.pub"><img src="https://cdn.versia.pub/branding/logo-dark.svg" alt="Versia Logo" height="110"></a>
</p>

<center><h1><code>@versia/sdk</code></h1></center>

Federation types, validators and cryptography for Versia server implementations.

## Usage

## Entities

The `@versia/sdk/entities` module provides TypeScript classes for working with Versia entities. These classes provide type-safe access to entity properties and methods for serialization/deserialization.

```ts
import { Note, User } from "@versia/sdk/entities";

const note = new Note({
    id: "00000000-0000-0000-0000-000000000000",
    type: "Note",
});

// You can also parse from JSON, which will apply the schema validation
const invalidJson = {
    id: "00000000-0000-0000-0000-000000000000",
    invalid: "property",
};

// Will throw an error
const invalidNote = await Note.fromJSON(invalidJson);

const validJson = {
    id: "00000000-0000-0000-0000-000000000000",
    type: "Note",
};

const validNote = await Note.fromJSON(validJson);
```

Some entities like `Note` have additional properties, like `content` or `attachments`, which are automatically calculated from the relevant properties.

```ts
import { TextContentFormat, Note } from "@versia/sdk/entities";

const note = new Note({
    id: "00000000-0000-0000-0000-000000000000",
    type: "Note",
    content: {
        "text/plain": {
            content: "Hello, world!",
            remote: false,
        },
    },
});

const content = note.content;
// Is equivalent to
const content = new TextContentFormat(note.data.content);
```

## Schemas

Additionally, the [**Zod**](https://zod.dev) schemas used for validation are available in the `@versia/sdk/schemas` module. You can use these to directly validate incoming data, without using the entity classes.

```ts
import { NoteSchema, UserSchema } from "@versia/sdk/schemas";

const response = await fetch("https://example.com/notes/123");
const json = await response.json();

const noteSchema = NoteSchema.parse(json);
```

## Sorter

The `@versia/sdk/sorter` module provides a class for inbox request handling. It allows you to automatically sort and process incoming entities based on their type.

```ts
import { EntitySorter } from "@versia/sdk";
import { Note, User } from "@versia/sdk/entities";

app.post("/inbox", async (req, res) => {
    const json = await req.json();

    const sorter = new EntitySorter(json);

    await sorter
        .on(Note, (note) => {
            console.log(note);
        })
        .on(User, (user) => {
            console.log(user);
        })
        .sort();
});
```

## Cryptography

The `@versia/sdk/crypto` module provides functions for signing and verifying requests using the [**Ed25519**](https://en.wikipedia.org/wiki/EdDSA) algorithm.

```ts
import { sign, verify } from "@versia/sdk/crypto";

const keys = await crypto.subtle.generateKey("Ed25519", true, [
    "sign",
    "verify",
]);

// URI of the User that is signing the request
const authorUrl = new URL("https://example.com");

const req = new Request("https://example.com/notes/123", {
    method: "POST",
    body: JSON.stringify({
        id: "00000000-0000-0000-0000-000000000000",
        type: "Note",
    }),
});

const signedReq = await sign(keys.privateKey, authorUrl, req);

const verified = await verify(keys.publicKey, signedReq);
```

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
-   (only required for cryptography) [**Ed25519**](https://en.wikipedia.org/wiki/EdDSA) cryptography in the [**WebCrypto API**](https://developer.mozilla.org/en-US/docs/Web/API/Web_Crypto_API)

#### Runtimes

-   **Node.js**: 14.0+ is the minimum (18.0+ for cryptography), but only Node.js 20.0+ (LTS) is officially supported.
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

Cryptography functions are supported in the following browsers:

-   **Safari**: 17.0+
-   **Firefox**: 129.0+
-   **Chrome**: 113.0+ with `#enable-experimental-web-platform-features` enabled

If you are targeting older browsers, please don't, you are doing yourself a disservice.

Transpilation to non-ES Module environments is not officially supported, but should be simple with the use of a bundler like [**Parcel**](https://parceljs.org) or [**Rollup**](https://rollupjs.org).

### Installation

Package is distributed as a scoped package on the NPM registry and [JSR](https://jsr.io).

We strongly recommend using JSR over NPM for all your packages that are available on it.

```bash
# NPM version
deno add npm:@versia/sdk # For Deno
npm install @versia/sdk # For NPM
yarn add @versia/sdk # For Yarn
pnpm add @versia/sdk # For PNPM
bun add @versia/sdk # For Bun

# JSR version
deno add @versia/sdk # For Deno
npx jsr add @versia/sdk # For JSR
yarn dlx jsr add @versia/sdk # For Yarn
pnpm dlx jsr add @versia/sdk # For PNPM
bunx jsr add @versia/sdk # For Bun
```

#### From Source

If you want to install from source, you can clone [this repository](https://github.com/versia-pub/api) and run the following commands:

```bash
bun install # Install dependencies

bun run build # Build the packages
```

The built package will be in the `sdk/dist` folder.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

### Projects

-   [**Bun**](https://bun.sh): Thanks to the Bun team for creating an amazing JavaScript runtime.
-   [**TypeScript**](https://www.typescriptlang.org): TypeScript is the backbone of this project.
-   [**Node.js**](https://nodejs.org): Node.js created the idea of JavaScript on the server.

### People

-   [**April John**](https://github.com/cutestnekoaqua): Creator and maintainer of the Versia Server ActivityPub bridge.
