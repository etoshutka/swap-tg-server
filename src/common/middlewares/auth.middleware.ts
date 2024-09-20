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
    console.log('Raw headers:', req.headers);
    
    const telegramId = req.headers['x-telegram-id'] as string || req.query.telegram_id as string;

    if (telegramId) {
      try {
        let user = await this.userService.findOne({ telegram_id: telegramId });
        if (!user) {
          user = await this.userService.create({ 
            telegram_id: telegramId,
            username: req.query.username as string,
            language_code: req.query.language_code as string
          });
        }
        req.user = user;
        console.log('User set:', user);
      } catch (error) {
        console.error('Error finding/creating user:', error);
      }
    }

    console.log('Final req.user:', req.user);
    next();
  }
}