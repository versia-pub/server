export const randomString = (
    length: number,
    encoding?: BufferEncoding,
): string =>
    Buffer.from(crypto.getRandomValues(new Uint8Array(length))).toString(
        encoding,
    );
