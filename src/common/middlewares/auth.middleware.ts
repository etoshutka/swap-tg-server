import { transformCookieToObject } from "../helpers/transformCookieToObject";
import { COOKIE_KEYS, CookieKeys } from "../consts/cookie-keys.const";
import { COOKIE_CONFIG } from "../consts/cookie-config.const";
import { UserModel, UsersService } from "src/domains/users";
import { Injectable, NestMiddleware, UnauthorizedException } from "@nestjs/common";
import { Request, Response, NextFunction } from "express";
import { v4 as uuidv4 } from "uuid";

@Injectable()
export class AuthMiddleware implements NestMiddleware {
  constructor(private readonly userService: UsersService) {}

  async use(req: Request & { user?: UserModel }, res: Response, next: NextFunction) {
    console.log('AuthMiddleware: Headers:', req.headers);
    const cookie: CookieKeys = transformCookieToObject(req.headers.cookie);

    try {
      if (!cookie?.CSRF_TOKEN) {
        if (req.query.telegram_id) {
          const csrfToken: string = uuidv4();
          res.cookie(COOKIE_KEYS.CSRF_TOKEN, csrfToken, COOKIE_CONFIG);
          res.cookie(COOKIE_KEYS.CSRF_CLIENT_TOKEN, csrfToken);
          const user = await this.userService.findOne({ telegram_id: req.query.telegram_id as string });
          if (user) {
            await this.userService.updateOne({ id: user.id, csrf_token: csrfToken });
            req.user = user;
          }
        } else {
          throw new UnauthorizedException('Отсутствует CSRF токен и telegram_id');
        }
      } else {
        req.user = await this.userService.findOne({ csrf_token: cookie.CSRF_TOKEN });
      }

      console.log('AuthMiddleware: req.user:', req.user);

      if (!req.user) {
        throw new UnauthorizedException('Пользователь не аутентифицирован');
      }

      next();
    } catch (error) {
      console.error('Ошибка AuthMiddleware:', error);
      res.status(401).json({ message: 'Неавторизованный доступ', details: error.message });
    }
  }
}