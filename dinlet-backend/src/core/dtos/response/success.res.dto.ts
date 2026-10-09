import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class HateoasLinkDto {
  @ApiProperty({
    type: String,
    example: "http://localhost:3000/api/v1/resource",
  })
  href: string;

  @ApiProperty({ type: String, example: "GET" })
  method: string;
}

export class HateoasLinksDto {
  @ApiProperty({ type: HateoasLinkDto })
  self: HateoasLinkDto;

  @ApiPropertyOptional({ type: HateoasLinkDto })
  first?: HateoasLinkDto;

  @ApiPropertyOptional({ type: HateoasLinkDto })
  last?: HateoasLinkDto;

  @ApiPropertyOptional({ type: HateoasLinkDto })
  next?: HateoasLinkDto;

  @ApiPropertyOptional({ type: HateoasLinkDto })
  prev?: HateoasLinkDto;
}

export class SuccessResDto {
  @ApiProperty({ type: Boolean, example: true })
  success: boolean;

  @ApiProperty({ type: Number, example: 200 })
  status: number;

  @ApiProperty({ type: String, example: "İşlem başarıyla tamamlandı" })
  message: string;

  @ApiProperty({
    type: String,
    format: "date-time",
    example: "2024-01-31T12:00:00.000Z",
  })
  timestamp: string;

  @ApiProperty({ type: String, example: "/api/v1/resource" })
  path: string;

  @ApiPropertyOptional({ type: HateoasLinksDto })
  _links?: HateoasLinksDto;
}
