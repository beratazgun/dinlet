import {
  HttpSuccess,
  type HttpSuccessOptions,
} from "#/core/http/http-success.js";

/**
 * HTTP 202 Accepted response class.
 * Use this for async operations that have been accepted for processing.
 *
 * @example
 * ```typescript
 * // Simple accepted
 * return new AcceptedResponse()
 *
 * // With job/task info
 * return new AcceptedResponse({ jobId: 'abc123', status: 'processing' })
 *
 * // With status check link
 * return new AcceptedResponse({ jobId: 'abc123' }, {
 *   links: {
 *     status: { href: '/api/jobs/abc123', method: 'GET' }
 *   }
 * })
 * ```
 */
export class AcceptedResponse<T = unknown> extends HttpSuccess<T> {
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
      super("Request accepted for processing", 202);
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
      super(messageOrData, 202, dataOrOptions as HttpSuccessOptions);
      return;
    }

    // Only data or data with options
    if (typeof messageOrData !== "string") {
      super(messageOrData as T, 202, dataOrOptions as HttpSuccessOptions);
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
      super(messageOrData, dataOrOptions as T, 202, options);
      return;
    }

    throw new Error("Invalid constructor parameters");
  }
}
