const timeBefore = performance.now();

const requests: Promise<Response>[] = [];

// Repeat 1000 times
for (let i = 0; i < 1000; i++) {
    requests.push(
        fetch("https://mastodon.social", {
            method: "GET",
        }),
    );
}

await Promise.all(requests);

const timeAfter = performance.now();

console.log(`Time taken: ${timeAfter - timeBefore}ms`);
