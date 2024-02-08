import { formattedPointsString } from "./util";

import { players, teams } from "@/schema";
import { container } from "@sapphire/pieces";
import {
	ActionRowBuilder,
	ButtonBuilder,
	ButtonStyle,
	EmbedBuilder,
	Guild,
	TextChannel,
} from "discord.js";
import { count, desc, eq, gt, sum } from "drizzle-orm";

export default async () => {
	const client = container.client;

	const scoreboardChannel = (await client.channels.fetch(
		container.config.bot.scoreboard_channel,
	)) as TextChannel;

	if (!container.config.bot.autogenerated) {
		container.logger.error("updateEmbed called before scoreboard was created!");
		return;
	}

	const scoreboardMessage = await scoreboardChannel.messages.fetch(
		container.config.bot.autogenerated.scoreboard_message,
	);

	const guild = await client.guilds.fetch(container.config.bot.guild);

	const scoreboardEmbed = await generateScoreboardEmbed(guild);

	const teamEmbed = await generateTeamsEmbed(guild);

	// we use Discord Message Components (buttons lol) for team joining
	const components = new ActionRowBuilder<ButtonBuilder>().addComponents(
		new ButtonBuilder()
			.setCustomId("joinTeam")
			.setLabel("Click here to join a team!")
			.setStyle(ButtonStyle.Primary),
	);

	scoreboardMessage.edit({
		content: "",
		embeds: [scoreboardEmbed, teamEmbed],
		components: [components],
	});
};

const generateScoreboardEmbed = async (guild: Guild): Promise<EmbedBuilder> => {
	const embed = new EmbedBuilder()
		.setColor(0xff4500)
		.setTitle("Event Leaderboard");

	const topTenPlayers = await container.database
		.select()
		.from(players)
		.orderBy(desc(players.score))
		.limit(10);

	// open code block
	let playerScoreboard = "```py\n";

	for (const [index, player] of topTenPlayers.entries()) {
		const member = await guild.members.fetch(player.snowflake);
		const memberName = member ? member.displayName : player.snowflake;

		// parseInt will remove leading zeroes
		const playerPlace = index + 1;
		const playerScore = player.score;
		const suffix = formattedPointsString(playerScore);

		playerScoreboard += `${playerPlace}. ${memberName}: ${playerScore} ${suffix}\n`;
	}

	// display a placeholder if empty
	if (topTenPlayers.length === 0) {
		playerScoreboard += "Nobody has any eggs yet!\n";
	}

	// close code block
	playerScoreboard += "```";
	embed.addFields({ name: "Individual Scores", value: playerScoreboard });

	const teamScore = await container.database
		.select({
			teamSnowflake: players.team,
			score: sum(players.score).mapWith(Number),
		})
		.from(players)
		.where(gt(players.score, 0))
		.groupBy(players.team);

	if (!teamScore) {
		container.logger.error("Couldn't get scores from the db!");
		return embed;
	}

	for (const team of teamScore) {
		// we need to get the team name from Discord because it's not in the db
		const role = await guild.roles.fetch(team.teamSnowflake);

		const teamName = role ? role.name : team.teamSnowflake;

		const teamScore = team.score || 0;

		embed.addFields({
			name: teamName,
			value: `${teamScore} ${formattedPointsString(teamScore)}`,
			inline: true,
		});
	}

	return embed;
};

const generateTeamsEmbed = async (guild: Guild): Promise<EmbedBuilder> => {
	const embed = new EmbedBuilder()
		.setColor(0xff4500)
		.setTitle("Teams")
		.setDescription("Click the button below to join a team!");

	for (const teamId of container.config.event.teams) {
		const role = await guild.roles.fetch(teamId);

		if (!role) continue;

		await container.database
			.insert(teams)
			.values({
				snowflake: teamId,
			})
			.onConflictDoNothing();

		const [{ playerCount }] = await container.database
			.select({
				playerCount: count(players.snowflake),
			})
			.from(players)
			.where(eq(players.team, teamId));

		embed.addFields({
			name: role.name,
			value: `Number of players: ${playerCount}`,
			inline: true,
		});
	}

	return embed;
};
