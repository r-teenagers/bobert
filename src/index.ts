import * as dotenv from "dotenv";
dotenv.config();

import { BobertClient } from "./lib/client";

const bot = new BobertClient("./config.toml");

bot.login("");
