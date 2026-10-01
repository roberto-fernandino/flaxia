import { apiRequest } from '@/lib/api';

/** Espelha os tipos do frontend web (Projetos / workspace de classificador). */
export type FieldType = 'string' | 'numbers' | 'currency' | 'datetime' | 'table';
export type ColumnFieldType = Exclude<FieldType, 'table'>;

export type FieldColumn = {
  columnName: string;
  displayName?: string;
  columnType?: ColumnFieldType;
  columnPrompt?: string;
};

export type Field = {
  fieldName: string;
  fieldPrompt?: string;
  fieldType?: FieldType;
  fieldIndex?: number;
  displayName?: string;
  columns?: FieldColumn[];
};

export enum DocumentProcessMethod {
  Fields = 1,
  Prompt = 2,
}

export type ExportTarget = 'db' | 'webhook';

export type ClassDocument = {
  documentId: string;
  documentType: string;
  displayName: string;
  description?: string;
  fields?: Field[] | null;
  prompt?: string | null;
  documentProcessMethod: DocumentProcessMethod | string;
  isValidating?: boolean;
  minValidationConfidence?: number | null;
  exportEnabled?: boolean;
  exportTargets?: ExportTarget[];
};

export type ClassifierSummary = { classifierId: string; name: string; modelsCount: number };
export type ClassifierDetail = {
  classifierId: string;
  name: string;
  models: { classifierId: string; documentId: string }[];
};

export type ClassificationStatus = 'unclassified' | 'processing' | 'classified' | 'failed';

export type ProjectDocument = {
  projectDocumentId: string;
  classifierId: string;
  fileName: string;
  mimeType: string;
  documentId?: string | null;
  processingJobId?: string | null;
  classificationStatus: ClassificationStatus;
  createdAt: string;
  updatedAt: string;
  documentDisplayName?: string | null;
  jobStatus?: string | null;
  jobResult?: Record<string, unknown> | null;
};

export type SuggestClassResponse = {
  suggestedDocumentId: string;
  displayName: string;
  documentType: string;
  description: string;
  advice: string;
  usedInProjects: string[];
  isLinkedToProject: boolean;
};

export type MatchedClassConflict = {
  documentId: string;
  displayName: string;
  documentType?: string;
  description?: string;
  advice?: string;
  usedInProjects?: string[];
  isLinkedToProject?: boolean;
};

export type ClassDraft = {
  documentType: string;
  displayName: string;
  description: string;
  fields: Field[];
  exportTargets: ExportTarget[];
};

type T = string | null | undefined;
const json = (body: unknown) => JSON.stringify(body);
const tk = (token: T) => token ?? undefined;

export const projectsApi = {
  list: (token: T) => apiRequest<ClassifierSummary[]>('/engine/classifiers', {}, tk(token)),
  create: (token: T, name: string) =>
    apiRequest<string>('/engine/classifiers', { method: 'POST', body: json({ name }) }, tk(token)),
  get: (token: T, id: string) => apiRequest<ClassifierDetail>(`/engine/classifiers/${id}`, {}, tk(token)),
  remove: (token: T, id: string) => apiRequest<boolean>(`/engine/classifiers/${id}`, { method: 'DELETE' }, tk(token)),
  upsertModels: (token: T, id: string, items: { documentId: string }[]) =>
    apiRequest(`/engine/classifiers/${id}/models`, { method: 'PUT', body: json({ items }) }, tk(token)),
  documents: (token: T, id: string) =>
    apiRequest<ProjectDocument[]>(`/engine/classifiers/${id}/documents`, {}, tk(token)),
  upload: (
    token: T,
    id: string,
    body: { base64Document: string; mimeType: string; fileName: string; skipAutoClassify?: boolean },
  ) =>
    apiRequest<{ projectDocumentId: string }>(
      `/engine/classifiers/${id}/documents`,
      { method: 'POST', body: json(body) },
      tk(token),
    ),
  reprocessClass: (token: T, id: string, documentId: string) =>
    apiRequest<{ reprocessedCount: number }>(
      `/engine/classifiers/${id}/documents/reprocess`,
      { method: 'POST', body: json({ documentId }) },
      tk(token),
    ),
  classify: (token: T, projectDocumentId: string, force?: boolean) =>
    apiRequest(
      `/engine/project_documents/${projectDocumentId}/classify`,
      { method: 'POST', body: json(force ? { force: true } : {}) },
      tk(token),
    ),
  suggestClass: (token: T, projectDocumentId: string) =>
    apiRequest<SuggestClassResponse>(
      `/engine/project_documents/${projectDocumentId}/suggest_class`,
      { method: 'POST', body: json({}) },
      tk(token),
    ),
  autoCreateClass: (token: T, projectDocumentId: string, force: boolean) =>
    apiRequest(
      `/engine/project_documents/${projectDocumentId}/auto_create_class`,
      { method: 'POST', body: json({ force }) },
      tk(token),
    ),
  useExistingClass: (token: T, projectDocumentId: string, documentId: string) =>
    apiRequest(
      `/engine/project_documents/${projectDocumentId}/use_existing_class`,
      { method: 'POST', body: json({ documentId }) },
      tk(token),
    ),
  deleteDocument: (token: T, projectDocumentId: string) =>
    apiRequest(`/engine/project_documents/${projectDocumentId}`, { method: 'DELETE' }, tk(token)),
  classes: (token: T) => apiRequest<ClassDocument[]>('/engine/documents', {}, tk(token)),
  createClass: (token: T, draft: ClassDraft) =>
    apiRequest<ClassDocument>(
      '/engine/create_manual_document',
      {
        method: 'POST',
        body: json({
          documentType: draft.documentType,
          displayName: draft.displayName,
          description: draft.description,
          fields: draft.fields,
          prompt: null,
          documentProcessMethod: DocumentProcessMethod.Fields,
          isValidating: true,
          exportEnabled: true,
          exportTargets: draft.exportTargets,
        }),
      },
      tk(token),
    ),
  updateClass: (token: T, body: Record<string, unknown>) =>
    apiRequest('/engine/update_document', { method: 'PUT', body: json(body) }, tk(token)),
  job: (token: T, processJobId: string) =>
    apiRequest<{ result?: Record<string, unknown> | null }>(`/engine/processing_jobs/${processJobId}`, {}, tk(token)),
};

/** Classe global de sistema (ver `UNCLASSIFIED_DOCUMENT_ID` no backend). */
export const UNCLASSIFIED_DOCUMENT_ID = '00000000-0000-0000-0000-0000000000c1';

export const filterVisibleClasses = <D extends { documentId?: string | null }>(docs: readonly D[]) =>
  docs.filter((d) => d.documentId !== UNCLASSIFIED_DOCUMENT_ID);

export const isUnclassifiedDocument = (doc: { classificationStatus: string; documentId?: string | null }) =>
  doc.classificationStatus === 'unclassified' || doc.documentId === UNCLASSIFIED_DOCUMENT_ID;

/** Tempo sem atualização antes de considerar o documento preso em processamento. */
export const PROCESSING_STUCK_THRESHOLD_MS = 60_000;

export function isDocumentProcessingStuck(doc: Pick<ProjectDocument, 'classificationStatus' | 'updatedAt'>, now = Date.now()) {
  if (doc.classificationStatus === 'failed') return true;
  if (doc.classificationStatus !== 'processing') return false;
  const updatedAt = new Date(doc.updatedAt).getTime();
  if (Number.isNaN(updatedAt)) return true;
  return now - updatedAt >= PROCESSING_STUCK_THRESHOLD_MS;
}

export function normalizeProcessMethod(method: ClassDocument['documentProcessMethod'] | undefined) {
  if (typeof method === 'string') {
    return method.toLowerCase() === 'prompt' ? DocumentProcessMethod.Prompt : DocumentProcessMethod.Fields;
  }
  return method ?? DocumentProcessMethod.Fields;
}

export const FIELD_TYPE_OPTIONS: { value: FieldType; label: string; icon: string }[] = [
  { value: 'string', label: 'Texto', icon: 'Aa' },
  { value: 'numbers', label: 'Números', icon: '#' },
  { value: 'currency', label: 'Moeda', icon: '$' },
  { value: 'datetime', label: 'Data/hora', icon: '◷' },
  { value: 'table', label: 'Tabela', icon: '▦' },
];

export const fieldTypeOption = (type?: FieldType) =>
  FIELD_TYPE_OPTIONS.find((o) => o.value === type) ?? FIELD_TYPE_OPTIONS[0];

export const toSnakeCase = (value: string) =>
  value.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');

/** Coluna semeada ao trocar um campo para tabela — tabela sem coluna não persiste. */
export const defaultTableColumn = (index = 0): FieldColumn => ({
  columnName: `coluna_${index + 1}`,
  displayName: `Coluna ${index + 1}`,
  columnType: 'string',
});

export const newField = (index: number, withPrompt = false): Field => ({
  fieldName: `field_${index + 1}`,
  displayName: `Field ${index + 1}`,
  fieldType: 'string',
  ...(withPrompt ? { fieldPrompt: '' } : {}),
  fieldIndex: index,
});

/** Troca o tipo do campo; tabela nasce com pelo menos uma coluna. */
export const withFieldType = (field: Field, type: FieldType): Field => ({
  ...field,
  fieldType: type,
  ...(type === 'table' ? { columns: field.columns?.length ? field.columns : [defaultTableColumn()] } : {}),
});

export type TableRow = Record<string, string>;

const CONFIDENCE_FIELD_KEY = 'confidence';

const isConfidenceKey = (key: string) => key.toLowerCase() === CONFIDENCE_FIELD_KEY;

/** Valores escalares exibidos por campo (tabelas ficam em `tableRowsFromResult`). */
export function scalarValuesFromResult(result: Record<string, unknown> | null | undefined, fields: Field[]) {
  const out: Record<string, string> = {};
  if (!result) return out;
  const tables = new Set(fields.filter((f) => f.fieldType === 'table').map((f) => f.fieldName));
  for (const [key, value] of Object.entries(result)) {
    if (isConfidenceKey(key) || tables.has(key)) continue;
    out[key] = value == null ? '' : typeof value === 'object' ? JSON.stringify(value) : String(value);
  }
  return out;
}

export function tableRowsFromResult(result: Record<string, unknown> | null | undefined, field: Field): TableRow[] {
  const raw = result?.[field.fieldName];
  if (!Array.isArray(raw)) return [];
  const columns = field.columns ?? [];
  return raw.map((row) => {
    const source = (row && typeof row === 'object' ? row : {}) as Record<string, unknown>;
    const complete: TableRow = {};
    for (const column of columns) {
      const v = source[column.columnName];
      complete[column.columnName] = v == null ? '' : String(v);
    }
    return complete;
  });
}

export const errorStatus = (e: unknown) => (e as { status?: number } | null)?.status;
export const errorMessage = (e: unknown, fallback: string) => (e instanceof Error && e.message ? e.message : fallback);

const CLASS_COLORS = ['#f43f5e', '#10b981', '#0ea5e9', '#f59e0b', '#8b5cf6', '#06b6d4', '#f97316', '#6366f1'];
export function classColor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return CLASS_COLORS[Math.abs(hash) % CLASS_COLORS.length];
}

/** Tamanho máximo de upload (mesmo limite total do web). */
export const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;
export const SUPPORTED_MIME_TYPES = ['application/pdf', 'image/png', 'image/jpeg', 'image/webp', 'image/gif'];
