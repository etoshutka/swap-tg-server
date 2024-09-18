export class GetReferralProgramParams {
  user_id: string;
}

export class CheckReferralCodeParams {
  invited_by: string;
  telegram_id: string;
}

export class InitReferralUserProgramParams {
  telegram_id: string;
  invited_by?: string;
}
