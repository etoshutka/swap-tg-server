import { CanActivate, ExecutionContext, Injectable, ForbiddenException } from "@nestjs/common";
import { transformCookieToObject } from "../helpers/transformCookieToObject";
import { CookieKeys } from "../consts/cookie-keys.const";
import { Request } from "express";

@Injectable()
export class AuthGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request: Request = context.switchToHttp().getRequest();
    const cookies: CookieKeys = transformCookieToObject(request.headers.cookie);
    
    const csrfTokenFromCookie: string = cookies?.CSRF_TOKEN;
    const csrfTokenFromClient: string = cookies?.CSRF_CLIENT_TOKEN;
    
    if (!csrfTokenFromClient || csrfTokenFromCookie !== csrfTokenFromClient) {
      throw new ForbiddenException("Access denied");
    }

    return true;
  }
}
