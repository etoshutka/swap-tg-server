import { transformCookieToObject } from "../helpers/transformCookieToObject";
import { COOKIE_KEYS, CookieKeys } from "../consts/cookie-keys.const";
import { COOKIE_CONFIG } from "../consts/cookie-config.const";
import { UserModel, UsersService } from "src/domains/users";
import { Injectable, NestMiddleware } from "@nestjs/common";
import { Request, Response, NextFunction } from "express";
import { v4 as uuidv4 } from "uuid";

@Injectable()
export class AuthMiddleware implements NestMiddleware {
  constructor(private readonly userService: UsersService) {}

  async use(req: Request & { user?: UserModel }, res: Response, next: NextFunction) {
    const telegramId = req.query.telegram_id || req.headers['x-telegram-id'];

    if (telegramId) {
      try {
        // Здесь можно добавить дополнительную проверку подлинности telegramId
        let user = await this.userService.findOne({ telegram_id: telegramId as string });
        
        if (!user) {
          user = await this.userService.create({
            telegram_id: telegramId as string,
          });
        }

        req.user = user;
        console.log('User authenticated:', user);
      } catch (error) {
        console.error('Error authenticating user:', error);
      }
    } else {
      console.log('No Telegram ID provided');
    }

    next();
  }
}