import {
  HttpSuccess,
  type HttpSuccessOptions,
} from "#/core/http/http-success.js";

/**
 * HTTP 204 No Content response class.
 * Use this for successful DELETE operations or updates that don't return data.
 *
 * @example
 * ```typescript
 * // Simple no content
 * return new NoContentResponse()
 *
 * // With message (won't be visible in response body)
 * return new NoContentResponse('Resource deleted')
 * ```
 */
export class NoContentResponse extends HttpSuccess<void> {
  constructor(message?: string, options?: HttpSuccessOptions) {
    super(message || "Operation completed, no content", 204, options);
  }
}
