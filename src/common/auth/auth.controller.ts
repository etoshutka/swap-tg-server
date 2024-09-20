// auth.controller.ts
import { Controller, Post, Body, UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('login')
  async login(@Body() loginDto: { telegram_id: string }) {
    const user = await this.authService.validateUser(loginDto.telegram_id);
    if (!user) {
      throw new UnauthorizedException();
    }
    return this.authService.login(user);
  }
}