import { IsNotEmpty, IsOptional, IsString } from "class-validator";

export class GetUserParams {
  @IsString({ message: "Telegram id must be a string" })
  @IsNotEmpty({ message: "Telegram id is required" })
  telegram_id: string;

  @IsString({ message: "Username must be a string" })
  @IsNotEmpty({ message: "Username is required" })
  username: string;

  @IsString({ message: "First name must be a string" })
  @IsOptional()
  first_name: string;

  @IsString({ message: "Last name must be a string" })
  @IsOptional()
  last_name: string;

  @IsString({ message: "Language code must be a string" })
  @IsNotEmpty({ message: "Language code is required" })
  language_code: string;
}
