import { Controller, Post, Body, HttpException, HttpStatus } from "@nestjs/common";
import { AuthService } from "../../usecases/services/auth.service";
import { TelegramUserData } from "../../usecases/interfaces/auth.interface";


@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post("/telegram")
  async authenticateWithTelegram(@Body() telegramData: TelegramUserData) {
    const result = await this.authService.getAuthResult(telegramData);

    if (!result.ok) {
      throw new HttpException(result.message, result.status);
    }

    return result.data;
  }
}