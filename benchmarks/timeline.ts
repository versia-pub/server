import type { Status } from "@versia/client/schemas";
import {
    fakeRequest,
    getTestStatuses,
    getTestUsers,
} from "@versia-server/tests";
import { bench, run } from "mitata";
import type { z } from "zod/v4";

const { users, tokens, deleteUsers } = await getTestUsers(5);
await getTestStatuses(40, users[0]);

const testTimeline = async (): Promise<void> => {
    const response = await fakeRequest("/api/v1/timelines/home", {
        headers: {
            Authorization: `Bearer ${tokens[0].data.accessToken}`,
        },
    });

    const objects = (await response.json()) as z.infer<typeof Status>[];

    if (objects.length !== 20) {
        throw new Error("Invalid response (not 20 objects)");
    }
};

const testInstance = async (): Promise<void> => {
    const response = await fakeRequest("/api/v2/instance", {
        headers: {
            Authorization: `Bearer ${tokens[0].data.accessToken}`,
        },
    });

    const object = (await response.json()) as Record<string, unknown>;

    if (typeof object !== "object") {
        throw new Error("Invalid response (not an object)");
    }
};

bench("timeline", testTimeline).range("amount", 1, 1000);
bench("instance", testInstance).range("amount", 1, 1000);

await run();

await deleteUsers();
