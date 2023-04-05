import * as dotenv from "dotenv";
dotenv.config();

import { BobertClient } from "./lib/client";

const bot = new BobertClient();

bot.login(process.env.TOKEN);
