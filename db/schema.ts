import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const teams = sqliteTable("team", {
	snowflake: text("snowflake").primaryKey(),
});

export const players = sqliteTable("player", {
	snowflake: text("snowflake").primaryKey(),
	team: text("team_snowflake").notNull().references(() => teams.snowflake),
	score: integer("score").notNull().default(0),
	blacklisted: integer("blacklisted", { mode: "boolean" }).notNull().default(false),
});

