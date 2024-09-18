export interface CookieKeys {
  CSRF_TOKEN: string;
  TELEGRAM_ID: string;
  CSRF_CLIENT_TOKEN: string;
}

export const COOKIE_KEYS: CookieKeys = {
  CSRF_TOKEN: "_auth.csrf_token",
  TELEGRAM_ID: "_auth.telegram_id",
  CSRF_CLIENT_TOKEN: "_auth.client.csrf_token",
};
