import { CanActivate, ExecutionContext, Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { Request } from 'express';
import { UsersService } from 'src/domains/users';


@Injectable()
export class AuthGuard implements CanActivate {
  private readonly logger = new Logger(AuthGuard.name);

  constructor(private readonly usersService: UsersService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request>();
    
    this.logger.log(`Request headers: ${JSON.stringify(request.headers)}`);
    this.logger.log(`Cookies: ${JSON.stringify(request.cookies)}`);

    const csrfTokenFromCookie = request.cookies['_auth.csrf_token'];
    const csrfTokenFromHeader = request.headers['x-csrf-token'] as string;

    this.logger.log(`CSRF from cookie: ${csrfTokenFromCookie}`);
    this.logger.log(`CSRF from header: ${csrfTokenFromHeader}`);

    if (!csrfTokenFromCookie || !csrfTokenFromHeader || csrfTokenFromCookie !== csrfTokenFromHeader) {
      throw new UnauthorizedException('Invalid CSRF token');
    }

    // if (!request.user) {
    //   // Если пользователь не был установлен в middleware, попробуем найти его здесь
    //   const user = await this.usersService.findOne({ csrf_token: csrfTokenFromCookie });
    //   if (!user) {
    //     throw new UnauthorizedException('User not authenticated');
    //   }
    //   request.user = user;
    // }

    return true;
  }
}