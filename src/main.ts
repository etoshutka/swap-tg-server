import { ValidationPipe, VersioningType } from "@nestjs/common";
import * as cookieParser from "cookie-parser";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import "reflect-metadata";

declare const module: any;

(async () => {
  const app = await NestFactory.create(AppModule);

  app.useGlobalPipes(new ValidationPipe());
  app.use(cookieParser());

  // Allow to all and include localhost
  app.enableCors({
    origin: true,
    credentials: true,
  });

  app.enableVersioning({
    type: VersioningType.URI,
    prefix: "v",
    defaultVersion: "1",
  });

  process.setMaxListeners(10);

  await app.listen(3000);

  if (module.hot) {
    module.hot.accept();
    module.hot.dispose(() => app.close());
  }
})();
