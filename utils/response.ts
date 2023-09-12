export const jsonResponse = (data: object, status = 200) => {
	return new Response(JSON.stringify(data), {
		headers: {
			"Content-Type": "application/json"
		},
		status,
	});
}

export const errorResponse = (error: string, status = 500) => {
	return jsonResponse({
		error: error
	}, status);
}