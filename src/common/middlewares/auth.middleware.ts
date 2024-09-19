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
    console.log('AuthMiddleware: Cookies:', req.headers.cookie);
    console.log('AuthMiddleware: Query:', req.query);
    
    const cookie: CookieKeys = transformCookieToObject(req.headers.cookie);
    console.log('AuthMiddleware: Parsed Cookies:', cookie);

    try {
      if (!cookie?.CSRF_TOKEN) {
        console.log('AuthMiddleware: CSRF_TOKEN not found in cookies');
        if (req.query.telegram_id) {
          console.log('AuthMiddleware: telegram_id found in query:', req.query.telegram_id);
          const csrfToken: string = uuidv4();
          res.cookie(COOKIE_KEYS.CSRF_TOKEN, csrfToken, COOKIE_CONFIG);
          res.cookie(COOKIE_KEYS.CSRF_CLIENT_TOKEN, csrfToken);
          const user = await this.userService.findOne({ telegram_id: req.query.telegram_id as string });
          if (user) {
            await this.userService.updateOne({ id: user.id, csrf_token: csrfToken });
            req.user = user;
            console.log('AuthMiddleware: User found and updated:', user);
          } else {
            console.log('AuthMiddleware: User not found for telegram_id:', req.query.telegram_id);
          }
        } else {
          console.log('AuthMiddleware: No telegram_id in query');
          console.log('AuthMiddleware: Proceeding without authentication');
        }
      } else {
        console.log('AuthMiddleware: CSRF_TOKEN found in cookies:', cookie.CSRF_TOKEN);
        req.user = await this.userService.findOne({ csrf_token: cookie.CSRF_TOKEN });
        console.log('AuthMiddleware: User found by CSRF_TOKEN:', req.user);
      }

      console.log('AuthMiddleware: Final req.user:', req.user);

      
      // if (!req.user) {
      //   throw new UnauthorizedException('Пользователь не аутентифицирован');
      // }

      next();
    } catch (error) {
      console.error('Ошибка AuthMiddleware:', error);
      console.log('AuthMiddleware: Proceeding despite error');
      next();
    }
  }
}