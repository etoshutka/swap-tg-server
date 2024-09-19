import { transformCookieToObject } from "../helpers/transformCookieToObject";
import { COOKIE_KEYS, CookieKeys } from "../consts/cookie-keys.const";
import { COOKIE_CONFIG } from "../consts/cookie-config.const";
import { AuthService, UserModel, UsersService } from "src/domains/users";
import { HttpStatus, Injectable, NestMiddleware } from "@nestjs/common";
import { Request, Response, NextFunction } from "express";
import { v4 as uuidv4 } from "uuid";

@Injectable()
export class AuthMiddleware implements NestMiddleware {
  constructor(
    private readonly userService: UsersService,
    private readonly authService: AuthService
  ) {}

  async use(req: Request & { user?: UserModel }, res: Response, next: NextFunction) {
    console.log('AuthMiddleware: Headers:', req.headers);
    console.log('AuthMiddleware: Query:', req.query);

    const cookie: CookieKeys = transformCookieToObject(req.headers.cookie);
    console.log('AuthMiddleware: Parsed Cookies:', cookie);

    try {
      if (cookie?.CSRF_TOKEN) {
        console.log('AuthMiddleware: Finding user by CSRF token');
        req.user = await this.userService.findOne({ csrf_token: cookie.CSRF_TOKEN });
      } else if (req.query.telegram_id) {
        console.log('AuthMiddleware: Processing request with telegram_id:', req.query.telegram_id);
        const isUserExist = await this.userService.isUserExist({ telegram_id: req.query.telegram_id as string });
        
        if (!isUserExist) {
          console.log('AuthMiddleware: User does not exist, creating new user');
          const signUpResult = await this.authService.signUp({
            telegram_id: req.query.telegram_id as string,
            username: req.query.username as string,
            language_code: req.query.language_code as string,
          });
          
          if (signUpResult.ok && signUpResult.data) {
            req.user = signUpResult.data.user;
          } else {
            console.error('AuthMiddleware: Failed to create user:', signUpResult.message);
            return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ message: 'Failed to create user' });
          }
        } else {
          req.user = await this.userService.findOne({ telegram_id: req.query.telegram_id as string });
        }

        if (req.user) {
          const csrfToken: string = uuidv4();
          res.cookie(COOKIE_KEYS.CSRF_TOKEN, csrfToken, COOKIE_CONFIG);
          res.cookie(COOKIE_KEYS.CSRF_CLIENT_TOKEN, csrfToken);
          await this.userService.updateOne({ id: req.user.id, csrf_token: csrfToken });
        }
      }

      if (!req.user) {
        console.log('AuthMiddleware: User not authenticated');
        return res.status(HttpStatus.UNAUTHORIZED).json({ message: 'User not authenticated' });
      }

      console.log('AuthMiddleware: User authenticated:', req.user.id);
      next();
    } catch (error) {
      console.error('AuthMiddleware Error:', error);
      res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ message: 'Internal server error' });
    }
  }
}