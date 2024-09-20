import { CookieOptions } from "express";

export const COOKIE_CONFIG: CookieOptions = {
  httpOnly: true,
  secure: true, 
  sameSite: 'lax',
  maxAge: 30 * 24 * 60 * 60 * 1000, // 30 дней
  path: '/',
};