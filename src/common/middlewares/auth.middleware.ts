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
    console.log('AuthMiddleware: Request headers:', req.headers);
    console.log('AuthMiddleware: Cookies:', req.cookies);

    const cookie: CookieKeys = transformCookieToObject(req.headers.cookie);

    if (!cookie?.CSRF_TOKEN && req.query.telegram_id) {
      const csrfToken: string = uuidv4();
      res.cookie(COOKIE_KEYS.CSRF_TOKEN, csrfToken, {
        httpOnly: true,
        secure: true,
        sameSite: 'none'
      });
      res.cookie(COOKIE_KEYS.CSRF_CLIENT_TOKEN, csrfToken, {
        httpOnly: false,
        secure: true,
        sameSite: 'none'
      });
      const user = await this.userService.findOne({ telegram_id: req.query.telegram_id as string });
      if (user) {
        await this.userService.updateOne({ id: user.id, csrf_token: csrfToken });
        req.user = user;
        console.log('AuthMiddleware: User set:', user.id);
      }
    } else if (cookie?.CSRF_TOKEN) {
      const user = await this.userService.findOne({ csrf_token: cookie.CSRF_TOKEN });
      if (user) {
        req.user = user;
        console.log('AuthMiddleware: User set from cookie:', user.id);
      }
    }

    console.log('AuthMiddleware: Final req.user:', req.user);
    next();
  }
}