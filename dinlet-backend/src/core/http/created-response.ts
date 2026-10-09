import {
  HttpSuccess,
  type HttpSuccessOptions,
} from "#/core/http/http-success.js";

/**
 * HTTP 201 Created response class.
 * Use this for successful POST operations that create a new resource.
 *
 * @example
 * ```typescript
 * // With created resource
 * return new CreatedResponse({ id: 1, name: 'John' })
 *
 * // With message and data
 * return new CreatedResponse('User created successfully', { id: 1, name: 'John' })
 *
 * // With HATEOAS links
 * return new CreatedResponse({ id: 1 }, {
 *   links: {
 *     self: { href: '/api/users/1', method: 'GET' },
 *     update: { href: '/api/users/1', method: 'PATCH' }
 *   }
 * })
 * ```
 */
export class CreatedResponse<T = unknown> extends HttpSuccess<T> {
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
      super("Resource created successfully", 201);
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
      super(messageOrData, 201, dataOrOptions as HttpSuccessOptions);
      return;
    }

    // Only data or data with options
    if (typeof messageOrData !== "string") {
      super(messageOrData as T, 201, dataOrOptions as HttpSuccessOptions);
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
      super(messageOrData, dataOrOptions as T, 201, options);
      return;
    }

    throw new Error("Invalid constructor parameters");
  }
}
