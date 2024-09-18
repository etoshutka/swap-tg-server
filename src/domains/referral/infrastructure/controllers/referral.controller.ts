import { Controller, Get, HttpException, Req, UseGuards } from "@nestjs/common";
import { ReferralService } from "../../usecases/services/referral.service";
import { AuthGuard } from "src/common/guards/auth.guard";
import { UserModel } from "src/domains/users";

@Controller("referral")
export class ReferralController {
  constructor(private readonly referralService: ReferralService) {}

  @Get("user")
  @UseGuards(AuthGuard)
  async getReferralProgram(@Req() req: Request & { user: UserModel }) {
    const result = await this.referralService.getReferralProgram({ user_id: req.user.id });

    if (!result.ok) {
      throw new HttpException(result.message, result.status);
    }

    return result;
  }
}
