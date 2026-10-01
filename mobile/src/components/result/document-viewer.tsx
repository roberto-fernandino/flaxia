import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { WebView, WebViewMessageEvent } from 'react-native-webview';
import { ThemedText } from '@/components/themed-text';
import { palette, useProjectColors } from '@/components/projects/ui';
import { DEFAULT_FIELD_HIGHLIGHT_COLOR } from '@/lib/engine/fieldTypeColors';
import { extendMatchWithParentheticalSuffix, findWordsForValue } from '@/lib/engine/ocrHighlightMatch';
import { isDegenerateOcrGeometry, normalizeOcrPages, resolveOcrSpace, wordsForOverlay } from '@/lib/engine/ocrPages';
import { isCompositeKey } from '@/lib/engine/tableFieldValues';
import type { Field, OcrPage, OcrWord } from '@/lib/engine/types';
import { resultApi } from '@/lib/result-api';
import { VIEWER_HTML } from './viewer-html';

type PageInfo = { pageNumber: number; w: number; h: number };
type Rect = { x1: number; y1: number; x2: number; y2: number; fill: string; stroke: string; selected: boolean; fieldKey: string };

/** Agrupa palavras em linhas / frases próximas — mesmo algoritmo do web. */
function clusterWordsIntoRects(words: OcrWord[]) {
  if (words.length === 0) return [];
  const avgH = words.reduce((s, w) => s + w.h, 0) / words.length;
  const sorted = [...words].sort((a, b) => (a.y !== b.y ? a.y - b.y : a.x - b.x));
  const lines: OcrWord[][] = [];
  for (const word of sorted) {
    const line = lines.find((candidate) => {
      const y1 = Math.max(word.y, Math.min(...candidate.map((w) => w.y)));
      const y2 = Math.min(word.y + word.h, Math.max(...candidate.map((w) => w.y + w.h)));
      return y2 - y1 >= Math.min(word.h, avgH) * 0.35;
    });
    if (line) line.push(word);
    else lines.push([word]);
  }
  return lines.flatMap((line) => {
    const clusters: OcrWord[][] = [];
    for (const word of [...line].sort((a, b) => a.x - b.x)) {
      const current = clusters[clusters.length - 1];
      const previous = current?.[current.length - 1];
      const gap = previous ? word.x - (previous.x + previous.w) : 0;
      if (!current || gap > avgH * 4) clusters.push([word]);
      else current.push(word);
    }
    return clusters.map((c) => ({
      x1: Math.min(...c.map((w) => w.x)),
      y1: Math.min(...c.map((w) => w.y)),
      x2: Math.max(...c.map((w) => w.x + w.w)),
      y2: Math.max(...c.map((w) => w.y + w.h)),
    }));
  });
}

function rgb(color: string) {
  const m = color.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  return m ? `${m[1]},${m[2]},${m[3]}` : '255,255,0';
}

const isSearchable = (v: unknown) => v != null && String(v).trim().length >= 1;

function kindOf(fileType: string | null | undefined, fileName: string | null | undefined, base64: string) {
  const raw = `${fileType ?? ''} ${fileName ?? ''}`.toLowerCase();
  if (raw.includes('pdf') || base64.startsWith('JVBER')) return { kind: 'pdf' as const, mime: 'application/pdf' };
  if (base64.startsWith('iVBOR') || raw.includes('png')) return { kind: 'image' as const, mime: 'image/png' };
  if (base64.startsWith('UklGR') || raw.includes('webp')) return { kind: 'image' as const, mime: 'image/webp' };
  if (base64.startsWith('R0lGOD') || raw.includes('gif')) return { kind: 'image' as const, mime: 'image/gif' };
  return { kind: 'image' as const, mime: 'image/jpeg' };
}

export function ResultDocumentViewer({
  processJobId,
  token,
  fileType,
  fileName,
  ocrData,
  displayValues,
  fieldColors,
  selectedFieldKey,
  scrollToken,
  readOnly,
  documentFields,
  onFieldSelect,
  onDeselect,
  onSelectedText,
  height,
}: {
  processJobId: string;
  token: string | null;
  fileType?: string | null;
  fileName?: string | null;
  ocrData: unknown;
  displayValues: Record<string, string>;
  fieldColors: Record<string, string>;
  selectedFieldKey: string | null;
  scrollToken: number;
  readOnly: boolean;
  documentFields?: Field[];
  onFieldSelect: (key: string) => void;
  onDeselect: () => void;
  onSelectedText: (text: string) => void;
  height: number;
}) {
  const c = useProjectColors();
  const webRef = useRef<WebView>(null);
  const [ready, setReady] = useState(false);
  const [file, setFile] = useState<{ uri: string; base64: string; kind: 'pdf' | 'image'; mime: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pagesInfo, setPagesInfo] = useState<PageInfo[] | null>(null);
  const [textWords, setTextWords] = useState<Record<string, OcrWord[]>>({});
  const [zoom, setZoom] = useState(1);
  const [selectMode, setSelectMode] = useState(false);
  const [sharing, setSharing] = useState(false);

  const send = useCallback((msg: unknown) => {
    webRef.current?.injectJavaScript(`window.__rn && window.__rn(${JSON.stringify(msg)}); true;`);
  }, []);

  // Baixa o arquivo original do job (com auth) para o cache.
  useEffect(() => {
    let cancelled = false;
    setFile(null);
    setError(null);
    setPagesInfo(null);
    setTextWords({});
    if (!token) return;
    (async () => {
      try {
        const destination = new File(Paths.cache, `job-${processJobId}`);
        if (!destination.exists) {
          const downloaded = await File.createDownloadTask(resultApi.documentUrl(processJobId), destination, { headers: { Authorization: `Bearer ${token}` } }).downloadAsync();
          if (!downloaded) throw new Error('download');
        }
        const base64 = await destination.base64();
        if (!base64) throw new Error('empty');
        if (!cancelled) setFile({ uri: destination.uri, base64, ...kindOf(fileType, fileName, base64) });
      } catch {
        if (!cancelled) setError('Falha ao carregar arquivo do documento. Ele pode não estar disponível para este trabalho.');
      }
    })();
    return () => { cancelled = true; };
  }, [processJobId, token, fileType, fileName]);

  useEffect(() => {
    if (!ready || !file) return;
    send({ type: 'theme', bg: c.dark ? '#111827' : '#f3f4f6' });
    send({ type: 'load', kind: file.kind, base64: file.base64, mime: file.mime });
  }, [ready, file, send, c.dark]);

  // OCR do Vision quando utilizável; senão o text layer do PDF faz o papel.
  const ocrPages = useMemo(() => {
    const pages = normalizeOcrPages(ocrData);
    if (pages && pages.length > 0 && !isDegenerateOcrGeometry(pages)) return pages;
    if (file?.kind === 'pdf' && pagesInfo) {
      return pagesInfo.map<OcrPage>((p) => ({ pageNumber: p.pageNumber, width: p.w, height: p.h, words: textWords[p.pageNumber] ?? [] }));
    }
    return null;
  }, [ocrData, file?.kind, pagesInfo, textWords]);

  /** Palavras e espaço de coordenadas de cada página, já alinhados à imagem (EXIF). */
  const pageGeometry = useMemo(() => {
    const out: Record<number, { words: OcrWord[]; space: { w: number; h: number } }> = {};
    if (!ocrPages || !pagesInfo) return out;
    pagesInfo.forEach((info, index) => {
      const page = ocrPages.find((p) => p.pageNumber === info.pageNumber) ?? ocrPages[index];
      if (!page) return;
      if (file?.kind === 'image') {
        const natural = { w: info.w, h: info.h };
        out[info.pageNumber] = { words: wordsForOverlay(page, natural), space: resolveOcrSpace(page, natural) };
      } else {
        out[info.pageNumber] = { words: page.words, space: resolveOcrSpace(page) };
      }
    });
    return out;
  }, [ocrPages, pagesInfo, file?.kind]);

  const lastScrollRef = useRef('');
  useEffect(() => {
    if (!pagesInfo) return;
    const pages: Record<number, { space: { w: number; h: number }; rects: Rect[] }> = {};
    for (const [n, geo] of Object.entries(pageGeometry)) {
      const matches: { fieldKey: string; color: string; selected: boolean; words: OcrWord[] }[] = [];
      const add = (key: string, value: string, selected: boolean) => {
        const found = extendMatchWithParentheticalSuffix(value, geo.words, findWordsForValue(value, geo.words));
        if (found.length) matches.push({ fieldKey: key, color: fieldColors[key] || DEFAULT_FIELD_HIGHLIGHT_COLOR, selected, words: found });
      };
      if (selectedFieldKey) {
        const v = displayValues[selectedFieldKey];
        if (isSearchable(v)) add(selectedFieldKey, String(v).trim(), true);
      } else {
        for (const [key, value] of Object.entries(displayValues)) {
          // Células de tabela ficam fora do "destacar tudo" (custo), como no web.
          if (!isSearchable(value) || isCompositeKey(key, documentFields)) continue;
          add(key, String(value).trim(), false);
        }
      }
      pages[Number(n)] = {
        space: geo.space,
        rects: matches.flatMap((m) =>
          clusterWordsIntoRects(m.words).map((r) => ({
            ...r,
            fieldKey: m.fieldKey,
            selected: m.selected,
            fill: `rgba(${rgb(m.color)},${m.selected ? 0.52 : 0.36})`,
            stroke: m.selected ? 'rgba(6,182,212,0.85)' : `rgba(${rgb(m.color)},0.55)`,
          })),
        ),
      };
    }
    const scrollKey = `${selectedFieldKey ?? ''}:${scrollToken}`;
    const scroll = !!selectedFieldKey && lastScrollRef.current !== scrollKey;
    lastScrollRef.current = scrollKey;
    send({ type: 'highlights', pages, scroll });
  }, [pageGeometry, pagesInfo, displayValues, fieldColors, selectedFieldKey, scrollToken, documentFields, send]);

  useEffect(() => { send({ type: 'zoom', zoom }); }, [zoom, send]);

  const canSelectText = !!selectedFieldKey && !readOnly;
  useEffect(() => {
    if (!canSelectText) setSelectMode(false);
  }, [canSelectText]);
  useEffect(() => { send({ type: 'selectMode', enabled: selectMode }); }, [selectMode, send, pagesInfo]);

  const onMessage = (e: WebViewMessageEvent) => {
    let msg: { type: string; [k: string]: unknown };
    try { msg = JSON.parse(e.nativeEvent.data); } catch { return; }
    if (msg.type === 'ready') setReady(true);
    if (msg.type === 'loaded') {
      setPagesInfo(msg.pages as PageInfo[]);
      setTextWords((msg.textWords as Record<string, OcrWord[]>) ?? {});
    }
    if (msg.type === 'error') setError('Falha ao carregar documento.');
    if (msg.type === 'fieldTap' && typeof msg.fieldKey === 'string') onFieldSelect(msg.fieldKey);
    if (msg.type === 'blankTap') onDeselect();
    if (msg.type === 'area') {
      const geo = pageGeometry[msg.pageNumber as number];
      if (!geo) return;
      const x1 = (msg.x1 as number) * geo.space.w, x2 = (msg.x2 as number) * geo.space.w;
      const y1 = (msg.y1 as number) * geo.space.h, y2 = (msg.y2 as number) * geo.space.h;
      const hit = geo.words.filter((w) => w.x < x2 && w.x + w.w > x1 && w.y < y2 && w.y + w.h > y1);
      if (!hit.length) return;
      hit.sort((a, b) => (Math.abs(a.y - b.y) > Math.min(a.h, b.h) * 0.5 ? a.y - b.y : a.x - b.x));
      const lines: OcrWord[][] = [];
      for (const w of hit) {
        const last = lines[lines.length - 1];
        if (!last || w.y - last[0].y > Math.min(w.h, last[0].h) * 0.5) lines.push([w]);
        else last.push(w);
      }
      const text = lines.map((l) => l.map((w) => w.text).join(' ')).join(' ').trim();
      if (text) onSelectedText(text);
    }
  };

  const share = async () => {
    if (!file) return;
    setSharing(true);
    try {
      const ext = file.kind === 'pdf' ? '.pdf' : `.${file.mime.split('/')[1]}`;
      const named = new File(Paths.cache, `${(fileName || `documento-${processJobId}`).replace(/[^\w.\-]+/g, '_').replace(/\.[a-z0-9]+$/i, '')}${ext}`);
      if (named.exists) named.delete();
      new File(file.uri).copy(named);
      await Sharing.shareAsync(named.uri, { mimeType: file.mime, UTI: file.kind === 'pdf' ? 'com.adobe.pdf' : undefined });
    } catch {
      // cancelado ou indisponível
    } finally {
      setSharing(false);
    }
  };

  return (
    <View style={[s.wrap, { height, borderColor: c.border, backgroundColor: c.surface }]}>
      <View style={[s.toolbar, { borderColor: c.border }]}>
        <ThemedText numberOfLines={1} style={{ flex: 1, fontSize: 13, fontWeight: '600', color: c.text }}>Visualizador de Documento</ThemedText>
        <Pressable onPress={() => setZoom((z) => Math.max(0.5, z - 0.25))} disabled={zoom <= 0.5} style={[s.tool, { borderColor: c.border, opacity: zoom <= 0.5 ? 0.4 : 1 }]}><ThemedText style={{ color: c.text }}>−</ThemedText></Pressable>
        <ThemedText style={{ width: 40, textAlign: 'center', fontSize: 11, color: c.textMuted }}>{Math.round(zoom * 100)}%</ThemedText>
        <Pressable onPress={() => setZoom((z) => Math.min(3, z + 0.25))} disabled={zoom >= 3} style={[s.tool, { borderColor: c.border, opacity: zoom >= 3 ? 0.4 : 1 }]}><ThemedText style={{ color: c.text }}>+</ThemedText></Pressable>
        <Pressable onPress={() => setZoom(1)} disabled={zoom === 1} style={[s.tool, { borderColor: c.border, opacity: zoom === 1 ? 0.4 : 1 }]}><ThemedText style={{ fontSize: 11, color: c.text }}>Ajustar</ThemedText></Pressable>
        <Pressable onPress={() => void share()} disabled={!file || sharing} style={[s.tool, { borderColor: c.border, opacity: !file ? 0.4 : 1 }]} accessibilityLabel="Compartilhar documento"><ThemedText style={{ fontSize: 13, color: c.text }}>⬆︎</ThemedText></Pressable>
      </View>
      {canSelectText && (
        <Pressable onPress={() => setSelectMode((v) => !v)} style={[s.selectBar, { backgroundColor: selectMode ? palette.primary : c.selectedBg }]}>
          <ThemedText style={{ fontSize: 12, fontWeight: '600', color: selectMode ? '#fff' : palette.primary }}>
            {selectMode ? '✓ Arraste sobre o texto para preencher o campo — toque para sair' : '✂︎ Selecionar valor no documento'}
          </ThemedText>
        </Pressable>
      )}
      <View style={{ flex: 1 }}>
        {error ? (
          <View style={s.center}><ThemedText style={{ color: palette.danger, textAlign: 'center', fontSize: 13 }}>{error}</ThemedText></View>
        ) : (
          <>
            <WebView
              ref={webRef}
              source={{ html: VIEWER_HTML }}
              originWhitelist={['*']}
              onMessage={onMessage}
              javaScriptEnabled
              scrollEnabled={!selectMode}
              style={{ flex: 1, backgroundColor: 'transparent' }}
            />
            {!pagesInfo && (
              <View style={[StyleSheet.absoluteFill, s.center, { backgroundColor: c.surfaceAlt }]}>
                <ActivityIndicator color={palette.primary} />
                <ThemedText style={{ fontSize: 12, color: c.textMuted }}>Carregando documento...</ThemedText>
              </View>
            )}
          </>
        )}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { borderWidth: 1, borderRadius: 12, overflow: 'hidden' },
  toolbar: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 6, borderBottomWidth: StyleSheet.hairlineWidth },
  tool: { borderWidth: 1, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3, minWidth: 28, alignItems: 'center' },
  selectBar: { paddingVertical: 7, paddingHorizontal: 10, alignItems: 'center' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8, padding: 16 },
});
