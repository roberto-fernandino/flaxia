import { API_BASE_URL, apiRequest } from '@/lib/api';
import type { AuditEvent, ProcessingJob } from '@/lib/engine/types';
import type { ClassDocument } from '@/lib/projects';

type T = string | null | undefined;
const tk = (token: T) => token ?? undefined;
const json = (body: unknown) => JSON.stringify(body);

/** Endpoints da tela de resultado — espelha `engineApi` do frontend web. */
export const resultApi = {
  job: (token: T, id: string) => apiRequest<ProcessingJob>(`/engine/processing_jobs/${id}`, {}, tk(token)),
  batch: (token: T, batchId: string) =>
    apiRequest<{ jobs?: ProcessingJob[] }>(`/engine/processing_job_batches/${batchId}`, {}, tk(token)),
  classes: (token: T) => apiRequest<ClassDocument[]>('/engine/documents', {}, tk(token)),
  updateResult: (token: T, id: string, result: Record<string, unknown>) =>
    apiRequest(`/engine/processing_jobs/${id}/result`, { method: 'PUT', body: json({ result }) }, tk(token)),
  markValidated: (token: T, id: string) =>
    apiRequest(`/engine/processing_jobs/${id}/mark_validated`, { method: 'PATCH' }, tk(token)),
  markRejected: (token: T, id: string) =>
    apiRequest(`/engine/processing_jobs/${id}/mark_rejected`, { method: 'PATCH' }, tk(token)),
  refreshOcr: (token: T, id: string) =>
    apiRequest(`/engine/processing_jobs/${id}/refresh_ocr`, { method: 'POST' }, tk(token)),
  claimLock: (token: T, id: string) => apiRequest(`/engine/processing_jobs/${id}/lock`, { method: 'POST' }, tk(token)),
  heartbeatLock: (token: T, id: string) =>
    apiRequest(`/engine/processing_jobs/${id}/lock/heartbeat`, { method: 'POST' }, tk(token)),
  releaseLock: (token: T, id: string) => apiRequest(`/engine/processing_jobs/${id}/lock`, { method: 'DELETE' }, tk(token)),
  auditEvents: (token: T, id: string) =>
    apiRequest<{ auditEvents?: AuditEvent[]; audit_events?: AuditEvent[] }>(`/engine/audit_events/${id}`, {}, tk(token)),
  createAuditEvent: (
    token: T,
    event: { processJobId: string; eventType: string; description: string; elementId?: string; elementType?: string; eventData?: Record<string, unknown> },
  ) => apiRequest('/engine/audit_events', { method: 'POST', body: json(event) }, tk(token)),
  validationMetrics: (token: T, id: string, metrics: { durationMs: number; mouseClicks: number; keyPresses: number }) =>
    apiRequest(`/engine/processing_jobs/${id}/validation_metrics`, { method: 'PUT', body: json(metrics) }, tk(token)),
  documentUrl: (id: string) => `${API_BASE_URL}/engine/processing_job/${id}/document`,
};
