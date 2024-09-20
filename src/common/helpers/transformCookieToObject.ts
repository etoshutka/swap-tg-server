import { CookieKeys } from "../consts/cookie-keys.const";

export function transformCookieToObject(cookie: string): CookieKeys {
  console.log('Raw cookie string:', cookie);

  const keyMapping: Record<string, keyof CookieKeys> = {
    "_auth.csrf_token": "CSRF_TOKEN",
    "_auth.telegram_id": "TELEGRAM_ID",
    "_auth.client.csrf_token": "CSRF_CLIENT_TOKEN",
  };

  const defaultKeys: CookieKeys = {
    CSRF_TOKEN: "",
    TELEGRAM_ID: "",
    CSRF_CLIENT_TOKEN: "",
  };
  console.log('Transformed cookie object:', defaultKeys);
  return cookie?.split("; ").reduce((acc, curr) => {
    const [key, value] = curr?.split("=");
    if (key in keyMapping) {
      acc[keyMapping[key]] = value;
    }
    return acc;
    
  }, defaultKeys);
}

