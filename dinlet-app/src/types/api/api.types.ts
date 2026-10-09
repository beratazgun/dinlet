import type { HttpStatusCodeType } from "@/constants/http-status";
import type { components, paths } from "./api-schema";

/**
 * TypeScript type hover'da flattened gösterim için utility type
 */
type Prettify<T> = {
  [K in keyof T]: T[K];
} & {};

/**
 * ─────────────────────────────────────────────────────────────────────────
 * OpenAPI Helper Tipleri
 * ─────────────────────────────────────────────────────────────────────────
 * Aşağıdaki tipler api-schema.d.ts içindeki 'paths' ve 'operations'
 * yapılarını kullanarak otomatik tip çıkarımı sağlar.
 */

/** Mevcut tüm API path'leri */
type ApiPaths = keyof paths;

/** Seçili path için desteklenen HTTP metodları */
type ApiMethods<P extends ApiPaths> = keyof paths[P] &
  ("get" | "post" | "put" | "delete" | "patch");

type ExtractContent<R> = R extends { content: { "application/json": infer T } }
  ? T
  : R extends { content: { "*/*": infer T } }
    ? T
    : unknown;

/**
 * API endpoint'ın tipini döndürür.
 */
export type ApiEndpoint<P extends ApiPaths, M extends ApiMethods<P>> = {
  PathParams: ApiPathParams<P, M>;
  SuccessResponse: ApiSuccessResponse<P, M>;
  ErrorResponse: ApiErrorResponse<P, M>;
  Body: ApiBody<P, M>;
  Query: ApiQuery<P, M>;
  /**
   * Başarılı yanıtın `data` alanı.
   *
   * İçeriksiz (204 / `content: never`) yanıtlarda doğrudan indexleme derleme
   * hatası verdiği için koşullu erişim kullanılır.
   */
  Data: ApiSuccessResponse<P, M> extends { data?: infer D } ? D : never;
};

/**
 * API Success Response Type
 * Sadece başarılı yanıtları (200, 201, 202, 204) döndürür.
 *
 * Kullanım: ApiSuccessResponse<"/api/v1/auth/me", "get">
 */
type ApiSuccessResponse<P extends ApiPaths, M extends ApiMethods<P>> = paths[P][M] extends {
  responses: infer R;
}
  ? Prettify<
      {
        [K in keyof R]: K extends 200 | "200" | 201 | "201" | 202 | "202" | 204 | "204"
          ? ExtractContent<R[K]>
          : never;
      }[keyof R]
    >
  : never;

/**
 * API Error Response Type
 * Sadece hata yanıtlarını (200, 201, 202, 204 dışındaki status kodları) döndürür.
 *
 * Kullanım: ApiErrorResponse<"/api/v1/auth/me", "get">
 */
type ApiErrorResponse<P extends ApiPaths, M extends ApiMethods<P>> = paths[P][M] extends {
  responses: infer R;
}
  ? Prettify<
      {
        [K in keyof R]: K extends 200 | "200" | 201 | "201" | 202 | "202" | 204 | "204"
          ? never
          : K extends HttpStatusCodeType | `${HttpStatusCodeType}`
            ? ExtractContent<R[K]>
            : never;
      }[keyof R]
    >
  : never;

/**
 * API Request Body Tipi
 * Kullanım: ApiBody<"/api/v1/auth/login", "post">
 */
type ApiBody<P extends ApiPaths, M extends ApiMethods<P>> = paths[P][M] extends {
  requestBody?: { content: { "application/json": infer T } };
}
  ? T
  : paths[P][M] extends {
        requestBody?: { content: { "multipart/form-data": infer T } };
      }
    ? T
    : never;

/**
 * API Query Parametreleri Tipi
 * Kullanım: ApiQuery<"/api/v1/auth/me", "get">
 */
type ApiQuery<P extends ApiPaths, M extends ApiMethods<P>> = paths[P][M] extends {
  parameters: { query?: infer T };
}
  ? T
  : never;

/**
 * API Path Parametreleri Tipi
 * Kullanım: ApiPathParams<"/api/v1/auth/users/{id}", "get">
 */
type ApiPathParams<P extends ApiPaths, M extends ApiMethods<P>> = paths[P][M] extends {
  parameters: { path: infer T };
}
  ? T
  : never;

/**
 * ─────────────────────────────────────────────────────────────────────────
 * Component Schema Helper'ları
 * ─────────────────────────────────────────────────────────────────────────
 */

/**
 * Component schema'dan type extract eder
 */
export type ApiSchema<T extends keyof components["schemas"]> = components["schemas"][T];
