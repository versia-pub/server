import { server } from "~index";

/**
 * This allows us to send a test request to the server even when it isnt running
 * CURRENTLY NOT WORKING, NEEDS TO BE FIXED
 * @param req Request to send
 * @returns Response from the server
 */
export async function sendTestRequest(req: Request) {
    return server.fetch(req);
}

export function wrapRelativeUrl(url: string, base_url: string) {
    return new URL(url, base_url);
}
