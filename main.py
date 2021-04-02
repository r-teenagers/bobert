import discord
import os
import logging
import json

from discord.ext import commands
from dotenv import load_dotenv

load_dotenv()

logging.basicConfig(format="%(asctime)s %(levelname)s: %(message)s", datefmt="[%a %b %d %H:%M:%S %Y]", level=logging.INFO)

intents = discord.Intents.all()
bot = commands.Bot(command_prefix="b!", help_command=None, intents=intents)
bot.already_logged_in = False


@bot.event
async def on_ready():  # This event fires a lot. We don't really want to call load_cogs() when they're already loaded.

    if not bot.already_logged_in:

        logging.info(f"Logged in as {str(bot.user)}!")

        with open("config.json") as config:
            data = json.load(config)

        bot.config_set = False
        bot.teams = data["teams"]  # Dict
        bot.blacklisted_users = data["blacklisted_users"]  # List of ints
        bot.current_guild =  bot.get_guild(int(os.getenv("GUILD_ID")))

        if data["set"]:  # Don't set this to true manually. Otherwise this will error and you'll have bad time.

            bot.config_set = True

            for channel, message in data["scoreboard_message"].items():
                bot.scoreboard_channel = bot.get_channel(int(channel))
                bot.scoreboard_message = await bot.scoreboard_channel.fetch_message(int(message))

            for channel, message in data["react_role_message"].items():
                bot.react_role_channel = bot.get_channel(int(channel))
                bot.react_role_message = await bot.react_role_channel.fetch_message(int(message))
                print(bot.react_role_message.id)

            logging.info("Found existing config and loaded it")

        await load_cogs()

        bot.already_logged_in = True


async def load_cogs():
    for filename in os.listdir("./cogs"):
        if filename.endswith(".py"):
            bot.load_extension(f"cogs.{filename[:-3]}")

bot.run(os.getenv("TOKEN"))
