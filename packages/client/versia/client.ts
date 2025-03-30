// biome-ignore lint/correctness/noUndeclaredDependencies: biome is looking at the wrong package.json
import { OAuth2Client } from "@badgateway/oauth2-client";
import type { z } from "zod";
import type { Account } from "../schemas/account.ts";
import type { CredentialApplication } from "../schemas/application.ts";
import type { Attachment } from "../schemas/attachment.ts";
import type { Context } from "../schemas/context.ts";
import type { CustomEmoji } from "../schemas/emoji.ts";
import type { ExtendedDescription } from "../schemas/extended-description.ts";
import type { FamiliarFollowers } from "../schemas/familiar-followers.ts";
import type { Filter, FilterKeyword } from "../schemas/filters.ts";
import type { Instance } from "../schemas/instance.ts";
import type { Marker } from "../schemas/marker.ts";
import type { Notification } from "../schemas/notification.ts";
import type { Poll } from "../schemas/poll.ts";
import type { Preferences } from "../schemas/preferences.ts";
import type { PrivacyPolicy } from "../schemas/privacy-policy.ts";
import type { WebPushSubscription } from "../schemas/pushsubscription.ts";
import type { Relationship } from "../schemas/relationship.ts";
import type { Report } from "../schemas/report.ts";
import type { Rule } from "../schemas/rule.ts";
import type { Search } from "../schemas/search.ts";
import type {
    ScheduledStatus,
    Status,
    StatusSource,
} from "../schemas/status.ts";
import type { Tag } from "../schemas/tag.ts";
import type { Token } from "../schemas/token.ts";
import type { TermsOfService } from "../schemas/tos.ts";
import type { Challenge, Role } from "../schemas/versia.ts";
import { BaseClient, type Output } from "./base.ts";
import { DEFAULT_SCOPE, NO_REDIRECT } from "./constants.ts";

type StatusContentType =
    | "text/plain"
    | "text/markdown"
    | "text/html"
    | "text/x.misskeymarkdown";

/**
 * Client is a client for interacting with the Versia API.
 *
 * @extends BaseClient
 * @example
 * const client = new Client(new URL("https://example.com"));
 *
 * const { data } = await client.getInstance();
 *
 * console.log(data);
 */
export class Client extends BaseClient {
    /**
     * POST /api/v1/follow_requests/:id/authorize
     *
     * @param id Target account ID.
     * @return Relationship.
     */
    public acceptFollowRequest(
        id: string,
        extra?: RequestInit,
    ): Promise<Output<z.infer<typeof Relationship>>> {
        return this.post<z.infer<typeof Relationship>>(
            `/api/v1/follow_requests/${id}/authorize`,
            undefined,
            extra,
        );
    }

    /**
     * POST /api/v1/lists/:id/accounts
     *
     * @param id Target list ID.
     * @param account_ids Array of account IDs to add to the list.
     */
    public addAccountToList(
        id: string,
        account_ids: string[],
        extra?: RequestInit,
    ): Promise<Output<void>> {
        return this.post(
            `/api/v1/lists/${id}/accounts`,
            { account_ids },
            extra,
        );
    }

    /**
     * PUT /api/v1/announcements/:id/reactions/:name
     *
     * @param id The ID of the Announcement in the database.
     * @param name Unicode emoji, or the shortcode of a custom emoji.
     */
    public addReactionToAnnouncement(
        id: string,
        name: string,
        extra?: RequestInit,
    ): Promise<Output<void>> {
        return this.put(
            `/api/v1/announcements/${id}/reactions/${name}`,
            undefined,
            extra,
        );
    }

    /**
     * POST /api/v1/accounts/:account_id/roles/:role_id
     *
     * Versia API only.
     * @param account_id The account ID.
     * @param role_id The role ID.
     */
    public assignRole(
        account_id: string,
        role_id: string,
        extra?: RequestInit,
    ): Promise<Output<void>> {
        return this.post(
            `/api/v1/accounts/${account_id}/roles/${role_id}`,
            undefined,
            extra,
        );
    }

    /**
     * POST /api/v1/accounts/:id/block
     *
     * @param id The account ID.
     * @return Relationship
     */
    public blockAccount(
        id: string,
        extra?: RequestInit,
    ): Promise<Output<z.infer<typeof Relationship>>> {
        return this.post<z.infer<typeof Relationship>>(
            `/api/v1/accounts/${id}/block`,
            undefined,
            extra,
        );
    }

    /**
     * POST/api/v1/domain_blocks
     *
     * @param domain Domain to block.
     */
    public blockDomain(
        domain: string,
        extra?: RequestInit,
    ): Promise<Output<void>> {
        return this.post("/api/v1/domain_blocks", { domain }, extra);
    }

    public bookmarkStatus(
        id: string,
        extra?: RequestInit,
    ): Promise<Output<z.infer<typeof Status>>> {
        return this.post<z.infer<typeof Status>>(
            `/api/v1/statuses/${id}/bookmark`,
            undefined,
            extra,
        );
    }

    /**
     * DELETE /api/v1/scheduled_statuses/:id
     *
     * @param id Target scheduled status ID.
     */
    public cancelScheduledStatus(
        id: string,
        extra?: RequestInit,
    ): Promise<Output<void>> {
        return this.delete(
            `/api/v1/scheduled_statuses/${id}/cancel`,
            undefined,
            extra,
        );
    }

    /**
     * POST /api/v1/apps
     *
     * Create an application.
     * @param client_name your application's name
     * @param options.redirect_uris Redirect URI for the application. Defaults to `urn:ietf:wg:oauth:2.0:oob`.
     * @param options.scopes Array of scopes to request.
     * @param options.website URL to the application's website.
     */
    public createApp(
        client_name: string,
        options?: Partial<{
            redirect_uris: string;
            scopes: string[];
            website?: string;
        }>,
    ): Promise<Output<z.infer<typeof CredentialApplication>>> {
        return this.postForm<z.infer<typeof CredentialApplication>>(
            "/api/v1/apps",
            {
                client_name,
                ...options,
                scopes: options?.scopes?.join(" ") || DEFAULT_SCOPE.join(" "),
                redirect_uris: options?.redirect_uris || NO_REDIRECT,
            },
        );
    }

    /**
     * POST /api/v1/statuses/:id/reactions/:emoji
     *
     * @param id The target status ID.
     * @param emoji The emoji to add (shortcode or Unicode emoji).
     * @returns
     */
    public createEmojiReaction(
        id: string,
        emoji: string,
        extra?: RequestInit,
    ): Promise<Output<z.infer<typeof Status>>> {
        return this.post<z.infer<typeof Status>>(
            `/api/v1/statuses/${id}/reactions/${emoji}`,
            undefined,
            extra,
        );
    }

    // FIXME: No FeaturedTag schema
    /**
     * POST /api/v1/featured_tags
     *
     * @param name Target hashtag name.
     * @return FeaturedTag.
     */
    public createFeaturedTag(
        name: string,
        extra?: RequestInit,
    ): Promise<Output<unknown>> {
        return this.post<unknown>("/api/v1/featured_tags", { name }, extra);
    }

    /**
     * POST /api/v2/filters
     *
     * Create a filter.
     * @param context Filter context.
     * @param title Filter title.
     * @param filter_action Filter action.
     * @param options.expires_in How many seconds from now should the filter expire?
     * @param options.keywords_attributes Keywords to filter.
     */
    public createFilter(
        context: z.infer<typeof Filter.shape.context>,
        title: z.infer<typeof Filter.shape.title>,
        filter_action: z.infer<typeof Filter.shape.filter_action>,
        options: Partial<{
            expires_in: number;
            keywords_attributes: {
                keyword: z.infer<typeof FilterKeyword.shape.keyword>;
                whole_word: z.infer<typeof FilterKeyword.shape.whole_word>;
            }[];
        }>,
        extra?: RequestInit,
    ): Promise<Output<z.infer<typeof Filter>>> {
        return this.post<z.infer<typeof Filter>>(
            "/api/v2/filters",
            {
                context,
                title,
                filter_action,
                ...options,
            },
            extra,
        );
    }

    // FIXME: No List schema
    /**
     * POST /api/v1/lists
     *
     * @param title List name.
     * @return List.
     */
    public createList(
        title: string,
        extra?: RequestInit,
    ): Promise<Output<unknown>> {
        return this.post<unknown>("/api/v1/lists", { title }, extra);
    }

    /**
     * POST /api/v1/roles
     *
     * Versia API only.
     * @param name Name of the role.
     * @param options.permissions Array of permissions.
     * @param options.priority Role priority.
     * @param options.description Role description.
     * @param options.visible Role visibility.
     * @param options.icon Role icon (URL).
     * @returns Role
     */
    public createRole(
        name: string,
        options: Partial<{
            permissions: string[];
            priority: number;
            description: string;
            visible: boolean;
            icon: string;
        }>,
        extra?: RequestInit,
    ): Promise<Output<z.infer<typeof Role>>> {
        return this.post<z.infer<typeof Role>>(
            "/api/v1/roles",
            { name, ...options },
            extra,
        );
    }

    /**
     * DELETE /api/v1/lists/:id/accounts
     *
     * @param id Target list ID.
     * @param account_ids Array of account IDs to add to the list.
     */
    public deleteAccountsFromList(
        id: string,
        account_ids: string[],
        extra?: RequestInit,
    ): Promise<Output<void>> {
        return this.delete(
            `/api/v1/lists/${id}/accounts`,
            { account_ids },
            extra,
        );
    }

    /**
     * DELETE /api/v1/conversations/:id
     *
     * @param id Target conversation ID.
     */
    public deleteConversation(
        id: string,
        extra?: RequestInit,
    ): Promise<Output<void>> {
        return this.delete(`/api/v1/conversations/${id}`, undefined, extra);
    }

    /**
     * DELETE /api/v1/emojis/:id
     *
     * Versia API only.
     * @param id The emoji to delete's ID.
     * @return Empty.
     */
    public deleteEmoji(id: string, extra?: RequestInit): Promise<Output<void>> {
        return this.delete(`/api/v1/emojis/${id}`, undefined, extra);
    }

    /**
     * DELETE /api/v1/statuses/:id/reactions/:emoji
     *
     * @param id The target status ID.
     * @param emoji The emoji to delete (shortcode or Unicode emoji).
     * @returns
     */
    public deleteEmojiReaction(
        id: string,
        emoji: string,
        extra?: RequestInit,
    ): Promise<Output<z.infer<typeof Status>>> {
        return this.delete<z.infer<typeof Status>>(
            `/api/v1/statuses/${id}/reactions/${emoji}`,
            undefined,
            extra,
        );
    }

    /**
     * DELETE /api/v1/featured_tags/:id
     *
     * @param id Target featured tag ID.
     * @return Empty
     */
    public deleteFeaturedTag(
        id: string,
        extra?: RequestInit,
    ): Promise<Output<void>> {
        return this.delete(`/api/v1/featured_tags/${id}`, undefined, extra);
    }

    /**
     * DELETE /api/v2/filters/:id
     *
     * @param id Target filter ID.
     */
    public deleteFilter(
        id: string,
        extra?: RequestInit,
    ): Promise<Output<void>> {
        return this.delete(`/api/v2/filters/${id}`, undefined, extra);
    }

    /**
     * DELETE /api/v1/lists/:id
     *
     * @param id Target list ID.
     */
    public deleteList(id: string, extra?: RequestInit): Promise<Output<void>> {
        return this.delete(`/api/v1/lists/${id}`, undefined, extra);
    }

    /**
     * DELETE /api/v1/push/subscription
     */
    public deletePushSubscription(extra?: RequestInit): Promise<Output<void>> {
        return this.delete("/api/v1/push/subscription", undefined, extra);
    }

    /**
     * DELETE /api/v1/roles/:id
     *
     * Versia API only.
     * @param id The role ID.
     * @return Empty.
     */
    public deleteRole(id: string, extra?: RequestInit): Promise<Output<void>> {
        return this.delete(`/api/v1/roles/${id}`, undefined, extra);
    }

    /**
     * DELETE /api/v1/statuses/:id
     *
     * @param id The target status id.
     * @return Status
     */
    public deleteStatus(
        id: string,
        extra?: RequestInit,
    ): Promise<Output<z.infer<typeof Status>>> {
        return this.delete<z.infer<typeof Status>>(
            `/api/v1/statuses/${id}`,
            undefined,
            extra,
        );
    }

    // TODO: directStreaming

    /**
     * POST /api/v1/announcements/:id/dismiss
     *
     * @param id The ID of the Announcement in the database.
     */
    public dismissInstanceAnnouncement(
        id: string,
        extra?: RequestInit,
    ): Promise<Output<void>> {
        return this.post(
            `/api/v1/instance/announcements/${id}/dismiss`,
            undefined,
            extra,
        );
    }

    /**
     * DELETE /api/v1/notifications/destroy_multiple
     *
     * @param ids Target notification IDs.
     */
    public dismissMultipleNotifications(
        ids: string[],
        extra?: RequestInit,
    ): Promise<Output<void>> {
        const params = new URLSearchParams();

        for (const id of ids) {
            params.append("ids[]", id);
        }

        return this.delete(
            `/api/v1/notifications/destroy_multiple?${params.toString()}`,
            undefined,
            extra,
        );
    }

    /**
     * POST /api/v1/notifications/:id/dismiss
     *
     * @param id Target notification ID.
     */
    public dismissNotification(
        id: string,
        extra?: RequestInit,
    ): Promise<Output<void>> {
        return this.post(
            `/api/v1/notifications/${id}/dismiss`,
            undefined,
            extra,
        );
    }

    /**
     * POST /api/v1/notifications/clear
     */
    public dismissNotifications(extra?: RequestInit): Promise<Output<void>> {
        return this.post("/api/v1/notifications/clear", undefined, extra);
    }

    /**
     * PUT /api/v1/statuses/:id
     *
     * @param id The target status id.
     * @param options.status The new status text.
     * @param options.content_type The new status content type.
     * @param options.media_ids Array of media IDs to attach to the status.
     * @param options.poll Poll options.
     * @param options.sensitive Mark status as sensitive.
     * @param options.spoiler_text Warning text that should be displayed as a warning before the actual content.
     * @param options.language Language of the status (ISO 639-1 two letter code).
     * @return Status
     */
    public editStatus(
        id: string,
        options: Partial<{
            status: string;
            content_type: StatusContentType;
            media_ids: string[];
            poll: Partial<{
                expires_in: number;
                hide_totals: boolean;
                multiple: boolean;
                options: string[];
            }>;
            sensitive: boolean;
            spoiler_text: string;
            language: string;
        }>,
        extra?: RequestInit,
    ): Promise<Output<z.infer<typeof Status>>> {
        return this.put<z.infer<typeof Status>>(
            `/api/v1/statuses/${id}`,
            options,
            extra,
        );
    }

    /**
     * POST /api/v1/statuses/:id/favourite
     *
     * @param id The target status id.
     * @return Status.
     */
    public favouriteStatus(
        id: string,
        extra?: RequestInit,
    ): Promise<Output<z.infer<typeof Status>>> {
        return this.post<z.infer<typeof Status>>(
            `/api/v1/statuses/${id}/favourite`,
            undefined,
            extra,
        );
    }

    /**
     * POST /oauth/token
     *
     * Fetch OAuth access token.
     * Get an access token based client_id and client_secret and authorization code.
     * @param client_id Will be generated by #createApp or #registerApp
     * @param client_secret Will be generated by #createApp or #registerApp
     * @param code Will be generated by the link of #generateAuthUrl or #registerApp
     * @param redirect_uri Must be the same URI as the time when you register your OAuth2 application
     */
    public fetchAccessToken(
        client_id: string,
        client_secret: string,
        code?: string,
        redirect_uri: string = NO_REDIRECT,
        extra?: RequestInit,
    ): Promise<Output<z.infer<typeof Token>>> {
        return this.postForm<z.infer<typeof Token>>(
            "/oauth/token",
            {
                client_id,
                client_secret,
                code,
                redirect_uri,
                grant_type: "authorization_code",
            },
            extra,
        );
    }

    /**
     * POST /api/v1/accounts/:id/follow
     *
     * @param id The account ID.
     * @param options.reblogs Receive this account's reblogs in home timeline.
     * @param options.notify Receive push notifications from this account.
     * @param options.languages Array of language codes.
     * @return Relationship
     */
    public followAccount(
        id: string,
        options?: Partial<{
            reblogs: boolean;
            notify: boolean;
            languages: string[];
        }>,
        extra?: RequestInit,
    ): Promise<Output<z.infer<typeof Relationship>>> {
        return this.post<z.infer<typeof Relationship>>(
            `/api/v1/accounts/${id}/follow`,
            options,
            extra,
        );
    }

    /**
     * POST /api/v1/tags/:id/follow
     *
     * @param id Target hashtag id.
     * @return Tag
     */
    public followTag(
        id: string,
        extra?: RequestInit,
    ): Promise<Output<z.infer<typeof Tag>>> {
        return this.post<z.infer<typeof Tag>>(
            `/api/v1/tags/${id}/follow`,
            undefined,
            extra,
        );
    }

    /**
     * Generate an authorization URL for the client.
     *
     * @param client_id OAuth2 app client ID.
     * @param client_secret OAuth2 app client secret.
     * @param options.redirect_uri Redirect URI for the OAuth2 app.
     * @param options.scopes Array of scopes to request.
     * @returns
     */
    public generateAuthUrl(
        client_id: string,
        client_secret: string,
        options: Partial<{
            redirect_uri: string;
            scopes: string[];
        }>,
    ): Promise<string> {
        const oauthClient = new OAuth2Client({
            server: this.baseUrl.toString(),
            clientId: client_id,
            clientSecret: client_secret,
            tokenEndpoint: "/oauth/token",
            authorizationEndpoint: "/oauth/authorize",
        });

        return oauthClient.authorizationCode.getAuthorizeUri({
            redirectUri: options.redirect_uri || NO_REDIRECT,
            scope: options.scopes || DEFAULT_SCOPE,
        });
    }

    /**
     * POST /api/v1/challenges
     *
     * Generates a new Captcha to solve.
     * @returns A challenge.
     */
    public getChallenge(
        extra?: RequestInit,
    ): Promise<Output<z.infer<typeof Challenge>>> {
        return this.post<z.infer<typeof Challenge>>(
            "/api/v1/challenges",
            undefined,
            extra,
        );
    }

    /**
     * GET /api/v1/accounts/:id
     *
     * @param id The account ID.
     * @return An account.
     */
    public getAccount(
        id: string,
        extra?: RequestInit,
    ): Promise<Output<z.infer<typeof Account>>> {
        return this.get<z.infer<typeof Account>>(
            `/api/v1/accounts/${id}`,
            extra,
        );
    }

    /**
     * GET /api/v1/accounts/id
     *
     * Versia API only.
     * @param username The username.
     * @return An account.
     */
    public getAccountByUsername(
        username: string,
        extra?: RequestInit,
    ): Promise<Output<z.infer<typeof Account>>> {
        return this.get<z.infer<typeof Account>>(
            `/api/v1/accounts/id?${new URLSearchParams({
                username,
            }).toString()}`,
            extra,
        );
    }

    /**
     * GET /api/v1/accounts/:id/followers
     *
     * @param id The account ID.
     * @param options.limit Max number of results to return. Defaults to 40.
     * @param options.max_id Return results older than ID.
     * @param options.since_id Return results newer than ID.
     * @return The array of accounts.
     */
    public getAccountFollowers(
        id: string,
        options?: Partial<{
            max_id: string;
            since_id: string;
            limit: number;
        }>,
        extra?: RequestInit,
    ): Promise<Output<z.infer<typeof Account>[]>> {
        const params = new URLSearchParams();

        if (options) {
            if (options.max_id) {
                params.set("max_id", options.max_id);
            }
            if (options.since_id) {
                params.set("since_id", options.since_id);
            }
            if (options.limit) {
                params.set("limit", options.limit.toString());
            }
        }

        return this.get<z.infer<typeof Account>[]>(
            `/api/v1/accounts/${id}/followers?${params}`,
            extra,
        );
    }

    /**
     * GET /api/v1/accounts/:id/following
     *
     * @param id The account ID.
     * @param options.limit Max number of results to return. Defaults to 40.
     * @param options.max_id Return results older than ID.
     * @param options.since_id Return results newer than ID.
     * @return The array of accounts.
     */
    public getAccountFollowing(
        id: string,
        options?: Partial<{
            max_id: string;
            since_id: string;
            limit: number;
        }>,
        extra?: RequestInit,
    ): Promise<Output<z.infer<typeof Account>[]>> {
        const params = new URLSearchParams();

        if (options) {
            if (options.max_id) {
                params.set("max_id", options.max_id);
            }
            if (options.since_id) {
                params.set("since_id", options.since_id);
            }
            if (options.limit) {
                params.set("limit", options.limit.toString());
            }
        }

        return this.get<z.infer<typeof Account>[]>(
            `/api/v1/accounts/${id}/following?${params}`,
            extra,
        );
    }

    // FIXME: No List schema
    /**
     * GET /api/v1/accounts/:id/lists
     *
     * @param id The account ID.
     * @return The array of lists.
     */
    public getAccountLists(
        id: string,
        extra?: RequestInit,
    ): Promise<Output<unknown[]>> {
        return this.get<unknown[]>(`/api/v1/accounts/${id}/lists`, extra);
    }

    /**
     * GET /api/v1/accounts/:id/roles
     *
     * Versia API only.
     * @param id The account ID.
     * @return Array of roles.
     */
    public getAccountRoles(
        id: string,
        extra?: RequestInit,
    ): Promise<Output<z.infer<typeof Role>[]>> {
        return this.get<z.infer<typeof Role>[]>(
            `/api/v1/accounts/${id}/roles`,
            extra,
        );
    }

    /**
     * GET /api/v1/accounts/:id/statuses
     *
     * @param id The account ID.
     * @param options.limit Max number of results to return. Defaults to 20.
     * @param options.max_id Return results older than ID.
     * @param options.since_id Return results newer than ID but starting with most recent.
     * @param options.min_id Return results newer than ID.
     * @param options.pinned Return statuses which include pinned statuses.
     * @param options.exclude_replies Return statuses which exclude replies.
     * @param options.exclude_reblogs Return statuses which exclude reblogs.
     * @param options.only_media Show only statuses with media attached? Defaults to false.
     * @return Account's statuses.
     */
    public getAccountStatuses(
        id: string,
        options?: Partial<{
            max_id: string;
            min_id: string;
            since_id: string;
            limit: number;
            only_media: boolean;
            pinned: boolean;
            exclude_replies: boolean;
            exclude_reblogs: boolean;
        }>,
        extra?: RequestInit,
    ): Promise<Output<z.infer<typeof Status>[]>> {
        const params = new URLSearchParams();

        if (options) {
            if (options.max_id) {
                params.set("max_id", options.max_id);
            }
            if (options.min_id) {
                params.set("min_id", options.min_id);
            }
            if (options.since_id) {
                params.set("since_id", options.since_id);
            }
            if (options.limit) {
                params.set("limit", options.limit.toString());
            }
            if (options.only_media) {
                params.set("only_media", "true");
            }
            if (options.pinned) {
                params.set("pinned", "true");
            }
            if (options.exclude_replies) {
                params.set("exclude_replies", "true");
            }
            if (options.exclude_reblogs) {
                params.set("exclude_reblogs", "true");
            }
        }

        return this.get<z.infer<typeof Status>[]>(
            `/api/v1/accounts/${id}/statuses?${params}`,
            extra,
        );
    }

    /**
     * GET /api/v1/lists/:id/accounts
     *
     * @param id Target list ID.
     * @param options.limit Max number of results to return.
     * @param options.max_id Return results older than ID.
     * @param options.since_id Return results newer than ID.
     * @param options.min_id Return results immediately newer than ID.
     * @return Array of accounts.
     */
    public getAccountsInList(
        id: string,
        options: Partial<{
            max_id: string;
            since_id: string;
            min_id: string;
            limit: number;
        }>,
        extra?: RequestInit,
    ): Promise<Output<z.infer<typeof Account>[]>> {
        const params = new URLSearchParams();

        if (options) {
            if (options.max_id) {
                params.set("max_id", options.max_id);
            }
            if (options.since_id) {
                params.set("since_id", options.since_id);
            }
            if (options.min_id) {
                params.set("min_id", options.min_id);
            }
            if (options.limit) {
                params.set("limit", options.limit.toString());
            }
        }

        return this.get<z.infer<typeof Account>[]>(
            `/api/v1/lists/${id}/accounts?${params}`,
            extra,
        );
    }

    /**
     * GET /api/v1/blocks
     *
     * @param options.limit Max number of results to return. Defaults to 40.
     * @param options.max_id Return results older than ID.
     * @param options.min_id Return results immediately newer than ID.
     * @return Array of accounts.
     */
    public getBlocks(
        options?: Partial<{
            max_id: string;
            min_id: string;
            limit: number;
        }>,
    ): Promise<Output<z.infer<typeof Account>[]>> {
        const params = new URLSearchParams();

        if (options) {
            if (options.max_id) {
                params.set("max_id", options.max_id);
            }
            if (options.min_id) {
                params.set("min_id", options.min_id);
            }
            if (options.limit) {
                params.set("limit", options.limit.toString());
            }
        }

        return this.get<z.infer<typeof Account>[]>(`/api/v1/blocks?${params}`);
    }

    /**
     * GET /api/v1/bookmarks
     *
     * @param options.limit Max number of results to return. Defaults to 40.
     * @param options.max_id Return results older than ID.
     * @param options.since_id Return results newer than ID.
     * @param options.min_id Return results immediately newer than ID.
     * @return Array of statuses.
     */
    public getBookmarks(
        options?: Partial<{
            max_id: string;
            min_id: string;
            since_id: string;
            limit: number;
        }>,
    ): Promise<Output<z.infer<typeof Status>[]>> {
        const params = new URLSearchParams();

        if (options) {
            if (options.max_id) {
                params.set("max_id", options.max_id);
            }
            if (options.min_id) {
                params.set("min_id", options.min_id);
            }
            if (options.since_id) {
                params.set("since_id", options.since_id);
            }
            if (options.limit) {
                params.set("limit", options.limit.toString());
            }
        }

        return this.get<z.infer<typeof Status>[]>(
            `/api/v1/bookmarks?${params}`,
        );
    }

    // FIXME: No Conversation schema
    /**
     * GET /api/v1/conversations
     *
     * @param options.limit Max number of results to return. Defaults to 20.
     * @param options.max_id Return results older than ID.
     * @param options.since_id Return results newer than ID.
     * @param options.min_id Return results immediately newer than ID.
     * @return Array of statuses.
     */
    public getConversationTimeline(
        id: string,
        options?: Partial<{
            max_id: string;
            min_id: string;
            since_id: string;
            limit: number;
        }>,
        extra?: RequestInit,
    ): Promise<Output<unknown[]>> {
        const params = new URLSearchParams();

        if (options) {
            if (options.max_id) {
                params.set("max_id", options.max_id);
            }
            if (options.min_id) {
                params.set("min_id", options.min_id);
            }
            if (options.since_id) {
                params.set("since_id", options.since_id);
            }
            if (options.limit) {
                params.set("limit", options.limit.toString());
            }
        }

        return this.get<unknown[]>(
            `/api/v1/conversations/${id}/timeline?${params}`,
            extra,
        );
    }

    /**
     * GET /api/v1/domain_blocks
     *
     * @param options.limit Max number of results to return. Defaults to 40.
     * @param options.max_id Return results older than ID.
     * @param options.min_id Return results immediately newer than ID.
     * @return Array of domain name.
     */
    public getDomainBlocks(
        options?: Partial<{
            max_id: string;
            since_id: string;
            limit: number;
        }>,
    ): Promise<Output<string[]>> {
        const params = new URLSearchParams();

        if (options) {
            if (options.max_id) {
                params.set("max_id", options.max_id);
            }
            if (options.since_id) {
                params.set("since_id", options.since_id);
            }
            if (options.limit) {
                params.set("limit", options.limit.toString());
            }
        }

        return this.get<string[]>(`/api/v1/domain_blocks?${params}`);
    }

    /**
     * GET /api/v1/emojis/:id
     *
     * Versia API only.
     * @param id The emoji ID.
     * @return Emoji.
     */
    public getEmoji(
        id: string,
        extra?: RequestInit,
    ): Promise<Output<z.infer<typeof CustomEmoji>>> {
        return this.get<z.infer<typeof CustomEmoji>>(
            `/api/v1/emojis/${id}`,
            extra,
        );
    }

    /**
     * GET /api/v1/endorsements
     *
     * @param options.limit Max number of results to return. Defaults to 40.
     * @param options.max_id Return results older than ID.
     * @param options.since_id Return results newer than ID.
     * @return Array of accounts.
     */
    public getEndorsements(
        options?: Partial<{
            max_id: string;
            since_id: string;
            limit: number;
        }>,
        extra?: RequestInit,
    ): Promise<Output<z.infer<typeof Account>[]>> {
        const params = new URLSearchParams();

        if (options) {
            if (options.max_id) {
                params.set("max_id", options.max_id);
            }
            if (options.since_id) {
                params.set("since_id", options.since_id);
            }
            if (options.limit) {
                params.set("limit", options.limit.toString());
            }
        }

        return this.get<z.infer<typeof Account>[]>(
            `/api/v1/endorsements?${params}`,
            extra,
        );
    }

    /**
     * GET /api/v1/accounts/familiar_followers
     *
     * @param ids Array of account IDs.
     * @return Array of familiar followers.
     */
    public getFamiliarFollowers(
        ids: string[],
    ): Promise<Output<z.infer<typeof FamiliarFollowers>[]>> {
        const params = new URLSearchParams();

        for (const id of ids) {
            params.append("id[]", id);
        }

        return this.get<z.infer<typeof FamiliarFollowers>[]>(
            `/api/v1/accounts/familiar_followers?${params}`,
        );
    }

    /**
     * GET /api/v1/favourites
     *
     * @param options.limit Max number of results to return. Defaults to 40.
     * @param options.max_id Return results older than ID.
     * @param options.min_id Return results immediately newer than ID.
     * @return Array of statuses.
     */
    public getFavourites(
        options?: Partial<{
            max_id: string;
            min_id: string;
            limit: number;
        }>,
    ): Promise<Output<z.infer<typeof Status>[]>> {
        const params = new URLSearchParams();

        if (options) {
            if (options.max_id) {
                params.set("max_id", options.max_id);
            }
            if (options.min_id) {
                params.set("min_id", options.min_id);
            }
            if (options.limit) {
                params.set("limit", options.limit.toString());
            }
        }

        return this.get<z.infer<typeof Status>[]>(
            `/api/v1/favourites?${params}`,
        );
    }

    // FIXME: No FeaturedTag schema
    /**
     * GET /api/v1/featured_tags
     *
     * @return Array of featured tag.
     */
    public getFeaturedTags(extra?: RequestInit): Promise<Output<unknown[]>> {
        return this.get<unknown[]>("/api/v1/featured_tags", extra);
    }

    /**
     * GET /api/v2/filters/:id
     *
     * @param id The filter ID.
     * @return Filter.
     */
    public getFilter(
        id: string,
        extra?: RequestInit,
    ): Promise<Output<z.infer<typeof Filter>>> {
        return this.get<z.infer<typeof Filter>>(`/api/v2/filters/${id}`, extra);
    }

    /**
     * GET /api/v2/filters
     *
     * @return Array of filters.
     */
    public getFilters(
        extra?: RequestInit,
    ): Promise<Output<z.infer<typeof Filter>[]>> {
        return this.get<z.infer<typeof Filter>[]>("/api/v2/filters", extra);
    }

    /**
     * GET /api/v1/follow_requests
     *
     * @param options.limit Maximum number of results.
     * @return Array of account.
     */
    public getFollowRequests(
        options?: Partial<{
            limit: number;
        }>,
    ): Promise<Output<z.infer<typeof Account>[]>> {
        const params = new URLSearchParams();

        if (options) {
            if (options.limit) {
                params.set("limit", options.limit.toString());
            }
        }

        return this.get<z.infer<typeof Account>[]>(
            `/api/v1/follow_requests?${params}`,
        );
    }

    /**
     * GET /api/v1/followed_tags
     *
     * @return Array of Tag.
     */
    public getFollowedTags(
        extra?: RequestInit,
    ): Promise<Output<z.infer<typeof Tag>[]>> {
        return this.get<z.infer<typeof Tag>[]>("/api/v1/followed_tags", extra);
    }

    /**
     * GET /api/v1/timelines/home
     *
     * @param options.local Show only local statuses? Defaults to false.
     * @param options.limit Max number of results to return. Defaults to 20.
     * @param options.max_id Return results older than ID.
     * @param options.since_id Return results newer than ID.
     * @param options.min_id Return results immediately newer than ID.
     * @return Array of statuses.
     */
    public getHomeTimeline(
        options?: Partial<{
            max_id: string;
            min_id: string;
            since_id: string;
            limit: number;
            local: boolean;
        }>,
        extra?: RequestInit,
    ): Promise<Output<z.infer<typeof Status>[]>> {
        const params = new URLSearchParams();

        if (options) {
            if (options.max_id) {
                params.set("max_id", options.max_id);
            }
            if (options.min_id) {
                params.set("min_id", options.min_id);
            }
            if (options.since_id) {
                params.set("since_id", options.since_id);
            }
            if (options.limit) {
                params.set("limit", options.limit.toString());
            }
            if (options.local) {
                params.set("local", "true");
            }
        }

        return this.get<z.infer<typeof Status>[]>(
            `/api/v1/timelines/home?${params}`,
            extra,
        );
    }

    /**
     * GET /api/v2/instance
     *
     * @return Instance.
     */
    public getInstance(
        extra?: RequestInit,
    ): Promise<Output<z.infer<typeof Instance>>> {
        return this.get<z.infer<typeof Instance>>("/api/v2/instance", extra);
    }

    // FIXME: No InstanceActivity schema
    /**
     * GET /api/v1/instance/activity
     */
    public getInstanceActivity(
        extra?: RequestInit,
    ): Promise<Output<unknown[]>> {
        return this.get<unknown[]>("/api/v1/instance/activity", extra);
    }

    // FIXME: No Announcement schema
    /**
     * GET /api/v1/announcements
     *
     * @return Array of announcements.
     */
    public getInstanceAnnouncements(
        extra?: RequestInit,
    ): Promise<Output<unknown[]>> {
        return this.get<unknown[]>("/api/v1/instance/announcements", extra);
    }

    /**
     * GET /api/v1/custom_emojis
     *
     * Get custom emojis. Returns both server and user emojis.
     * @return Array of emojis.
     */
    public getInstanceCustomEmojis(
        extra?: RequestInit,
    ): Promise<Output<z.infer<typeof CustomEmoji>[]>> {
        return this.get<z.infer<typeof CustomEmoji>[]>(
            "/api/v1/custom_emojis",
            extra,
        );
    }

    /**
     * GET /api/v1/directory
     *
     * @param options.limit How many accounts to load. Default 40.
     * @param options.offset How many accounts to skip before returning results. Default 0.
     * @param options.order Order of results.
     * @param options.local Only return local accounts.
     * @return Array of accounts.
     */
    public getInstanceDirectory(
        options?: Partial<{
            limit: number;
            local: boolean;
            offset: number;
            order: "active" | "new";
        }>,
        extra?: RequestInit,
    ): Promise<Output<z.infer<typeof Account>[]>> {
        const params = new URLSearchParams();

        if (options) {
            if (options.limit) {
                params.set("limit", options.limit.toString());
            }
            if (options.local) {
                params.set("local", "true");
            }
            if (options.offset) {
                params.set("offset", options.offset.toString());
            }
            if (options.order) {
                params.set("order", options.order);
            }
        }

        return this.get<z.infer<typeof Account>[]>(
            `/api/v1/directory?${params}`,
            extra,
        );
    }

    /**
     * GET /api/v1/instance/extended_description
     *
     * @returns Instance's extended description.
     */
    public getInstanceExtendedDescription(
        extra?: RequestInit,
    ): Promise<Output<z.infer<typeof ExtendedDescription>>> {
        return this.get<z.infer<typeof ExtendedDescription>>(
            "/api/v1/instance/extended_description",
            extra,
        );
    }

    /**
     * GET /api/v1/instance/peers
     *
     * @return Array of instance domains.
     */
    public getInstancePeers(extra?: RequestInit): Promise<Output<string[]>> {
        return this.get<string[]>("/api/v1/instance/peers", extra);
    }

    /**
     * GET /api/v1/instance/privacy_policy
     *
     * Versia API only.
     * @returns
     */
    public getInstancePrivacyPolicy(
        extra?: RequestInit,
    ): Promise<Output<z.infer<typeof PrivacyPolicy>>> {
        return this.get<z.infer<typeof PrivacyPolicy>>(
            "/api/v1/instance/privacy_policy",
            extra,
        );
    }

    /**
     * GET /api/v1/instance/terms_of_service
     *
     * @returns
     */
    public getInstanceTermsOfService(
        extra?: RequestInit,
    ): Promise<Output<z.infer<typeof TermsOfService>>> {
        return this.get<z.infer<typeof TermsOfService>>(
            "/api/v1/instance/terms_of_service",
            extra,
        );
    }

    /**
     * GET /api/v1/trends
     *
     * @param options.limit Maximum number of results to return. Defaults to 10.
     * @return Array of Tag.
     */
    public getInstanceTrends(
        options?: Partial<{ limit: number }>,
    ): Promise<Output<z.infer<typeof Tag>[]>> {
        const params = new URLSearchParams();

        if (options) {
            if (options.limit) {
                params.set("limit", options.limit.toString());
            }
        }

        return this.get<z.infer<typeof Tag>[]>(`/api/v1/trends?${params}`);
    }

    // FIXME: No List schema
    /**
     * GET /api/v1/lists/:id
     *
     * @param id Target list ID.
     * @return List.
     */
    public getList(id: string, extra?: RequestInit): Promise<Output<unknown>> {
        return this.get<unknown>(`/api/v1/lists/${id}`, extra);
    }

    /**
     * GET /api/v1/timelines/list/:id
     *
     * @param id Local ID of the list in the database.
     * @param options.limit Max number of results to return. Defaults to 20.
     * @param options.max_id Return results older than ID.
     * @param options.since_id Return results newer than ID.
     * @param options.min_id Return results immediately newer than ID.
     * @return Array of statuses.
     */
    public getListTimeline(
        id: string,
        options?: Partial<{
            max_id: string;
            min_id: string;
            since_id: string;
            limit: number;
        }>,
        extra?: RequestInit,
    ): Promise<Output<z.infer<typeof Status>[]>> {
        const params = new URLSearchParams();

        if (options) {
            if (options.max_id) {
                params.set("max_id", options.max_id);
            }
            if (options.min_id) {
                params.set("min_id", options.min_id);
            }
            if (options.since_id) {
                params.set("since_id", options.since_id);
            }
            if (options.limit) {
                params.set("limit", options.limit.toString());
            }
        }

        return this.get<z.infer<typeof Status>[]>(
            `/api/v1/timelines/list/${id}?${params}`,
            extra,
        );
    }

    // FIXME: No List schema
    /**
     * GET /api/v1/lists
     *
     * @return Array of lists.
     */
    public getLists(extra?: RequestInit): Promise<Output<unknown[]>> {
        return this.get<unknown[]>("/api/v1/lists", extra);
    }

    /**
     * GET /api/v1/timelines/public?local=true
     *
     * @param options.only_media Show only statuses with media attached? Defaults to false.
     * @param options.limit Max number of results to return. Defaults to 20.
     * @param options.max_id Return results older than ID.
     * @param options.since_id Return results newer than ID.
     * @param options.min_id Return results immediately newer than ID.
     * @param options.only_media Show only statuses with media attached? Defaults to false.
     * @return Array of statuses.
     */
    public getLocalTimeline(
        options?: Partial<{
            max_id: string;
            min_id: string;
            since_id: string;
            limit: number;
            only_media: boolean;
        }>,
        extra?: RequestInit,
    ): Promise<Output<z.infer<typeof Status>[]>> {
        const params = new URLSearchParams();

        params.set("local", "true");

        if (options) {
            if (options.max_id) {
                params.set("max_id", options.max_id);
            }
            if (options.min_id) {
                params.set("min_id", options.min_id);
            }
            if (options.since_id) {
                params.set("since_id", options.since_id);
            }
            if (options.limit) {
                params.set("limit", options.limit.toString());
            }
            if (options.only_media) {
                params.set("only_media", "true");
            }
        }

        return this.get<z.infer<typeof Status>[]>(
            `/api/v1/timelines/public?${params}`,
            extra,
        );
    }

    /**
     * GET /api/v1/markers
     *
     * @param timelines Array of timeline names, String enum anyOf home, notifications.
     * @return Marker or empty object.
     */
    public getMarkers(
        timelines: ("home" | "notifications")[],
    ): Promise<Output<z.infer<typeof Marker> | Record<never, never>>> {
        const params = new URLSearchParams();

        for (const timeline of timelines) {
            params.append("timeline[]", timeline);
        }

        return this.get<z.infer<typeof Marker> | Record<never, never>>(
            `/api/v1/markers?${params}`,
        );
    }

    /**
     * GET /api/v1/media/:id
     *
     * @param id Target media ID.
     * @return Attachment
     */
    public getMedia(
        id: string,
        extra?: RequestInit,
    ): Promise<Output<z.infer<typeof Attachment>>> {
        return this.get<z.infer<typeof Attachment>>(
            `/api/v1/media/${id}`,
            extra,
        );
    }

    /**
     * GET /api/v1/mutes
     *
     * @param options.limit Max number of results to return. Defaults to 40.
     * @param options.max_id Return results older than ID.
     * @param options.min_id Return results immediately newer than ID.
     * @return Array of accounts.
     */
    public getMutes(
        options?: Partial<{
            max_id: string;
            since_id: string;
            limit: number;
        }>,
    ): Promise<Output<z.infer<typeof Account>[]>> {
        const params = new URLSearchParams();

        if (options) {
            if (options.max_id) {
                params.set("max_id", options.max_id);
            }
            if (options.since_id) {
                params.set("since_id", options.since_id);
            }
            if (options.limit) {
                params.set("limit", options.limit.toString());
            }
        }

        return this.get<z.infer<typeof Account>[]>(`/api/v1/mutes?${params}`);
    }

    /**
     * GET /api/v1/notifications/:id
     *
     * @param id Target notification ID.
     * @return Notification.
     */
    public getNotification(
        id: string,
        extra?: RequestInit,
    ): Promise<Output<z.infer<typeof Notification>>> {
        return this.get<z.infer<typeof Notification>>(
            `/api/v1/notifications/${id}`,
            extra,
        );
    }

    /**
     * GET /api/v1/notifications
     *
     * @param options.limit Max number of results to return. Defaults to 20.
     * @param options.max_id Return results older than ID.
     * @param options.since_id Return results newer than ID.
     * @param options.min_id Return results immediately newer than ID.
     * @param options.exclude_types Array of types to exclude.
     * @param options.account_id Return only notifications received from this account.
     * @return Array of notifications.
     */
    public getNotifications(
        options?: Partial<{
            max_id: string;
            min_id: string;
            since_id: string;
            limit: number;
            exclude_types: string[];
            account_id: string;
        }>,
    ): Promise<Output<z.infer<typeof Notification>[]>> {
        const params = new URLSearchParams();

        if (options) {
            if (options.max_id) {
                params.set("max_id", options.max_id);
            }
            if (options.min_id) {
                params.set("min_id", options.min_id);
            }
            if (options.since_id) {
                params.set("since_id", options.since_id);
            }
            if (options.limit) {
                params.set("limit", options.limit.toString());
            }
            if (options.exclude_types) {
                for (const type of options.exclude_types) {
                    params.append("exclude_types[]", type);
                }
            }
            if (options.account_id) {
                params.set("account_id", options.account_id);
            }
        }

        return this.get<z.infer<typeof Notification>[]>(
            `/api/v1/notifications?${params}`,
        );
    }

    /**
     * GET /api/v1/polls/:id
     *
     * @param id Target poll ID.
     * @return Poll.
     */
    public getPoll(
        id: string,
        extra?: RequestInit,
    ): Promise<Output<z.infer<typeof Poll>>> {
        return this.get<z.infer<typeof Poll>>(`/api/v1/polls/${id}`, extra);
    }

    /**
     * GET /api/v1/preferences
     *
     * @return Preferences.
     */
    public getPreferences(
        extra?: RequestInit,
    ): Promise<Output<z.infer<typeof Preferences>>> {
        return this.get<z.infer<typeof Preferences>>(
            "/api/v1/preferences",
            extra,
        );
    }

    /**
     * GET /api/v1/timelines/public
     *
     * @param options.only_media Show only statuses with media attached? Defaults to false.
     * @param options.limit Max number of results to return. Defaults to 20.
     * @param options.max_id Return results older than ID.
     * @param options.since_id Return results newer than ID.
     * @param options.min_id Return results immediately newer than ID.
     * @return Array of statuses.
     */
    public getPublicTimeline(
        options?: Partial<{
            max_id: string;
            min_id: string;
            since_id: string;
            limit: number;
            only_media: boolean;
            local: boolean;
            remote: boolean;
        }>,
        extra?: RequestInit,
    ): Promise<Output<z.infer<typeof Status>[]>> {
        const params = new URLSearchParams();

        if (options) {
            if (options.max_id) {
                params.set("max_id", options.max_id);
            }
            if (options.min_id) {
                params.set("min_id", options.min_id);
            }
            if (options.since_id) {
                params.set("since_id", options.since_id);
            }
            if (options.limit) {
                params.set("limit", options.limit.toString());
            }
            if (options.only_media) {
                params.set("only_media", "true");
            }
            if (options.local) {
                params.set("local", "true");
            }
            if (options.remote) {
                params.set("remote", "true");
            }
        }

        return this.get<z.infer<typeof Status>[]>(
            `/api/v1/timelines/public?${params}`,
            extra,
        );
    }

    /**
     * GET /api/v1/push/subscription
     *
     * @return PushSubscription.
     */
    public getPushSubscription(
        extra?: RequestInit,
    ): Promise<Output<z.infer<typeof WebPushSubscription>>> {
        return this.get<z.infer<typeof WebPushSubscription>>(
            "/api/v1/push/subscription",
            extra,
        );
    }

    /**
     * GET /api/v1/accounts/relationships
     *
     * @param id The account ID.
     * @param options.with_suspended Include relationships with suspended accounts? Defaults to false.
     * @return Relationship
     */
    public getRelationship(
        id: string,
        options?: Partial<{
            with_suspended: boolean;
        }>,
        extra?: RequestInit,
    ): Promise<Output<z.infer<typeof Relationship>>> {
        return this.getRelationships([id], options, extra).then((r) => ({
            ...r,
            data: r.data[0] as z.infer<typeof Relationship>,
        }));
    }

    /**
     * GET /api/v1/accounts/relationships
     *
     * @param ids Array of account IDs.
     * @param options.with_suspended Include relationships with suspended accounts? Defaults to false.
     * @return Array of Relationship.
     */
    public getRelationships(
        ids: string[],
        options?: Partial<{
            with_suspended: boolean;
        }>,
        extra?: RequestInit,
    ): Promise<Output<z.infer<typeof Relationship>[]>> {
        const params = new URLSearchParams();

        for (const id of ids) {
            params.append("id[]", id);
        }

        if (options) {
            if (options.with_suspended) {
                params.set("with_suspended", "true");
            }
        }

        return this.get<z.infer<typeof Relationship>[]>(
            `/api/v1/accounts/relationships?${params}`,
            extra,
        );
    }

    /**
     * GET /api/v1/roles/:id
     *
     * Versia API only.
     * @param id Target role ID.
     * @return Role.
     */
    public getRole(
        id: string,
        extra?: RequestInit,
    ): Promise<Output<z.infer<typeof Role>>> {
        return this.get<z.infer<typeof Role>>(`/api/v1/roles/${id}`, extra);
    }

    /**
     * GET /api/v1/roles
     *
     * Versia API only.
     * @returns Array of roles.
     */
    public getRoles(
        extra?: RequestInit,
    ): Promise<Output<z.infer<typeof Role>[]>> {
        return this.get<z.infer<typeof Role>[]>("/api/v1/roles", extra);
    }

    /**
     * GET /api/v1/instance/rules
     *
     * @return Array of rules.
     */
    public getRules(
        extra?: RequestInit,
    ): Promise<Output<z.infer<typeof Rule>[]>> {
        return this.get<z.infer<typeof Rule>[]>(
            "/api/v1/instance/rules",
            extra,
        );
    }

    /**
     * GET /api/v1/scheduled_statuses/:id
     *
     * @param id Target status ID.
     * @return ScheduledStatus.
     */
    public getScheduledStatus(
        id: string,
        extra?: RequestInit,
    ): Promise<Output<z.infer<typeof ScheduledStatus>>> {
        return this.get<z.infer<typeof ScheduledStatus>>(
            `/api/v1/scheduled_statuses/${id}`,
            extra,
        );
    }

    /**
     * GET /api/v1/scheduled_statuses
     *
     * @param options.limit Max number of results to return. Defaults to 20.
     * @param options.max_id Return results older than ID.
     * @param options.since_id Return results newer than ID.
     * @param options.min_id Return results immediately newer than ID.
     * @return Array of scheduled statuses.
     */
    public getScheduledStatuses(
        options?: Partial<{
            max_id: string;
            min_id: string;
            since_id: string;
            limit: number;
        }>,
        extra?: RequestInit,
    ): Promise<Output<z.infer<typeof ScheduledStatus>[]>> {
        const params = new URLSearchParams();

        if (options) {
            if (options.max_id) {
                params.set("max_id", options.max_id);
            }
            if (options.min_id) {
                params.set("min_id", options.min_id);
            }
            if (options.since_id) {
                params.set("since_id", options.since_id);
            }
            if (options.limit) {
                params.set("limit", options.limit.toString());
            }
        }

        return this.get<z.infer<typeof ScheduledStatus>[]>(
            `/api/v1/scheduled_statuses?${params}`,
            extra,
        );
    }

    /**
     * GET /api/v1/statuses/:id
     *
     * @param id The target status id.
     * @return Status
     */
    public getStatus(
        id: string,
        extra?: RequestInit,
    ): Promise<Output<z.infer<typeof Status>>> {
        return this.get<z.infer<typeof Status>>(
            `/api/v1/statuses/${id}`,
            extra,
        );
    }

    /**
     * GET /api/v1/statuses/:id/context
     *
     * Get parent and child statuses.
     * @param id The target status id.
     * @param options.limit Max number of results to return. Defaults to 20.
     * @param options.max_id Return results older than ID.
     * @param options.since_id Return results newer than ID.
     * @return Context
     */
    public getStatusContext(
        id: string,
        options?: Partial<{
            limit: number;
            max_id: string;
            since_id: string;
        }>,
        extra?: RequestInit,
    ): Promise<Output<z.infer<typeof Context>>> {
        const params = new URLSearchParams();

        if (options) {
            if (options.limit) {
                params.set("limit", options.limit.toString());
            }
            if (options.max_id) {
                params.set("max_id", options.max_id);
            }
            if (options.since_id) {
                params.set("since_id", options.since_id);
            }
        }

        return this.get<z.infer<typeof Context>>(
            `/api/v1/statuses/${id}/context?${params}`,
            extra,
        );
    }

    /**
     * GET /api/v1/statuses/:id/favourited_by
     *
     * @param id The target status id.
     * @param options.limit Max number of results to return. Defaults to 40.
     * @param options.max_id Return results older than ID.
     * @param options.since_id Return results newer than ID.
     * @return Array of accounts.
     */
    public getStatusFavouritedBy(
        id: string,
        options?: Partial<{
            max_id: string;
            since_id: string;
            limit: number;
        }>,
        extra?: RequestInit,
    ): Promise<Output<z.infer<typeof Account>[]>> {
        const params = new URLSearchParams();

        if (options) {
            if (options.max_id) {
                params.set("max_id", options.max_id);
            }
            if (options.since_id) {
                params.set("since_id", options.since_id);
            }
            if (options.limit) {
                params.set("limit", options.limit.toString());
            }
        }

        return this.get<z.infer<typeof Account>[]>(
            `/api/v1/statuses/${id}/favourited_by?${params}`,
            extra,
        );
    }

    /**
     * GET /api/v1/statuses/:id/reblogged_by
     *
     * @param id The target status id.
     * @param options.limit Max number of results to return. Defaults to 40.
     * @param options.max_id Return results older than ID.
     * @param options.since_id Return results newer than ID.
     * @return Array of accounts.
     */
    public getStatusRebloggedBy(
        id: string,
        options?: Partial<{
            max_id: string;
            since_id: string;
            limit: number;
        }>,
        extra?: RequestInit,
    ): Promise<Output<z.infer<typeof Account>[]>> {
        const params = new URLSearchParams();

        if (options) {
            if (options.max_id) {
                params.set("max_id", options.max_id);
            }
            if (options.since_id) {
                params.set("since_id", options.since_id);
            }
            if (options.limit) {
                params.set("limit", options.limit.toString());
            }
        }

        return this.get<z.infer<typeof Account>[]>(
            `/api/v1/statuses/${id}/reblogged_by?${params}`,
            extra,
        );
    }

    /**
     * GET /api/v1/statuses/:id/source
     *
     * Obtain the source properties for a status so that it can be edited.
     * @param id The target status id.
     * @return StatusSource
     */
    public getStatusSource(
        id: string,
        extra?: RequestInit,
    ): Promise<Output<z.infer<typeof StatusSource>>> {
        return this.get<z.infer<typeof StatusSource>>(
            `/api/v1/statuses/${id}/source`,
            extra,
        );
    }

    /**
     * GET /api/v1/featured_tags/suggestions
     *
     * @return Array of tag.
     */
    public getSuggestedTags(
        extra?: RequestInit,
    ): Promise<Output<z.infer<typeof Tag>[]>> {
        return this.get<z.infer<typeof Tag>[]>(
            "/api/v1/featured_tags/suggestions",
            extra,
        );
    }

    /**
     * GET /api/v1/suggestions
     *
     * @param options.limit Maximum number of results.
     * @return Array of accounts.
     */
    public getSuggestions(
        options?: Partial<{ limit: number }>,
    ): Promise<Output<z.infer<typeof Account>[]>> {
        const params = new URLSearchParams();

        if (options) {
            if (options.limit) {
                params.set("limit", options.limit.toString());
            }
        }

        return this.get<z.infer<typeof Account>[]>(
            `/api/v1/suggestions?${params}`,
        );
    }

    /**
     * GET /api/v1/tags/:id
     *
     * @param id Target hashtag id.
     * @return Tag
     */
    public getTag(
        id: string,
        extra?: RequestInit,
    ): Promise<Output<z.infer<typeof Tag>>> {
        return this.get<z.infer<typeof Tag>>(`/api/v1/tags/${id}`, extra);
    }

    /**
     * GET /api/v1/timelines/tag/:hashtag
     *
     * @param hashtag Content of a #hashtag, not including # symbol.
     * @param options.local Show only local statuses? Defaults to false.
     * @param options.only_media Show only statuses with media attached? Defaults to false.
     * @param options.limit Max number of results to return. Defaults to 20.
     * @param options.max_id Return results older than ID.
     * @param options.since_id Return results newer than ID.
     * @param options.min_id Return results immediately newer than ID.
     * @return Array of statuses.
     */
    public getTagTimeline(
        id: string,
        options?: Partial<{
            max_id: string;
            min_id: string;
            since_id: string;
            limit: number;
            local: boolean;
            only_media: boolean;
        }>,
        extra?: RequestInit,
    ): Promise<Output<z.infer<typeof Status>[]>> {
        const params = new URLSearchParams();

        if (options) {
            if (options.max_id) {
                params.set("max_id", options.max_id);
            }
            if (options.min_id) {
                params.set("min_id", options.min_id);
            }
            if (options.since_id) {
                params.set("since_id", options.since_id);
            }
            if (options.limit) {
                params.set("limit", options.limit.toString());
            }
            if (options.local) {
                params.set("local", "true");
            }
            if (options.only_media) {
                params.set("only_media", "true");
            }
        }

        return this.get<z.infer<typeof Status>[]>(
            `/api/v1/timelines/tag/${id}?${params}`,
            extra,
        );
    }

    // TODO: listStreaming
    // TODO: localStreaming

    /**
     * GET /api/v1/accounts/lookup
     *
     * @param acct The username or Webfinger address to lookup.
     * @return Account.
     */
    public lookupAccount(
        acct: string,
        extra?: RequestInit,
    ): Promise<Output<z.infer<typeof Account>>> {
        const params = new URLSearchParams();

        params.set("acct", acct);

        return this.get<z.infer<typeof Account>>(
            `/api/v1/accounts/lookup?${params}`,
            extra,
        );
    }

    /**
     * POST /api/v1/accounts/:id/mute
     *
     * @param id The account ID.
     * @param options.notifications Mute notifications in addition to statuses.
     * @param options.duration Duration of mute in seconds. Defaults to indefinite.
     * @return Relationship
     */
    public muteAccount(
        id: string,
        options?: Partial<{ notifications: boolean; duration: number }>,
        extra?: RequestInit,
    ): Promise<Output<z.infer<typeof Relationship>>> {
        return this.post<z.infer<typeof Relationship>>(
            `/api/v1/accounts/${id}/mute`,
            options,
            extra,
        );
    }

    /**
     * POST /api/v1/statuses/:id/mute
     *
     * @param id The target status id.
     * @return Status
     */
    public muteStatus(
        id: string,
        extra?: RequestInit,
    ): Promise<Output<z.infer<typeof Status>>> {
        return this.post<z.infer<typeof Status>>(
            `/api/v1/statuses/${id}/mute`,
            undefined,
            extra,
        );
    }

    /**
     * POST /api/v1/accounts/:id/pin
     *
     * @param id The account ID.
     * @return Relationship
     */
    public pinAccount(
        id: string,
        extra?: RequestInit,
    ): Promise<Output<z.infer<typeof Relationship>>> {
        return this.post<z.infer<typeof Relationship>>(
            `/api/v1/accounts/${id}/pin`,
            undefined,
            extra,
        );
    }

    /**
     * POST /api/v1/statuses/:id/pin
     * @param id The target status id.
     * @return Status
     */
    public pinStatus(
        id: string,
        extra?: RequestInit,
    ): Promise<Output<z.infer<typeof Status>>> {
        return this.post<z.infer<typeof Status>>(
            `/api/v1/statuses/${id}/pin`,
            undefined,
            extra,
        );
    }

    /**
     * POST /api/v1/statuses
     *
     * @param status Text content of status.
     * @param options.media_ids Array of Attachment ids.
     * @param options.poll Poll object.
     * @param options.in_reply_to_id ID of the status being replied to, if status is a reply.
     * @param options.quote_id ID of the status being quoted to, if status is a quote.
     * @param options.sensitive Mark status and attached media as sensitive?
     * @param options.spoiler_text Text to be shown as a warning or subject before the actual content.
     * @param options.visibility Visibility of the posted status.
     * @param options.content_type Content type of the status (MIME format).
     * @param options.language ISO 639 language code for this status.
     * @param options.scheduled_at ISO 8601 Datetime at which to schedule a status.
     * @param options.local_only Post status to local timeline only?
     * @return Status. When options.scheduled_at is present, ScheduledStatus is returned instead.
     */
    public postStatus(
        status: string,
        options?: {
            in_reply_to_id?: string;
            quote_id?: string;
            media_ids?: string[];
            sensitive?: boolean;
            spoiler_text?: string;
            visibility?: z.infer<typeof Status.shape.visibility>;
            content_type?: StatusContentType;
            scheduled_at?: Date;
            language?: string;
            local_only?: boolean;
            poll?: {
                expires_in?: number;
                hide_totals?: boolean;
                multiple?: boolean;
                options: string[];
            };
        },
        extra?: RequestInit,
    ): Promise<
        Output<z.infer<typeof Status> | z.infer<typeof ScheduledStatus>>
    > {
        return this.post<
            z.infer<typeof Status> | z.infer<typeof ScheduledStatus>
        >(
            "/api/v1/statuses",
            {
                status,
                ...options,
                scheduled_at: options?.scheduled_at?.toISOString(),
            },
            extra,
        );
    }

    // TODO: publicStreaming
    // FIXME: No Conversation schema
    /**
     * POST /api/v1/conversations/:id/read
     *
     * @param id Target conversation ID.
     * @return Conversation.
     */
    public readConversation(
        id: string,
        extra?: RequestInit,
    ): Promise<Output<unknown>> {
        return this.post<unknown>(
            `/api/v1/conversations/${id}/read`,
            undefined,
            extra,
        );
    }

    /**
     * POST /api/v1/statuses/:id/reblog
     *
     * @param id The target status id.
     * @param options.visibility Visibility of the reblogged status.
     * @return Status.
     */
    public reblogStatus(
        id: string,
        options?: Partial<{
            visibility: z.infer<typeof Status.shape.visibility>;
        }>,
        extra?: RequestInit,
    ): Promise<Output<z.infer<typeof Status>>> {
        return this.post<z.infer<typeof Status>>(
            `/api/v1/statuses/${id}/reblog`,
            options,
            extra,
        );
    }

    /**
     * POST /api/v1/accounts/:id/refetch
     *
     * Starts a refetch of an account from a remote source.
     * Versia API only.
     * @param id The account ID.
     * @return Account with updated data.
     */
    public refetchAccount(
        id: string,
        extra?: RequestInit,
    ): Promise<Output<z.infer<typeof Account>>> {
        return this.post<z.infer<typeof Account>>(
            `/api/v1/accounts/${id}/refetch`,
            undefined,
            extra,
        );
    }

    /**
     * POST /oauth/token
     *
     * Revoke an OAuth token.
     * @param client_id will be generated by #createApp or #registerApp
     * @param client_secret will be generated by #createApp or #registerApp
     * @param token will be get #fetchAccessToken
     */
    public refreshToken(
        client_id: string,
        client_secret: string,
        refresh_token: string,
        extra?: RequestInit,
    ): Promise<Output<z.infer<typeof Token>>> {
        return this.post<z.infer<typeof Token>>(
            "/oauth/token",
            {
                client_id,
                client_secret,
                grant_type: "refresh_token",
                refresh_token,
            },
            extra,
        );
    }

    /**
     * POST /api/v1/accounts
     *
     * @param username Username for the account.
     * @param email Email for the account.
     * @param password Password for the account.
     * @param agreement Whether the user agrees to the local rules, terms, and policies.
     * @param locale The language of the confirmation email that will be sent
     * @param reason Text that will be reviewed by moderators if registrations require manual approval.
     * @return An account token.
     */
    public registerAccount(
        username: string,
        email: string,
        password: string,
        agreement: boolean,
        locale: string,
        reason: string,
        extra?: RequestInit,
    ): Promise<Output<z.infer<typeof Account>>> {
        return this.postForm<z.infer<typeof Account>>(
            "/api/v1/accounts",
            { username, email, password, agreement, locale, reason },
            extra,
        );
    }

    /**
     * POST /api/v1/follow_requests/:id/reject
     *
     * @param id Target account ID.
     * @return Relationship.
     */
    public rejectFollowRequest(
        id: string,
        extra?: RequestInit,
    ): Promise<Output<z.infer<typeof Relationship>>> {
        return this.post<z.infer<typeof Relationship>>(
            `/api/v1/follow_requests/${id}/reject`,
            undefined,
            extra,
        );
    }

    /**
     * DELETE /api/v1/profile/avatar
     *
     * @return Account.
     */
    public deleteAvatar(
        extra?: RequestInit,
    ): Promise<Output<z.infer<typeof Account>>> {
        return this.delete<z.infer<typeof Account>>(
            "/api/v1/profile/avatar",
            undefined,
            extra,
        );
    }

    /**
     * DELETE /api/v1/profile/header
     *
     * @return Account.
     */
    public deleteHeader(
        extra?: RequestInit,
    ): Promise<Output<z.infer<typeof Account>>> {
        return this.delete<z.infer<typeof Account>>(
            "/api/v1/profile/header",
            undefined,
            extra,
        );
    }

    /**
     * POST /api/v1/accounts/:id/remove_from_followers
     *
     * @param id The account ID.
     * @return Relationship.
     */
    public removeFromFollowers(
        id: string,
        extra?: RequestInit,
    ): Promise<Output<z.infer<typeof Relationship>>> {
        return this.post<z.infer<typeof Relationship>>(
            `/api/v1/accounts/${id}/remove_from_followers`,
            undefined,
            extra,
        );
    }

    // FIXME: Announcement schema is not defined.
    /**
     * DELETE /api/v1/announcements/:id/reactions/:name
     *
     * @param id The ID of the Announcement in the database.
     * @param name Unicode emoji, or the shortcode of a custom emoji.
     */
    public removeReactionFromAnnouncement(
        id: string,
        name: string,
        extra?: RequestInit,
    ): Promise<Output<unknown>> {
        return this.delete<unknown>(
            `/api/v1/announcements/${id}/reactions/${name}`,
            undefined,
            extra,
        );
    }

    /**
     * DELETE /api/v1/roles/:roleId
     *
     * Versia API only.
     * @param roleId Role ID to remove from requesting account.
     * @returns
     */
    public removeRole(
        role_id: string,
        extra?: RequestInit,
    ): Promise<Output<void>> {
        return this.delete(`/api/v1/roles/${role_id}`, undefined, extra);
    }

    /**
     * POST /api/v1/reports
     *
     * @param account_id Target account ID.
     * @param options.status_ids Array of Statuses ids to attach to the report.
     * @param options.comment The reason for the report. Default maximum of 1000 characters.
     * @param options.forward If the account is remote, should the report be forwarded to the remote admin?
     * @param options.category Specify if the report is due to spam, violation of enumerated instance rules, or some other reason. Defaults to other. Will be set to violation if rule_ids[] is provided (regardless of any category value you provide).
     * @param options.rule_ids For violation category reports, specify the ID of the exact rules broken. Rules and their IDs are available via GET /api/v1/instance/rules and GET /api/v1/instance.
     * @return Report.
     */
    public report(
        account_id: string,
        options: {
            status_ids?: string[];
            rule_ids?: string[];
            comment: string;
            forward?: boolean;
            category?: z.infer<typeof Report.shape.category>;
        },
        extra?: RequestInit,
    ): Promise<Output<z.infer<typeof Report>>> {
        return this.post<z.infer<typeof Report>>(
            "/api/v1/reports",
            { account_id, ...options },
            extra,
        );
    }

    /**
     * POST /oauth/revoke
     *
     * Revoke an OAuth token.
     * @param client_id will be generated by #createApp or #registerApp
     * @param client_secret will be generated by #createApp or #registerApp
     * @param token will be get #fetchAccessToken
     */
    public revokeToken(
        client_id: string,
        client_secret: string,
        token: string,
        extra?: RequestInit,
    ): Promise<Output<void>> {
        return this.post(
            "/oauth/revoke",
            { client_id, client_secret, token },
            extra,
        );
    }

    /**
     * POST /api/v1/markers
     *
     * @param options.home Marker position of the last read status ID in home timeline.
     * @param options.notifications Marker position of the last read notification ID in notifications.
     * @return Marker.
     */
    public saveMarkers(
        options: Partial<{
            home: {
                last_read_id: string;
            };
            notifications: {
                last_read_id: string;
            };
        }>,
        extra?: RequestInit,
    ): Promise<
        Output<{
            home?: z.infer<typeof Marker>;
            notifications?: z.infer<typeof Marker>;
        }>
    > {
        const params = new URLSearchParams();

        if (options.home) {
            params.set("home[last_read_id]", options.home.last_read_id);
        }

        if (options.notifications) {
            params.set(
                "notifications[last_read_id]",
                options.notifications.last_read_id,
            );
        }

        return this.post<{
            home?: z.infer<typeof Marker>;
            notifications?: z.infer<typeof Marker>;
        }>(`/api/v1/markers?${params}`, undefined, extra);
    }

    /**
     * PUT /api/v1/scheduled_statuses/:id
     *
     * @param id Target scheduled status ID.
     * @param scheduled_at ISO 8601 Datetime at which the status will be published.
     * @return ScheduledStatus.
     */
    public scheduleStatus(
        id: string,
        scheduled_at?: Date,
        extra?: RequestInit,
    ): Promise<Output<z.infer<typeof ScheduledStatus>>> {
        return this.put<z.infer<typeof ScheduledStatus>>(
            `/api/v1/scheduled_statuses/${id}`,
            { scheduled_at: scheduled_at?.toISOString() },
            extra,
        );
    }

    /**
     * GET /api/v2/search
     *
     * @param q The search query.
     * @param type Enum of search target.
     * @param options.limit Maximum number of results to load, per type. Defaults to 20. Max 40.
     * @param options.max_id Return results older than this id.
     * @param options.min_id Return results immediately newer than this id.
     * @param options.resolve Attempt WebFinger lookup. Defaults to false.
     * @param options.following Only include accounts that the user is following. Defaults to false.
     * @param options.account_id If provided, statuses returned will be authored only by this account.
     * @param options.exclude_unreviewed Filter out unreviewed tags? Defaults to false.
     * @return Results.
     */
    public search(
        q: string,
        options: Partial<{
            account_id: string;
            exclude_unreviewed: boolean;
            following: boolean;
            limit: number;
            max_id: string;
            min_id: string;
            offset: number;
            resolve: boolean;
            type: "accounts" | "hashtags" | "statuses";
        }>,
        extra?: RequestInit,
    ): Promise<Output<z.infer<typeof Search>>> {
        const params = new URLSearchParams();

        params.set("q", q);

        if (options) {
            if (options.account_id) {
                params.set("account_id", options.account_id);
            }
            if (options.exclude_unreviewed) {
                params.set("exclude_unreviewed", "true");
            }
            if (options.following) {
                params.set("following", "true");
            }
            if (options.limit) {
                params.set("limit", options.limit.toString());
            }
            if (options.max_id) {
                params.set("max_id", options.max_id);
            }
            if (options.min_id) {
                params.set("min_id", options.min_id);
            }
            if (options.offset) {
                params.set("offset", options.offset.toString());
            }
            if (options.resolve) {
                params.set("resolve", "true");
            }
            if (options.type) {
                params.set("type", options.type);
            }
        }

        return this.get<z.infer<typeof Search>>(
            `/api/v2/search?${params}`,
            extra,
        );
    }

    /**
     * GET /api/v1/accounts/search
     *
     * @param q Search query.
     * @param options.limit Max number of results to return. Defaults to 40.
     * @param options.max_id Return results older than ID.
     * @param options.since_id Return results newer than ID.
     * @param options.following Limit search to accounts the current user is following.
     * @param options.resolve Resolve non-local accounts?
     * @return The array of accounts.
     */
    public searchAccount(
        q: string,
        options?: Partial<{
            following: boolean;
            limit: number;
            max_id: string;
            resolve: boolean;
            since_id: string;
        }>,
        extra?: RequestInit,
    ): Promise<Output<z.infer<typeof Account>[]>> {
        const params = new URLSearchParams();

        params.set("q", q);

        if (options?.following) {
            params.set("following", "true");
        }
        if (options?.limit) {
            params.set("limit", options.limit.toString());
        }
        if (options?.max_id) {
            params.set("max_id", options.max_id);
        }
        if (options?.resolve) {
            params.set("resolve", "true");
        }
        if (options?.since_id) {
            params.set("since_id", options.since_id);
        }

        return this.get<z.infer<typeof Account>[]>(
            `/api/v1/accounts/search?${params}`,
            extra,
        );
    }

    // TODO: streamingURL

    /**
     * POST /api/v1/push/subscription
     *
     * @param subscription.endpoint Endpoint URL that is called when a notification event occurs.
     * @param subscription.keys.p256dh User agent public key. Base64 encoded string of public key of ECDH key using prime256v1 curve.
     * @param subscription.keys Auth secret. Base64 encoded string of 16 bytes of random data.
     * @param data.alerts.follow Receive follow notifications?
     * @param data.alerts.favourite Receive favourite notifications?
     * @param data.alerts.reblog Receive reblog notifictaions?
     * @param data.alerts.mention Receive mention notifications?
     * @param data.alerts.poll Receive poll notifications?
     * @param data.alerts.status Receive status notifications?
     * @param data.alerts.follow_request Receive follow request notifications?
     * @param data.alerts.update Receive status update notifications?
     * @param data.alerts.admin.sign_up Receive sign up notifications?
     * @param data.alerts.admin.report Receive report notifications?
     * @param data.policy Notification policy. Defaults to all.
     * @return PushSubscription.
     */
    public subscribePushNotifications(
        subscription: {
            endpoint: string;
            keys: {
                auth: string;
                p256dh: string;
            };
        },
        data?: {
            alerts: Partial<{
                favourite: boolean;
                follow: boolean;
                mention: boolean;
                poll: boolean;
                reblog: boolean;
                status: boolean;
                follow_request: boolean;
                update: boolean;
                "admin.sign_up": boolean;
                "admin.report": boolean;
            }>;
            policy?: "all" | "followed" | "follower" | "none";
        },
        extra?: RequestInit,
    ): Promise<Output<z.infer<typeof WebPushSubscription>>> {
        return this.post<z.infer<typeof WebPushSubscription>>(
            "/api/v1/push/subscription",
            {
                subscription,
                policy: data?.policy,
                data: {
                    alerts: data?.alerts,
                },
            },
            extra,
        );
    }

    // TODO: tagStreaming

    /**
     * DELETE /api/v1/accounts/:account_id/roles/:role_id
     *
     * Versia API only.
     * @param account_id Account ID to remove the role from.
     * @param role_id Role ID to remove from the account.
     * @returns No content.
     */
    public unassignRole(
        account_id: string,
        role_id: string,
        extra?: RequestInit,
    ): Promise<Output<void>> {
        return this.delete(
            `/api/v1/accounts/${account_id}/roles/${role_id}`,
            undefined,
            extra,
        );
    }

    /**
     * POST /api/v1/accounts/:id/unblock
     *
     * @param id The account ID.
     * @return Relationship
     */
    public unblockAccount(
        id: string,
        extra?: RequestInit,
    ): Promise<Output<z.infer<typeof Relationship>>> {
        return this.post<z.infer<typeof Relationship>>(
            `/api/v1/accounts/${id}/unblock`,
            undefined,
            extra,
        );
    }

    /**
     * DELETE /api/v1/domain_blocks
     *
     * @param domain Domain to unblock
     */
    public unblockDomain(
        domain: string,
        extra?: RequestInit,
    ): Promise<Output<void>> {
        return this.delete("/api/v1/domain_blocks", { domain }, extra);
    }

    /**
     * POST /api/v1/statuses/:id/unbookmark
     *
     * @param id The target status id.
     * @return Status.
     */
    public unbookmarkStatus(
        id: string,
        extra?: RequestInit,
    ): Promise<Output<z.infer<typeof Status>>> {
        return this.post<z.infer<typeof Status>>(
            `/api/v1/statuses/${id}/unbookmark`,
            undefined,
            extra,
        );
    }

    /**
     * POST /api/v1/statuses/:id/unfavourite
     *
     * @param id The target status id.
     * @return Status.
     */
    public unfavouriteStatus(
        id: string,
        extra?: RequestInit,
    ): Promise<Output<z.infer<typeof Status>>> {
        return this.post<z.infer<typeof Status>>(
            `/api/v1/statuses/${id}/unfavourite`,
            undefined,
            extra,
        );
    }

    /**
     * POST /api/v1/accounts/:id/unfollow
     *
     * @param id The account ID.
     * @return Relationship
     */
    public unfollowAccount(
        id: string,
        extra?: RequestInit,
    ): Promise<Output<z.infer<typeof Relationship>>> {
        return this.post<z.infer<typeof Relationship>>(
            `/api/v1/accounts/${id}/unfollow`,
            undefined,
            extra,
        );
    }

    /**
     * POST /api/v1/accounts/:id/unmute
     *
     * @param id The account ID.
     * @return Relationship
     */
    public unmuteAccount(
        id: string,
        extra?: RequestInit,
    ): Promise<Output<z.infer<typeof Relationship>>> {
        return this.post<z.infer<typeof Relationship>>(
            `/api/v1/accounts/${id}/unmute`,
            undefined,
            extra,
        );
    }

    /**
     * POST /api/v1/accounts/:id/unpin
     *
     * @param id The account ID.
     * @return Relationship
     */
    public unpinAccount(
        id: string,
        extra?: RequestInit,
    ): Promise<Output<z.infer<typeof Relationship>>> {
        return this.post<z.infer<typeof Relationship>>(
            `/api/v1/accounts/${id}/unpin`,
            undefined,
            extra,
        );
    }

    /**
     * POST /api/v1/statuses/:id/unpin
     *
     * @param id The target status id.
     * @return Status
     */
    public unpinStatus(
        id: string,
        extra?: RequestInit,
    ): Promise<Output<z.infer<typeof Status>>> {
        return this.post<z.infer<typeof Status>>(
            `/api/v1/statuses/${id}/unpin`,
            undefined,
            extra,
        );
    }

    /**
     * POST /api/v1/statuses/:id/unreblog
     *
     * @param id The target status id.
     * @return Status.
     */
    public unreblogStatus(
        id: string,
        extra?: RequestInit,
    ): Promise<Output<z.infer<typeof Status>>> {
        return this.post<z.infer<typeof Status>>(
            `/api/v1/statuses/${id}/unreblog`,
            undefined,
            extra,
        );
    }

    /**
     * POST /api/v1/accounts/:id/note
     *
     * @param id The account ID.
     * @param note The note to set.
     * @return Account.
     */
    public updateAccountNote(
        id: string,
        note: string | null,
        extra?: RequestInit,
    ): Promise<Output<z.infer<typeof Account>>> {
        return this.post<z.infer<typeof Account>>(
            `/api/v1/accounts/${id}/note`,
            { comment: note ?? undefined },
            extra,
        );
    }

    /**
     * PATCH /api/v1/accounts/update_credentials
     *
     * @param options.avatar Avatar image, as a File
     * @param options.bot Is this account a bot?
     * @param options.discoverable Should this account be included in directory?
     * @param options.display_name Account display name.
     * @param options.fields_attributes Array of profile metadata.
     * @param options.header Header image, as a File
     * @param options.locked Is this account locked?
     * @param options.note Brief account description.
     * @param options.source Source metadata.
     * @return An account.
     */
    public updateCredentials(
        options: Partial<{
            avatar: File | URL;
            bot: boolean;
            discoverable: boolean;
            display_name: string;
            fields_attributes: {
                name: string;
                value: string;
            }[];
            header: File | URL;
            locked: boolean;
            hide_collections: boolean;
            indexable: boolean;
            note: string;
            source: Partial<{
                language: string;
                privacy: string;
                sensitive: boolean;
            }>;
        }>,
        extra?: RequestInit,
    ): Promise<Output<z.infer<typeof Account>>> {
        return this.patchForm<z.infer<typeof Account>>(
            "/api/v1/accounts/update_credentials",
            {
                ...options,
                avatar:
                    options.avatar instanceof File
                        ? options.avatar
                        : options.avatar?.toString(),
                header:
                    options.header instanceof File
                        ? options.header
                        : options.header?.toString(),
            },
            extra,
        );
    }

    /**
     * PATCH /api/v1/emojis/:id
     *
     * Versia API only.
     * @param id Target emoji ID.
     * @param options.shortcode Emoji shortcode.
     * @param options.image Emoji image, as a File, or a URL.
     * @param options.category Emoji category.
     * @param options.alt Emoji description.
     * @param options.global Whether the emoji should be visible to all users (requires `emoji` permission).
     * @return Emoji.
     */
    public updateEmoji(
        id: string,
        options: Partial<{
            alt: string;
            category: string;
            global: boolean;
            image: File | URL;
            shortcode: string;
        }>,
        extra?: RequestInit,
    ): Promise<Output<z.infer<typeof CustomEmoji>>> {
        return this.patchForm<z.infer<typeof CustomEmoji>>(
            `/api/v1/emojis/${id}`,
            {
                ...options,
                image: undefined,
                element:
                    options.image instanceof File
                        ? options.image
                        : options.image?.toString(),
            },
            extra,
        );
    }

    /**
     * PUT /api/v2/filters/:id
     *
     * @param id Target filter ID.
     * @param options.title New filter title.
     * @param options.context New filter context.
     * @param options.filter_action New filter action.
     * @param options.expires_in New filter expiration.
     * @param options.keywords_attributes New filter keywords.
     * @return Filter.
     */
    public updateFilter(
        id: string,
        options: Partial<{
            title: string;
            context: string[];
            filter_action: string;
            expires_in: number;
            keywords_attributes: Partial<{
                id: string;
                keyword: string;
                whole_word: boolean;
                _destroy: boolean;
            }>[];
        }>,
        extra?: RequestInit,
    ): Promise<Output<z.infer<typeof Filter>>> {
        return this.put<z.infer<typeof Filter>>(
            `/api/v2/filters/${id}`,
            options,
            extra,
        );
    }

    // FIXME: No List schema
    /**
     * PUT /api/v1/lists/:id
     *
     * @param id Target list ID.
     * @param options.title New list title.
     * @param options.replies_policy Which replies should be shown in the list.
     * @param options.exclusive Should the members of this list be removed from the home timeline?
     * @return List.
     */
    public updateList(
        id: string,
        options: {
            title: string;
            replies_policy?: "none" | "followed" | "list";
            exclusive?: boolean;
        },
        extra?: RequestInit,
    ): Promise<Output<unknown>> {
        return this.put<unknown>(`/api/v1/lists/${id}`, options, extra);
    }

    /**
     * PUT /api/v1/media/:id
     *
     * @param id Target media ID.
     * @param options.file The file to be attached, using multipart form data.
     * @param options.description A plain-text description of the media.
     * @param options.focus Two floating points (x,y), comma-delimited, ranging from -1.0 to 1.0.
     * @param options.is_sensitive Whether the media is sensitive.
     * @return Attachment
     */
    public updateMedia(
        id: string,
        options?: Partial<{
            description: string;
            file: File;
            focus: string;
            is_sensitive: boolean;
        }>,
        extra?: RequestInit,
    ): Promise<Output<z.infer<typeof Attachment>>> {
        return this.putForm<z.infer<typeof Attachment>>(
            `/api/v1/media/${id}`,
            { ...options },
            extra,
        );
    }

    /**
     * PUT /api/v1/push/subscription
     *
     * @param data.alerts.follow Receive follow notifications?
     * @param data.alerts.favourite Receive favourite notifications?
     * @param data.alerts.reblog Receive reblog notifictaions?
     * @param data.alerts.mention Receive mention notifications?
     * @param data.alerts.poll Receive poll notifications?
     * @param data.alerts.status Receive status notifications?
     * @param data.alerts.follow_request Receive follow request notifications?
     * @param data.alerts.update Receive status update notifications?
     * @param data.alerts.admin.sign_up Receive sign up notifications?
     * @param data.alerts.admin.report Receive report notifications?
     * @param policy Notification policy. Defaults to all.
     * @return PushSubscription.
     */
    public updatePushSubscription(
        data?: {
            alerts: Partial<{
                favourite: boolean;
                follow: boolean;
                mention: boolean;
                poll: boolean;
                reblog: boolean;
                status: boolean;
                follow_request: boolean;
                update: boolean;
                "admin.sign_up": boolean;
                "admin.report": boolean;
            }>;
        },
        policy?: "all" | "followed" | "follower" | "none",
        extra?: RequestInit,
    ): Promise<Output<z.infer<typeof WebPushSubscription>>> {
        return this.put<z.infer<typeof WebPushSubscription>>(
            "/api/v1/push/subscription",
            { data, policy },
            extra,
        );
    }

    /**
     * PATCH /api/v1/roles/:id
     *
     * Versia API only.
     * @param id Role ID to update.
     * @param options.name New role name.
     * @param options.permissions New role permissions.
     * @param options.priority New role priority.
     * @param options.description New role description.
     * @param options.visible New role visibility.
     * @param options.icon New role icon.
     * @returns New role data.
     */
    public updateRole(
        id: string,
        options: Partial<{
            name: string;
            permissions: string[];
            priority: number;
            description: string;
            visible: boolean;
            icon: string;
        }>,
        extra?: RequestInit,
    ): Promise<Output<z.infer<typeof Role>>> {
        return this.patch<z.infer<typeof Role>>(
            `/api/v1/roles/${id}`,
            options,
            extra,
        );
    }

    /**
     * POST /api/v1/emojis
     *
     * Versia API only.
     * @param shortcode The shortcode of the emoji.
     * @param image The image file to be uploaded, as a File or URL.
     * @param options.category A category for the emoji.
     * @param options.alt Text description of the emoji.
     * @param options.global Whether the emoji should be visible to all users (requires `emoji` permission).
     * @return Emoji
     */
    public uploadEmoji(
        shortcode: string,
        image: File | URL,
        options?: Partial<{
            alt: string;
            category: string;
            global: boolean;
        }>,
        extra?: RequestInit,
    ): Promise<Output<z.infer<typeof CustomEmoji>>> {
        return this.postForm<z.infer<typeof CustomEmoji>>(
            "/api/v1/emojis",
            {
                shortcode,
                element: image instanceof File ? image : image.toString(),
                ...options,
            },
            extra,
        );
    }

    // FIXME: No AsyncAttachment schema
    /**
     * POST /api/v2/media
     *
     * @param file The file to be attached, using multipart form data.
     * @param options.description A plain-text description of the media.
     * @param options.focus Two floating points (x,y), comma-delimited, ranging from -1.0 to 1.0.
     * @return Attachment
     */
    public uploadMedia(
        file: File,
        options?: Partial<{
            description: string;
            focus: string;
        }>,
        extra?: RequestInit,
    ): Promise<Output<z.infer<typeof Attachment> | unknown>> {
        return this.postForm<z.infer<typeof Attachment> | unknown>(
            "/api/v2/media",
            { file, ...options },
            extra,
        );
    }

    // TODO: userStreaming

    /**
     * GET /api/v1/accounts/verify_credentials
     *
     * @return Account.
     */
    public verifyAccountCredentials(
        extra?: RequestInit,
    ): Promise<Output<z.infer<typeof Account>>> {
        return this.get<z.infer<typeof Account>>(
            "/api/v1/accounts/verify_credentials",
            extra,
        );
    }

    /**
     * GET /api/v1/apps/verify_credentials
     *
     * @return An Application
     */
    public verifyAppCredentials(
        extra?: RequestInit,
    ): Promise<Output<z.infer<typeof CredentialApplication>>> {
        return this.get<z.infer<typeof CredentialApplication>>(
            "/api/v1/apps/verify_credentials",
            extra,
        );
    }

    /**
     * POST /api/v1/polls/:id/votes
     *
     * @param id Target poll ID.
     * @param choices Array of own votes containing index for each option (starting from 0).
     * @return Poll
     */
    public votePoll(
        id: string,
        choices: number[],
        extra?: RequestInit,
    ): Promise<Output<z.infer<typeof Poll>>> {
        return this.post<z.infer<typeof Poll>>(
            `/api/v1/polls/${id}/votes`,
            { choices },
            extra,
        );
    }
}
