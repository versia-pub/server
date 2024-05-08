import EmojiAdd from "./commands/emoji/add";
import UserCreate from "./commands/user/create";
import UserDelete from "./commands/user/delete";
import UserList from "./commands/user/list";
import UserReset from "./commands/user/reset";

export const commands = {
    "user list": UserList,
    "user delete": UserDelete,
    "user create": UserCreate,
    "user reset": UserReset,
    "emoji add": EmojiAdd,
};
