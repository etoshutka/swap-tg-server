import { MiddlewareConsumer, Module, NestModule } from "@nestjs/common";
import { AuthMiddleware } from "./common/middlewares/auth.middleware";
import { TelegramModule } from "./domains/telegram/telegram.module";
import { ReferralModule } from "./domains/referral/referral.module";
import { DatabaseModule } from "./config/database/database.module";
import { WalletsModule } from "./domains/wallets/wallets.module";
import { AppConfigModule } from "./config/app/config.module";
import { UsersModule } from "./domains/users/users.module";
import { ScheduleModule } from "@nestjs/schedule";
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';

@Module({
  imports: [
    AppConfigModule,
    DatabaseModule,
    UsersModule,
    ScheduleModule.forRoot(),
    WalletsModule,
    ReferralModule,
    TelegramModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET'),
        signOptions: { expiresIn: '1d' },
      }),
      inject: [ConfigService],
    }),
  ],
  providers: [AuthMiddleware],
  controllers: [],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(AuthMiddleware).forRoutes("*");
  }
}