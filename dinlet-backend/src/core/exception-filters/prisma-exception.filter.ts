import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpStatus,
} from "@nestjs/common";
import type { FastifyReply, FastifyRequest } from "fastify";

import type { ProblemDetails } from "#/types/api-error.type.js";

interface PrismaStructuredError {
  code: string;
  message?: string;
  why?: string;
  fix?: string;
}

function isPrismaStructuredError(
  error: unknown,
): error is PrismaStructuredError {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    typeof (error as { code?: unknown }).code === "string"
  );
}

@Catch()
export class PrismaExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    if (!isPrismaStructuredError(exception)) throw exception;

    const context = host.switchToHttp();
    const response = context.getResponse<FastifyReply>();
    const request = context.getRequest<FastifyRequest>();
    const status = this.statusFor(exception.code);
    const body: ProblemDetails = {
      success: false,
      type: "https://www.prisma.io/docs/orm/reference/error-reference",
      title: status === HttpStatus.CONFLICT ? "Conflict" : "Database Error",
      status,
      message:
        exception.why ?? exception.message ?? "Database operation failed",
      path: request.url,
      timestamp: new Date().toISOString(),
      data:
        process.env.NODE_ENV === "development"
          ? { code: exception.code, fix: exception.fix }
          : { code: exception.code },
    };

    response.status(status).type("application/problem+json").send(body);
  }

  private statusFor(code: string): number {
    return /UNIQUE|CONFLICT|DUPLICATE/i.test(code)
      ? HttpStatus.CONFLICT
      : HttpStatus.INTERNAL_SERVER_ERROR;
  }
}
