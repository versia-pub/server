export const randomString = (length: number, encoding?: BufferEncoding) =>
    Buffer.from(crypto.getRandomValues(new Uint8Array(length))).toString(
        encoding,
    );
