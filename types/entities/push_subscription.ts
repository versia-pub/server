export interface Alerts {
	follow: boolean;
	favourite: boolean;
	mention: boolean;
	reblog: boolean;
	poll: boolean;
}

export interface PushSubscription {
	id: string;
	endpoint: string;
	server_key: string;
	alerts: Alerts;
}
