import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
} from "@nestjs/common";
import { JobService } from "#/infra/job/job.service.js";
import { CreateJobBodyDto } from "#/infra/job/dtos/create-job-body.dto.js";
import { UpdateJobBodyDto } from "#/infra/job/dtos/update-job-body.dto.js";
import {
  ApiBody,
  ApiOperation,
  ApiTags,
  ApiCookieAuth,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiBadRequestResponse,
  ApiUnauthorizedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
} from "@nestjs/swagger";
import { AppAbility } from "#/core/casl/index.js";
import { CheckPolicies, TrackChanges } from "#/core/decorators/index.js";

/**
 * Job yönetimi için admin controller.
 * Job'ları listeleme, oluşturma, güncelleme ve manuel çalıştırma işlemlerini sağlar.
 */
@ApiTags("job")
@Controller("jobs")
@ApiCookieAuth()
export class JobController {
  constructor(private readonly jobService: JobService) {}

  /**
   * Tüm job'ları listele.
   */
  @Get()
  @ApiOperation({ summary: "Jobları listele" })
  @CheckPolicies((ability: AppAbility) => ability.can("list", "Job"))
  @ApiResponse({ status: 200, description: "Joblar başarıyla listelendi" })
  @ApiUnauthorizedResponse({ description: "Yetkilendirme gerekli" })
  @ApiForbiddenResponse({ description: "Bu işlem için yetkiniz yok" })
  async list() {
    return this.jobService.list();
  }

  /**
   * Belirli bir job'u getir.
   */
  @Get(":code")
  @ApiOperation({ summary: "Bir job'u getir" })
  @CheckPolicies((ability: AppAbility) => ability.can("read", "Job"))
  @ApiParam({ name: "code", type: String, description: "Job kodu" })
  @ApiResponse({ status: 200, description: "Job başarıyla getirildi" })
  @ApiBadRequestResponse({ description: "Geçersiz job kodu" })
  @ApiUnauthorizedResponse({ description: "Yetkilendirme gerekli" })
  @ApiForbiddenResponse({ description: "Bu işlem için yetkiniz yok" })
  @ApiNotFoundResponse({ description: "Job bulunamadı" })
  async get(@Param("code") code: string) {
    return this.jobService.get(code);
  }

  /**
   * Yeni job oluştur.
   */
  @Post()
  @ApiOperation({ summary: "Yeni job oluştur" })
  @CheckPolicies((ability: AppAbility) => ability.can("create", "Job"))
  @ApiBody({ type: CreateJobBodyDto })
  @ApiResponse({ status: 201, description: "Job oluşturuldu" })
  @ApiBadRequestResponse({ description: "Geçersiz istek parametreleri" })
  @ApiUnauthorizedResponse({ description: "Yetkilendirme gerekli" })
  @ApiForbiddenResponse({ description: "Bu işlem için yetkiniz yok" })
  async create(@Body() data: CreateJobBodyDto) {
    return this.jobService.create(data);
  }

  /**
   * Job'u güncelle.
   */
  @Patch(":code")
  @ApiOperation({ summary: "Bir job'u güncelle" })
  @CheckPolicies((ability: AppAbility) => ability.can("update", "Job"))
  @TrackChanges({ model: "Job" })
  @ApiBody({ type: UpdateJobBodyDto })
  @ApiParam({ name: "code", type: String, description: "Job kodu" })
  @ApiResponse({ status: 200, description: "Job güncellendi" })
  @ApiBadRequestResponse({ description: "Geçersiz istek parametreleri" })
  @ApiUnauthorizedResponse({ description: "Yetkilendirme gerekli" })
  @ApiForbiddenResponse({ description: "Bu işlem için yetkiniz yok" })
  @ApiNotFoundResponse({ description: "Job bulunamadı" })
  async update(@Param("code") code: string, @Body() data: UpdateJobBodyDto) {
    return this.jobService.update(code, data);
  }

  /**
   * Job'u manuel olarak çalıştır.
   */
  @Post(":code/run")
  @ApiOperation({ summary: "Bir job'u manuel olarak çalıştır" })
  @CheckPolicies((ability: AppAbility) => ability.can("run", "Job"))
  @ApiParam({ name: "code", type: String, description: "Job kodu" })
  @ApiResponse({ status: 200, description: "Job manuel olarak çalıştırıldı" })
  @ApiBadRequestResponse({ description: "Geçersiz job kodu" })
  @ApiUnauthorizedResponse({ description: "Yetkilendirme gerekli" })
  @ApiForbiddenResponse({ description: "Bu işlem için yetkiniz yok" })
  @ApiNotFoundResponse({ description: "Job bulunamadı" })
  async runManually(@Param("code") code: string) {
    return this.jobService.runManually(code);
  }

  /**
   * Job'u aktif/pasif yap.
   */
  @Patch(":code/toggle")
  @ApiOperation({ summary: "Bir job'u aktif/pasif yap" })
  @CheckPolicies((ability: AppAbility) => ability.can("toggle", "Job"))
  @TrackChanges({ model: "Job" })
  @ApiParam({ name: "code", type: String, description: "Job kodu" })
  @ApiResponse({ status: 200, description: "Job durumu değiştirildi" })
  @ApiBadRequestResponse({ description: "Geçersiz job kodu" })
  @ApiUnauthorizedResponse({ description: "Yetkilendirme gerekli" })
  @ApiForbiddenResponse({ description: "Bu işlem için yetkiniz yok" })
  @ApiNotFoundResponse({ description: "Job bulunamadı" })
  async toggleJob(@Param("code") code: string) {
    return this.jobService.toggleJob(code);
  }

  /**
   * Job execution geçmişini getir.
   */
  @Get(":code/executions")
  @ApiOperation({ summary: "Bir job'un execution geçmişini getir" })
  @CheckPolicies((ability: AppAbility) => ability.can("read", "Job"))
  @ApiParam({ name: "code", type: String, description: "Job kodu" })
  @ApiQuery({
    name: "limit",
    type: String,
    required: false,
    description: "Limit sayısı",
  })
  @ApiResponse({ status: 200, description: "Job execution geçmişi getirildi" })
  @ApiBadRequestResponse({ description: "Geçersiz job kodu veya limit" })
  @ApiUnauthorizedResponse({ description: "Yetkilendirme gerekli" })
  @ApiForbiddenResponse({ description: "Bu işlem için yetkiniz yok" })
  @ApiNotFoundResponse({ description: "Job bulunamadı" })
  async getJobExecutions(
    @Param("code") code: string,
    @Query("limit") limit?: string,
  ) {
    return this.jobService.getJobExecutions(code, limit);
  }
}
