import { ServiceMethodResponseDto } from "src/common/dto/service-method-response.dto";
import { RefConfigModel } from "../../domain/models/ref-config.model";
import { ReferralModel } from "../../domain/models/referral.model";
import { HttpStatus, Injectable, Logger } from "@nestjs/common";
import { DB_DATE_FORMAT } from "src/common/consts/date.const";
import { UserModel, UsersService } from "src/domains/users";
import * as types from "../interfaces/referral.interface";
import { InjectRepository } from "@nestjs/typeorm";
import { ConfigService } from "@nestjs/config";
import { Repository } from "typeorm";
import * as moment from "moment";

@Injectable()
export class ReferralService {
  private readonly logger = (context: string) => new Logger(`ReferralModule > ReferralService > ${context}`);
  private readonly TELEGRAM_BOT_USERNAME: string = this.configService.get<string>("TELEGRAM_BOT_USERNAME");

  constructor(
    private readonly userService: UsersService,
    private readonly configService: ConfigService,
    @InjectRepository(ReferralModel)
    private readonly referralRepo: Repository<ReferralModel>,
    @InjectRepository(RefConfigModel)
    private readonly refConfigRepo: Repository<RefConfigModel>,
  ) {}

  /**
   * Get referral config
   * @returns {Promise<ServiceMethodResponseDto<any>>}
   */
  async getRefConfig(): Promise<ServiceMethodResponseDto<RefConfigModel>> {
    const refConfig: RefConfigModel = await this.refConfigRepo.findOne({});

    if (!refConfig) {
      this.logger("getRefConfig()").error("Referral config not found");
      return new ServiceMethodResponseDto<null>({ ok: false, status: HttpStatus.NOT_FOUND, message: "Referral config not found" });
    }

    return new ServiceMethodResponseDto<RefConfigModel>({ ok: true, status: HttpStatus.OK, data: refConfig });
  }

  /**
   * Get referral program
   * @param {types.GetReferralProgramParams} params
   * @returns {Promise<ServiceMethodResponseDto<any>>}
   */
  async getReferralProgram(params: types.GetReferralProgramParams): Promise<ServiceMethodResponseDto<ReferralModel>> {
    const user: UserModel = await this.userService.findOne({ id: params.user_id });
    let refProgram: ReferralModel = await this.referralRepo.findOne({ where: { user_id: params.user_id } });

    if (!refProgram && user) {
      refProgram = (await this.initReferralUserProgram({ telegram_id: user.telegram_id })).data;
    }

    return new ServiceMethodResponseDto<ReferralModel>({ ok: true, status: HttpStatus.OK, data: refProgram });
  }

  /**
   * Check referral code
   * @param {types.CheckReferralCodeParams} params
   * @returns {Promise<ServiceMethodResponseDto<any>>}
   */
  async checkReferralLink(params: types.CheckReferralCodeParams): Promise<ServiceMethodResponseDto<null>> {
    const telegramIdFromLink: string = params.invited_by;

    // Check invited_by user
    const user: UserModel = await this.userService.findOne({ telegram_id: telegramIdFromLink });

    // Check if user exist
    if (!user) {
      this.logger("checkReferralLink()").error(`invited_by user ${telegramIdFromLink} not found`);
      return new ServiceMethodResponseDto<null>({ ok: false, status: HttpStatus.NOT_FOUND, message: "User not found" });
    }

    // Get invited_by user program
    let refProgram: ReferralModel = await this.referralRepo.findOne({ where: { user_id: user.id } });

    // Check if ref program doesn't exist
    if (!refProgram) {
      refProgram = (await this.initReferralUserProgram({ telegram_id: user.telegram_id })).data;
    }

    // Update invited_by user count
    await this.referralRepo.update(refProgram.id, { invited_count: refProgram.invited_count + 1 });

    return new ServiceMethodResponseDto<null>({ ok: true, status: HttpStatus.OK });
  }

  /**
   * Init referral user program
   * @param {types.InitReferralUserProgramParams} params
   * @returns {Promise<ServiceMethodResponseDto<any>>}
   */
  async initReferralUserProgram(params: types.InitReferralUserProgramParams): Promise<ServiceMethodResponseDto<ReferralModel>> {
    const user: UserModel = await this.userService.findOne({ telegram_id: params.telegram_id });

    // Check if user exist
    if (!user) {
      this.logger("initReferralUserProgram()").error(`User ${params.telegram_id} not found`);
      return new ServiceMethodResponseDto<null>({ ok: false, status: HttpStatus.NOT_FOUND, message: "User not found" });
    }

    // Search for ref program
    const isRefProgramExist: boolean = await this.referralRepo.existsBy({ user_id: user.id });

    // Check if ref program already exist
    if (isRefProgramExist) {
      this.logger("initReferralUserProgram()").error(`Referral program for user ${params.telegram_id} already exist`);
      return new ServiceMethodResponseDto<null>({ ok: false, status: HttpStatus.BAD_REQUEST, message: "Referral program already exist" });
    }

    // Generate referral link
    const userIdIntoBase64: string = Buffer.from(params.telegram_id).toString("base64");
    const userReferralLink: string = `https://t.me/${this.TELEGRAM_BOT_USERNAME}?start=${userIdIntoBase64}`;

    // Create new referral model
    const refProgram: ReferralModel = await this.referralRepo.save({
      user_id: user.id,
      telegram_id: params.telegram_id,
      link: userReferralLink,
      invited_count: 0,
      balance: 0,
      invited_by: params.invited_by,
      created_at: moment().format(DB_DATE_FORMAT),
      updated_at: moment().format(DB_DATE_FORMAT),
    });

    return new ServiceMethodResponseDto<ReferralModel>({ ok: true, status: HttpStatus.OK, data: refProgram });
  }
}
