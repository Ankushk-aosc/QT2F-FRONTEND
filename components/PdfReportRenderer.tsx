"use client"

import React, { useState, useEffect, useRef, useMemo } from 'react'
import { Spinner } from "@/components/ui/spinner"
import { Button } from "@/components/ui/button"
import { ProgressBar } from "@/components/ui/progress"
import {
  FileText,
  CheckCircle2,
  Circle,
  XCircle,
  Clock,
  AlertTriangle,
  ChevronUp,
  Minus,
} from "lucide-react"
import { MigrationOverview } from './tabs/MigrationOverview'
import { AssessmentTab } from './tabs/AssessmentTab'
import { ParsingTab } from './tabs/ParsingTab'
import { useAgentStore } from '@/stores/agent.store'
import { useParsingStore } from '@/stores/parsing.store'
import { captureElementToPdfBlob, CaptureProgress } from '@/lib/pdf/pdfCaptureUtils'
import { ZipReportService } from '@/lib/pdf/zipService'
import { useToast } from '@/hooks/use-toast'

function cx(...parts: Array<string | undefined | false>) {
  return parts.filter(Boolean).join(" ")
}

interface GenerationStep {
  id: string;
  label: string;
  status: 'pending' | 'loading' | 'success' | 'error';
  percentage?: number;
  message?: string;
  type: 'overview' | 'workbook' | 'zip';
  workbookId?: string;
}

interface PdfReportRendererProps {
  onClose: () => void;
}

export function PdfReportRenderer({ onClose }: PdfReportRendererProps) {
  const { currentWorkbookIds, currentRunId } = useAgentStore()
  const assessmentData = useAgentStore(state => state.assessmentData)
  const parsingData = useParsingStore(state => state.parsingData)
  const captureRef = useRef<HTMLDivElement>(null)
  const { toast } = useToast()

  const [status, setStatus] = useState<'preparing' | 'processing' | 'done' | 'error'>('preparing')
  const [errorMessage, setErrorMessage] = useState("")
  const [steps, setSteps] = useState<GenerationStep[]>([])
  const [activeStepId, setActiveStepId] = useState<string | null>(null)
  const [activeWorkbookId, setActiveWorkbookId] = useState<string | null>(null)
  const isCancelled = useRef(false);

  // ── New UX Enhancements State ─────────────────────────────────────────
  const [logs, setLogs] = useState<{ time: string, msg: string }[]>([])
  const logsEndRef = useRef<HTMLDivElement>(null)
  const [timers, setTimers] = useState({ total: 0, workbook: 0 })
  const startTimeRef = useRef<number>(0)
  const workbookStartTimeRef = useRef<number>(0)
  const lastLogTimeRef = useRef<number>(Date.now())
  const [isStalled, setIsStalled] = useState(false)
  const [heartbeatFlip, setHeartbeatFlip] = useState(false)
  const [overallProgress, setOverallProgress] = useState(0)

  const [summaryStats, setSummaryStats] = useState<{
    totalPdfs: number;
    failedCount: number;
    totalTime: string;
  } | null>(null)

  const [isMinimized, setIsMinimized] = useState(false)
  const [showCancelConfirm, setShowCancelConfirm] = useState(false)
  const logScrollPosRef = useRef<number>(0)

  const completedWorkbooks = useMemo(() => {
    return steps.filter(s => s.type === 'workbook' && (s.status === 'success' || s.status === 'error')).length;
  }, [steps]);

  // Dedicated Completion Gate - top level rendering authority
  const isExportFinished = useMemo(() => status === 'done', [status]);

  // Strict Cleanup: Force reset cancellation states when export finishes to prevent async race conditions
  useEffect(() => {
    if (isExportFinished) {
      setShowCancelConfirm(false);
    }
  }, [isExportFinished]);

  const totalWorkbooks = useMemo(() => {
    return currentWorkbookIds.length;
  }, [currentWorkbookIds]);

  const getWorkbookName = (wbId: string) => {
    if (!currentRunId) return wbId;
    const fromParsing = parsingData[wbId]?.workbook_name;
    const fromAssessment = assessmentData[currentRunId]?.[wbId]?.workbook_name || assessmentData[currentRunId]?.[wbId]?.payload?.workbook_name;
    return fromParsing || fromAssessment || wbId;
  };

  // Add Log helper
  const addLog = (msg: string) => {
    const time = new Date().toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
    setLogs(prev => [...prev, { time, msg }]);
    lastLogTimeRef.current = Date.now();
    setIsStalled(false);
  }

  // Auto-scroll logs
  useEffect(() => {
    if (logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [logs]);

  // Timers & Heartbeat & Stall Detection
  useEffect(() => {
    if (status !== 'processing') return;

    const interval = setInterval(() => {
      const now = Date.now();
      setTimers({
        total: Math.floor((now - startTimeRef.current) / 1000),
        workbook: Math.floor((now - workbookStartTimeRef.current) / 1000)
      });
      setHeartbeatFlip(f => !f);

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

  // Initialize steps
  useEffect(() => {
    if (currentWorkbookIds.length === 0) return;

    const initialSteps: GenerationStep[] = [
      { id: 'overview', label: 'Project Migration Overview', status: 'pending', type: 'overview' },
      ...currentWorkbookIds.map(id => ({
        id: `wb-${id}`,
        label: `Workbook: ${getWorkbookName(id)}`,
        status: 'pending' as const,
        type: 'workbook' as const,
        workbookId: id
      })),
      { id: 'zip', label: 'Finalizing ZIP Archive', status: 'pending', type: 'zip' }
    ];
    setSteps(initialSteps);
  }, [currentWorkbookIds, currentRunId]);

  const isDataReady = useMemo(() => {
    if (!currentRunId || currentWorkbookIds.length === 0) return false;
    return currentWorkbookIds.every(wbId => {
      const hasAssessment = !!assessmentData[currentRunId]?.[wbId];
      const hasParsing = !!parsingData[wbId];
      return hasAssessment && hasParsing;
    });
  }, [currentWorkbookIds, currentRunId, assessmentData, parsingData]);

  const updateStep = (id: string, updates: Partial<GenerationStep>) => {
    setSteps(prev => prev.map(s => s.id === id ? { ...s, ...updates } : s));
  };

  /**
   * waitForRenderReady — True render readiness detection.
   *
   * Replaces the broken stabilizeDOM which used getBoundingClientRect()
   * (always returns 0x0 for off-screen positioned elements at top:-10000px).
   *
   * Uses scrollWidth/scrollHeight which correctly report content size
   * for off-screen absolutely-positioned containers.
   *
   * Validates:
   *   1. node exists and node.isConnected === true
   *   2. scrollWidth > 0 AND scrollHeight > 0
   *   3. [data-pdf-section] elements present and each has scrollHeight > 0
   *   4. All <img> elements fully loaded (naturalWidth > 0 or complete)
   *   5. SVG/chart quiescence — no pending animations or transforms in flux
   *   6. All <table> elements have at least one rendered row
   *   7. document.fonts.ready resolved
   *   8. DOM quiescence — MutationObserver detects no mutations for 400ms
   */
  const waitForRenderReady = async (
    targetRef: React.RefObject<HTMLDivElement>,
    context: string,
    timeoutMs = 45000
  ): Promise<HTMLElement> => {
    const POLL_INTERVAL = 350;
    const QUIESCENCE_WAIT = 400; // ms of DOM quiet required before capture
    const start = Date.now();

    addLog(`[${context}] 🔍 Render start — polling for full DOM readiness...`);

    while (Date.now() - start < timeoutMs) {
      if (isCancelled.current) throw new Error("Cancelled by user");

      const el = targetRef.current;

      // ── Check 1: Node exists and is connected ──────────────────────
      if (!el || !el.isConnected) {
        addLog(`[${context}] ⏳ Container not yet mounted (isConnected: ${el?.isConnected ?? false})`);
        await new Promise(r => setTimeout(r, POLL_INTERVAL));
        continue;
      }

      // ── Check 2: scrollWidth/scrollHeight (works for off-screen elements) ──
      const sw = el.scrollWidth;
      const sh = el.scrollHeight;
      if (sw === 0 || sh === 0) {
        addLog(`[${context}] ⏳ Container has no scroll dimensions yet (${sw}x${sh})`);
        await new Promise(r => setTimeout(r, POLL_INTERVAL));
        continue;
      }

      // ── Check 3: data-pdf-section elements present and sized ───────
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

      // ── Check 4: Images fully loaded ───────────────────────────────
      const allImgs = Array.from(el.querySelectorAll('img')) as HTMLImageElement[];
      const unloadedImgs = allImgs.filter(img => !img.complete || img.naturalWidth === 0);
      if (unloadedImgs.length > 0) {
        addLog(`[${context}] ⏳ Waiting for ${unloadedImgs.length}/${allImgs.length} images to load...`);
        // Force-wait for each unloaded image with a short per-image timeout
        await Promise.all(
          unloadedImgs.map(
            img =>
              new Promise<void>(resolve => {
                if (img.complete && img.naturalWidth > 0) { resolve(); return; }
                const onLoad = () => { img.removeEventListener('load', onLoad); img.removeEventListener('error', onLoad); resolve(); };
                img.addEventListener('load', onLoad);
                img.addEventListener('error', onLoad); // resolve even on error so we don't hang
                // Safety timeout per image
                setTimeout(resolve, 5000);
              })
          )
        );
        addLog(`[${context}] 🖼️ Image ready — all ${allImgs.length} images loaded`);
      } else if (allImgs.length > 0) {
        addLog(`[${context}] 🖼️ Image ready — all ${allImgs.length} images already loaded`);
      }

      // ── Check 5: SVG / Chart quiescence ────────────────────────────
      // Charts that animate (D3, Recharts, etc.) mutate SVG attributes.
      // We check that SVG paths are not in a "mid-animation" state by
      // reading a sample of path `d` attributes and confirming they
      // stay stable across two quick samples.
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

      // ── Check 6: Tables rendered (have at least one body row) ───────
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

      // ── Check 7: Fonts loaded ───────────────────────────────────────
      try {
        await document.fonts.ready;
        addLog(`[${context}] 🔤 Fonts ready — document.fonts.ready resolved`);
      } catch (_) {
        addLog(`[${context}] ⚠️ document.fonts.ready threw — continuing anyway`);
      }

      // ── Check 8: DOM quiescence (MutationObserver) ─────────────────
      // Wait for the DOM to stop mutating for QUIESCENCE_WAIT ms.
      const quiescent = await new Promise<boolean>(resolve => {
        let timer: ReturnType<typeof setTimeout> | null = null;
        const observer = new MutationObserver(() => {
          // Any mutation resets the quiet timer
          if (timer) clearTimeout(timer);
          timer = setTimeout(() => {
            observer.disconnect();
            resolve(true);
          }, QUIESCENCE_WAIT);
        });
        observer.observe(el, { childList: true, subtree: true, attributes: true, characterData: false });
        // Kick off the initial timer in case there are zero mutations right away
        timer = setTimeout(() => {
          observer.disconnect();
          resolve(true);
        }, QUIESCENCE_WAIT);
        // Hard cap: if somehow still mutating after 10s, give up and proceed
        setTimeout(() => { observer.disconnect(); resolve(false); }, 10000);
      });

      if (!quiescent) {
        addLog(`[${context}] ⚠️ DOM quiescence timeout — proceeding anyway after 10s`);
      } else {
        addLog(`[${context}] ✅ DOM quiescent for ${QUIESCENCE_WAIT}ms — no mutations detected`);
      }

      // ── All checks passed ───────────────────────────────────────────
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

  /**
   * captureWithRetry — Wraps captureElementToPdfBlob with one safe retry.
   * On first failure, waits 2s, re-validates the element is still connected,
   * then attempts capture again before propagating the error.
   */
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
    const totalGlobalSteps = currentWorkbookIds.length + 2; // Overview + Workbooks + ZIP
    let currentGlobalStep = 0;

    try {
      // 1. Process Overview
      setActiveStepId('overview');
      updateStep('overview', { status: 'loading', percentage: 0, message: 'Preparing overview components...' });
      addLog(`[Project Overview] 🔧 Workbook mount — activating hidden DOM`);

      if (isCancelled.current) throw new Error("Cancelled by user");

      try {
        addLog(`[Project Overview] 🔍 Render start — waiting for full visual readiness...`);
        const stableEl = await waitForRenderReady(captureRef, "Project Overview");
        addLog(`[Project Overview] ✅ Render ready`);

        addLog(`[Project Overview] 🎯 Capture start`);
        updateStep('overview', { percentage: 10, message: 'Capturing overview...' });
        const overviewBlob = await captureWithRetry(stableEl, "Project Overview", (p: CaptureProgress) => {
          updateStep('overview', { percentage: p.percentage, message: p.message });
          if (p.logMessage) addLog(`[Overview] ${p.logMessage}`);
        });
        addLog(`[Project Overview] ✅ Capture finish — PDF generated`);

        addLog(`[Project Overview] 📦 Adding Overview PDF to ZIP archive...`);
        zipService.addPdf(`00_Migration_Overview_${timestamp}.pdf`, overviewBlob);
        addLog(`[Project Overview] ✅ PDF added to ZIP`);
        updateStep('overview', { status: 'success', percentage: 100, message: 'Completed' });
      } catch (err: any) {
        if (isCancelled.current) throw err;
        const contextError = `[Project Overview][Capture] ${err.message}`;
        addLog(`❌ ERROR: ${contextError}`);
        zipService.logFailure("Project Overview", "Capture", err.message || "Unknown error");
        updateStep('overview', { status: 'error', message: 'Failed to capture overview' });
      }

      currentGlobalStep++;
      setOverallProgress(Math.round((currentGlobalStep / totalGlobalSteps) * 100));

      // Memory Cooldown after overview
      addLog(`[Project Overview] 🧹 Cleanup start`);
      await new Promise(r => setTimeout(r, 50));
      addLog(`[Project Overview] ✅ Cleanup finish`);

      // 2. Process Workbooks sequentially
      for (const wbId of currentWorkbookIds) {
        if (isCancelled.current) throw new Error("Cancelled by user");

        workbookStartTimeRef.current = Date.now();
        const stepId = `wb-${wbId}`;
        const wbName = getWorkbookName(wbId);
        const wbShort = wbName.length > 20 ? wbName.substring(0, 20) + '…' : wbName;

        // ── MOUNT ────────────────────────────────────────────────────
        addLog(`[${wbShort}] 🔧 Workbook mount — activating hidden DOM`);
        updateStep(stepId, { status: 'loading', percentage: 0, message: 'Mounting workbook DOM...' });
        setActiveStepId(stepId);
        setActiveWorkbookId(wbId);
        // Yield to React so the state update and DOM mount happens before we poll
        await new Promise(r => setTimeout(r, 0));

        if (isCancelled.current) throw new Error("Cancelled by user");

        try {
          // ── RENDER READINESS ────────────────────────────────────────
          addLog(`[${wbShort}] 🔍 Render start — polling for full visual readiness...`);
          updateStep(stepId, { percentage: 5, message: 'Waiting for render readiness...' });
          const stableEl = await waitForRenderReady(captureRef, wbShort);
          addLog(`[${wbShort}] ✅ Render ready`);

          // ── CAPTURE ─────────────────────────────────────────────────
          addLog(`[${wbShort}] 🎯 Capture start`);
          updateStep(stepId, { percentage: 10, message: 'Capturing workbook...' });
          const wbBlob = await captureWithRetry(stableEl, wbShort, (p: CaptureProgress) => {
            updateStep(stepId, { percentage: p.percentage, message: p.message });
            if (p.logMessage) addLog(`[${wbShort}] ${p.logMessage}`);
          });
          addLog(`[${wbShort}] ✅ Capture finish — PDF generated`);

          // ── ADD TO ZIP ──────────────────────────────────────────────
          const safeName = wbName.replace(/[/\\?%*:|"<>]/g, '_');
          addLog(`[${wbShort}] 📦 Adding PDF to ZIP archive...`);
          zipService.addPdf(`${safeName}_Report.pdf`, wbBlob);
          addLog(`[${wbShort}] ✅ PDF added to ZIP`);
          updateStep(stepId, { status: 'success', percentage: 100, message: 'Completed' });
        } catch (err: any) {
          if (isCancelled.current) throw err;
          const contextError = `[${wbName}][Capture] ${err.message}`;
          addLog(`❌ ERROR: ${contextError}`);
          zipService.logFailure(wbName, "Capture", err.message || "Unknown error");
          updateStep(stepId, { status: 'error', message: 'Failed to capture workbook' });
        } finally {
          // ── CLEANUP — always runs AFTER capture resolves/rejects ────
          // This is the critical fix: cleanup must never precede capture.
          addLog(`[${wbShort}] 🧹 Cleanup start — unmounting workbook DOM`);
          setActiveWorkbookId(null);
          await new Promise(r => setTimeout(r, 50));
          addLog(`[${wbShort}] ✅ Cleanup finish`);
        }

        currentGlobalStep++;
        setOverallProgress(Math.round((currentGlobalStep / totalGlobalSteps) * 100));
      }

      if (isCancelled.current) throw new Error("Cancelled by user");

      // 3. Finalize ZIP
      workbookStartTimeRef.current = Date.now();
      addLog("All renders complete. Preparing final ZIP bundle...");
      setActiveWorkbookId(null);
      setActiveStepId('zip');
      updateStep('zip', { status: 'loading', percentage: 50, message: 'Bundling reports...' });

      await zipService.downloadZip(`Migration_Reports_${timestamp}.zip`);
      addLog("ZIP bundle created and browser download triggered.");
      updateStep('zip', { status: 'success', percentage: 100, message: 'Archive downloaded' });

      setOverallProgress(100);

      // Extract success stats before destroying zipService
      // JSZip doesn't directly expose final byte size easily without generating twice, we will count files.
      // @ts-ignore
      const totalFiles = Object.keys(zipService.zip.files).length;
      // @ts-ignore
      const failures = zipService.failures.length;

      setSummaryStats({
        totalPdfs: totalFiles - (failures > 0 ? 1 : 0), // Subtract FAILURE_SUMMARY.txt if exists
        failedCount: failures,
        totalTime: formatTime(Math.floor((Date.now() - startTimeRef.current) / 1000))
      });

      // Cleanup
      zipService = null;
      addLog("Generation pipeline completely successfully.");

      toast({
        title: "PDF Export Complete",
        description: "All reports have been successfully generated and bundled.",
      });

      setStatus('done');
      setIsMinimized(false); // Auto-maximize on completion
      setShowCancelConfirm(false); // Clear any pending cancel confirmation

    } catch (err: any) {
      if (err.message === "Cancelled by user") {
        addLog("Process safely cancelled by user. Terminating loops.");
        return; // Exit silently
      }
      addLog(`CRITICAL ERROR: ${err.message}`);
      setErrorMessage(err.message || "A critical error occurred during the zipping process.");

      toast({
        title: "Export Failed",
        description: err.message || "A critical error occurred.",
        variant: "destructive",
      });

      setStatus('error');
      setIsMinimized(false); // Auto-maximize on error
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

    // Capture scroll position before hiding
    if (logsEndRef.current?.parentElement) {
      logScrollPosRef.current = logsEndRef.current.parentElement.scrollTop;
    }
    setIsMinimized(true);
  };

  const handleRestore = () => {
    setIsMinimized(false);
  };

  // Restore scroll position when maximizing
  useEffect(() => {
    if (!isMinimized && logsEndRef.current?.parentElement) {
      // Small timeout to ensure DOM is rendered before restoring scroll
      setTimeout(() => {
        if (logsEndRef.current?.parentElement) {
          logsEndRef.current.parentElement.scrollTop = logScrollPosRef.current;
        }
      }, 50);
    }
  }, [isMinimized]);

  return (
    <>
      {/* Floating Minimized Widget */}
      {isMinimized && (
        <div className="pdf-minimized-widget" onClick={handleRestore}>
          <Spinner size="tiny" />
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontWeight: 600, fontSize: "12px" }}>Generating Reports...</span>
            <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>
              {overallProgress}% • {activeWorkbookId ? getWorkbookName(activeWorkbookId) : 'Overview'}
            </span>
          </div>
          <ChevronUp size={16} style={{ marginLeft: '8px' }} />
        </div>
      )}

      {/* Main Modal Dialog */}
      <div
        className={cx("pdf-overlay", isMinimized && "vl-hidden")}
        style={isMinimized ? { display: 'none' } : {}}
        onClick={(e) => {
          if (e.target === e.currentTarget) {
            handleMinimize();
          }
        }}
      >
        <div className="pdf-modal" style={{ position: 'relative' }}>
          {/* Minimize Button */}
          <div className="pdf-minimize-button">
            {!showCancelConfirm && status !== 'done' && (
              <Button
                variant="ghost"
                size="icon"
                onClick={handleMinimize}
                title="Minimize to background"
              >
                <Minus size={24} />
              </Button>
            )}
          </div>


        {/* Header */}
        <div className="pdf-header">
          <div style={{ color: "var(--primary)" }}>
            <FileText size={40} />
          </div>
          <div>
            <span style={{ fontWeight: 600, fontSize: "18px", display: 'block' }}>Migration Reports Export</span>
            <span style={{ fontSize: "13px", color: "var(--text-muted)" }}>
              {status === 'done' ? 'Reports successfully bundled.' : 'Safely generating paginated PDF reports in the background.'}
            </span>
          </div>
        </div>

        {status === 'done' && summaryStats ? (
          <div className="pdf-summary-panel">
            <CheckCircle2 size={48} style={{ color: "var(--success)" }} />
            <span style={{ fontWeight: 600, fontSize: "16px" }}>Generation Complete</span>
            <div style={{ display: 'flex', gap: '24px', marginTop: '12px' }}>
              <div>
                <span style={{ fontSize: "13px", color: "var(--text-muted)", display: 'block' }}>Total PDFs</span>
                <span style={{ fontSize: "16px", fontWeight: 700 }}>{summaryStats.totalPdfs}</span>
              </div>
              <div>
                <span style={{ fontSize: "13px", color: "var(--text-muted)", display: 'block' }}>Total Time</span>
                <span style={{ fontSize: "16px", fontWeight: 700 }}>{summaryStats.totalTime}</span>
              </div>
              <div>
                <span style={{ fontSize: "13px", color: "var(--text-muted)", display: 'block' }}>Failed</span>
                <span style={{ fontSize: "16px", fontWeight: 700, color: summaryStats.failedCount > 0 ? "var(--danger)" : 'inherit' }}>
                  {summaryStats.failedCount}
                </span>
              </div>
            </div>
          </div>
        ) : (
          <>
            {/* Status Bar */}
            <div className="pdf-status-bar">
              <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Clock size={16} />
                  <span style={{ fontWeight: 600 }}>Total Time: {formatTime(timers.total)}</span>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontWeight: 700, fontSize: "16px", color: "var(--primary)" }}>{overallProgress}%</span>
                <span style={{ fontWeight: 600, color: "var(--text-secondary)" }}>Processing</span>
                {status === 'processing' && (
                  <div className="pdf-heartbeat" style={{ opacity: heartbeatFlip ? 1 : 0.3, transition: 'opacity 0.2s' }} />
                )}
              </div>
            </div>

            {/* Overall Workbook Progress Bar */}
            <div style={{ padding: '4px 0', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--text-muted)", textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Workbook Completion
                </span>
                <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-secondary)" }}>
                  {completedWorkbooks} of {totalWorkbooks} workbooks processed
                </span>
              </div>
              <ProgressBar value={totalWorkbooks > 0 ? (completedWorkbooks / totalWorkbooks) : 0} />
            </div>

            {/* Stalled Warning */}
            {isStalled && status === 'processing' && (
              <div style={{ backgroundColor: "var(--warning-subtle)", padding: '8px', borderRadius: '4px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <AlertTriangle size={20} style={{ color: "var(--warning)" }} />
                <span style={{ fontSize: "13px", color: "var(--warning)" }}>Generation is taking longer than expected. Please wait...</span>
              </div>
            )}

            {/* Step List */}
            <div className="pdf-step-list">
              {steps.map((step) => (
                <div
                  key={step.id}
                  className={cx("pdf-step-item", activeStepId === step.id && "pdf-active-step")}
                >
                  <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center' }}>
                    {step.status === 'pending' && <Circle size={24} style={{ color: "var(--text-muted)" }} />}
                    {step.status === 'loading' && <Spinner size="tiny" />}
                    {step.status === 'success' && <CheckCircle2 size={24} style={{ color: "var(--success)" }} />}
                    {step.status === 'error' && <XCircle size={24} style={{ color: "var(--danger)" }} />}
                  </div>
                  <div className="pdf-step-info">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: "13px", fontWeight: activeStepId === step.id ? 600 : 400 }}>
                        {step.label}
                      </span>
                      {step.status === 'loading' && step.percentage !== undefined && (
                        <span style={{ fontSize: "11px", fontVariantNumeric: 'tabular-nums' }}>{step.percentage}%</span>
                      )}
                    </div>
                    {step.status === 'loading' && (
                      <div className="pdf-progress">
                        <ProgressBar value={(step.percentage || 0) / 100} />
                        <span style={{ fontSize: "11px", marginTop: '2px', display: 'block', color: "var(--text-muted)" }}>
                          {step.message}
                        </span>
                      </div>
                    )}
                    {step.status === 'error' && (
                      <span style={{ fontSize: "11px", color: "var(--danger)" }}>{step.message}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Live Logs */}
          </>
        )}

        {/* Footer Actions - Strict Priority Order: COMPLETED > ERROR > ACTIVE > CANCEL */}
        {isExportFinished ? (
          <div style={{ display: 'flex', justifyContent: 'center', paddingTop: '12px' }}>
            <Button onClick={handleClose}>Complete & Close</Button>
          </div>
        ) : status === 'error' ? (
          <div style={{ marginTop: '12px' }}>
            <span style={{ fontSize: "13px", color: "var(--danger)" }}>{errorMessage}</span>
            <div style={{ marginTop: '12px' }}>
              <Button onClick={handleClose}>Close</Button>
            </div>
          </div>
        ) : showCancelConfirm ? (
          <div style={{ marginTop: '24px', padding: '20px', backgroundColor: "var(--muted)", borderRadius: '12px', textAlign: 'center' }}>
            <AlertTriangle size={32} style={{ color: "var(--danger)", marginBottom: '12px' }} />
            <span style={{ fontWeight: 600, fontSize: "16px", display: 'block', marginBottom: '8px' }}>Cancel Export?</span>
            <span style={{ fontSize: "13px", display: 'block', marginBottom: '20px', color: "var(--text-secondary)" }}>
              This will abort the entire generation process. All progress will be lost.
            </span>
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
              <Button onClick={() => setShowCancelConfirm(false)}>No, Keep Exporting</Button>
              <Button variant="ghost" style={{ color: "var(--danger)" }} onClick={handleClose}>Yes, Stop Export</Button>
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

      {/* Hidden container for rendering the full UI state */}
      <div ref={captureRef} className={cx("pdf-hidden-container", "pdf-render-mode")}>
        {/* Render Overview ONLY when activeStepId is 'overview' */}
        {activeStepId === 'overview' && (
          <div data-pdf-section style={{ padding: "40px" }}>
            <MigrationOverview isPdfMode={true} />
          </div>
        )}

        {/* Render ACTIVE Workbook ONLY when activeWorkbookId matches */}
        {currentWorkbookIds.map((wbId) => (
          activeWorkbookId === wbId && (
            <React.Fragment key={wbId}>
              <div data-pdf-section style={{ padding: "40px" }}>
                <div style={{ fontSize: "28px", fontWeight: "bold", marginBottom: "20px", borderBottom: "4px solid #0078d4", paddingBottom: "10px" }}>
                  Workbook: {getWorkbookName(wbId)} - Assessment Results
                </div>
                <AssessmentTab selectedWorkbookId={wbId} isPdfMode={true} />
              </div>
              <div data-pdf-section style={{ padding: "40px" }}>
                <div style={{ fontSize: "28px", fontWeight: "bold", marginBottom: "20px", borderBottom: "4px solid #0078d4", paddingBottom: "10px" }}>
                  Workbook: {getWorkbookName(wbId)} - Parsing Results
                </div>
                <ParsingTab workbookId={wbId} isPdfMode={true} />
              </div>
            </React.Fragment>
          )
        ))}
      </div>
    </>
  )
}
