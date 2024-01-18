import { sql } from "drizzle-orm";
import { sqliteTable, text } from "drizzle-orm/sqlite-core";

export const teams = sqliteTable("teams", {
	snowflake: text("snowflake").primaryKey(),
	b,
});
