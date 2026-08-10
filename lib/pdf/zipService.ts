// lib/pdf/zipService.ts
import JSZip from 'jszip';
import { saveAs } from 'file-saver';

export class ZipReportService {
  private zip: JSZip;
  private failures: Array<{ name: string; stage: string; error: string }> = [];

  constructor() {
    this.zip = new JSZip();
  }

  /**
   * Adds a PDF blob to the zip archive.
   */
  addPdf(filename: string, blob: Blob) {
    this.zip.file(filename, blob);
  }

  /**
   * Logs a failure for inclusion in the summary report.
   */
  logFailure(workbookName: string, stage: string, error: string) {
    this.failures.push({ name: workbookName, stage, error });
  }

  /**
   * Generates the final ZIP and triggers the download.
   */
  async downloadZip(zipFilename: string) {
    if (this.failures.length > 0) {
      let summary = "MIGRATION REPORT DOWNLOAD SUMMARY\n";
      summary += "================================\n\n";
      summary += `Total Failures: ${this.failures.length}\n\n`;
      summary += "FAILED WORKBOOKS:\n";
      
      this.failures.forEach(f => {
        summary += `--------------------------------\n`;
        summary += `Workbook: ${f.name}\n`;
        summary += `Stage:    ${f.stage}\n`;
        summary += `Error:    ${f.error}\n`;
      });
      
      this.zip.file("FAILURE_SUMMARY.txt", summary);
    }

    const content = await this.zip.generateAsync({ 
      type: "blob",
      compression: "STORE" // PDFs are already compressed, avoid double compression memory spikes
    });
    saveAs(content, zipFilename);
  }
}
