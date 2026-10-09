export type JobParams = Record<string, unknown>;
export type JobMetadata = Record<string, unknown>;

export interface JobExecutionResult {
  affectedRows: number;
  metadata?: JobMetadata;
}

export abstract class AbstractJobHandler {
  abstract getJobCode(): string;
  abstract execute(params?: JobParams): Promise<JobExecutionResult>;
}
