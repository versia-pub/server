import { Token } from "~database/entities/Token";

export const getUserByToken = async (access_token: string | null) => {
	if (!access_token) return null;

	const token = await Token.findOne({
		where: {
			access_token,
		},
		relations: ["user"],
	});

	if (!token) return null;

	return token.user;
};
