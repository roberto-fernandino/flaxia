/** Tipos do engine compartilhados com o frontend web (ver `types/engine/responses.ts` lá). */
export type { ColumnFieldType, Field, FieldColumn, FieldType } from '@/lib/projects';

export interface OcrWord {
  text: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface OcrPage {
  pageNumber: number;
  width: number;
  height: number;
  words: OcrWord[];
}

export enum ProcessingJobsStatus {
  Processing = 'processing',
  WaitingValidation = 'waiting_validation',
  Completed = 'completed',
  Failed = 'failed',
  Rejected = 'rejected',
}

export interface ProcessingJob {
  processJobId: string;
  processingJobBatchId?: string | null;
  result: Record<string, unknown> | null;
  userId: string;
  documentId: string | null;
  pagesCount: number;
  finishedAt: string | null;
  startedAt: string;
  status: ProcessingJobsStatus | string;
  isValidating?: boolean;
  documentValidated?: boolean;
  validatedAt?: string | null;
  hasDocument?: boolean;
  documentFileName?: string | null;
  documentFileType?: string | null;
  ocrData?: OcrPage[] | null;
}

export interface AuditEvent {
  auditEventId: string;
  processJobId: string;
  userId: string;
  eventType: string;
  eventData?: Record<string, unknown>;
  elementId?: string;
  elementType?: string;
  description: string;
  createdAt: string;
}
