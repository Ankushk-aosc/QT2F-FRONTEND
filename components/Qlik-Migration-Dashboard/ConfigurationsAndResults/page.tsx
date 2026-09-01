"use client";

import React, { useState, useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ConfigurationsContent from "@/components/tabs/ConfigurationsContent";
import { MigrationOverview } from "@/components/tabs/MigrationOverview";
import { ResultTab } from "@/components/tabs/ResultTab";
import { useDashboardStore } from "@/stores/dashboard.store";
import { AssessmentData, MappedData, ParsedData, ReportGenerationData, AppProcessState } from "@/types/assessment";

// Same pattern as the Tableau side's PdfReportRenderer (components/tabs/MigrationTab.tsx):
// jspdf/html2canvas/jszip only load when the user actually generates a PDF,
// not whenever this page mounts.
const QlikPdfReportRenderer = dynamic(
  () => import("@/components/QlikPdfReportRenderer").then(mod => mod.QlikPdfReportRenderer),
  { ssr: false }
);

function cx(...parts: Array<string | false | undefined>) {
  return parts.filter(Boolean).join(" ");
}

// Reuses the Tableau workspace's own sub-tab classes (mt-subTab*, defined in
// globals.css) so the Qlik and Tableau workspaces present the same tab strip
// instead of two independently-styled ones.
const styles = {
  subTabsWrapper: "mt-subTabsWrapper",
  subTabList: "mt-subTabList",
  subTabBase: "mt-subTabBase",
  subTabSelected: "mt-subTabSelected",
  subTabDisabled: "mt-subTabDisabled",
};

interface ApiResult {
  appId: string;
  appName: string;
  folderName?: string;
  assessmentData?: AssessmentData;
  parsedData?: ParsedData;
  mappedData?: MappedData;
  reportGenData?: ReportGenerationData;
}

interface ConfigurationsAndResultsProps {
  isAssessmentTriggered: boolean;
  dropdownAppId: string;
  onDropdownChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  apiResults: ApiResult[];
  processStates: AppProcessState;
  backendToken: string;
  onContinueStage?: (appId: string, stage: string) => void;
  /** True while a run is in flight. */
  isProcessing?: boolean;
  /** Set as soon as a run is accepted by the backend. */
  currentRunId?: string | null;
}

export function ConfigurationsAndResults({
  isAssessmentTriggered,
  apiResults,
  isProcessing = false,
  currentRunId = null,
}: ConfigurationsAndResultsProps) {
  const hasShownResultSection = useDashboardStore((state) => state.hasShownResultSection);

  /**
   * Gate for the Migration Overview and Results sub-tabs. Mirrors T2F
   * MigrationTab's `canAccessResults`: a run only has to have *started*, not to
   * have produced anything.
   *
   * `isAssessmentTriggered` alone is not enough any more. It is set inside
   * processApp, which only the superseded browser-side pipeline ever called, so
   * under the run_id model it stays false forever and both tabs would never
   * unlock. It is kept in the condition so a legacy run still opens them.
   */
  const canAccessResults = hasShownResultSection || isProcessing || !!currentRunId || isAssessmentTriggered;

  // Default tab set to results as requested
  const [activeMainTab, setActiveMainTab] = useState("results");
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  const previousRunIdRef = useRef(currentRunId);
  useEffect(() => {
    if (currentRunId && currentRunId !== previousRunIdRef.current) {
      setActiveMainTab("results");
    }
    previousRunIdRef.current = currentRunId;
  }, [currentRunId]);

  if (!canAccessResults) {
    return null;
  }

  return (
    <div className="w-full">
      <div className={styles.subTabsWrapper}>
        <style>{`
          .vl-subtabs-scroll-wrapper::-webkit-scrollbar {
            display: none;
          }
        `}</style>
        <Tabs
          value={activeMainTab}
          onValueChange={(value) => {
            setActiveMainTab(value);
          }}
        >
          <TabsList className={cx(styles.subTabList, "vl-subtabs-scroll-wrapper")}>
            {/* <TabsTrigger value="configurations">Configurations</TabsTrigger> */}
            {/* <TabsTrigger value="overview">Migration Overview</TabsTrigger> */}
            <TabsTrigger
              value="results"
              className={cx(
                styles.subTabBase,
                activeMainTab === "results" && styles.subTabSelected
              )}
            >
              Results
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>
      {isGeneratingPdf && <QlikPdfReportRenderer apiResults={apiResults} onClose={() => setIsGeneratingPdf(false)} />}
      <div className="grid grid-cols-1 gap-6 sm:gap-8">
        {/* {activeMainTab === "configurations" && <ConfigurationsContent />} */}
        {/* {activeMainTab === "overview" && <MigrationOverview onRequestPdf={() => setIsGeneratingPdf(true)} />} */}
        {activeMainTab === "results" && <ResultTab />}
      </div>
    </div>
  );
}
