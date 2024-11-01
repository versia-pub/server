import { db } from "@versia/kit/db";
import { Challenges } from "@versia/kit/tables";
import { createChallenge } from "altcha-lib";
import { sql } from "drizzle-orm";
import { config } from "~/packages/config-manager";

export const generateChallenge = async (
    maxNumber = config.validation.challenges.difficulty,
) => {
    const expirationDate = new Date(
        Date.now() + config.validation.challenges.expiration * 1000,
    );

    const uuid = (await db.execute(sql<string>`SELECT uuid_generate_v7()`))
        .rows[0].uuid_generate_v7 as string;

    const challenge = await createChallenge({
        hmacKey: config.validation.challenges.key,
        expires: expirationDate,
        maxNumber,
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
                expiresAt: expirationDate.toISOString(),
            })
            .returning()
    )[0];

    return result;
};
