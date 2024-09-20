import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { JwtService } from '@nestjs/jwt';
import { UsersService } from 'src/domains/users';


@Injectable()
export class AuthMiddleware implements NestMiddleware {
  constructor(
    private jwtService: JwtService,
    private usersService: UsersService
  ) {}

  async use(req: Request & { user?: any }, res: Response, next: NextFunction) {
    const token = req.headers.authorization?.split(' ')[1];
    if (token) {
      try {
        const decoded = this.jwtService.verify(token);
        const user = await this.usersService.findOne({ id: decoded.sub });
        if (user) {
          req.user = user;
        }
      } catch (error) {
        console.error('JWT verification failed:', error);
      }
    }
    next();
  }
}