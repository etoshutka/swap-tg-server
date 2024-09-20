import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { UsersService } from 'src/domains/users';

@Injectable()
export class AuthMiddleware implements NestMiddleware {
  private readonly logger = new Logger(AuthMiddleware.name);

  constructor(private readonly userService: UsersService) {}

  async use(req: Request & { user?: any }, res: Response, next: NextFunction) {
    this.logger.log(`Request headers: ${JSON.stringify(req.headers)}`);
    this.logger.log(`Cookies: ${JSON.stringify(req.cookies)}`);

    const csrfToken = req.cookies['_auth.csrf_token'];
    
    if (csrfToken) {
      try {
        const user = await this.userService.findOne({ csrf_token: csrfToken });
        if (user) {
          req.user = user;
          this.logger.log(`User authenticated: ${user.id}`);
        } else {
          this.logger.warn(`User not found for CSRF token: ${csrfToken}`);
        }
      } catch (error) {
        this.logger.error(`Error finding user: ${error.message}`);
      }
    } else {
      this.logger.warn('No CSRF token found in cookies');
    }

    this.logger.log(`Final req.user: ${JSON.stringify(req.user)}`);
    next();
  }
}