import { players } from "@/schema";
import { Command } from "@sapphire/framework";
import type { Message } from "discord.js";
import { eq } from "drizzle-orm";
import updateEmbed from "../lib/updateEmbed";

export class ScoreCommand extends Command {
	public constructor(context: Command.LoaderContext, options: Command.Options) {
		super(context, {
			...options,
			name: "score",
		});
	}

	public async messageRun(message: Message) {
		if (message.guild?.id !== this.container.config.bot.guild) return;

		this.container.logger.info("Finalizing event.");

		const allPlayers = await this.container.database
			.select()
			.from(players)
			.where(eq(players.blacklisted, false));

		const progressMessage = await message.reply(
			"checking member status - 0 in server, 0 not",
		);
		let accepted = 0;
		let rejected = 0;

		const updateMessageInterval = setInterval(
			() =>
				progressMessage
					.edit(
						`checking member status - ${accepted} in server, ${rejected} not`,
					)
					.catch(() => {}),
			1000,
		);

		for (const player of allPlayers) {
			const isInServer =
				(await message.guild!.members.fetch(player.snowflake)) !== null;

			// temp value, will be cleared after event is finalized so the scores can be used again later!!
			await this.container.database
				.update(players)
				.set({
					excludedFromScore: isInServer,
				})
				.where(eq(players.snowflake, player.snowflake));

			if (isInServer) accepted += 1;
			else rejected += 1;
		}

		this.container.logger.info(
			`${accepted} players accepted, ${rejected} rejected`,
		);

		clearInterval(updateMessageInterval);
		await progressMessage.edit("Finalizing scoreboard...");

		await updateEmbed();

		await progressMessage.edit("Done.");

		// generate scores.json
		const activePlayers = allPlayers
			.filter((p) => !p.blacklisted && !p.excludedFromScore)
			.map((p) => ({ snowflake: p.snowflake, team: p.team, score: p.score }));

		await Bun.write("./scores.json", JSON.stringify(activePlayers, null, 2));

		await this.container.database
			.update(players)
			.set({ excludedFromScore: null });

		this.container.config.event.active = false;
	}
}
