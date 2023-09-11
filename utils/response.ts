export const jsonResponse = (data: object, status: number = 200) => {
	return new Response(JSON.stringify(data), {
		headers: {
			"Content-Type": "application/json"
		},
		status,
	});
}