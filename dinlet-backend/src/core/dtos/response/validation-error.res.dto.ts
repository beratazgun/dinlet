import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import type {
  ProblemDetails,
  ValidationErrorDetail,
} from "#/types/api-error.type.js";

export class ValidationErrorDetailDto implements ValidationErrorDetail {
  @ApiProperty({ type: String, example: "email" })
  field: string;

  @ApiProperty({ type: String, example: "Email formatı geçersiz" })
  message: string;

  @ApiPropertyOptional({ type: String, example: "isEmail" })
  code: string;
}

export class ValidationErrorResDto implements ProblemDetails {
  @ApiProperty({ type: Boolean, example: false })
  success: false;

  @ApiProperty({
    type: String,
    example: "https://datatracker.ietf.org/doc/html/rfc9110#section-15.5.21",
  })
  type: string;

  @ApiProperty({ type: String, example: "Unprocessable Entity" })
  title: string;

  @ApiProperty({ type: Number, example: 422 })
  status: number;

  @ApiProperty({ type: String, example: "Girdi doğrulama hatası" })
  message: string;

  @ApiProperty({ type: String, example: "/api/v1/auth/register" })
  path: string;

  @ApiProperty({
    type: String,
    format: "date-time",
    example: "2024-01-30T20:00:00.000Z",
  })
  timestamp: string;

  @ApiProperty({ type: [ValidationErrorDetailDto] })
  errors: ValidationErrorDetailDto[];
}
