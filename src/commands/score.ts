import { players } from "@/schema";
import { Command } from "@sapphire/framework";
import type { Message } from "discord.js";
import { eq } from "drizzle-orm";
import { formattedPointsString } from "../lib/util";

export class ScoreCommand extends Command {
	public constructor(context: Command.LoaderContext, options: Command.Options) {
		super(context, {
			...options,
			name: "score",
		});
	}

	public async messageRun(message: Message) {
		const player = await this.container.database
			.select()
			.from(players)
			.where(eq(players.snowflake, message.author.id));

		if (player.length === 0)
			return message
				.reply("You are not currently playing!")
				.then((m) =>
					setTimeout(async () => {
						await m.delete();
						await message.delete();
					}, 2000),
				)
				.catch(() => {});

		try {
			const dmChannel = await message.author.createDM();
			await dmChannel.send(
				`You have collected ${player[0].score} ${formattedPointsString(
					player[0].score,
				)}.`,
			);
			setTimeout(async () => await message.delete(), 2000);
		} catch {
			const reply = await message.reply(
				"Unable to send you a DM. Please open your DMs.",
			);
			setTimeout(async () => {
				await message.delete();
				await reply.delete();
			}, 2000);
		}
	}
}
