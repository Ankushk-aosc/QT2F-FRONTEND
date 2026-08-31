// lib/pdf/pdfCaptureUtils.ts
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

export interface CaptureProgress {
  stage: 'capturing' | 'generating' | 'finalizing';
  percentage: number;
  message?: string;
  logMessage?: string;
}

const yieldToMain = () => new Promise(r => setTimeout(r, 0));

/**
 * Captures a DOM element and transforms it into a high-fidelity, paginated PDF.
 * Uses a smart pagination algorithm to avoid cutting through text/charts.
 */
export async function captureElementToPdfBlob(
  element: HTMLElement, 
  onProgress?: (progress: CaptureProgress) => void
): Promise<Blob> {
  // ── A4 page geometry ──────────────────────────────────────────────
  const MARGIN_MM   = 10;          // mm – margins
  let pdf: jsPDF | null = new jsPDF('p', 'mm', 'a4');
  const pdfWidth    = pdf.internal.pageSize.getWidth();   // 210 mm
  const pdfHeight   = pdf.internal.pageSize.getHeight();  // 297 mm
  const printWidth  = pdfWidth  - MARGIN_MM * 2;          // 190 mm
  const printHeight = pdfHeight - MARGIN_MM * 2;          // 277 mm

  if (!element) {
    throw new Error("[CaptureError] Target element for PDF capture is null.");
  }

  // Pre-capture validity guard — final safety net before the expensive canvas operation.
  // Uses scrollWidth/scrollHeight (works for off-screen positioned elements, unlike getBoundingClientRect).
  if (!element.isConnected) {
    throw new Error("[CaptureError] Target element is not connected to the DOM (was it unmounted before capture?).");
  }
  if (element.scrollWidth === 0 || element.scrollHeight === 0) {
    throw new Error(
      `[CaptureError] Target element has no scroll dimensions (${element.scrollWidth}x${element.scrollHeight}). ` +
      `Render may not have completed.`
    );
  }

  const sections = element.querySelectorAll('[data-pdf-section]');
  const totalSections = sections.length > 0 ? sections.length : 1;
  const targetSections = sections.length > 0 ? Array.from(sections) : [element];

  onProgress?.({ 
    stage: 'capturing', 
    percentage: 0, 
    message: 'Analyzing DOM structure...',
    logMessage: `DOM Analysis: Found ${sections.length} [data-pdf-section] nodes within container.`
  });

  let isFirstPage = true;

  for (let i = 0; i < targetSections.length; i++) {
    const section = targetSections[i] as HTMLElement;
    
    onProgress?.({ 
      stage: 'capturing', 
      percentage: Math.round((i / totalSections) * 50),
      message: `Capturing section ${i + 1} of ${totalSections}...`,
      logMessage: `Initiating html2canvas capture for section ${i + 1}...`
    });

    // Yield before heavy html2canvas operation
    await yieldToMain();

    // Capture the section at 1× resolution to save memory
    let srcCanvas: HTMLCanvasElement | null = await html2canvas(section, {
      scale: 1, // Reduced from 2 to prevent OOM on large tables
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff',
      windowWidth: 1200,
      removeContainer: true, // Force html2canvas to cleanup its cloned DOM
    });

    const srcW = srcCanvas.width;
    const srcH = srcCanvas.height;

    // How many source-canvas pixels equal one printable-height slice?
    const srcPageH = Math.floor((printHeight / printWidth) * srcW);
    let srcY = 0;

    onProgress?.({ 
      stage: 'generating', 
      percentage: 50 + Math.round((i / totalSections) * 40),
      message: `Processing page slices for section ${i + 1}...`,
      logMessage: `Canvas rendered (${srcW}x${srcH}). Slicing into PDF pages...`
    });

    while (srcY < srcH) {
      // Yield to main thread every slice loop to keep UI unblocked
      await yieldToMain();
      let sliceH = Math.min(srcPageH, srcH - srcY);

      // ── Smart Pagination ──
      if (srcY + sliceH < srcH) {
        const searchHeight = Math.floor(srcPageH * 0.25);
        const searchY = srcY + sliceH - searchHeight;
        
        let searchCanvas: HTMLCanvasElement | null = document.createElement('canvas');
        searchCanvas.width = srcW;
        searchCanvas.height = searchHeight;
        const searchCtx = searchCanvas.getContext('2d', { willReadFrequently: true })!;
        searchCtx.drawImage(srcCanvas, 0, searchY, srcW, searchHeight, 0, 0, srcW, searchHeight);
        const imageData = searchCtx.getImageData(0, 0, srcW, searchHeight);
        
        const rowDarkPixels = new Int32Array(searchHeight);
        let minDarkPixels = srcW;
        
        for (let y = 0; y < searchHeight; y++) {
          let darkCount = 0;
          for (let x = 0; x < srcW; x++) {
            const index = (y * srcW + x) * 4;
            if (imageData.data[index] < 235 || imageData.data[index + 1] < 235 || imageData.data[index + 2] < 235) {
              darkCount++;
            }
          }
          rowDarkPixels[y] = darkCount;
          if (darkCount < minDarkPixels) minDarkPixels = darkCount;
        }
        
        if (minDarkPixels <= 50) {
          let bestY = searchHeight - 1;
          let maxContiguous = 0;
          let currentContiguous = 0;
          let currentStart = -1;
          
          for (let y = 0; y < searchHeight; y++) {
            if (rowDarkPixels[y] <= minDarkPixels + 5) {
              if (currentContiguous === 0) currentStart = y;
              currentContiguous++;
            } else {
              if (currentContiguous > maxContiguous) {
                maxContiguous = currentContiguous;
                bestY = currentStart + Math.floor(currentContiguous / 2);
              }
              currentContiguous = 0;
            }
          }
          if (currentContiguous > maxContiguous) {
            bestY = currentStart + Math.floor(currentContiguous / 2);
          }
          if (maxContiguous >= 2) {
            sliceH = sliceH - (searchHeight - bestY);
          }
        }
        
        // Cleanup search canvas
        searchCanvas.width = 0;
        searchCanvas.height = 0;
        searchCanvas = null;
      }

      let sliceCanvas: HTMLCanvasElement | null = document.createElement('canvas');
      sliceCanvas.width  = srcW;
      sliceCanvas.height = sliceH;

      const ctx = sliceCanvas.getContext('2d')!;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, srcW, sliceH);
      ctx.drawImage(srcCanvas, 0, srcY, srcW, sliceH, 0, 0, srcW, sliceH);

      const sliceData = sliceCanvas.toDataURL('image/jpeg', 0.85); // slightly lower quality for smaller PDF
      const sliceHeightMM = (sliceH / srcW) * printWidth;

      if (!isFirstPage) {
        pdf.addPage();
      }
      isFirstPage = false;
      
      onProgress?.({ 
        stage: 'generating', 
        percentage: 50 + Math.round((i / totalSections) * 40),
        message: `Adding page to PDF...`,
        logMessage: `Adding generated page slice to PDF stream...`
      });

      pdf.addImage(sliceData, 'JPEG', MARGIN_MM, MARGIN_MM, printWidth, sliceHeightMM);
      srcY += sliceH;
      
      // Aggressive cleanup of slice canvas
      sliceCanvas.width = 0;
      sliceCanvas.height = 0;
      sliceCanvas = null;
    }
    
    // Explicitly clear source canvas to free memory immediately
    if (srcCanvas) {
      srcCanvas.width = 0;
      srcCanvas.height = 0;
      srcCanvas = null;
    }
  }

  onProgress?.({ 
    stage: 'finalizing', 
    percentage: 100, 
    message: 'Finalizing PDF document...',
    logMessage: 'Compressing PDF and generating binary blob...'
  });
  
  await yieldToMain();
  const blob = pdf.output('blob');
  
  // Try to free jsPDF instance memory
  pdf = null;
  
  return blob;
}
