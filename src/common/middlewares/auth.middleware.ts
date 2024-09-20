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
    const cookies = req.cookies || {}; // Use req.cookies if available
    console.log('Parsed cookies:', cookies);

    if (cookies.CSRF_TOKEN) {
      console.log('CSRF token found, attempting to find user');
      try {
        const user = await this.userService.findOne({ csrf_token: cookies.CSRF_TOKEN });
        console.log('User found by CSRF token:', user);
        if (user) {
          req.user = user;
        } else {
          console.log('No user found with CSRF token:', cookies.CSRF_TOKEN);
        }
      } catch (error) {
        console.error('Error finding user by CSRF token:', error);
      }
    } else if (req.query.telegram_id) {
      console.log('No CSRF token, but telegram_id present. Creating new user session');
      const csrfToken: string = uuidv4();
      res.cookie(COOKIE_KEYS.CSRF_TOKEN, csrfToken, COOKIE_CONFIG);
      res.cookie(COOKIE_KEYS.CSRF_CLIENT_TOKEN, csrfToken, {...COOKIE_CONFIG, httpOnly: false});
      res.cookie(COOKIE_KEYS.TELEGRAM_ID, req.query.telegram_id as string, COOKIE_CONFIG);
      
      try {
        let user = await this.userService.findOne({ telegram_id: req.query.telegram_id as string });
        if (!user) {
          user = await this.userService.create({
            telegram_id: req.query.telegram_id as string,
            csrf_token: csrfToken
          });
        } else {
          await this.userService.updateOne({ id: user.id, csrf_token: csrfToken });
        }
        console.log('User created/updated:', user);
        req.user = user;
      } catch (error) {
        console.error('Error creating/updating user:', error);
      }
    }

    console.log('Final req.user:', req.user);
    console.log('Response cookies:', res.getHeader('Set-Cookie'));
    next();
  }
}