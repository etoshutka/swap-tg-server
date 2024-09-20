import { CanActivate, ExecutionContext, Injectable, ForbiddenException, UnauthorizedException } from "@nestjs/common";
import { UsersService } from "src/domains/users";

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly usersService: UsersService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    console.log('AuthGuard: Request headers:', request.headers);
    console.log('AuthGuard: Cookies:', request.cookies);

    // First, check if the user is already authenticated
    if (!request.user) {
      // If not, try to authenticate using CSRF token
      const csrfTokenFromCookie: string = request.cookies?.CSRF_TOKEN;
      const csrfTokenFromHeader: string = request.headers['x-csrf-token'] as string;
      
      console.log('AuthGuard: CSRF from cookie:', csrfTokenFromCookie);
      console.log('AuthGuard: CSRF from header:', csrfTokenFromHeader);

      if (!csrfTokenFromCookie || !csrfTokenFromHeader) {
        throw new UnauthorizedException("Missing CSRF token");
      }

      if (csrfTokenFromCookie !== csrfTokenFromHeader) {
        throw new ForbiddenException("CSRF token mismatch");
      }

      const user = await this.usersService.findOne({ csrf_token: csrfTokenFromCookie });
      if (!user) {
        throw new UnauthorizedException("User not found");
      }

      request.user = user;
    }

    console.log('AuthGuard: Final req.user:', request.user);
    return true;
  }
}