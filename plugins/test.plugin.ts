import { HookTypes, Server } from "./types";

const registerPlugin = (server: Server) => {
	server.on(HookTypes.OnPostCreate, (req, newPost, author) => {
		console.log("New post created!");
		console.log(`Post details: ${newPost.content} (${newPost.id})`);
		console.log(`Made by ${author.username} (${author.id})`);
	});
};

export default registerPlugin;
