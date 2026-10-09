import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from "@nestjs/common";
import { JobRepository } from "#/infra/job/repository/job.repository.js";
import { CreateJobBodyDto } from "#/infra/job/dtos/create-job-body.dto.js";
import { UpdateJobBodyDto } from "#/infra/job/dtos/update-job-body.dto.js";
import { JobSchedulerService } from "#/infra/job/services/index.js";
import { OkResponse } from "#/core/http/index.js";
import { EnvType } from "#config/env.validation.js";
import { ConfigService } from "@nestjs/config";

/**
 * Job yönetimi için service.
 * Business logic'i burada yönetir.
 */
@Injectable()
export class JobService {
  constructor(
    private readonly jobRepository: JobRepository,
    private readonly jobScheduler: JobSchedulerService,
    private readonly configService: ConfigService<EnvType>,
  ) {}

  /**
   * Tüm job'ları listele.
   */
  async list() {
    const jobs = await this.jobRepository.findAll();

    return new OkResponse(jobs);
  }

  /**
   * Belirli bir job'u getir.
   */
  async get(code: string) {
    const job = await this.jobRepository.findByCode(code);

    if (!job) {
      throw new NotFoundException(`Job not found: ${code}`);
    }
    return new OkResponse(job);
  }

  /**
   * Yeni job oluştur.
   */
  async create(data: CreateJobBodyDto) {
    const createdJob = await this.jobScheduler.createJob(data);

    return new OkResponse(createdJob);
  }

  /**
   * Job'u güncelle.
   */
  async update(code: string, data: UpdateJobBodyDto) {
    const updatedJob = await this.jobScheduler.updateJob(code, data);

    return new OkResponse(updatedJob);
  }

  /**
   * Job'u manuel olarak çalıştır.
   */
  async runManually(code: string) {
    const node_env = this.configService.get("NODE_ENV", { infer: true });

    try {
      await this.jobScheduler.runJobManually(code);
    } catch (error) {
      if (error instanceof NotFoundException) {
        throw error;
      }

      throw new InternalServerErrorException(
        `Job çalıştırılamadı: ${error instanceof Error && node_env === "development" ? error.message : "Bilinmeyen hata"}`,
      );
    }

    return new OkResponse("Job Tetiklendi");
  }

  /**
   * Job'u aktif/pasif yap.
   */
  async toggleJob(code: string) {
    const job = await this.jobRepository.findByCode(code);

    if (!job) {
      throw new NotFoundException(`Job not found: ${code}`);
    }

    if (job.isActive) {
      await this.jobScheduler.stopJob(code);
    } else {
      await this.jobScheduler.startJob(code);
    }

    return this.jobRepository.findByCode(code);
  }

  /**
   * Job execution geçmişini getir.
   */
  async getJobExecutions(code: string, limit?: string) {
    const job = await this.jobRepository.findByCode(code);

    if (!job) {
      throw new NotFoundException(`Job not found: ${code}`);
    }

    const limitNumber = limit ? parseInt(limit, 10) : 50;
    const history = await this.jobRepository.findExecutionsByJobId(
      job.id,
      limitNumber,
    );

    return new OkResponse(history);
  }
}
