import { config } from "@versia-server/config";
import { db } from "@versia-server/kit/db";
import { Challenges } from "@versia-server/kit/tables";
import { createChallenge } from "altcha-lib";
import type { Challenge } from "altcha-lib/types";
import { randomUUIDv7 } from "bun";

export const generateChallenge = async (
    maxNumber?: number,
): Promise<{
    id: string;
    challenge: Challenge;
    expiresAt: Date;
    createdAt: Date;
}> => {
    if (!config.validation.challenges) {
        throw new Error("Challenges are not enabled");
    }

    const expirationDate = new Date(
        Date.now() + config.validation.challenges.expiration * 1000,
    );

    const uuid = randomUUIDv7();

    const challenge = await createChallenge({
        hmacKey: config.validation.challenges.key,
        expires: expirationDate,
        maxNumber: maxNumber ?? config.validation.challenges.difficulty,
        algorithm: "SHA-256",
        params: {
            challenge_id: uuid,
        },
    });

    const result = (
        await db
            .insert(Challenges)
            .values({
                id: uuid,
                challenge,
                expiresAt: expirationDate,
            })
            .returning()
    )[0];

    return result;
};
