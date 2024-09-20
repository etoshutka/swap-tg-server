import { CanActivate, ExecutionContext, Injectable, ForbiddenException, UnauthorizedException } from "@nestjs/common";
import { transformCookieToObject } from "../helpers/transformCookieToObject";
import { CookieKeys } from "../consts/cookie-keys.const";
import { Request } from "express";
import { UsersService } from "src/domains/users";


@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly usersService: UsersService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request: Request = context.switchToHttp().getRequest();
    const cookies: CookieKeys = transformCookieToObject(request.headers.cookie);
    
    const csrfTokenFromCookie: string = cookies?.CSRF_TOKEN;
    const csrfTokenFromHeader: string = request.headers['x-csrf-token'] as string;
    
    if (!csrfTokenFromHeader || csrfTokenFromCookie !== csrfTokenFromHeader) {
      throw new ForbiddenException("CSRF token mismatch");
    }

    const user = await this.usersService.findOne({ csrf_token: csrfTokenFromCookie });
    if (!user) {
      throw new UnauthorizedException("User not found");
    }

    request['user'] = user;
    return true;
  }
}