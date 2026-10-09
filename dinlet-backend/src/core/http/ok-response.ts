import {
  HttpSuccess,
  type HttpSuccessOptions,
} from "#/core/http/http-success.js";

/**
 * HTTP 200 OK response class.
 * Use this for successful GET, PUT, PATCH operations.
 *
 * @example
 * ```typescript
 * // Simple success
 * return new OkResponse()
 *
 * // With message
 * return new OkResponse('Operation completed')
 *
 * // With data
 * return new OkResponse({ id: 1, name: 'John' })
 *
 * // With message and data
 * return new OkResponse('User retrieved', { id: 1, name: 'John' })
 *
 * // With options (meta, links, cookies)
 * return new OkResponse({ id: 1 }, {
 *   meta: { cached: true },
 *   links: { update: { href: '/api/users/1', method: 'PATCH' } }
 * })
 * ```
 */
export class OkResponse<T = unknown> extends HttpSuccess<T> {
  constructor();

  constructor(message: string, options?: HttpSuccessOptions);

  constructor(data: T, options?: HttpSuccessOptions);

  constructor(message: string, data: T, options?: HttpSuccessOptions);

  constructor(
    messageOrData?: string | T,
    dataOrOptions?: T | HttpSuccessOptions,
    options?: HttpSuccessOptions,
  ) {
    // No arguments
    if (
      messageOrData === undefined &&
      dataOrOptions === undefined &&
      options === undefined
    ) {
      super("Operation completed successfully", 200);
      return;
    }

    // Only message or message with options
    if (
      typeof messageOrData === "string" &&
      (dataOrOptions === undefined ||
        (dataOrOptions instanceof Object &&
          ("meta" in dataOrOptions ||
            "cookies" in dataOrOptions ||
            "setCookieHeaders" in dataOrOptions ||
            "clearCookies" in dataOrOptions ||
            "links" in dataOrOptions)))
    ) {
      super(messageOrData, 200, dataOrOptions as HttpSuccessOptions);
      return;
    }

    // Only data or data with options
    if (typeof messageOrData !== "string") {
      super(messageOrData as T, 200, dataOrOptions as HttpSuccessOptions);
      return;
    }

    // Message and data, or message, data and options
    if (
      typeof messageOrData === "string" &&
      typeof dataOrOptions !== "undefined" &&
      !(
        dataOrOptions instanceof Object &&
        ("meta" in dataOrOptions ||
          "cookies" in dataOrOptions ||
          "setCookieHeaders" in dataOrOptions ||
          "clearCookies" in dataOrOptions ||
          "links" in dataOrOptions)
      )
    ) {
      super(messageOrData, dataOrOptions as T, 200, options);
      return;
    }

    throw new Error("Invalid constructor parameters");
  }
}
