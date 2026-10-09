import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Expose, Type } from "class-transformer";
import {
  DateTransformer,
  DateTransformerValueDto,
  EnumTransformer,
  type EnumTransformerValueDto,
} from "#/core/decorators/index.js";
import {
  type AccountType,
  AccountType as AccountTypeValues,
  type UserStatus,
  UserStatus as UserStatusValues,
} from "#database/enums.js";

export class GetMeLinkedProviderDto {
  @ApiProperty({ type: Number, example: 1 })
  @Expose()
  id!: number;

  @ApiProperty({ enum: AccountTypeValues })
  @Expose()
  @EnumTransformer({ enumType: "AccountType" })
  type!: EnumTransformerValueDto<AccountType>;

  @ApiProperty({ type: DateTransformerValueDto })
  @Expose()
  @DateTransformer({ format: "dd MMMM yyyy HH:mm" })
  createdAt!: DateTransformerValueDto<string>;
}

/** Güncel KVKK onay durumu (yürürlükteki metin sürümüne göre). */
export class GetMeConsentsDto {
  @ApiProperty({ type: Boolean })
  @Expose()
  privacyNotice!: boolean;

  @ApiProperty({ type: Boolean })
  @Expose()
  termsOfUse!: boolean;

  @ApiProperty({
    type: Boolean,
    description: "Yurt dışındaki yapay zekâ servisine aktarım rızası (Pro anlatım)",
  })
  @Expose()
  crossBorderTransfer!: boolean;
}

export class GetMeResDto {
  @ApiProperty({ type: Number, example: 1 })
  @Expose()
  id!: number;

  @ApiProperty()
  @Expose()
  email!: string;

  @ApiPropertyOptional({ type: String, nullable: true })
  @Expose()
  name!: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  @Expose()
  surname!: string | null;

  @ApiProperty()
  @Expose()
  username!: string;

  @ApiPropertyOptional({ type: String, nullable: true })
  @Expose()
  bio!: string | null;

  @ApiProperty({ enum: UserStatusValues })
  @Expose()
  @EnumTransformer({ enumType: "UserStatus" })
  status!: EnumTransformerValueDto<UserStatus>;

  @ApiProperty()
  @Expose()
  isEmailVerified!: boolean;

  @ApiPropertyOptional({ type: DateTransformerValueDto, nullable: true })
  @Expose()
  @DateTransformer({ format: "dd MMMM yyyy HH:mm" })
  lastLoginAt!: DateTransformerValueDto<string> | null;

  @ApiPropertyOptional({ enum: AccountTypeValues, nullable: true })
  @Expose()
  @EnumTransformer({ enumType: "AccountType" })
  lastLoginMethod!: EnumTransformerValueDto<AccountType> | null;

  @ApiProperty({ type: [GetMeLinkedProviderDto] })
  @Expose()
  @Type(() => GetMeLinkedProviderDto)
  linkedProviders!: GetMeLinkedProviderDto[];

  @ApiProperty({ type: () => GetMeConsentsDto })
  @Expose()
  @Type(() => GetMeConsentsDto)
  consents!: GetMeConsentsDto;
}
