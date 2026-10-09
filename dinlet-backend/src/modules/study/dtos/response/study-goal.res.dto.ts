import { ApiProperty } from "@nestjs/swagger";
import { Expose } from "class-transformer";

/** "KPSS hedefi · 38 gün kaldı · 12 belgenin 7'sini bitirdin · Günde ~35 dk". */
export class StudyGoalResDto {
  @ApiProperty({ type: String, example: "KPSS" })
  @Expose()
  examName!: string;

  @ApiProperty({ type: String, example: "2026-11-16" })
  @Expose()
  examDate!: string;

  @ApiProperty({
    type: Number,
    example: 38,
    description: "Sınava kalan gün (bugün sınav günüyse 0, geçtiyse negatif)",
  })
  @Expose()
  daysLeft!: number;

  @ApiProperty({ type: Number, example: 12 })
  @Expose()
  documentCount!: number;

  @ApiProperty({ type: Number, example: 7 })
  @Expose()
  finishedCount!: number;

  @ApiProperty({ type: Number, minimum: 0, maximum: 100, example: 58 })
  @Expose()
  progressPercent!: number;

  @ApiProperty({
    type: Number,
    example: 79_800_000,
    description:
      "Tüm notları bitirmek için kalan dinleme (hazır olmayanlar tahmini)",
  })
  @Expose()
  remainingListenMs!: number;

  @ApiProperty({
    type: Number,
    nullable: true,
    example: 35,
    description:
      "Yetişmek için günde dinlenecek dakika; iş kalmadıysa veya sınav geçtiyse `null`",
  })
  @Expose()
  dailyMinutes!: number | null;
}
