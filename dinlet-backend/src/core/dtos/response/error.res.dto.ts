import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { ValidationErrorDetailDto } from "#/core/dtos/response/index.js";
import type {
  ProblemDetails,
  ValidationErrorDetail,
} from "#/types/api-error.type.js";

export class ErrorResDto implements ProblemDetails {
  @ApiProperty({ type: Boolean, example: false })
  success: false;

  @ApiProperty({
    type: String,
    example: "https://datatracker.ietf.org/doc/html/rfc9110#section-15.5.1",
  })
  type: string;

  @ApiProperty({ type: String, example: "Bad Request" })
  title: string;

  @ApiProperty({ type: Number, example: 400 })
  status: number;

  @ApiProperty({ type: String, example: "Hatalı istek" })
  message: string;

  @ApiProperty({ type: String, example: "/api/v1/auth/login" })
  path: string;

  @ApiProperty({
    type: String,
    format: "date-time",
    example: "2024-01-30T20:00:00.000Z",
  })
  timestamp: string;

  @ApiPropertyOptional({ type: () => [ValidationErrorDetailDto] })
  errors: ValidationErrorDetail[];

  @ApiPropertyOptional({ type: "object", additionalProperties: true })
  data?: Record<string, unknown>;
}
