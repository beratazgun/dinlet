import type { ProblemDetails } from "#/types/api-error.type.js";
import * as common from "@nestjs/common";
import { FastifyReply, FastifyRequest } from "fastify";
import {
  hasClearCookies,
  TooManyAttemptsException,
} from "#/core/exceptions/index.js";

/**
 * HTTP Exception Filter that returns RFC 7807 Problem Details format.
 * Ensures consistency with success responses by including success and timestamp fields.
 */
@common.Catch(common.HttpException)
export class HttpExceptionFilter implements common.ExceptionFilter {
  catch(exception: common.HttpException, host: common.ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<FastifyReply>();
    const request = ctx.getRequest<FastifyRequest>();
    const status = exception.getStatus();
    const exceptionResponse: any = exception.getResponse();

    const { error, message, errors, statusCode, ...rest } =
      typeof exceptionResponse === "object" && exceptionResponse !== null
        ? exceptionResponse
        : { error: undefined, message: exceptionResponse, errors: undefined };

    const data = Object.keys(rest).length > 0 ? rest : undefined;

    const problemDetails: ProblemDetails = {
      success: false,
      type: this.getType(status),
      title: error || this.getTitle(status),
      status: status,
      message: message || exception.message,
      path: request.url,
      timestamp: new Date().toISOString(),
      errors: errors || undefined,
      data,
    };

    // SecurityBreachException gibi HasClearCookies uygulayan hatalar,
    // istemcide ölü cookie bırakmamak için silinecek cookie'leri taşır.
    if (hasClearCookies(exception)) {
      for (const cookie of exception.clearCookies) {
        if (typeof cookie === "string") {
          response.clearCookie(cookie);
        } else {
          response.clearCookie(cookie.name, cookie.options);
        }
      }
    }

    if (exception instanceof TooManyAttemptsException) {
      response.header("retry-after", String(exception.retryAfterSeconds));
    }

    response
      .status(status)
      .type("application/problem+json")
      .send(problemDetails);
  }

  private getTitle(status: number): string {
    const titles: Record<number, string> = {
      [common.HttpStatus.BAD_REQUEST]: "Bad Request",
      [common.HttpStatus.UNAUTHORIZED]: "Unauthorized",
      [common.HttpStatus.FORBIDDEN]: "Forbidden",
      [common.HttpStatus.NOT_FOUND]: "Not Found",
      [common.HttpStatus.METHOD_NOT_ALLOWED]: "Method Not Allowed",
      [common.HttpStatus.CONFLICT]: "Conflict",
      [common.HttpStatus.UNPROCESSABLE_ENTITY]: "Unprocessable Entity",
      [common.HttpStatus.TOO_MANY_REQUESTS]: "Too Many Requests",
      [common.HttpStatus.INTERNAL_SERVER_ERROR]: "Internal Server Error",
      [common.HttpStatus.BAD_GATEWAY]: "Bad Gateway",
      [common.HttpStatus.SERVICE_UNAVAILABLE]: "Service Unavailable",
      [common.HttpStatus.GATEWAY_TIMEOUT]: "Gateway Timeout",
    };
    return titles[status] || "Unknown Error";
  }

  private getType(status: number): string {
    // RFC 9110 HTTP Semantics references
    const mapping: Record<number, string> = {
      400: "https://datatracker.ietf.org/doc/html/rfc9110#section-15.5.1",
      401: "https://datatracker.ietf.org/doc/html/rfc9110#section-15.5.2",
      403: "https://datatracker.ietf.org/doc/html/rfc9110#section-15.5.4",
      404: "https://datatracker.ietf.org/doc/html/rfc9110#section-15.5.5",
      405: "https://datatracker.ietf.org/doc/html/rfc9110#section-15.5.6",
      409: "https://datatracker.ietf.org/doc/html/rfc9110#section-15.5.10",
      422: "https://datatracker.ietf.org/doc/html/rfc9110#section-15.5.21",
      429: "https://datatracker.ietf.org/doc/html/rfc6585#section-4",
      500: "https://datatracker.ietf.org/doc/html/rfc9110#section-15.6.1",
      502: "https://datatracker.ietf.org/doc/html/rfc9110#section-15.6.3",
      503: "https://datatracker.ietf.org/doc/html/rfc9110#section-15.6.4",
      504: "https://datatracker.ietf.org/doc/html/rfc9110#section-15.6.5",
    };
    return mapping[status] || "about:blank";
  }
}
