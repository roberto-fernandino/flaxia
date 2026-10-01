import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '@/auth/AuthContext';
import {
  ClassDocument,
  ClassDraft,
  ClassifierDetail,
  DocumentProcessMethod,
  MatchedClassConflict,
  ProjectDocument,
  SuggestClassResponse,
  errorStatus,
  filterVisibleClasses,
  isDocumentProcessingStuck,
  projectsApi,
} from '@/lib/projects';
import type { ClassEdit } from './manage-classes';
import { PickedFile, readBase64 } from './pick-file';
import type { Toast } from './ui';

export type FlowPhase = 'idle' | 'uploading' | 'checking_match' | 'creating_class';
export type FlowState = { phase: FlowPhase; fileName: string; projectDocumentId?: string };
type MatchChoice = 'use_existing' | 'create_new' | 'cancel';

const idle: FlowState = { phase: 'idle', fileName: '' };
const POLL_MS = 5_000;

const FLOW_HINTS: Record<FlowPhase, string> = {
  idle: '',
  uploading: 'Enviando documento…',
  checking_match: 'Verificando classes existentes…',
  creating_class: 'Criando classe com IA…',
};

const conflictToMatch = (d: MatchedClassConflict): SuggestClassResponse => ({
  suggestedDocumentId: d.documentId,
  displayName: d.displayName,
  documentType: d.documentType ?? '',
  description: d.description ?? '',
  advice: d.advice ?? '',
  usedInProjects: d.usedInProjects ?? [],
  isLinkedToProject: d.isLinkedToProject ?? false,
});

/**
 * Estado e ações do workspace de um projeto — porta mobile de
 * `ProjectWorkspace` + `WorkspaceFlowContext` do frontend web.
 * O stream SSE de jobs do web vira polling enquanto houver processamento.
 */
export function useProjectWorkspace(classifierId: string) {
  const { token } = useAuth();
  const [classifier, setClassifier] = useState<ClassifierDetail | null>(null);
  const [documents, setDocuments] = useState<ProjectDocument[]>([]);
  const [classes, setClasses] = useState<ClassDocument[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [toast, setToast] = useState<Toast | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [removedIds, setRemovedIds] = useState<Set<string>>(() => new Set());
  const [jobResult, setJobResult] = useState<{ jobId: string; result: Record<string, unknown> | null } | null>(null);
  const [flow, setFlow] = useState<FlowState>(idle);
  const [pendingUpload, setPendingUpload] = useState<string | null>(null);
  const [busy, setBusy] = useState<Record<string, boolean>>({});
  const [match, setMatch] = useState<SuggestClassResponse | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const matchResolver = useRef<((c: MatchChoice) => void) | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const notify = useCallback((status: Toast['status'], message: string) => {
    setToast({ status, message });
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 4000);
  }, []);
  useEffect(() => () => { if (toastTimer.current) clearTimeout(toastTimer.current); }, []);

  const setBusyKey = (key: string, value: boolean) => setBusy((b) => ({ ...b, [key]: value }));

  const refetchClassifier = useCallback(async () => {
    try {
      const r = await projectsApi.get(token, classifierId);
      setClassifier(r.data ?? null);
      setNotFound(!r.data);
    } catch (e) {
      if (errorStatus(e) === 404) setNotFound(true);
    }
  }, [classifierId, token]);

  const refetchDocuments = useCallback(async () => {
    try {
      const r = await projectsApi.documents(token, classifierId);
      setDocuments(r.data ?? []);
    } catch {
      // mantém a lista anterior; próxima atualização tenta de novo
    }
  }, [classifierId, token]);

  const refetchClasses = useCallback(async () => {
    try {
      const r = await projectsApi.classes(token);
      setClasses(r.data ?? []);
    } catch {
      // idem
    }
  }, [token]);

  const refetchAll = useCallback(async () => {
    await Promise.all([refetchClassifier(), refetchDocuments(), refetchClasses()]);
    setLoaded(true);
  }, [refetchClassifier, refetchDocuments, refetchClasses]);

  useFocusEffect(
    useCallback(() => {
      void refetchAll();
    }, [refetchAll]),
  );

  // Remove da lista otimista os ids que o servidor já não retorna mais.
  useEffect(() => {
    setRemovedIds((prev) => {
      if (prev.size === 0) return prev;
      const next = new Set([...prev].filter((id) => documents.some((d) => d.projectDocumentId === id)));
      return next.size === prev.size ? prev : next;
    });
  }, [documents]);

  const activeDocuments = useMemo(() => documents.filter((d) => !removedIds.has(d.projectDocumentId)), [documents, removedIds]);

  const selectedDocumentId = useMemo(() => {
    if (selectedId && activeDocuments.some((d) => d.projectDocumentId === selectedId)) return selectedId;
    return activeDocuments[0]?.projectDocumentId ?? null;
  }, [selectedId, activeDocuments]);

  const selectedDocument = useMemo(() => activeDocuments.find((d) => d.projectDocumentId === selectedDocumentId) ?? null, [activeDocuments, selectedDocumentId]);

  const isEarlyFlow = flow.phase !== 'idle';
  const hasProcessing = activeDocuments.some((d) => d.classificationStatus === 'processing' || d.jobStatus === 'processing');

  // Polling substitui o stream SSE do web: atualiza enquanto algo processa.
  useEffect(() => {
    if (!hasProcessing && !isEarlyFlow) return;
    const interval = setInterval(() => {
      setNow(Date.now());
      void refetchDocuments();
    }, POLL_MS);
    return () => clearInterval(interval);
  }, [hasProcessing, isEarlyFlow, refetchDocuments]);

  const processJobId = selectedDocument?.processingJobId ?? null;
  const jobStatusKey = `${selectedDocument?.jobStatus ?? ''}-${selectedDocument?.updatedAt ?? ''}`;
  useEffect(() => {
    if (!processJobId || selectedDocument?.jobResult) return;
    let cancelled = false;
    projectsApi
      .job(token, processJobId)
      .then((r) => { if (!cancelled) setJobResult({ jobId: processJobId, result: r.data?.result ?? null }); })
      .catch(() => undefined);
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [processJobId, jobStatusKey, token]);

  const originalResult: Record<string, unknown> | null =
    (selectedDocument?.jobResult as Record<string, unknown> | null | undefined) ??
    (jobResult && jobResult.jobId === processJobId ? jobResult.result : null) ??
    null;

  const visibleClasses = useMemo(() => filterVisibleClasses(classes), [classes]);
  const linkedIds = useMemo(() => new Set(classifier?.models?.map((m) => m.documentId) ?? []), [classifier]);
  const linkedDocuments = useMemo(() => visibleClasses.filter((d) => linkedIds.has(d.documentId)), [visibleClasses, linkedIds]);
  const availableDocuments = useMemo(() => visibleClasses.filter((d) => !linkedIds.has(d.documentId)), [visibleClasses, linkedIds]);

  const selectDocument = useCallback((id: string) => setSelectedId(id), []);

  // ---------- Documentos ----------

  const uploadDocument = useCallback(
    async (file: PickedFile) => {
      setPendingUpload(file.name);
      try {
        const r = await projectsApi.upload(token, classifierId, { base64Document: await readBase64(file), mimeType: file.mimeType || 'application/octet-stream', fileName: file.name });
        if (r.data) {
          await refetchDocuments();
          setSelectedId(r.data.projectDocumentId);
          notify('success', 'Documento enviado');
        }
      } catch (e) {
        notify('error', errorStatus(e) === 409 ? 'Este arquivo já foi enviado neste projeto.' : 'Falha no envio');
      } finally {
        setPendingUpload(null);
      }
    },
    [classifierId, notify, refetchDocuments, token],
  );

  const reclassify = useCallback(
    async (projectDocumentId: string, kind: 'reclassify' | 'reprocess' = 'reclassify') => {
      setBusyKey(`classify:${projectDocumentId}`, true);
      try {
        await projectsApi.classify(token, projectDocumentId, true);
        notify('success', kind === 'reclassify' ? 'Documento reclassificado' : 'Processamento reiniciado');
        await Promise.all([refetchDocuments(), refetchClassifier()]);
      } catch {
        notify('error', kind === 'reclassify' ? 'Falha na reclassificação' : 'Falha ao reiniciar o processamento');
      } finally {
        setBusyKey(`classify:${projectDocumentId}`, false);
      }
    },
    [notify, refetchClassifier, refetchDocuments, token],
  );

  const deleteDocument = useCallback(
    async (doc: ProjectDocument) => {
      setBusyKey('delete', true);
      try {
        await projectsApi.deleteDocument(token, doc.projectDocumentId);
        setRemovedIds((prev) => new Set(prev).add(doc.projectDocumentId));
        if (selectedDocumentId === doc.projectDocumentId) {
          const remaining = activeDocuments.filter((d) => d.projectDocumentId !== doc.projectDocumentId);
          setSelectedId(remaining[0]?.projectDocumentId ?? null);
        }
        notify('success', 'Documento removido');
        void refetchDocuments();
      } catch {
        notify('error', 'Falha ao remover documento');
      } finally {
        setBusyKey('delete', false);
      }
    },
    [activeDocuments, notify, refetchDocuments, selectedDocumentId, token],
  );

  const deleteProject = useCallback(async () => {
    setBusyKey('deleteProject', true);
    try {
      await projectsApi.remove(token, classifierId);
      notify('success', 'Projeto excluído');
      return true;
    } catch {
      notify('error', 'Falha ao excluir o projeto');
      return false;
    } finally {
      setBusyKey('deleteProject', false);
    }
  }, [classifierId, notify, token]);

  // ---------- Fluxo "criar classe com IA" ----------

  const askMatchChoice = useCallback(
    (m: SuggestClassResponse) =>
      new Promise<MatchChoice>((resolve) => {
        matchResolver.current = resolve;
        setMatch(m);
      }),
    [],
  );

  const resolveMatch = useCallback((choice: MatchChoice) => {
    setMatch(null);
    matchResolver.current?.(choice);
    matchResolver.current = null;
  }, []);

  const finishFlow = useCallback(
    async (message: string) => {
      await Promise.all([refetchClassifier(), refetchDocuments(), refetchClasses()]);
      notify('success', message);
      setFlow(idle);
    },
    [notify, refetchClassifier, refetchClasses, refetchDocuments],
  );

  const applyExistingClass = useCallback(
    async (m: SuggestClassResponse, projectDocumentId: string) => {
      if (m.isLinkedToProject) await projectsApi.classify(token, projectDocumentId, true);
      else await projectsApi.useExistingClass(token, projectDocumentId, m.suggestedDocumentId);
      await finishFlow('Documento classificado com a classe existente');
    },
    [finishFlow, token],
  );

  const runPipeline = useCallback(
    async (projectDocumentId: string, initialForce: boolean): Promise<void> => {
      setFlow((f) => ({ ...f, phase: 'creating_class', projectDocumentId }));
      // 409 = IA encontrou classe equivalente; "criar nova" repete forçando.
      for (let force = initialForce; ; force = true) {
        try {
          await projectsApi.autoCreateClass(token, projectDocumentId, force);
          break;
        } catch (e) {
          const data = (e as { body?: { data?: MatchedClassConflict } }).body?.data;
          if (errorStatus(e) !== 409 || !data?.documentId || !data?.displayName) throw e;
          const choice = await askMatchChoice(conflictToMatch(data));
          if (choice === 'cancel') { setFlow(idle); return; }
          if (choice === 'use_existing') { await applyExistingClass(conflictToMatch(data), projectDocumentId); return; }
        }
      }
      await finishFlow('Classe criada e vinculada — extraindo campos em segundo plano');
    },
    [applyExistingClass, askMatchChoice, finishFlow, token],
  );

  const continueAfterUpload = useCallback(
    async (projectDocumentId: string) => {
      setFlow((f) => ({ ...f, phase: 'checking_match', projectDocumentId }));
      try {
        const r = await projectsApi.suggestClass(token, projectDocumentId);
        const m = r.data;
        if (m?.suggestedDocumentId) {
          const choice = await askMatchChoice(m);
          if (choice === 'cancel') { setFlow(idle); return; }
          if (choice === 'use_existing') { await applyExistingClass(m, projectDocumentId); return; }
          await runPipeline(projectDocumentId, true);
          return;
        }
      } catch {
        // segue para criação com IA se o suggest falhar
      }
      await runPipeline(projectDocumentId, false);
    },
    [applyExistingClass, askMatchChoice, runPipeline, token],
  );

  const startAutoCreateFlow = useCallback(
    (file: PickedFile) => {
      setFlow({ phase: 'uploading', fileName: file.name });
      void (async () => {
        try {
          const r = await projectsApi.upload(token, classifierId, { base64Document: await readBase64(file), mimeType: file.mimeType || 'application/octet-stream', fileName: file.name, skipAutoClassify: true });
          if (!r.data) throw new Error('upload failed');
          const projectDocumentId = r.data.projectDocumentId;
          setFlow({ phase: 'uploading', fileName: file.name, projectDocumentId });
          setSelectedId(projectDocumentId);
          void refetchDocuments();
          await continueAfterUpload(projectDocumentId);
        } catch (e) {
          setFlow(idle);
          notify('error', errorStatus(e) === 409 ? 'Este documento já existe no projeto' : 'Falha na criação automática');
        }
      })();
    },
    [classifierId, continueAfterUpload, notify, refetchDocuments, token],
  );

  const startAutoCreateFromExisting = useCallback(
    (projectDocumentId: string, fileName: string) => {
      if (flow.phase !== 'idle') return;
      setFlow({ phase: 'checking_match', fileName, projectDocumentId });
      setSelectedId(projectDocumentId);
      void (async () => {
        try {
          await continueAfterUpload(projectDocumentId);
        } catch {
          setFlow(idle);
          notify('error', 'Falha na criação automática');
        }
      })();
    },
    [continueAfterUpload, flow.phase, notify],
  );

  // ---------- Classes do projeto ----------

  const classifyUnclassifiedDocs = useCallback(async () => {
    for (const doc of activeDocuments.filter((d) => d.classificationStatus === 'unclassified')) {
      try {
        await projectsApi.classify(token, doc.projectDocumentId);
      } catch {
        // falhas individuais aparecem no status do documento
      }
    }
    await refetchDocuments();
  }, [activeDocuments, refetchDocuments, token]);

  const linkClass = useCallback(
    async (documentId: string) => {
      const existing = classifier?.models?.map((m) => ({ documentId: m.documentId })) ?? [];
      if (existing.some((e) => e.documentId === documentId)) return;
      await projectsApi.upsertModels(token, classifierId, [...existing, { documentId }]);
      await refetchAll();
      await classifyUnclassifiedDocs();
    },
    [classifier, classifierId, classifyUnclassifiedDocs, refetchAll, token],
  );

  const assignExistingClass = useCallback(
    async (documentId: string) => {
      setBusyKey('classes', true);
      try {
        await linkClass(documentId);
        notify('success', 'Classe atribuída ao projeto');
      } catch (e) {
        notify('error', 'Falha ao atribuir classe');
        throw e;
      } finally {
        setBusyKey('classes', false);
      }
    },
    [linkClass, notify],
  );

  const unlinkClass = useCallback(
    async (documentId: string) => {
      setBusyKey('classes', true);
      try {
        const existing = classifier?.models?.map((m) => ({ documentId: m.documentId })) ?? [];
        await projectsApi.upsertModels(token, classifierId, existing.filter((e) => e.documentId !== documentId));
        await refetchAll();
        notify('success', 'Classe removida do projeto');
      } catch (e) {
        notify('error', 'Falha ao remover classe do projeto');
        throw e;
      } finally {
        setBusyKey('classes', false);
      }
    },
    [classifier, classifierId, notify, refetchAll, token],
  );

  const createClass = useCallback(
    async (draft: ClassDraft) => {
      setBusyKey('classes', true);
      try {
        const r = await projectsApi.createClass(token, draft);
        if (!r.data?.documentId) throw new Error('create failed');
        await linkClass(r.data.documentId);
        notify('success', 'Classe criada e vinculada ao projeto');
        return true;
      } catch {
        notify('error', 'Falha ao criar classe');
        return false;
      } finally {
        setBusyKey('classes', false);
      }
    },
    [linkClass, notify, token],
  );

  const saveClass = useCallback(
    async (doc: ClassDocument, edit: ClassEdit) => {
      const prevMethod = doc.documentProcessMethod === DocumentProcessMethod.Prompt || String(doc.documentProcessMethod).toLowerCase() === 'prompt' ? DocumentProcessMethod.Prompt : DocumentProcessMethod.Fields;
      const prevExport = (doc.exportTargets ?? []).filter((t) => t !== 'db');
      const fieldsChanged = JSON.stringify(doc.fields ?? []) !== JSON.stringify(edit.fields);
      const configChanged =
        (doc.prompt ?? '') !== edit.prompt.trim() ||
        prevMethod !== edit.documentProcessMethod ||
        (doc.isValidating ?? true) !== edit.isValidating ||
        (doc.minValidationConfidence ?? null) !== edit.minValidationConfidence ||
        JSON.stringify(prevExport) !== JSON.stringify(edit.exportTargets);
      setBusyKey('classes', true);
      try {
        await projectsApi.updateClass(token, {
          documentId: doc.documentId,
          documentType: doc.documentType,
          displayName: edit.displayName.trim() || doc.displayName,
          description: edit.description.trim(),
          fields: edit.documentProcessMethod === DocumentProcessMethod.Fields ? edit.fields : null,
          prompt: edit.documentProcessMethod === DocumentProcessMethod.Prompt ? edit.prompt.trim() : doc.prompt ?? null,
          documentProcessMethod: edit.documentProcessMethod,
          isValidating: edit.isValidating,
          minValidationConfidence: edit.isValidating ? edit.minValidationConfidence : null,
          exportEnabled: doc.exportEnabled ?? true,
          exportTargets: ['db', ...edit.exportTargets],
        });
        await refetchClasses();
        notify('success', 'Classe salva');
        if (fieldsChanged || configChanged) {
          try {
            const r = await projectsApi.reprocessClass(token, classifierId, doc.documentId);
            const count = r.data?.reprocessedCount ?? 0;
            if (count > 0) notify('success', `${count} documento(s) reprocessado(s)`);
            void refetchDocuments();
          } catch {
            notify('error', 'Falha no reprocessamento');
          }
        }
        return true;
      } catch {
        notify('error', 'Falha ao salvar classe');
        return false;
      } finally {
        setBusyKey('classes', false);
      }
    },
    [classifierId, notify, refetchClasses, refetchDocuments, token],
  );

  const isStuck = useCallback((doc: ProjectDocument | null) => !!doc && isDocumentProcessingStuck(doc, now), [now]);

  return {
    classifier,
    loaded,
    notFound,
    documents: activeDocuments,
    selectedDocument,
    selectedDocumentId,
    selectDocument,
    originalResult,
    linkedDocuments,
    availableDocuments,
    toast,
    dismissToast: () => setToast(null),
    notify,
    busy,
    flow,
    flowHint: FLOW_HINTS[flow.phase],
    isEarlyFlow,
    pendingUpload,
    match,
    resolveMatch,
    isStuck,
    refetchAll,
    uploadDocument,
    reclassify,
    deleteDocument,
    deleteProject,
    startAutoCreateFlow,
    startAutoCreateFromExisting,
    assignExistingClass,
    unlinkClass,
    createClass,
    saveClass,
  };
}

export type ProjectWorkspace = ReturnType<typeof useProjectWorkspace>;
