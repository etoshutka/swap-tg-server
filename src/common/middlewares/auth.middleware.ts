import { transformCookieToObject } from "../helpers/transformCookieToObject";
import { COOKIE_KEYS, CookieKeys } from "../consts/cookie-keys.const";
import { COOKIE_CONFIG } from "../consts/cookie-config.const";
import { UserModel, UsersService } from "src/domains/users";
import { Injectable, Logger, NestMiddleware } from "@nestjs/common";
import { Request, Response, NextFunction } from "express";
import { v4 as uuidv4 } from "uuid";

@Injectable()
export class AuthMiddleware implements NestMiddleware {
  constructor(private readonly userService: UsersService) {}

  async use(req: Request & { user?: UserModel }, res: Response, next: NextFunction) {
    const cookie: CookieKeys = transformCookieToObject(req.headers.cookie);

    if (!cookie?.CSRF_TOKEN && req.query.telegram_id) {
      const csrfToken: string = uuidv4();
      res.cookie(COOKIE_KEYS.CSRF_TOKEN, csrfToken, {
        ...COOKIE_CONFIG,
        httpOnly: true,
        secure: true,
        sameSite: 'none'
      });
      res.cookie(COOKIE_KEYS.CSRF_CLIENT_TOKEN, csrfToken, {
        ...COOKIE_CONFIG,
        httpOnly: false,
        secure: true,
        sameSite: 'none'
      });
      const user = await this.userService.findOne({ telegram_id: req.query.telegram_id as string });
      if (user) {
        await this.userService.updateOne({ id: user.id, csrf_token: csrfToken });
      }
    }

    next();
  }
}