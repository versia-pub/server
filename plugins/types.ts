import EventEmitter from "eventemitter3";
import type { StatusWithRelations } from "~database/entities/Status";
import type { UserWithRelations } from "~database/entities/User";
import type { LysandObjectType } from "~types/lysand/Object";

export enum HookTypes {
	/**
	 * Called before the server starts listening
	 */
	PreServe = "preServe",
	/**
	 * Called after the server stops listening
	 */
	PostServe = "postServe",
	/**
	 * Called on every HTTP request (before anything else is done)
	 */
	OnRequestReceive = "onRequestReceive",
	/**
	 * Called on every HTTP request (after it is processed)
	 */
	OnRequestProcessed = "onRequestProcessed",
	/**
	 * Called on every object received (before it is parsed and added to the database)
	 */
	OnObjectReceive = "onObjectReceive",
	/**
	 * Called on every object processed (after it is parsed and added to the database)
	 */
	OnObjectProcessed = "onObjectProcessed",
	/**
	 * Called when signature verification fails on an object
	 */
	OnCryptoFail = "onCryptoFail",
	/**
	 * Called when signature verification succeeds on an object
	 */
	OnCryptoSuccess = "onCryptoSuccess",
	/**
	 * Called when a user is banned by another user
	 */
	OnBan = "onBan",
	/**
	 * Called when a user is suspended by another user
	 */
	OnSuspend = "onSuspend",
	/**
	 * Called when a user is blocked by another user
	 */
	OnUserBlock = "onUserBlock",
	/**
	 * Called when a user is muted by another user
	 */
	OnUserMute = "onUserMute",
	/**
	 * Called when a user is followed by another user
	 */
	OnUserFollow = "onUserFollow",
	/**
	 * Called when a user registers (before completing email verification)
	 */
	OnRegister = "onRegister",
	/**
	 * Called when a user finishes registering (after completing email verification)
	 */
	OnRegisterFinish = "onRegisterFinish",
	/**
	 * Called when a user deletes their account
	 */
	OnDeleteAccount = "onDeleteAccount",
	/**
	 * Called when a post is created
	 */
	OnPostCreate = "onPostCreate",
	/**
	 * Called when a post is deleted
	 */
	OnPostDelete = "onPostDelete",
	/**
	 * Called when a post is updated
	 */
	OnPostUpdate = "onPostUpdate",
}

export interface ServerStats {
	postCount: number;
}

interface ServerEvents {
	[HookTypes.PreServe]: () => void;
	[HookTypes.PostServe]: (stats: ServerStats) => void;
	[HookTypes.OnRequestReceive]: (req: Request) => void;
	[HookTypes.OnRequestProcessed]: (req: Request) => void;
	[HookTypes.OnObjectReceive]: (obj: LysandObjectType) => void;
	[HookTypes.OnObjectProcessed]: (obj: LysandObjectType) => void;
	[HookTypes.OnCryptoFail]: (
		req: Request,
		obj: LysandObjectType,
		author: UserWithRelations,
		publicKey: string
	) => void;
	[HookTypes.OnCryptoSuccess]: (
		req: Request,
		obj: LysandObjectType,
		author: UserWithRelations,
		publicKey: string
	) => void;
	[HookTypes.OnBan]: (
		req: Request,
		bannedUser: UserWithRelations,
		banner: UserWithRelations
	) => void;
	[HookTypes.OnSuspend]: (
		req: Request,
		suspendedUser: UserWithRelations,
		suspender: UserWithRelations
	) => void;
	[HookTypes.OnUserBlock]: (
		req: Request,
		blockedUser: UserWithRelations,
		blocker: UserWithRelations
	) => void;
	[HookTypes.OnUserMute]: (
		req: Request,
		mutedUser: UserWithRelations,
		muter: UserWithRelations
	) => void;
	[HookTypes.OnUserFollow]: (
		req: Request,
		followedUser: UserWithRelations,
		follower: UserWithRelations
	) => void;
	[HookTypes.OnRegister]: (req: Request, newUser: UserWithRelations) => void;
	[HookTypes.OnDeleteAccount]: (
		req: Request,
		deletedUser: UserWithRelations
	) => void;
	[HookTypes.OnPostCreate]: (
		req: Request,
		newPost: StatusWithRelations,
		author: UserWithRelations
	) => void;
	[HookTypes.OnPostDelete]: (
		req: Request,
		deletedPost: StatusWithRelations,
		deleter: UserWithRelations
	) => void;
	[HookTypes.OnPostUpdate]: (
		req: Request,
		updatedPost: StatusWithRelations,
		updater: UserWithRelations
	) => void;
}

export class Server extends EventEmitter<ServerEvents> {}
