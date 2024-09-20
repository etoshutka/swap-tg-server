import { CanActivate, ExecutionContext, Injectable, ForbiddenException, UnauthorizedException } from "@nestjs/common";
import { transformCookieToObject } from "../helpers/transformCookieToObject";
import { CookieKeys } from "../consts/cookie-keys.const";
import { Request } from "express";
import { UsersService } from "src/domains/users";

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly usersService: UsersService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    console.log('AuthGuard: Request headers:', request.headers);
    console.log('AuthGuard: Cookies:', request.cookies);
    console.log('AuthGuard: Initial req.user:', request.user);

    const csrfTokenFromCookie: string = request.cookies?.CSRF_TOKEN;
    const csrfTokenFromHeader: string = request.headers['x-csrf-token'] as string;
    
    console.log('AuthGuard: CSRF from cookie:', csrfTokenFromCookie);
    console.log('AuthGuard: CSRF from header:', csrfTokenFromHeader);

    if (!csrfTokenFromHeader || csrfTokenFromCookie !== csrfTokenFromHeader) {
      throw new ForbiddenException("CSRF token mismatch");
    }

    if (!request.user) {
      const user = await this.usersService.findOne({ csrf_token: csrfTokenFromCookie });
      if (user) {
        request.user = user;
        console.log('AuthGuard: User set:', user.id);
      } else {
        throw new UnauthorizedException("User not found");
      }
    }

    console.log('AuthGuard: Final req.user:', request.user);
    return true;
  }
}