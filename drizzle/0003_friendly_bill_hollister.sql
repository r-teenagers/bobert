ALTER TABLE "player" RENAME excluded TO excluded_old;
--> statement-breakpoint
ALTER TABLE "player" ADD excluded boolean not null default false;
--> statement-breakpoint
UPDATE "player" SET excluded = coalesce(excluded_old, false);
--> statement-breakpoint
ALTER TABLE "player" DROP COLUMN excluded_old;
