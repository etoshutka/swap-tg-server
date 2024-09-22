import { Injectable, NestMiddleware, UnauthorizedException } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { validate, parse, InitDataParsed } from '@telegram-apps/init-data-node';
import { ConfigService } from '@nestjs/config';
import { UsersService } from 'src/domains/users';

@Injectable()
export class AuthMiddleware implements NestMiddleware {
  constructor(
    private readonly configService: ConfigService,
    private readonly usersService: UsersService
  ) {}

  async use(req: Request & { user?: any }, res: Response, next: NextFunction) {
    const [authType, authData = ''] = (req.header('authorization') || '').split(' ');

    if (authType !== 'tma') {
      throw new UnauthorizedException('Invalid authorization type');
    }

    try {
      const botToken = this.configService.get<string>('TELEGRAM_BOT_TOKEN');
      validate(authData, botToken, { expiresIn: 3600 });
      const initData: InitDataParsed = parse(authData);

      // Найти или создать пользователя на основе данных Telegram
      let user = await this.usersService.findOne({ telegram_id: initData.user.id.toString() });
      if (!user) {
        user = await this.usersService.create({
          telegram_id: initData.user.id.toString(),
          username: initData.user.username,
          first_name: initData.user.firstName,
          last_name: initData.user.lastName,
          language_code: initData.user.languageCode,
        });
      }

      req.user = user;
      next();
    } catch (error) {
      throw new UnauthorizedException('Invalid init data');
    }
  }
}