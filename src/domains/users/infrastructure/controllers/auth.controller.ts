import { Body, Controller, HttpException, HttpStatus, Post, Res } from "@nestjs/common";
import { SignUpParams } from "../../usecases/interfaces/auth.interface";
import { COOKIE_CONFIG } from "src/common/consts/cookie-config.const";
import { AuthService } from "../../usecases/services/auth.service";
import { COOKIE_KEYS } from "src/common/consts/cookie-keys.const";
import { Response } from "express";

@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post("/sign-up")
  async signUp(@Body() body: SignUpParams, @Res() res: Response): Promise<void> {
    const result = await this.authService.signUp(body);

    if (result.ok) {
      res.cookie(COOKIE_KEYS.TELEGRAM_ID, result.data.user.telegram_id, COOKIE_CONFIG);
    }

    if (!result.ok) {
      throw new HttpException("Error signing up", HttpStatus.INTERNAL_SERVER_ERROR);
    }

    res.status(200).json(result);
  }
}
