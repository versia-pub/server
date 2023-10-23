import { APActivity, APActor } from "activitypub-types";

export class RemoteActor {
	private actorData: APActor | null;
	private actorUri: string;

	constructor(actor: APActor | string) {
		if (typeof actor === "string") {
			this.actorUri = actor;
			this.actorData = null;
		} else {
			this.actorUri = actor.id || "";
			this.actorData = actor;
		}
	}

	public async fetch() {
		const response = await fetch(this.actorUri);
		const actorJson = (await response.json()) as APActor;
		this.actorData = actorJson;
	}

	public getData() {
		return this.actorData;
	}
}

export class RemoteActivity {
	private data: APActivity | null;
	private uri: string;

	constructor(uri: string, data: APActivity | null) {
		this.uri = uri;
		this.data = data;
	}

	public async fetch() {
		const response = await fetch(this.uri);
		const json = (await response.json()) as APActivity;
		this.data = json;
	}

	public getData() {
		return this.data;
	}

	public async getActor() {
		if (!this.data) {
			throw new Error("No data");
		}

		if (Array.isArray(this.data.actor)) {
			throw new Error("Multiple actors");
		}

		if (typeof this.data.actor === "string") {
			const actor = new RemoteActor(this.data.actor);
			await actor.fetch();
			return actor.getData();
		}

		return new RemoteActor(this.data.actor as any);
	}
}
