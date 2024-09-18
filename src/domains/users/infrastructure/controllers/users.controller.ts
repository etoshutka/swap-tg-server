import { Controller, Get, HttpException, HttpStatus, Query, Req } from "@nestjs/common";
import * as types from "../../usecases/interfaces/users.interface";
import { AuthService } from "../../usecases/services/auth.service";
import { UserModel } from "../../domain/models/user.model";
import { Request } from "express";

@Controller("users")
export class UsersController {
  constructor(private readonly authService: AuthService) {}

  @Get("profile")
  async getUser(@Query() params: types.GetUserParams, @Req() req: Request & { user: UserModel }): Promise<UserModel> {
    const user: UserModel = req?.user;

    if (!user) {
      throw new HttpException("User not found", HttpStatus.NOT_FOUND);
    }

    return user;
  }
}
