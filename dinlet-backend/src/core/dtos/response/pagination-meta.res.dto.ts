import { ApiProperty } from "@nestjs/swagger";
import { Expose, Transform } from "class-transformer";

export class PaginationMetaResDto {
  @ApiProperty({ type: Number, example: 1 })
  @Expose()
  page: number;

  @ApiProperty({ type: Number, example: 10 })
  @Expose()
  limit: number;

  @ApiProperty({ type: Number, example: 100 })
  @Expose()
  totalDocs: number;

  @ApiProperty({ type: Number, example: 10 })
  @Expose()
  totalPages: number;

  @ApiProperty({ type: Number, nullable: true, example: 2 })
  @Expose()
  nextPage: number | null;

  @ApiProperty({ type: Number, nullable: true, example: null })
  @Expose()
  prevPage: number | null;

  @ApiProperty({ type: Boolean, example: true })
  @Expose()
  hasNextPage: boolean;

  @ApiProperty({ type: Boolean, example: false })
  @Expose()
  hasPrevPage: boolean;

  @ApiProperty({
    type: String,
    nullable: true,
    example: "http://localhost:3000/api/v1/auth/sessions?page=2",
  })
  @Expose()
  @Transform(({ obj }) => obj._links?.next?.href || null)
  nextUrl: string | null;

  @ApiProperty({ type: String, nullable: true, example: null })
  @Expose()
  @Transform(({ obj }) => obj._links?.prev?.href || null)
  prevUrl: string | null;
}
