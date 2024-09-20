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
    console.log('Raw request cookies:', req.headers.cookie);
    const cookie: CookieKeys = transformCookieToObject(req.headers.cookie);
    console.log('Parsed cookies:', cookie);

    if (!cookie?.CSRF_TOKEN && req.query.telegram_id) {
      console.log('No CSRF token, creating new user session');
      const csrfToken: string = uuidv4();
      res.cookie(COOKIE_KEYS.CSRF_TOKEN, csrfToken, COOKIE_CONFIG);
      res.cookie(COOKIE_KEYS.CSRF_CLIENT_TOKEN, csrfToken, {...COOKIE_CONFIG, httpOnly: false});
      res.cookie(COOKIE_KEYS.TELEGRAM_ID, req.query.telegram_id as string, COOKIE_CONFIG);
      
      try {
        const user = await this.userService.findOne({ telegram_id: req.query.telegram_id as string });
        console.log('User found by telegram_id:', user);
        await this.userService.updateOne({ id: user.id, csrf_token: csrfToken });
        req.user = user;
      } catch (error) {
        console.error('Error finding or updating user:', error);
      }
    }

    if (cookie?.CSRF_TOKEN) {
      console.log('CSRF token found, attempting to find user');
      try {
        req.user = await this.userService.findOne({ csrf_token: cookie.CSRF_TOKEN });
        console.log('User found by CSRF token:', req.user);
      } catch (error) {
        console.error('Error finding user by CSRF token:', error);
      }
    }

    console.log('Final req.user:', req.user);
    console.log('Response cookies:', res.getHeader('Set-Cookie'));
    next();
  }
}