"use client"

import React, { useState, useEffect, useRef, useMemo } from 'react'
import { Spinner } from '@/components/ui/spinner'
import { Button } from '@/components/ui/button'
import { ProgressBar } from '@/components/ui/progress'
import {
  FileText,
  CheckCircle2,
  Circle,
  XCircle,
  Clock,
  AlertTriangle,
  ChevronUp,
  Minus
} from 'lucide-react'
/*
 * The report renders the SAME components the user sees, which is the whole of
 * T2F's approach: its PdfReportRenderer captures <MigrationOverview>,
 * <AssessmentTab> and <ParsingTab> with isPdfMode set, so the PDF inherits the
 * product's design system for free.
 *
 * This file used to capture Assessment-Results/AssessmentResults instead --
 * the legacy view, still on its own makeStyles system (gradient headings,
 * min-h-screen, Tailwind-shaped class names) with only 4 `vl-` classes in it.
 * The screen shows AssessmentResultsView, which has 77. Two different designs,
 * and the PDF was capturing the one nobody looks at. Worse, `.pdf-render-mode`
 * in globals.css only normalises `.vl-*` and `.fui-*` elements, so the legacy
 * component's backgrounds and borders were never corrected for print either.
 */
import AssessmentResultsView from './Assessment-Results/AssessmentResultsView'
import ParsingResults from './Parsing-Results/ParsingResults'
import { MigrationOverview } from './tabs/MigrationOverview'
import { captureElementToPdfBlob, CaptureProgress } from '@/lib/pdf/pdfCaptureUtils'
import { ZipReportService } from '@/lib/pdf/zipService'
import { useToast } from '@/hooks/use-toast'
import { useParsingStore } from '@/stores/parsing.store'
import type { AssessmentData, ParsedData } from '@/types/assessment'

// Same UI/step-tracking shell as components/PdfReportRenderer.tsx (the
// dead, Tableau-shaped version this was forked from), reusing its proven
// capture-readiness polling, retry, and ZIP-bundling logic unchanged.
// What's different: data comes from a prop (apiResults, already in its
// real Qlik shape) instead of Zustand stores that nothing live populates,
// and the hidden capture container renders the live, already-correct
// AssessmentResults/ParsingResults components instead of the dead
// Tableau-shaped AssessmentTab/ParsingTab/MigrationOverview.

interface QlikApiResult {
  appId: string;
  appName: string;
  folderName?: string;
  assessmentData?: AssessmentData;
  parsedData?: ParsedData;
  [key: string]: any;
}

interface GenerationStep {
  id: string;
  label: string;
  status: 'pending' | 'loading' | 'success' | 'error';
  percentage?: number;
  message?: string;
  type: 'overview' | 'workbook' | 'zip';
  appId?: string;
}

interface QlikPdfReportRendererProps {
  apiResults: QlikApiResult[];
  onClose: () => void;
}

export function QlikPdfReportRenderer({ apiResults, onClose }: QlikPdfReportRendererProps) {
  const captureRef = useRef<HTMLDivElement>(null)
  const { toast } = useToast()
  // Mapped parsing results, so the captured PDF matches the on-screen tab.
  const parsingDataMap = useParsingStore(state => state.parsingData)

  // Only apps with both assessment and parsing data can produce a report --
  // matches the same gate the "Download Report" button uses to decide
  // whether to even show itself.
  const readyResults = useMemo(
    () => apiResults.filter(r => r.assessmentData && r.parsedData),
    [apiResults]
  )
  const appIds = useMemo(() => readyResults.map(r => r.appId), [readyResults])

  const [status, setStatus] = useState<'preparing' | 'processing' | 'done' | 'error'>('preparing')
  const [errorMessage, setErrorMessage] = useState("")
  const [steps, setSteps] = useState<GenerationStep[]>([])
  const [activeStepId, setActiveStepId] = useState<string | null>(null)
  const [activeAppId, setActiveAppId] = useState<string | null>(null)
  const isCancelled = useRef(false);

  const [logs, setLogs] = useState<{ time: string, msg: string }[]>([])
  const logsEndRef = useRef<HTMLDivElement>(null)
  const [timers, setTimers] = useState({ total: 0, workbook: 0 })
  const startTimeRef = useRef<number>(0)
  const workbookStartTimeRef = useRef<number>(0)
  const lastLogTimeRef = useRef<number>(Date.now())
  const [isStalled, setIsStalled] = useState(false)
  const [overallProgress, setOverallProgress] = useState(0)

  const [summaryStats, setSummaryStats] = useState<{
    totalPdfs: number;
    failedCount: number;
    totalTime: string;
  } | null>(null)

  const [isMinimized, setIsMinimized] = useState(false)
  const [showCancelConfirm, setShowCancelConfirm] = useState(false)
  const logScrollPosRef = useRef<number>(0)

  const completedApps = useMemo(() => {
    return steps.filter(s => s.type === 'workbook' && (s.status === 'success' || s.status === 'error')).length;
  }, [steps]);

  const isExportFinished = useMemo(() => status === 'done', [status]);

  useEffect(() => {
    if (isExportFinished) {
      setShowCancelConfirm(false);
    }
  }, [isExportFinished]);

  const totalApps = useMemo(() => appIds.length, [appIds]);

  const getAppName = (appId: string) => {
    return readyResults.find(r => r.appId === appId)?.appName || appId;
  };

  const addLog = (msg: string) => {
    const time = new Date().toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
    setLogs(prev => [...prev, { time, msg }]);
    lastLogTimeRef.current = Date.now();
    setIsStalled(false);
    // The 1s interval below can't fire while html2canvas blocks the main
    // thread during a capture pass -- same reason the heartbeat dot moved to
    // a pure CSS animation (see the note on it above) -- so "Total Time" would
    // otherwise sit frozen for the whole capture and then jump forward all at
    // once. addLog runs right before/after and during every capture (via
    // onProgress), so refreshing here catches the clock up at the earliest
    // possible moment instead of waiting up to another full tick on top of
    // whatever the capture itself blocked.
    const now = Date.now();
    setTimers({
      total: Math.floor((now - startTimeRef.current) / 1000),
      workbook: Math.floor((now - workbookStartTimeRef.current) / 1000)
    });
  }

  useEffect(() => {
    if (logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [logs]);

  useEffect(() => {
    if (status !== 'processing') return;

    const interval = setInterval(() => {
      const now = Date.now();
      setTimers({
        total: Math.floor((now - startTimeRef.current) / 1000),
        workbook: Math.floor((now - workbookStartTimeRef.current) / 1000)
      });

      if (now - lastLogTimeRef.current > 25000) {
        setIsStalled(true);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [status]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  }

  useEffect(() => {
    if (appIds.length === 0) return;

    const initialSteps: GenerationStep[] = [
      { id: 'overview', label: 'Migration Overview', status: 'pending', type: 'overview' },
      ...appIds.map(id => ({
        id: `wb-${id}`,
        label: `App: ${getAppName(id)}`,
        status: 'pending' as const,
        type: 'workbook' as const,
        appId: id
      })),
      { id: 'zip', label: 'Finalizing ZIP Archive', status: 'pending', type: 'zip' }
    ];
    setSteps(initialSteps);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appIds.join(',')]);

  const isDataReady = readyResults.length > 0;

  const updateStep = (id: string, updates: Partial<GenerationStep>) => {
    setSteps(prev => prev.map(s => s.id === id ? { ...s, ...updates } : s));
  };

  // waitForRenderReady / captureWithRetry: unchanged from components/PdfReportRenderer.tsx --
  // this polling/retry logic is generic DOM-capture infrastructure, not tied
  // to any particular product's data shape.
  const waitForRenderReady = async (
    targetRef: React.RefObject<HTMLDivElement>,
    context: string,
    timeoutMs = 45000
  ): Promise<HTMLElement> => {
    const POLL_INTERVAL = 350;
    const QUIESCENCE_WAIT = 400;
    const start = Date.now();

    addLog(`[${context}] 🔍 Render start — polling for full DOM readiness...`);

    while (Date.now() - start < timeoutMs) {
      if (isCancelled.current) throw new Error("Cancelled by user");

      const el = targetRef.current;

      if (!el || !el.isConnected) {
        addLog(`[${context}] ⏳ Container not yet mounted (isConnected: ${el?.isConnected ?? false})`);
        await new Promise(r => setTimeout(r, POLL_INTERVAL));
        continue;
      }

      const sw = el.scrollWidth;
      const sh = el.scrollHeight;
      if (sw === 0 || sh === 0) {
        addLog(`[${context}] ⏳ Container has no scroll dimensions yet (${sw}x${sh})`);
        await new Promise(r => setTimeout(r, POLL_INTERVAL));
        continue;
      }

      const sections = Array.from(el.querySelectorAll('[data-pdf-section]')) as HTMLElement[];
      if (sections.length === 0) {
        addLog(`[${context}] ⏳ No [data-pdf-section] nodes found yet`);
        await new Promise(r => setTimeout(r, POLL_INTERVAL));
        continue;
      }
      const allSectionsReady = sections.every(s => s.scrollHeight > 0 && s.scrollWidth > 0);
      if (!allSectionsReady) {
        const unready = sections.filter(s => s.scrollHeight === 0 || s.scrollWidth === 0).length;
        addLog(`[${context}] ⏳ ${unready}/${sections.length} sections have zero dimensions`);
        await new Promise(r => setTimeout(r, POLL_INTERVAL));
        continue;
      }

      const allImgs = Array.from(el.querySelectorAll('img')) as HTMLImageElement[];
      const unloadedImgs = allImgs.filter(img => !img.complete || img.naturalWidth === 0);
      if (unloadedImgs.length > 0) {
        addLog(`[${context}] ⏳ Waiting for ${unloadedImgs.length}/${allImgs.length} images to load...`);
        await Promise.all(
          unloadedImgs.map(
            img =>
              new Promise<void>(resolve => {
                if (img.complete && img.naturalWidth > 0) { resolve(); return; }
                const onLoad = () => { img.removeEventListener('load', onLoad); img.removeEventListener('error', onLoad); resolve(); };
                img.addEventListener('load', onLoad);
                img.addEventListener('error', onLoad);
                setTimeout(resolve, 5000);
              })
          )
        );
        addLog(`[${context}] 🖼️ Image ready — all ${allImgs.length} images loaded`);
      } else if (allImgs.length > 0) {
        addLog(`[${context}] 🖼️ Image ready — all ${allImgs.length} images already loaded`);
      }

      const svgPaths = Array.from(el.querySelectorAll('svg path[d]')) as SVGPathElement[];
      if (svgPaths.length > 0) {
        const sample1 = svgPaths.slice(0, Math.min(svgPaths.length, 10)).map(p => p.getAttribute('d'));
        await new Promise(r => setTimeout(r, 200));
        const sample2 = svgPaths.slice(0, Math.min(svgPaths.length, 10)).map(p => p.getAttribute('d'));
        const svgStable = sample1.every((d, i) => d === sample2[i]);
        if (!svgStable) {
          addLog(`[${context}] ⏳ SVG/chart paths still animating — waiting for quiescence...`);
          await new Promise(r => setTimeout(r, POLL_INTERVAL));
          continue;
        }
        addLog(`[${context}] 📊 Chart ready — ${svgPaths.length} SVG paths stable`);
      }

      const allTables = Array.from(el.querySelectorAll('table')) as HTMLTableElement[];
      if (allTables.length > 0) {
        const emptyTables = allTables.filter(
          t => t.querySelectorAll('tbody tr').length === 0 && t.scrollHeight < 10
        );
        if (emptyTables.length > 0) {
          addLog(`[${context}] ⏳ ${emptyTables.length}/${allTables.length} tables not yet rendered`);
          await new Promise(r => setTimeout(r, POLL_INTERVAL));
          continue;
        }
        addLog(`[${context}] 📋 Table ready — all ${allTables.length} tables rendered`);
      }

      try {
        await document.fonts.ready;
        addLog(`[${context}] 🔤 Fonts ready — document.fonts.ready resolved`);
      } catch (_) {
        addLog(`[${context}] ⚠️ document.fonts.ready threw — continuing anyway`);
      }

      const quiescent = await new Promise<boolean>(resolve => {
        let timer: ReturnType<typeof setTimeout> | null = null;
        const observer = new MutationObserver(() => {
          if (timer) clearTimeout(timer);
          timer = setTimeout(() => {
            observer.disconnect();
            resolve(true);
          }, QUIESCENCE_WAIT);
        });
        observer.observe(el, { childList: true, subtree: true, attributes: true, characterData: false });
        timer = setTimeout(() => {
          observer.disconnect();
          resolve(true);
        }, QUIESCENCE_WAIT);
        setTimeout(() => { observer.disconnect(); resolve(false); }, 10000);
      });

      if (!quiescent) {
        addLog(`[${context}] ⚠️ DOM quiescence timeout — proceeding anyway after 10s`);
      } else {
        addLog(`[${context}] ✅ DOM quiescent for ${QUIESCENCE_WAIT}ms — no mutations detected`);
      }

      addLog(
        `[${context}] ✅ Render ready — ` +
        `sections:${sections.length}, ` +
        `scrollSize:${sw}x${sh}, ` +
        `imgs:${allImgs.length}, ` +
        `svgs:${svgPaths.length}, ` +
        `tables:${allTables.length}`
      );
      return el;
    }

    throw new Error(
      `[${context}] Render readiness timeout after ${timeoutMs}ms. ` +
      `Node connected: ${targetRef.current?.isConnected ?? false}. ` +
      `Sections: ${targetRef.current?.querySelectorAll('[data-pdf-section]').length ?? 0}.`
    );
  };

  const captureWithRetry = async (
    el: HTMLElement,
    context: string,
    onProgress: (p: CaptureProgress) => void
  ): Promise<Blob> => {
    try {
      return await captureElementToPdfBlob(el, onProgress);
    } catch (firstErr: any) {
      addLog(`[${context}] ⚠️ First capture attempt failed: ${firstErr.message}`);
      addLog(`[${context}] 🔄 Retry capture in 2s...`);
      await new Promise(r => setTimeout(r, 2000));
      if (!el.isConnected) {
        throw new Error(`[${context}] Retry aborted — node disconnected before retry`);
      }
      addLog(`[${context}] 🔄 Retry capture start`);
      return await captureElementToPdfBlob(el, onProgress);
    }
  };

  const processGeneration = async () => {
    if (!captureRef.current) return;
    setStatus('processing');
    isCancelled.current = false;
    startTimeRef.current = Date.now();
    workbookStartTimeRef.current = Date.now();
    lastLogTimeRef.current = Date.now();

    addLog("Starting generation process...");
    let zipService: ZipReportService | null = new ZipReportService();
    const timestamp = new Date().toISOString().split('T')[0];
    const totalGlobalSteps = appIds.length + 2;
    let currentGlobalStep = 0;

    try {
      // 1. Overview
      setActiveStepId('overview');
      updateStep('overview', { status: 'loading', percentage: 0, message: 'Preparing overview...' });
      addLog(`[Migration Overview] 🔧 Mount — activating hidden DOM`);

      if (isCancelled.current) throw new Error("Cancelled by user");

      try {
        addLog(`[Migration Overview] 🔍 Render start — waiting for full visual readiness...`);
        const stableEl = await waitForRenderReady(captureRef as React.RefObject<HTMLDivElement>, "Migration Overview");
        addLog(`[Migration Overview] ✅ Render ready`);

        addLog(`[Migration Overview] 🎯 Capture start`);
        updateStep('overview', { percentage: 10, message: 'Capturing overview...' });
        const overviewBlob = await captureWithRetry(stableEl, "Migration Overview", (p: CaptureProgress) => {
          updateStep('overview', { percentage: p.percentage, message: p.message });
          if (p.logMessage) addLog(`[Overview] ${p.logMessage}`);
        });
        addLog(`[Migration Overview] ✅ Capture finish — PDF generated`);

        zipService.addPdf(`00_Migration_Overview_${timestamp}.pdf`, overviewBlob);
        addLog(`[Migration Overview] ✅ PDF added to ZIP`);
        updateStep('overview', { status: 'success', percentage: 100, message: 'Completed' });
      } catch (err: any) {
        if (isCancelled.current) throw err;
        addLog(`❌ ERROR: [Migration Overview][Capture] ${err.message}`);
        zipService.logFailure("Migration Overview", "Capture", err.message || "Unknown error");
        updateStep('overview', { status: 'error', message: 'Failed to capture overview' });
      }

      currentGlobalStep++;
      setOverallProgress(Math.round((currentGlobalStep / totalGlobalSteps) * 100));

      addLog(`[Migration Overview] 🧹 Cleanup start`);
      await new Promise(r => setTimeout(r, 50));
      addLog(`[Migration Overview] ✅ Cleanup finish`);

      // 2. Per-app: Assessment + Parsing results
      for (const appId of appIds) {
        if (isCancelled.current) throw new Error("Cancelled by user");

        workbookStartTimeRef.current = Date.now();
        const stepId = `wb-${appId}`;
        const appName = getAppName(appId);
        const appShort = appName.length > 20 ? appName.substring(0, 20) + '…' : appName;

        addLog(`[${appShort}] 🔧 Mount — activating hidden DOM`);
        updateStep(stepId, { status: 'loading', percentage: 0, message: 'Mounting app results...' });
        setActiveStepId(stepId);
        setActiveAppId(appId);
        await new Promise(r => setTimeout(r, 0));

        if (isCancelled.current) throw new Error("Cancelled by user");

        try {
          addLog(`[${appShort}] 🔍 Render start — polling for full visual readiness...`);
          updateStep(stepId, { percentage: 5, message: 'Waiting for render readiness...' });
          const stableEl = await waitForRenderReady(captureRef as React.RefObject<HTMLDivElement>, appShort);
          addLog(`[${appShort}] ✅ Render ready`);

          addLog(`[${appShort}] 🎯 Capture start`);
          updateStep(stepId, { percentage: 10, message: 'Capturing app results...' });
          const wbBlob = await captureWithRetry(stableEl, appShort, (p: CaptureProgress) => {
            updateStep(stepId, { percentage: p.percentage, message: p.message });
            if (p.logMessage) addLog(`[${appShort}] ${p.logMessage}`);
          });
          addLog(`[${appShort}] ✅ Capture finish — PDF generated`);

          const safeName = appName.replace(/[/\\?%*:|"<>]/g, '_');
          zipService.addPdf(`${safeName}_Report.pdf`, wbBlob);
          addLog(`[${appShort}] ✅ PDF added to ZIP`);
          updateStep(stepId, { status: 'success', percentage: 100, message: 'Completed' });
        } catch (err: any) {
          if (isCancelled.current) throw err;
          addLog(`❌ ERROR: [${appName}][Capture] ${err.message}`);
          zipService.logFailure(appName, "Capture", err.message || "Unknown error");
          updateStep(stepId, { status: 'error', message: 'Failed to capture app results' });
        } finally {
          addLog(`[${appShort}] 🧹 Cleanup start — unmounting app DOM`);
          setActiveAppId(null);
          await new Promise(r => setTimeout(r, 50));
          addLog(`[${appShort}] ✅ Cleanup finish`);
        }

        currentGlobalStep++;
        setOverallProgress(Math.round((currentGlobalStep / totalGlobalSteps) * 100));
      }

      if (isCancelled.current) throw new Error("Cancelled by user");

      // 3. Finalize ZIP
      workbookStartTimeRef.current = Date.now();
      addLog("All renders complete. Preparing final ZIP bundle...");
      setActiveAppId(null);
      setActiveStepId('zip');
      updateStep('zip', { status: 'loading', percentage: 50, message: 'Bundling reports...' });

      await zipService.downloadZip(`Migration_Reports_${timestamp}.zip`);
      addLog("ZIP bundle created and browser download triggered.");
      updateStep('zip', { status: 'success', percentage: 100, message: 'Archive downloaded' });

      setOverallProgress(100);

      // @ts-expect-error - zip.files isn't part of the public JSZip service type
      const totalFiles = Object.keys(zipService.zip.files).length;
      // @ts-expect-error - failures isn't part of the public JSZip service type
      const failures = zipService.failures.length;

      setSummaryStats({
        totalPdfs: totalFiles - (failures > 0 ? 1 : 0),
        failedCount: failures,
        totalTime: formatTime(Math.floor((Date.now() - startTimeRef.current) / 1000))
      });

      addLog("Generation pipeline completed successfully.");

      toast({
        title: "PDF Export Complete",
        description: "All reports have been successfully generated and bundled.",
      });

      setStatus('done');
      setIsMinimized(false);
      setShowCancelConfirm(false);

    } catch (err: any) {
      if (err.message === "Cancelled by user") {
        addLog("Process safely cancelled by user. Terminating loops.");
        return;
      }
      addLog(`CRITICAL ERROR: ${err.message}`);
      setErrorMessage(err.message || "A critical error occurred during the zipping process.");

      toast({
        title: "Export Failed",
        description: err.message || "A critical error occurred.",
        variant: "destructive",
      });

      setStatus('error');
      setIsMinimized(false);
    } finally {
      zipService = null;
    }
  };

  useEffect(() => {
    if (status !== 'preparing' || steps.length === 0) return;

    const timer = setTimeout(() => {
      if (isDataReady) {
        processGeneration();
      }
    }, 3000);

    return () => {
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, isDataReady, steps.length]);

  const handleClose = () => {
    if (status === 'processing' && !showCancelConfirm) {
      setShowCancelConfirm(true);
      return;
    }

    addLog("Close/Cancel requested. Triggering safe abort...");
    isCancelled.current = true;
    onClose();
  };

  const handleMinimize = () => {
    if (status === 'done' || status === 'error' || showCancelConfirm) return;

    if (logsEndRef.current?.parentElement) {
      logScrollPosRef.current = logsEndRef.current.parentElement.scrollTop;
    }
    setIsMinimized(true);
  };

  const handleRestore = () => {
    setIsMinimized(false);
  };

  useEffect(() => {
    if (!isMinimized && logsEndRef.current?.parentElement) {
      setTimeout(() => {
        if (logsEndRef.current?.parentElement) {
          logsEndRef.current.parentElement.scrollTop = logScrollPosRef.current;
        }
      }, 50);
    }
  }, [isMinimized]);

  return (
    <>
      {isMinimized && (
        <div
          onClick={handleRestore}
          style={{
            position: 'fixed',
            bottom: '24px',
            right: '24px',
            backgroundColor: 'var(--surface)',
            padding: '12px 16px',
            borderRadius: '12px',
            boxShadow: 'var(--shadow-md)',
            border: '1px solid var(--primary)',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            cursor: 'pointer',
            zIndex: 10000,
            transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
          }}
        >
          <Spinner size="tiny" />
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontWeight: 600, fontSize: '14px' }}>Generating Reports...</span>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              {overallProgress}% • {activeAppId ? getAppName(activeAppId) : 'Overview'}
            </span>
          </div>
          <ChevronUp size={16} style={{ marginLeft: '8px' }} />
        </div>
      )}

      <div
        className={isMinimized ? "vl-hidden" : undefined}
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.4)',
          backdropFilter: 'blur(4px)',
          display: isMinimized ? 'none' : 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999,
        }}
        onClick={(e) => {
          if (e.target === e.currentTarget) {
            handleMinimize();
          }
        }}
      >
        <div
          style={{
            backgroundColor: 'var(--surface)',
            padding: '32px',
            borderRadius: '16px',
            boxShadow: 'var(--shadow-md)',
            width: '600px',
            maxHeight: '90vh',
            display: 'flex',
            flexDirection: 'column',
            gap: '20px',
            alignItems: 'stretch',
            textAlign: 'left',
            position: 'relative',
          }}
        >
          <div style={{ position: 'absolute', top: '16px', right: '16px' }}>
            {!showCancelConfirm && status !== 'done' && (
              <Button
                variant="ghost"
                onClick={handleMinimize}
                title="Minimize to background"
              >
                <Minus size={16} />
              </Button>
            )}
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '16px',
              paddingBottom: '16px',
              borderBottom: '1px solid var(--border)',
            }}
          >
            <div style={{ color: 'var(--primary)' }}>
              <FileText size={40} />
            </div>
            <div>
              <span style={{ fontWeight: 600, fontSize: '20px', display: 'block' }}>Migration Reports Export</span>
              <span style={{ fontSize: '14px', color: 'var(--text-muted)' }}>
                {status === 'done' ? 'Reports successfully bundled.' : 'Safely generating paginated PDF reports in the background.'}
              </span>
            </div>
          </div>

          {status === 'done' && summaryStats ? (
            <div
              style={{
                backgroundColor: 'var(--primary-subtle)',
                padding: '20px',
                borderRadius: '8px',
                outline: '1px solid var(--primary)',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
                alignItems: 'center',
                textAlign: 'center',
              }}
            >
              <CheckCircle2 size={48} style={{ color: 'var(--success)' }} />
              <span style={{ fontWeight: 600, fontSize: '16px' }}>Generation Complete</span>
              <div style={{ display: 'flex', gap: '24px', marginTop: '12px' }}>
                <div>
                  <span style={{ fontSize: '14px', color: 'var(--text-muted)', display: 'block' }}>Total PDFs</span>
                  <span style={{ fontSize: '16px', fontWeight: 700 }}>{summaryStats.totalPdfs}</span>
                </div>
                <div>
                  <span style={{ fontSize: '14px', color: 'var(--text-muted)', display: 'block' }}>Total Time</span>
                  <span style={{ fontSize: '16px', fontWeight: 700 }}>{summaryStats.totalTime}</span>
                </div>
                <div>
                  <span style={{ fontSize: '14px', color: 'var(--text-muted)', display: 'block' }}>Failed</span>
                  <span style={{ fontSize: '16px', fontWeight: 700, color: summaryStats.failedCount > 0 ? 'var(--danger)' : 'inherit' }}>
                    {summaryStats.failedCount}
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  backgroundColor: 'var(--surface-subtle)',
                  padding: '10px 16px',
                  borderRadius: '8px',
                  fontSize: '12px',
                }}
              >
                <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Clock size={16} />
                    <span style={{ fontWeight: 600 }}>Total Time: {formatTime(timers.total)}</span>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontWeight: 700, fontSize: '16px', color: 'var(--primary)' }}>{overallProgress}%</span>
                  <span style={{ fontWeight: 600, color: 'var(--text-muted)' }}>Processing</span>
                  {status === 'processing' && (
                    <>
                      <div
                        style={{
                          width: '8px',
                          height: '8px',
                          borderRadius: '50%',
                          backgroundColor: 'var(--success)',
                          animationName: 'vl-heartbeat-pulse',
                          animationDuration: '1.2s',
                          animationIterationCount: 'infinite',
                          animationTimingFunction: 'ease-in-out',
                        }}
                      />
                      <style dangerouslySetInnerHTML={{ __html: `
                        @keyframes vl-heartbeat-pulse {
                          0%, 100% { opacity: 1; transform: scale(1); }
                          50% { opacity: 0.3; transform: scale(0.85); }
                        }
                      ` }} />
                    </>
                  )}
                </div>
              </div>

              <div style={{ padding: '4px 0', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    App Completion
                  </span>
                  <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-muted)' }}>
                    {completedApps} of {totalApps} apps processed
                  </span>
                </div>
                <div style={{ height: '10px', borderRadius: '5px', overflow: 'hidden' }}>
                  <ProgressBar value={totalApps > 0 ? (completedApps / totalApps) : 0} />
                </div>
              </div>

              {isStalled && status === 'processing' && (
                <div style={{ backgroundColor: 'var(--warning-subtle)', padding: '8px', borderRadius: '4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <AlertTriangle style={{ color: 'var(--warning)' }} />
                  <span style={{ fontSize: '14px', color: 'var(--warning)' }}>Generation is taking longer than expected. Please wait...</span>
                </div>
              )}

              <div
                style={{
                  width: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                  overflow: 'hidden auto',
                  maxHeight: '180px',
                  paddingRight: '8px',
                }}
              >
                {steps.map((step) => (
                  <div
                    key={step.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      textAlign: 'left',
                      padding: '8px 12px',
                      backgroundColor: activeStepId === step.id ? 'var(--primary-subtle)' : 'var(--surface-subtle)',
                      borderRadius: '8px',
                      outline: activeStepId === step.id ? '1px solid var(--primary)' : undefined,
                    }}
                  >
                    <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center' }}>
                      {step.status === 'pending' && <Circle style={{ color: 'var(--text-muted)' }} />}
                      {step.status === 'loading' && <Spinner size="tiny" />}
                      {step.status === 'success' && <CheckCircle2 style={{ color: 'var(--success)' }} />}
                      {step.status === 'error' && <XCircle style={{ color: 'var(--danger)' }} />}
                    </div>
                    <div style={{ flexGrow: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '14px', fontWeight: activeStepId === step.id ? 600 : 400 }}>
                          {step.label}
                        </span>
                        {step.status === 'loading' && step.percentage !== undefined && (
                          <span style={{ fontSize: '12px', fontVariantNumeric: 'tabular-nums' }}>{step.percentage}%</span>
                        )}
                      </div>
                      {step.status === 'loading' && (
                        <div style={{ width: '100%', marginTop: '4px' }}>
                          <ProgressBar value={(step.percentage || 0) / 100} />
                          <span style={{ fontSize: '12px', marginTop: '2px', display: 'block', color: 'var(--text-muted)' }}>
                            {step.message}
                          </span>
                        </div>
                      )}
                      {step.status === 'error' && (
                        <span style={{ fontSize: '12px', color: 'var(--danger)' }}>{step.message}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {isExportFinished ? (
            <div style={{ display: 'flex', justifyContent: 'center', paddingTop: '12px' }}>
              <Button variant="default" onClick={handleClose}>Complete & Close</Button>
            </div>
          ) : status === 'error' ? (
            <div style={{ marginTop: '12px' }}>
              <span style={{ fontSize: '14px', color: 'var(--danger)' }}>{errorMessage}</span>
              <div style={{ marginTop: '12px' }}>
                <Button variant="default" onClick={handleClose}>Close</Button>
              </div>
            </div>
          ) : showCancelConfirm ? (
            <div style={{ marginTop: '24px', padding: '20px', backgroundColor: 'var(--surface-subtle)', borderRadius: '12px', textAlign: 'center' }}>
              <AlertTriangle size={32} style={{ color: 'var(--danger)', marginBottom: '12px' }} />
              <span style={{ fontWeight: 600, fontSize: '16px', display: 'block', marginBottom: '8px' }}>Cancel Export?</span>
              <span style={{ fontSize: '14px', display: 'block', marginBottom: '20px', color: 'var(--text-muted)' }}>
                This will abort the entire generation process. All progress will be lost.
              </span>
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
                <Button variant="default" onClick={() => setShowCancelConfirm(false)}>No, Keep Exporting</Button>
                <Button variant="ghost" style={{ color: 'var(--danger)' }} onClick={handleClose}>Yes, Stop Export</Button>
              </div>
            </div>
          ) : (
            <>
              {status === 'processing' && (
                <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: '12px' }}>
                  <Button variant="outline" onClick={handleClose}>Cancel Generation</Button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Hidden container for DOM capture */}
      <div
        ref={captureRef}
        className="pdf-render-mode"
        style={{
          position: 'absolute',
          top: '-10000px',
          left: '-10000px',
          width: '1200px',
          backgroundColor: '#ffffff',
        }}
      >
        {/* The real Migration Overview, exactly as T2F captures it. What stood
            here was a hand-built five-column table of "Completed / —" with
            inline styles -- no metric cards, no charts, none of the product's
            typography, and nothing in common with the Overview on screen.
            MigrationOverview already carries 28 isPdfMode branches (white card
            backgrounds, the Switchblade header with the generation timestamp,
            the larger title, subtitle suppressed), all of which were going
            unused. */}
        {activeStepId === 'overview' && (
          <div data-pdf-section style={{ padding: "40px" }}>
            <MigrationOverview isPdfMode={true} />
          </div>
        )}

        {readyResults.map((r) => (
          activeAppId === r.appId && (
            <React.Fragment key={r.appId}>
              <div data-pdf-section style={{ padding: "40px" }}>
                <div style={{ fontSize: "28px", fontWeight: "bold", marginBottom: "20px", borderBottom: "4px solid #0078d4", paddingBottom: "10px" }}>
                  {r.appName} - Assessment Results
                </div>
                <AssessmentResultsView assessmentItem={r as any} isPdfMode={true} />
              </div>
              <div data-pdf-section style={{ padding: "40px" }}>
                <div style={{ fontSize: "28px", fontWeight: "bold", marginBottom: "20px", borderBottom: "4px solid #0078d4", paddingBottom: "10px" }}>
                  {r.appName} - Parsing Results
                </div>
                {/* Prefer the store's mapped result over the raw payload. Both
                    render, but ParsingResults' own raw normaliser is the weaker
                    of the two: it reports every table as a fact and cannot find
                    an app name (it looks for `folder_name` / `script.filename`,
                    which Qlik does not send), so the PDF disagreed with the
                    screen. app/Mapper/parsingMapper.ts derives fact/dimension
                    from relationship cardinality and reads metadata.app_name. */}
                <ParsingResults
                  data={parsingDataMap[r.appId] ? (parsingDataMap[r.appId] as any) : r.parsedData}
                  appName={parsingDataMap[r.appId]?.workbook_name || r.appName}
                  reportType="Qlik Sense"
                  dataModel={parsingDataMap[r.appId]?.model ? (parsingDataMap[r.appId] as any).model?.type : undefined}
                  isPdfMode={true}
                />
              </div>
            </React.Fragment>
          )
        ))}
      </div>
    </>
  )
}
