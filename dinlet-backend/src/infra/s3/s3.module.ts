import { Global, Module } from "@nestjs/common";
import { S3Service } from "#/infra/s3/s3.service.js";

@Global()
@Module({
  providers: [S3Service],
  exports: [S3Service],
})
export class S3Module {}
