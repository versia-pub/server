export type APActivityPubContext =
	| "https://www.w3.org/ns/activitystreams"
	| {
			ostatus: string;
			atomUri: string;
			inReplyToAtomUri: string;
			conversation: string;
			sensitive: string;
			toot: string;
			votersCount: string;
			litepub: string;
			directMessage: string;
	  };

export interface APActivityPubObject {
	id: string;
	type: string;
	summary?: string;
	inReplyTo?: string;
	published: string;
	url: string;
	attributedTo: string;
	to: string[];
	cc: string[];
	sensitive?: boolean;
	atomUri: string;
	inReplyToAtomUri?: string;
	conversation: string;
	content: string;
	contentMap: Record<string, string>;
	attachment: APActivityPubAttachment[];
	tag: APTag[];
	context?: string;
	quoteUri?: string;
	quoteUrl?: string;
	source?: {
		content: string;
		mediaType: string;
	};
}

export interface APActivityPubAttachment {
	type?: string;
	mediaType?: string;
	url?: string;
	name?: string;
}

export interface APActivityPubCollection {
	id: string;
	type: string;
	first?: {
		type: string;
		next: string;
		partOf: string;
		items: any[]; // replace any with your item type
	};
}

export interface APActivityPubNote extends APActivityPubObject {
	type: "Note";
}

export interface APActivityPubActivity {
	"@context": APActivityPubContext[];
	id: string;
	type: string;
	actor: string;
	published: string;
	to: string[];
	cc: string[];
	object: APActivityPubNote;
}

export type APActorContext =
	| "https://www.w3.org/ns/activitystreams"
	| "https://w3id.org/security/v1"
	| Record<
			string,
			| string
			| { "@id": string; "@type": string }
			| { "@container": string; "@id": string }
	  >;

export interface APActorPublicKey {
	id: string;
	owner: string;
	publicKeyPem: string;
}

export interface APActorEndpoints {
	sharedInbox: string;
}

export interface APActorIcon {
	type: string;
	mediaType: string;
	url: string;
}

export interface APActor {
	"@context": APActorContext[];
	id: string;
	type: string;
	following: string;
	followers: string;
	inbox: string;
	outbox: string;
	featured: string;
	featuredTags: string;
	preferredUsername: string;
	name: string;
	summary: string;
	url: string;
	manuallyApprovesFollowers: boolean;
	discoverable: boolean;
	indexable: boolean;
	published: string;
	memorial: boolean;
	devices: string;
	publicKey: APActorPublicKey;
	tag: APTag[];
	attachment: APAttachment[];
	endpoints: APActorEndpoints;
	icon: APActorIcon;
}

export interface APTag {
	type: string;
	href: string;
	name: string;
}

export interface APAttachment {
	type: string;
	mediaType: string;
	url: string;
	name?: string;
	blurhash?: string;
	description?: string;
}
