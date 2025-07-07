export enum Hooks {
    Request = "request",
    Response = "response",
}

export type ServerHooks = {
    [Hooks.Request]: (request: Request) => Request;
    [Hooks.Response]: (response: Response) => Response;
};
