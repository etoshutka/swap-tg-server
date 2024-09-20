import { CookieKeys } from "../consts/cookie-keys.const";

export function transformCookieToObject(cookie: string): CookieKeys {
  console.log('Raw cookie string:', cookie);
  
  const keyMapping: Record<string, keyof CookieKeys> = {
    "_auth.csrf_token": "CSRF_TOKEN",
    "_auth.telegram_id": "TELEGRAM_ID",
    "_auth.client.csrf_token": "CSRF_CLIENT_TOKEN",
  };

  const result: CookieKeys = {
    CSRF_TOKEN: "",
    TELEGRAM_ID: "",
    CSRF_CLIENT_TOKEN: "",
  };

  if (cookie) {
    cookie.split('; ').forEach(pair => {
      const [key, value] = pair.split('=');
      const mappedKey = keyMapping[key];
      if (mappedKey) {
        result[mappedKey] = value;
      }
    });
  }

  console.log('Transformed cookie object:', result);
  return result;
}
