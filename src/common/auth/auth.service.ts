import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UserModel, UsersService } from 'src/domains/users';


@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService
  ) {}

  async validateUser(telegramId: string): Promise<UserModel | null> {
    const user = await this.usersService.findOne({ telegram_id: telegramId });
    if (user) {
      return user;
    }
    return null;
  }

  async login(user: UserModel) {
    const payload = { telegram_id: user.telegram_id, sub: user.id };
    return {
      access_token: this.jwtService.sign(payload),
    };
  }
}