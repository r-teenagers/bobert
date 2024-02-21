ALTER TABLE "players" RENAME excluded TO excluded_old;
--> statement-breakpoint
ALTER TABLE "players" ADD excluded boolean not null default false;
--> statement-breakpoint
UPDATE "players" SET excluded = coalesce(excluded_old, false);
--> statement-breakpoint
ALTER TABLE "players" DROP COLUMN excluded_old;
