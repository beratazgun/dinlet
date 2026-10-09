import type { CookieSerializeOptions } from "@fastify/cookie";

export interface Cookies {
  name: string;
  value: string;
  options: CookieSerializeOptions;
}

export interface ClearCookie {
  name: string;
  options?: CookieSerializeOptions;
}
