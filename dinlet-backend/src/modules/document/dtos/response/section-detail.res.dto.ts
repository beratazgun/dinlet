import { ApiProperty } from "@nestjs/swagger";
import { Expose, Type } from "class-transformer";

import { CdnUrl } from "#/core/decorators/index.js";

import { PlaybackProgressResDto } from "./playback-progress.res.dto.js";
import { SectionSummaryResDto } from "./section-summary.res.dto.js";
import { MnemonicResDto, SectionQuestionResDto } from "./study-tools.res.dto.js";

/** Kullanıcının kendi sesiyle kaydı (oynatıcı Dinlet sesi yerine bunu çalar). */
export class OwnVoiceResDto {
  @CdnUrl({ source: "audioKey", description: "Birleşik kayıt (MP3)" })
  audioUrl!: string;

  @ApiProperty({ type: Number })
  @Expose()
  durationMs!: number;

  @ApiProperty({
    type: Number,
    nullable: true,
    description: "Sondaki tekrar özetinin süresi (özet kapalıyken atlanır)",
  })
  @Expose()
  recapDurationMs!: number | null;
}

/** Bölüm detayı: ses + ekranda okumak için metin (`GET /sections/:id`). */
export class SectionDetailResDto extends SectionSummaryResDto {
  @ApiProperty({ type: Number, example: 1 })
  @Expose()
  documentId!: number;

  @ApiProperty({ type: Number, nullable: true, description: "Bayt" })
  @Expose()
  sizeBytes!: number | null;

  @ApiProperty({
    type: [String],
    description: "Seslendirilen paragraflar; metin hazır değilse boş",
  })
  @Expose()
  paragraphs!: string[];

  @ApiProperty({
    type: String,
    nullable: true,
    description: "Bölüm sonu tekrar özeti",
  })
  @Expose()
  recap!: string | null;

  @ApiProperty({
    type: String,
    description: "PDF'ten çıkarılan ham not metni (Markdown); \"Orijinal not\" görünümü",
  })
  @Expose()
  sourceText!: string;

  @ApiProperty({ type: String, nullable: true })
  @Expose()
  failureReason!: string | null;

  @ApiProperty({
    type: () => PlaybackProgressResDto,
    nullable: true,
    description: "Kullanıcının bu bölümde kaldığı yer; hiç dinlemediyse `null`",
  })
  @Expose()
  @Type(() => PlaybackProgressResDto)
  playback!: PlaybackProgressResDto | null;

  @ApiProperty({
    type: () => [SectionQuestionResDto],
    description: "Bölüm sonu soruları (akıcı anlatımda); yoksa boş",
  })
  @Expose()
  @Type(() => SectionQuestionResDto)
  questions!: SectionQuestionResDto[];

  @ApiProperty({
    type: () => [MnemonicResDto],
    description: "Saklanan ve sesi hazır hafıza kancaları (bölüm sonunda okunur)",
  })
  @Expose()
  @Type(() => MnemonicResDto)
  mnemonics!: MnemonicResDto[];

  @ApiProperty({
    type: () => OwnVoiceResDto,
    nullable: true,
    description:
      "Kendi sesinle kayıt (ses tercihi \"Benim sesim\" ve kayıt hazırsa); yoksa `null`",
  })
  @Expose()
  @Type(() => OwnVoiceResDto)
  ownVoice!: OwnVoiceResDto | null;
}
