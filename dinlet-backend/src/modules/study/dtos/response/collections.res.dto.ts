import { ApiProperty } from "@nestjs/swagger";
import { Expose, Type } from "class-transformer";

import { FolderResDto } from "./folder.res.dto.js";
import { StudyGoalResDto } from "./study-goal.res.dto.js";
import { TagResDto } from "./tag.res.dto.js";

/** "Klasörlerin" ekranı tek istekte: hedef, klasörler, etiketler. */
export class CollectionsResDto {
  @ApiProperty({ type: () => StudyGoalResDto, nullable: true })
  @Expose()
  @Type(() => StudyGoalResDto)
  goal!: StudyGoalResDto | null;

  @ApiProperty({ type: () => [FolderResDto] })
  @Expose()
  @Type(() => FolderResDto)
  folders!: FolderResDto[];

  @ApiProperty({ type: () => [TagResDto] })
  @Expose()
  @Type(() => TagResDto)
  tags!: TagResDto[];

  @ApiProperty({ type: Number, example: 4, description: "★ Favoriler" })
  @Expose()
  favoritesCount!: number;

  @ApiProperty({
    type: Number,
    example: 5,
    description: "Son 7 günde eklenen not",
  })
  @Expose()
  thisWeekCount!: number;

  @ApiProperty({ type: Number, example: 2, description: "Klasörü olmayan not" })
  @Expose()
  unfiledCount!: number;
}
