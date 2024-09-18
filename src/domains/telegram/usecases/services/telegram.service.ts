import { ReferralService } from "src/domains/referral";
import * as TelegramApi from "node-telegram-bot-api";
import { UsersService } from "src/domains/users";
import { AuthService } from "src/domains/users";
import { ConfigService } from "@nestjs/config";
import { Injectable } from "@nestjs/common";
import { Timeout } from "@nestjs/schedule";

@Injectable()
export class TelegramService {
  constructor(
    private readonly authService: AuthService,
    private readonly usersService: UsersService,
    private readonly configService: ConfigService,
    private readonly referralService: ReferralService,
  ) {}

  /**
   * Init telegram bot
   * @returns TelegramApi
   */
  async initTgBot(): Promise<TelegramApi> {
    const bot: TelegramApi = new TelegramApi(this.configService.get("TELEGRAM_BOT_TOKEN"), { polling: true });
    await bot.setMyCommands([{ command: "/start", description: "Start app" }]);
    return bot;
  }

  /**
   * On text event listener
   */
  @Timeout(0)
  async onText() {
    const bot: TelegramApi = await this.initTgBot();

    bot.on("text", async (msg) => {
      const text: string = msg.text;
      const chat_id: number = msg.chat.id;
      const invited_by: string | null = text.includes("/start") && text.split(" ")?.[1] ? Buffer.from(text.split(" ")[1], "base64").toString("ascii") : null;
      const telegram_id: string = msg.from.id.toString();

      // Check if user exist
      const isUserExist: boolean = await this.usersService.isUserExist({ telegram_id });

      // If user doesn't exist, create
      if (!isUserExist) {
        const m1: TelegramApi.Message = await bot.sendMessage(chat_id, "Hello 👋, please, wait a few moments, app is initializing...");

        // Create new user
        await this.authService.signUp({ telegram_id, username: msg.from.username, language_code: msg.from.language_code });

        // Check ref link
        await bot.editMessageText("⏳ Check your referral link...", { chat_id, message_id: m1.message_id });
        !!invited_by && (await this.referralService.checkReferralLink({ invited_by, telegram_id }));

        // Send welcome message
        await bot.editMessageText("Welcome to the TestCryptoSwapBot! 🙌", { chat_id, message_id: m1.message_id });
      }
    });
  }
}
