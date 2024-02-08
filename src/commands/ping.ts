import { Command } from "@sapphire/framework";
import { type Message, PermissionFlagsBits } from "discord.js";

export default class PingCommand extends Command {
	public constructor(context: Command.LoaderContext, options: Command.Options) {
		super(context, {
			...options,
			name: "ping",
		});
	}

	public async messageRun(message: Message) {
		if (!message.member?.permissions.has(PermissionFlagsBits.ManageMessages))
			return;

		const client = this.container.client;
		const readyAt = this.container.processStartedAt;

		await message.reply({
			content: `Pong! My ping is ${client.ws.ping}ms. Process started at <t:${readyAt}:f>, <t:${readyAt}:R>.`,
		});
	}
}
