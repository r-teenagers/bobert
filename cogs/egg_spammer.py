import discord
import json
import logging
import random
import asyncio
import os
import datetime
import typing

from discord.ext import commands, tasks
from dotenv import load_dotenv

load_dotenv()

logging.basicConfig(format="%(asctime)s %(levelname)s: %(message)s", datefmt="[%a %b %d %H:%M:%S %Y]", level=logging.INFO)


class EggSpammer(commands.Cog):

    def __init__(self, bot):

        self.bot = bot
        self.reaction_cooldown = []
        self.mod_channel = self.bot.get_channel(int(os.getenv("MOD_CHANNEL")))
        if self.bot.config_set:
            self.send_egg_message.start()

    # --- commands ---

    @commands.command()
    async def initialize(self, ctx, channel: discord.TextChannel):

        if ctx.author.id != int(os.getenv("AUTHORIZED_USER")):
            return

        if self.bot.config_set:
            return await ctx.send("Could not initialize! Variables already set. Please edit leaderboard.json "
                                  "to not have message channels and react role channels already set.")

        score_embed = discord.Embed(title="Scoreboards")
        reaction_embed = discord.Embed(title="Grab your team role here!",
                                       description="Teams are randomized for balance.")

        for role in self.bot.teams:
            guild = self.bot.current_guild
            role = discord.utils.get(guild.roles, id=role)
            score_embed.add_field(name=role.name, value="0")
            reaction_embed.add_field(name=role.name, value=f"Number of members: {len(role.members)}")

        score_msg = await channel.send(embed=score_embed)
        role_msg = await channel.send(embed=reaction_embed)

        await role_msg.add_reaction("🥚")

        self.bot.scoreboard_channel = channel
        self.bot.scoreboard_message = score_msg
        self.bot.react_role_channel = channel
        self.bot.react_role_message = role_msg

        with open("config.json") as config:
            data = json.load(config)

        data["set"] = True
        data["scoreboard_message"] = {str(self.bot.scoreboard_channel.id): str(self.bot.scoreboard_message.id)}
        data["react_role_message"] = {str(self.bot.react_role_channel.id): str(self.bot.react_role_message.id)}

        with open("config.json", "w") as config:
            json.dump(data, config)

        self.send_egg_message.start()

    @commands.command()
    @commands.cooldown(1, 5, commands.BucketType.user)
    async def score(self, ctx):

        with open("leaderboard.json") as leaderboard:
            data = json.load(leaderboard)

        try:
            score = data["users"][str(ctx.author.id)]
        except KeyError:
            score = 0

        try:
            scorestring = f"{score} eggs!" if score != 0 else f"{score} eggs :("
            await ctx.author.send(f"You have found {scorestring}", delete_after=2)
        except:
            await ctx.send(f"{ctx.author.mention} Couldn't send you a DM! Please open your DMs.", delete_after=2)

    @score.error
    async def score_error(self, ctx, error):
        if isinstance(error, commands.CommandOnCooldown):
            return

    @commands.command()
    async def blacklist(self, ctx, user = typing.Union[discord.Member, str, None]):

        if int(os.getenv("MOD_ROLE")) not in [role.id for role in ctx.author.roles]:
            return

        if user is None:
            return await ctx.send("Please provide a proper user!")

        with open("config.json") as config:
            data = json.load(config)

        try:
            uid = user.id if isinstance(user, discord.Member) else int(user)
        except ValueError:
            return await ctx.send("Please provide a valid user id!")

        data["blacklisted_users"].append(uid)

        with open("config.json", w) as config:
            json.dump(data, config)

    # -- File handler & message update --
    def update_statistics_file(self, user, entry):

        with open("leaderboard.json") as leaderboard:
            data = json.load(leaderboard)

        team = None
        for t in self.bot.teams:
            if t in [r.id for r in user.roles]:  # This is terrible
                team = t
                break
        if team is None:
            return

        data["teams"][str(team)] += 1  # This can't not exist
        if str(entry) not in data["users"]:
            data["users"][str(entry)] = 1
        else:
            data["users"][str(entry)] += 1

        with open("leaderboard.json", "w") as config:
            json.dump(data, config)

    async def update_leaderboard_message(self, ctx):

        embed = discord.Embed(title="Scoreboards")
        with open("leaderboard.json") as leaderboard:
            data = json.load(leaderboard)

        # I'm so sorry
        sorted_leaderboard = {k: v for k, v in reversed(sorted(data["users"].items(), key=lambda item: item[1]))}
        description = "```py\n"
        newline = "\n"
        index = 1

        for user, score in sorted_leaderboard.items():

            try:
                user_name = self.bot.get_user(int(user)).name
            except AttributeError:
                user_name = str(user)

            if user_name is not None:
                description += f"{index}. {user_name}: {score}" + newline
                index += 1
            if index == 11:
                break

        description += "```"
        embed.description = description

        for role in self.bot.teams:
            guild = self.bot.current_guild

            role = discord.utils.get(guild.roles, id=role)
            embed.add_field(name=role.name, value=data["teams"][str(role.id)])

        await self.bot.scoreboard_message.edit(content=None, embed=embed)

    async def update_role_message(self):
        reaction_embed = discord.Embed(title="Grab your team role here!",
                                       description="Teams are randomized for balance.")
        for role in self.bot.teams:
            role = discord.utils.get(self.bot.current_guild.roles, id=role)
            reaction_embed.add_field(name=role.name, value=f"Number of members: {len(role.members)}")

        await self.bot.react_role_message.edit(content=None, embed=reaction_embed)

    # - Listeners & loops -
    @commands.Cog.listener()  # Unlike on_reaction_add, this will fire 100% of the time. Could also use it but
    async def on_raw_reaction_add(self, payload):  # tbh I just used this as I forgot to pass intents at first

        if payload.user_id in self.reaction_cooldown:  # If user is on cooldown, return
            return                                     # Thoughhhh this isn't needed anymore cos they can't change teams

        member = self.bot.current_guild.get_member(payload.user_id)

        if payload.message_id == self.bot.react_role_message.id:  # This handles giving team roles

            for role in [r.id for r in member.roles]:
                if role in self.bot.teams:
                    return  # User already has role

            role_obj = discord.utils.get(self.bot.current_guild.roles, id=random.choice(self.bot.teams))
            await member.add_roles(role_obj)
            await self.update_role_message()
            logging.info(f"Added role to {str(member)}")

            self.reaction_cooldown.append(member.id)
            await asyncio.sleep(5)  # Just in case this is abused
            self.reaction_cooldown.remove(member.id)

    @tasks.loop(seconds=random.randint(15, 25))
    async def send_egg_message(self):

        category_id = os.getenv("CATEGORY_ID")
        guild = self.bot.current_guild

        allowed_category = discord.utils.get(guild.categories, id=int(category_id))
        allowed_channels = allowed_category.text_channels

        egg_msg = await random.choice(allowed_channels).send("🥚")
        await egg_msg.add_reaction("🥚")

        sent_date = datetime.datetime.utcnow()
        delay = sent_date - egg_msg.created_at
        logging.info(f"Sent egg to {egg_msg.channel}")

        def check(reaction, user):
            return str(reaction.emoji) == "🥚" and reaction.message == egg_msg and not user.bot and any(role in [r.id for r in user.roles] for role in self.bot.teams)

        try:
            reaction, user = await self.bot.wait_for('reaction_add', timeout=10.0, check=check)

        except asyncio.TimeoutError:

            try:
                await egg_msg.delete()
                logging.info("Egg ignored and deleted")

            except:
                logging.warning("Unable to delete egg message")

        else:

            timedelta = datetime.datetime.utcnow() - sent_date
            formatted_timedelta = round(timedelta.total_seconds() * 1000)
            conf_message = await egg_msg.channel.send(f"{user.mention} got the egg in {formatted_timedelta} ms!")

            if formatted_timedelta < 300:  # I don't know if this is realistic but let's see?

                self.mod_channel.send(f"{str(user)} ({user.id}) got an egg in {formatted_timedelta} ms. Possibly a bot")

            logging.info(f"{user.mention} got the egg in {round(timedelta.total_seconds() * 1000)} ms!")

            await asyncio.sleep(2)

            try:
                await egg_msg.delete()
                await conf_message.delete()
            except:
                logging.warning("Unable to delete egg message")

            self.update_statistics_file(user, user.id)
            await self.update_leaderboard_message(user)


def setup(bot):
    bot.add_cog(EggSpammer(bot))

