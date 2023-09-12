export interface APIAlerts {
	follow: boolean;
	favourite: boolean;
	mention: boolean;
	reblog: boolean;
	poll: boolean;
}

export interface APIPushSubscription {
	id: string;
	endpoint: string;
	server_key: string;
	alerts: APIAlerts;
}
