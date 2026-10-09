import { randomInt } from "node:crypto";

const USER_AGENT = "dinlet-e2e/1.0";

/** Her istemciye ayrı IP: rate-limit sayaçları testler arasında karışmasın. */
function randomClientIp(): string {
  return `10.${randomInt(256)}.${randomInt(256)}.${randomInt(1, 255)}`;
}

export interface ApiResponse<T = unknown> {
  status: number;
  body: {
    success?: boolean;
    message?: string;
    data?: T;
    meta?: unknown;
  } & Record<string, unknown>;
  headers: Headers;
}

/**
 * Cookie'leri tarayıcı gibi saklayan küçük HTTP istemcisi. `deviceId`
 * verilirse mobil uygulama gibi davranır: `X-Client: mobile` +
 * `X-Device-Id` gönderir, girişte dönen `accessToken`'ı Bearer olarak
 * kullanır ve cookie saklamaz.
 */
export class HttpClient {
  private readonly cookies = new Map<string, string>();
  accessToken: string | null = null;
  readonly deviceId: string | null;

  readonly ip: string;
  readonly userAgent: string;

  /**
   * `trustProxy` açık olduğu için sunucu istemci IP'sini `x-forwarded-for`'dan
   * okur; her istemci varsayılan olarak ayrı IP alır. `userAgent` cihazı
   * temsil eder (yeni cihaz tespiti, cihaz değişimi denetimi).
   */
  constructor(
    private readonly baseUrl: string,
    options: { ip?: string; userAgent?: string; deviceId?: string } = {},
  ) {
    this.ip = options.ip ?? randomClientIp();
    this.userAgent = options.userAgent ?? USER_AGENT;
    this.deviceId = options.deviceId ?? null;
  }

  get isMobile(): boolean {
    return this.deviceId !== null;
  }

  /** Tarayıcıdaki `document.cookie`'nin sunucuya giden hâli. */
  get cookieHeader(): string {
    return [...this.cookies]
      .map(([name, value]) => `${name}=${value}`)
      .join("; ");
  }

  async login(email: string, password: string): Promise<this> {
    const response = await this.request<{ accessToken?: string }>(
      "POST",
      "/auth/login",
      {
        email,
        password,
      },
    );
    if (response.status !== 200) {
      throw new Error(
        `Giriş başarısız (${response.status}): ${JSON.stringify(response.body)}`,
      );
    }
    if (this.isMobile) this.accessToken = response.body.data!.accessToken!;
    return this;
  }

  get<T>(path: string) {
    return this.request<T>("GET", path);
  }
  post<T>(path: string, body?: unknown) {
    return this.request<T>("POST", path, body);
  }
  put<T>(path: string, body?: unknown) {
    return this.request<T>("PUT", path, body);
  }
  patch<T>(path: string, body?: unknown) {
    return this.request<T>("PATCH", path, body);
  }
  delete<T>(path: string) {
    return this.request<T>("DELETE", path);
  }

  /** `multipart/form-data` gövdesi (ör. ses kaydı yükleme). */
  async form<T>(method: string, path: string, form: FormData): Promise<ApiResponse<T>> {
    return this.request<T>(method, path, form);
  }

  async request<T>(
    method: string,
    path: string,
    body?: unknown,
  ): Promise<ApiResponse<T>> {
    const isForm = body instanceof FormData;
    const headers: Record<string, string> = {
      "user-agent": this.userAgent,
      "x-forwarded-for": this.ip,
    };
    if (this.cookies.size > 0) headers.cookie = this.cookieHeader;
    if (this.deviceId) {
      headers["x-client"] = "mobile";
      headers["x-device-id"] = this.deviceId;
    }
    if (this.accessToken) headers.authorization = `Bearer ${this.accessToken}`;
    if (body !== undefined && !isForm) headers["content-type"] = "application/json";

    const response = await fetch(`${this.baseUrl}/api/v1${path}`, {
      method,
      headers,
      body: isForm ? body : body === undefined ? undefined : JSON.stringify(body),
    });
    if (!this.isMobile) this.storeCookies(response.headers);

    const text = await response.text();
    return {
      status: response.status,
      body: text ? JSON.parse(text) : {},
      headers: response.headers,
    };
  }

  private storeCookies(headers: Headers): void {
    for (const setCookie of headers.getSetCookie()) {
      const [pair, ...attributes] = setCookie.split(";");
      const separator = pair.indexOf("=");
      const name = pair.slice(0, separator).trim();
      const value = pair.slice(separator + 1).trim();
      const isExpired = attributes.some((attribute) =>
        /^\s*(max-age=0|expires=thu, 01 jan 1970)/i.test(attribute),
      );
      if (isExpired || value === "") this.cookies.delete(name);
      else this.cookies.set(name, value);
    }
  }
}
