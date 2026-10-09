import {
  type HateoasLinks,
  RequestContextService,
} from "#/core/context/index.js";
import type {
  ClearCookie,
  Cookies,
} from "#/types/response/base-response.type.js";

export interface HttpSuccessOptions {
  meta?: Record<string, any>;
  cookies?: Cookies[];
  setCookieHeaders?: string[];
  clearCookies?: ClearCookie[];
  links?: Partial<HateoasLinks>;
  [property: string]: any;
}

/**
 * RFC-compliant success response body structure.
 * Follows JSON:API and HATEOAS conventions.
 *
 * @example
 * ```json
 * {
 *   "success": true,
 *   "status": 200,
 *   "message": "Operation completed successfully",
 *   "timestamp": "2024-01-31T12:00:00.000Z",
 *   "path": "/api/users",
 *   "data": { ... },
 *   "meta": { ... },
 *   "_links": {
 *     "self": { "href": "http://...", "method": "GET" }
 *   }
 * }
 * ```
 */
export interface SuccessResponseBody<T = any> {
  success: true;
  status: number;
  message: string;
  timestamp: string;
  path: string;
  data?: T;
  meta?: Record<string, any>;
  _links?: Partial<HateoasLinks>;
  clearCookies?: string[];
}

/**
 * Base class for successful HTTP responses.
 * Implements RFC-compliant response structure with HATEOAS support.
 *
 * @see https://jsonapi.org/ - JSON:API Specification
 * @see https://datatracker.ietf.org/doc/html/rfc5988 - Web Linking (RFC 5988)
 */
export class HttpSuccess<T = any> {
  status: number;
  message: string;
  data?: T;
  meta?: Record<string, any>;
  links?: Partial<HateoasLinks>;
  readonly __isHttpSuccess = true;

  private readonly options?: HttpSuccessOptions;

  /**
   * Creates a successful HTTP response.
   *
   * @example
   * ```typescript
   * // Simple message response
   * return new HttpSuccess('Operation successful', HttpStatus.OK)
   *
   * // Data response
   * return new HttpSuccess({ id: 1, name: 'Test' }, HttpStatus.CREATED)
   *
   * // Message with data
   * return new HttpSuccess('Custom message', { id: 1 }, HttpStatus.OK)
   *
   * // With options (meta, cookies, links)
   * return new HttpSuccess({ id: 1 }, HttpStatus.CREATED, {
   *   meta: { totalCount: 100 },
   *   links: { collection: { href: '/api/users', method: 'GET' } },
   *   cookies: [{ name: 'token', value: 'abc123', options: { httpOnly: true } }]
   * })
   * ```
   */
  constructor(message: string, status: number, options?: HttpSuccessOptions);
  constructor(data: T, status: number, options?: HttpSuccessOptions);
  constructor(message: string, options?: HttpSuccessOptions);
  constructor(
    message: string,
    data: T,
    status: number,
    options?: HttpSuccessOptions,
  );
  constructor(
    messageOrData: string | T,
    statusOrData: number | T,
    statusOrOptions?: number | HttpSuccessOptions,
    options?: HttpSuccessOptions,
  ) {
    let message: string;
    let data: T | undefined;
    let status: number;

    // Default values
    message = "Success";
    status = 200;
    this.options = options;

    // Case 4: (message: string, data: T, status: number, options?: HttpSuccessOptions)
    if (
      typeof messageOrData === "string" &&
      typeof statusOrData !== "number" &&
      typeof statusOrOptions === "number"
    ) {
      message = messageOrData;
      data = statusOrData;
      status = statusOrOptions;
      this.options = options;
    }
    // Case 1: (message: string, status: number, options?: HttpSuccessOptions)
    else if (
      typeof messageOrData === "string" &&
      typeof statusOrData === "number"
    ) {
      message = messageOrData;
      status = statusOrData;
      this.options = options || (statusOrOptions as HttpSuccessOptions);
    }
    // Case 2: (data: T, status: number, options?: HttpSuccessOptions)
    else if (
      typeof messageOrData !== "string" &&
      typeof statusOrData === "number"
    ) {
      data = messageOrData;
      status = statusOrData;
      this.options = options || (statusOrOptions as HttpSuccessOptions);
      message =
        this.options?.message || this.getDefaultMessageForStatus(status);
    }
    // Case 3: (message: string, options?: HttpSuccessOptions)
    else if (
      typeof messageOrData === "string" &&
      (typeof statusOrData === "object" || typeof statusOrData === "undefined")
    ) {
      message = messageOrData;
      this.options = (statusOrData as HttpSuccessOptions) || options;
      status = typeof statusOrOptions === "number" ? statusOrOptions : 200;
    } else {
      // Fallback
      message = typeof messageOrData === "string" ? messageOrData : "Success";
      status = typeof statusOrData === "number" ? statusOrData : 200;
      data = typeof messageOrData !== "string" ? messageOrData : undefined;
    }

    this.status = status;
    this.message = message;
    this.data = data;

    if (this.options?.meta) {
      this.meta = this.options.meta;
    }

    if (this.options?.links) {
      this.links = this.options.links;
    }
  }

  /**
   * Returns default message based on status code
   */
  private getDefaultMessageForStatus(status: number): string {
    switch (status) {
      case 200:
        return "Operation completed successfully";
      case 201:
        return "Resource created successfully";
      case 202:
        return "Request accepted for processing";
      case 204:
        return "Operation completed, no content";
      default:
        return "Success";
    }
  }

  /**
   * Returns the HTTP status code
   */
  getStatus(): number {
    return this.status;
  }

  /**
   * Returns cookies to be set
   */
  getCookies(): Cookies[] | undefined {
    return this.options?.cookies;
  }

  /**
   * Returns Set-Cookie headers
   */
  getSetCookieHeaders(): string[] | undefined {
    return this.options?.setCookieHeaders;
  }

  /**
   * Returns cookies to be cleared
   */
  getClearCookies(): ClearCookie[] | undefined {
    return this.options?.clearCookies;
  }

  /**
   * Returns HATEOAS links
   */
  getLinks(): Partial<HateoasLinks> | undefined {
    return this.links;
  }

  /**
   * Builds RFC-compliant response body with HATEOAS links
   */
  getResponse(): SuccessResponseBody<T> {
    const context = RequestContextService.getContext();

    const responseBody: SuccessResponseBody<T> = {
      success: true,
      status: this.status,
      message: this.message,
      timestamp: new Date().toISOString(),
      path: context?.path || "",
    };

    if (this.data !== undefined) {
      responseBody.data = this.data;
    }

    if (this.meta !== undefined) {
      responseBody.meta = this.meta;
    }

    // Build HATEOAS links
    const selfLink = context
      ? {
          self: {
            href: context.fullUrl,
            method: context.method as
              "GET" | "POST" | "PUT" | "PATCH" | "DELETE",
          },
        }
      : {};

    const combinedLinks = {
      ...selfLink,
      ...this.links,
    };

    if (Object.keys(combinedLinks).length > 0) {
      responseBody._links = combinedLinks;
    }

    return responseBody;
  }
}
