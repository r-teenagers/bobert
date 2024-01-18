import type { CategoryChannel, ClientOptions, Message } from "discord.js";
import type { BobertConfig } from "./lib/config";
import { BunSQLiteDatabase } from "drizzle-orm/bun-sqlite";
import { BobertClient } from "./lib/client";

import * as schema from "../db/schema";

declare module "@sapphire/pieces" {
	interface Container {
		category_cache: CategoryChannel;
		config: BobertConfig;
		database: BunSQLiteDatabase<typeof schema>;
		scoreboard_message_cache: Message;
	}
}

export default undefined;
