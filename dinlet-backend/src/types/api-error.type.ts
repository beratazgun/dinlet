export interface ValidationErrorDetail {
  field: string;
  message: string;
  code?: string;
}

/**
 * RFC 7807 Problem Details with additional fields for consistency.
 * @see https://datatracker.ietf.org/doc/html/rfc7807
 */
export interface ProblemDetails {
  /** Always false for error responses */
  success: false;
  /** URI reference that identifies the problem type */
  type: string;
  /** Short, human-readable summary of the problem */
  title: string;
  /** HTTP status code */
  status: number;
  /** Human-readable explanation specific to this occurrence */
  message: string | string[];
  /** URI reference that identifies the specific occurrence */
  path: string;
  /** ISO 8601 timestamp of when the error occurred */
  timestamp: string;
  /** Validation errors list (optional) */
  errors?: ValidationErrorDetail[];
  /** Domain-specific extension data (RFC 7807 extension members) */
  data?: Record<string, unknown>;
  /** List of cookies that should be cleared by the client (optional) */
  clearCookies?: string[];
}
