import {
  type RequestContextData,
  RequestContextService,
} from "#/core/context/index.js";
import type { Cookies } from "#/types/response/base-response.type.js";
import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
  RequestTimeoutException,
} from "@nestjs/common";
import { HttpException } from "@nestjs/common/exceptions/http.exception";
import { FastifyReply, FastifyRequest } from "fastify";
import { Observable, throwError, TimeoutError } from "rxjs";
import { catchError, map, timeout } from "rxjs/operators";
import { HttpSuccess } from "#/core/http/index.js";

declare module "fastify" {
  interface FastifyRequest {
    context?: RequestContextData;
  }
}

@Injectable()
export class ResponseInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const req = context.switchToHttp().getRequest<FastifyRequest>();
    const res = context.switchToHttp().getResponse<FastifyReply>();

    const host = (req.headers.host as string) || "localhost";
    const protocol = req.protocol || "http";
    const baseUrl = `${protocol}://${host}`;
    const fullUrl = `${baseUrl}${req.url}`;
    const path = req.url.split("?")[0];

    // Build request context for HATEOAS
    const requestContext: RequestContextData = {
      baseUrl,
      fullUrl,
      path,
      method: req.method,
      query: req.query as Record<string, any>,
    };

    // Place context in request object for reliable access
    req.context = requestContext;

    // Also set in RequestContextService for backward compatibility
    RequestContextService.setContext(requestContext);

    return next.handle().pipe(
      timeout(10000),
      catchError((err) => {
        if (err instanceof TimeoutError) {
          return throwError(() => new RequestTimeoutException());
        }

        return throwError(() => err);
      }),
      map((response) => {
        if (response instanceof HttpSuccess) {
          res.status(response.getStatus());

          const cookies = response.getCookies();
          const setCookieHeaders = response.getSetCookieHeaders();
          const clearCookies = response.getClearCookies();

          if (cookies && cookies.length > 0) {
            cookies.forEach((cookie: Cookies) => {
              res.setCookie(cookie.name, cookie.value, cookie.options);
            });
          }

          if (setCookieHeaders && setCookieHeaders.length > 0) {
            res.header("Set-Cookie", setCookieHeaders);
          }

          const responseData = response.getResponse();

          if (clearCookies && clearCookies.length > 0) {
            const clearCookieNames: string[] = [];
            clearCookies.forEach((clearCookie) => {
              res.clearCookie(clearCookie.name, clearCookie.options);
              clearCookieNames.push(clearCookie.name);
            });

            if (clearCookieNames.length > 0) {
              (responseData as any).clearCookies = clearCookieNames;
            }
          }

          return responseData;
        }

        if (response instanceof HttpException) {
          res.status(response.getStatus());

          return response.getResponse();
        }

        return response;
      }),
    );
  }
}
