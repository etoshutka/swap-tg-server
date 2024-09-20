import { transformCookieToObject } from "../helpers/transformCookieToObject";
import { COOKIE_KEYS, CookieKeys } from "../consts/cookie-keys.const";
import { COOKIE_CONFIG } from "../consts/cookie-config.const";
import { UserModel, UsersService } from "src/domains/users";
import { Injectable, Logger, NestMiddleware } from "@nestjs/common";
import { Request, Response, NextFunction } from "express";
import { v4 as uuidv4 } from "uuid";

@Injectable()
export class AuthMiddleware implements NestMiddleware {
  private readonly logger = new Logger(AuthMiddleware.name);

  constructor(private readonly userService: UsersService) {}

  async use(req: Request & { user?: UserModel }, res: Response, next: NextFunction) {
    const cookie: CookieKeys = transformCookieToObject(req.headers.cookie);

    this.logger.log(`Incoming request: ${req.method} ${req.url}`);
    this.logger.debug(`Headers: ${JSON.stringify(req.headers)}`);
    this.logger.debug(`Query: ${JSON.stringify(req.query)}`);
    this.logger.debug(`Cookies: ${JSON.stringify(cookie)}`);

    if (!cookie?.CSRF_TOKEN && req.query.telegram_id) {
      const csrfToken: string = uuidv4();
      res.cookie(COOKIE_KEYS.CSRF_TOKEN, csrfToken, COOKIE_CONFIG);
      res.cookie(COOKIE_KEYS.CSRF_CLIENT_TOKEN, csrfToken);
      const user = await this.userService.findOne({ telegram_id: req.query.telegram_id as string });
      if (user) {
        await this.userService.updateOne({ id: user.id, csrf_token: csrfToken });
        req.user = user;
        this.logger.log(`User authenticated via telegram_id: ${user.id}`);
      } else {
        this.logger.warn(`User not found for telegram_id: ${req.query.telegram_id}`);
      }
    }

    if (cookie?.CSRF_TOKEN) {
      req.user = await this.userService.findOne({ csrf_token: cookie.CSRF_TOKEN });
      if (req.user) {
        this.logger.log(`User authenticated via CSRF_TOKEN: ${req.user.id}`);
      } else {
        this.logger.warn(`User not found for CSRF_TOKEN: ${cookie.CSRF_TOKEN}`);
      }
    }

    if (!req.user) {
      this.logger.warn('No user authenticated for this request');
    }

    next();
  }
}