import { ApiProperty } from "@nestjs/swagger";
import { Expose, Transform } from "class-transformer";

/** İmleçli (keyset) listelerin `meta.pagination` şekli. Toplam sayı bilerek yoktur. */
export class CursorPaginationMetaResDto {
  @ApiProperty({ type: Number, example: 20 })
  @Expose()
  limit: number;

  @ApiProperty({
    type: String,
    nullable: true,
    example: "WyIyMDI2LTEwLTA0IDEyOjAwOjAwLjEyMzQ1NiswMCIsNDJd",
  })
  @Expose()
  nextCursor: string | null;

  @ApiProperty({ type: Boolean, example: true })
  @Expose()
  hasNextPage: boolean;

  @ApiProperty({
    type: String,
    nullable: true,
    example:
      "http://localhost:3000/api/v1/audit-logs?limit=20&cursor=WyIyMDI2LTEwLTA0IDEyOjAwOjAwLjEyMzQ1NiswMCIsNDJd",
  })
  @Expose()
  @Transform(({ obj }) => obj._links?.next?.href || null)
  nextUrl: string | null;
}
