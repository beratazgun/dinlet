import { Injectable } from '@nestjs/common';

export interface HateoasLink {
  href: string;
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
}

export interface HateoasLinks {
  self: HateoasLink;
  first?: HateoasLink;
  last?: HateoasLink;
  next?: HateoasLink;
  prev?: HateoasLink;
  [key: string]: HateoasLink | undefined;
}

export interface RequestContextData {
  baseUrl: string;
  fullUrl: string;
  path: string;
  method: string;
  query: Record<string, any>;
}

/**
 * Request Context Service for HATEOAS-compliant URL generation.
 * Places request context data that can be accessed throughout the request lifecycle.
 *
 * @example
 * ```typescript
 * // In a service or paginator
 * const context = RequestContextService.getContext();
 * const nextUrl = RequestContextService.buildUrl('/users', { page: 2, limit: 10 });
 * ```
 */
@Injectable()
export class RequestContextService {
  private static currentContext: RequestContextData | undefined;

  /**
   * Sets the current request context
   */
  static setContext(context: RequestContextData): void {
    this.currentContext = context;
  }

  /**
   * Clears the current request context
   */
  static clearContext(): void {
    this.currentContext = undefined;
  }

  /**
   * Runs a callback within a request context (legacy support)
   */
  static run<T>(context: RequestContextData, callback: () => T): T {
    this.setContext(context);
    return callback();
  }

  /**
   * Gets the current request context
   */
  static getContext(): RequestContextData | undefined {
    return this.currentContext;
  }

  /**
   * Gets the base URL (protocol + host)
   */
  static getBaseUrl(): string | undefined {
    return this.getContext()?.baseUrl;
  }

  /**
   * Gets the full current URL including query parameters
   */
  static getFullUrl(): string | undefined {
    return this.getContext()?.fullUrl;
  }

  /**
   * Gets the current path without query parameters
   */
  static getPath(): string | undefined {
    return this.getContext()?.path;
  }

  /**
   * Gets the HTTP method of the current request
   */
  static getMethod(): string | undefined {
    return this.getContext()?.method;
  }

  /**
   * Builds a full URL from a path and optional query parameters
   *
   * @param path - The path to append to base URL (e.g., '/users/1')
   * @param queryParams - Optional query parameters to add
   * @returns Full URL string or null if context is not available
   */
  static buildUrl(
    path: string,
    queryParams?: Record<string, string | number | boolean | null | undefined>,
  ): string | null {
    const baseUrl = this.getBaseUrl();
    if (!baseUrl) return null;

    const url = new URL(path, baseUrl);

    if (queryParams) {
      Object.entries(queryParams).forEach(([key, value]) => {
        if (value !== null && value !== undefined) {
          url.searchParams.set(key, String(value));
        }
      });
    }

    return url.toString();
  }

  /**
   * Builds a URL based on current path with modified query parameters
   *
   * @param queryParams - Query parameters to set (replaces existing)
   * @returns Full URL string or null if context is not available
   */
  static buildCurrentUrlWithParams(
    queryParams: Record<string, string | number | boolean | null | undefined>,
  ): string | null {
    const context = this.getContext();
    if (!context) return null;

    const url = new URL(context.fullUrl);

    Object.entries(queryParams).forEach(([key, value]) => {
      if (value !== null && value !== undefined) {
        url.searchParams.set(key, String(value));
      } else {
        url.searchParams.delete(key);
      }
    });

    return url.toString();
  }

  /**
   * Creates HATEOAS links for a single resource
   *
   * @param resourcePath - Base path of the resource (e.g., '/api/users')
   * @param resourceId - ID of the resource
   * @param options - Additional options for link generation
   * @returns HATEOAS links object
   */
  static buildResourceLinks(
    resourcePath: string,
    resourceId: string | number,
    options?: {
      includeUpdate?: boolean;
      includeDelete?: boolean;
      additionalLinks?: Record<
        string,
        { path: string; method: HateoasLink['method'] }
      >;
    },
  ): Partial<HateoasLinks> | null {
    const baseUrl = this.getBaseUrl();
    if (!baseUrl) return null;

    const selfUrl = this.buildUrl(`${resourcePath}/${resourceId}`);
    const collectionUrl = this.buildUrl(resourcePath);

    const links: Partial<HateoasLinks> = {};

    if (selfUrl) {
      links.self = { href: selfUrl, method: 'GET' };
    }

    if (collectionUrl) {
      links.collection = { href: collectionUrl, method: 'GET' };
    }

    if (options?.includeUpdate && selfUrl) {
      links.update = { href: selfUrl, method: 'PATCH' };
    }

    if (options?.includeDelete && selfUrl) {
      links.delete = { href: selfUrl, method: 'DELETE' };
    }

    if (options?.additionalLinks) {
      Object.entries(options.additionalLinks).forEach(([key, value]) => {
        const url = this.buildUrl(value.path);
        if (url) {
          links[key] = { href: url, method: value.method };
        }
      });
    }

    return links;
  }
}
