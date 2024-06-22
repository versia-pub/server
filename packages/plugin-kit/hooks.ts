export type ServerHooks = {
    request: (request: Request) => Request;
    response: (response: Response) => Response;
};
