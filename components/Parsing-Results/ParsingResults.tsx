"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useQlikToast } from "@/hooks/useQlikToast";
import DataSourcesTab from "./DataSourcesTab";
import TablesEntitiesTab from "./TablesEntitiesTab";
import DimensionsTab from "./DimensionsTabs";
import MeasuresTab from "./MeasuresTab";
import FiltersTab from "./FiltersTab";
import RenamedFieldsTab from "./RenamedFieldsTab";
import HeaderCards from "./HeaderCards";
import type { ParsedData } from "@/types/assessment";

interface DateTimeFormat {
  formattedDate: string;
  formattedTime: string;
}

interface ParsingData {
  file_name: string;
  report_type: string;
  data_format: string;
  parsing_status: string;
  components: {
    data_sources: Array<{ name: string; type: string; format: string; filename: string }>;
    tables: Array<{ name: string; fields: number; fieldNames: Array<{ Name: string; dataType: string }> }>;
    dimensions: Array<{ name: string; expression: string; table: string }>;
    measures: Array<{ name: string; expression: string; table: string }>;
    filters: Array<{ name: string; condition: string; id: string; report: string }>;
    calculations: Array<{ name: string; expression: string; table: string }>;
  };
  structure: {
    data_model: string;
    fact_tables: string[];
    dimension_tables: string[];
    relationships: any[];
  };
  renames?: ParsingRenames;
}

interface ParsingRenames {
  table_column_renames?: Array<{
    table_name?: string;
    column_renames?: Array<{ previous_name?: string; renamed?: string }>;
  }>;
}

interface ParsingResultsProps {
  data?: ParsedData | ParsingData | null;
  appName?: string;
  reportType?: string;
  dataModel?: string;
  selectedAppName?: string;
}

interface TableRename {
  table_name: string;
  column_renames: Array<{ previous_name: string; renamed: string }>;
}

// Utility function to format date and time in IST
const formatDateTime = (isoString: string): DateTimeFormat => {
  const date = new Date(isoString);
  const dateOptions: Intl.DateTimeFormatOptions = {
    timeZone: "Asia/Kolkata",
    dateStyle: "medium",
  };
  const timeOptions: Intl.DateTimeFormatOptions = {
    timeZone: "Asia/Kolkata",
    timeStyle: "short",
  };
  const formattedDate = date.toLocaleString("en-IN", dateOptions);
  const formattedTime = date.toLocaleString("en-IN", timeOptions);
  return { formattedDate, formattedTime };
};

// Default fallback data
const defaultParsingData: ParsingData = {
  file_name: "default-report.qvf",
  report_type: "Unknown",
  data_format: "Unknown",
  parsing_status: "Unknown",
  components: {
    data_sources: [],
    tables: [],
    dimensions: [],
    measures: [],
    filters: [],
    calculations: [],
  },
  structure: {
    data_model: "Unknown",
    fact_tables: [],
    dimension_tables: [],
    relationships: [],
  },
};

// Helper: map raw ParsedData to UI-friendly ParsingData
const mapRawParsedToParsingData = (raw: any): { parsed: ParsingData; renames: TableRename[] } => {
  const fetchedReportType = "Unknown";

  let connections: any[] = [];

  if (Array.isArray(raw?.connection_details)) {
    connections = raw.connection_details;
  } else if (raw?.connection_details) {
    connections = [raw.connection_details];
  } else if (raw?.assessmentData?.results) {
    const dbEntry = raw.assessmentData.results.find((r: any) => r.category === "Database Name");
    if (dbEntry?.value) connections = Array.isArray(dbEntry.value) ? dbEntry.value : [dbEntry.value];
  }
  if (!Array.isArray(connections)) connections = connections ? [connections] : [];

  let dataFormat = "Unknown";
  if (raw?.script?.datasources_results?.[0]?.datasources?.[0]) {
    dataFormat = raw.script.datasources_results[0].datasources[0].split(":")[0]?.trim() || "CSV";
  } else if (connections.length > 0) {
    dataFormat =
      connections[0]?.connection_details?.driver ||
      connections[0]?.driver ||
      connections[0]?.type ||
      "Unknown";
    if (dataFormat === "") dataFormat = "Unknown";
  }

  const dsFromScript =
    (raw?.script?.datasources_results || []).flatMap((result: any, idx: number) =>
      (result.datasources || []).map((s: string) => ({
        name: s.split(":").slice(1).join(":").trim() || `Data Source ${idx + 1}`,
        type: s.split(":")[0]?.trim() || "CSV",
        format: s.split(":")[0]?.trim() || "CSV",
        filename: result.filename || "Unknown",
      }))
    ) || [];

  const dsFromConnections = (connections || []).map((conn: any, idx: number) => ({
    name:
      conn.name ||
      conn.connection_details?.server ||
      conn.server ||
      conn.database ||
      `Connection ${idx + 1}`,
    type:
      conn.connection_details?.driver ||
      conn.connection_details?.source_connector ||
      conn.type ||
      conn.driver ||
      conn.source_connector ||
      "Unknown",
    format:
      conn.connection_details?.driver ||
      conn.connection_details?.source_connector ||
      conn.type ||
      conn.driver ||
      conn.source_connector ||
      "Unknown",
    filename: conn.connection_details?.database || conn.database || `Connection ${idx + 1}`,
  }));

  const combinedDataSources = [...dsFromScript, ...dsFromConnections];

  const tables: Array<{ name: string; fields: number; fieldNames: Array<{ Name: string; dataType: string }> }> =
    (() => {
      if (Array.isArray(raw?.script?.tables)) {
        return raw.script.tables.map((table: any, index: number) => ({
          name: table.table_name || table.name || `Table ${index + 1}`,
          fields: Array.isArray(table.fields) ? table.fields.length : 0,
          fieldNames:
            (Array.isArray(table.fields) &&
              table.fields.map((field: any) =>
                typeof field === "string" ? { Name: field, dataType: "Unknown" } : { Name: field.Name || field.name || "Unknown", dataType: field.dataType || "Unknown" }
              )) ||
            [],
        }));
      }
      if (Array.isArray(raw?.tables)) {
        return raw.tables.map((table: any, index: number) => ({
          name: table.table_name || table.name || `Table ${index + 1}`,
          fields: Array.isArray(table.fields) ? table.fields.length : 0,
          fieldNames:
            (Array.isArray(table.fields) &&
              table.fields.map((field: any) =>
                typeof field === "string" ? { Name: field, dataType: "Unknown" } : { Name: field.Name || field.name || "Unknown", dataType: field.dataType || "Unknown" }
              )) ||
            [],
        }));
      }
      return [];
    })();

  const fact_tables: string[] = tables.map((t) => t.name).filter(Boolean);

  const rawDims: any[] = (() => {
    if (!raw) return [];
    if (Array.isArray(raw.dimensions)) return raw.dimensions;
    if (raw.dimensions && Array.isArray((raw.dimensions as any).dimensions)) return (raw.dimensions as any).dimensions;
    if (Array.isArray(raw.script?.dimensions)) return raw.script.dimensions;
    return [];
  })();

  const dimensions = rawDims.map((d: any, i: number) => ({
    name: d?.name || d?.dimension_name || `Dimension ${i + 1}`,
    expression: d?.expression || d?.formula || "Unknown",
    table: (Array.isArray(d?.tables) && d.tables[0]) || d?.table || fact_tables[0] || "Unknown",
  }));

  const dimension_tables: string[] = Array.from(new Set(dimensions.map((d) => d.table).filter(Boolean)));

  const measures =
    (raw?.measures?.measures &&
      Array.isArray(raw.measures.measures) &&
      raw.measures.measures.map((m: any, idx: number) => ({
        name: m.name || `Measure ${idx + 1}`,
        expression: m.expression || "Unknown",
        table: tables.find((t) => m.expression?.includes(t.name))?.name || tables[0]?.name || "Unknown",
      }))) ||
    (Array.isArray(raw?.measures) &&
      raw.measures.map((m: any, idx: number) => ({
        name: m.name || `Measure ${idx + 1}`,
        expression: m.expression || "Unknown",
        table: tables.find((t) => m.expression?.includes(t.name))?.name || tables[0]?.name || "Unknown",
      }))) ||
    [];

  let data_model = "Unknown";
  if (fact_tables.length === 0 && dimension_tables.length === 0) {
    data_model = "Unknown";
  } else if (fact_tables.length === 1 && dimension_tables.length === 0) {
    data_model = "Single Table";
  } else if (fact_tables.length > 0 && dimension_tables.length === 0) {
    data_model = "Relational / Flat";
  } else if (fact_tables.length > 0 && dimension_tables.length > 0) {
    data_model = dimension_tables.length < fact_tables.length ? "Dimensional (star-like)" : "Dimensional";
  }

  const mappedData: ParsingData = {
    file_name: raw?.folder_name || raw?.folder || raw?.script?.filename || "Unknown",
    report_type: fetchedReportType,
    data_format: dataFormat,
    parsing_status: "Complete",
    components: {
      data_sources: combinedDataSources,
      tables,
      dimensions,
      measures,
      filters:
        (raw?.filter_panes || raw?.filters?.filter_panes || []).map((filter: any) => ({
          name: filter.title,
          condition: filter.title,
          id: filter.id || "Unknown",
          report: raw?.folder_name || raw?.folder || "Unknown",
        })) || [],
      calculations:
        (Array.isArray(raw?.calculated_columns)
          ? raw.calculated_columns.map((calc: any) => ({
              name: calc.column_name || calc.name || "Unknown",
              expression: calc.expression || "Unknown",
              table: calc.table_name || tables[0]?.name || "Unknown",
            }))
          : raw?.calculated_columns?.calculated_columns?.map((calc: any) => ({
              name: calc.column_name || calc.name || "Unknown",
              expression: calc.expression || "Unknown",
              table: calc.table_name || tables[0]?.name || "Unknown",
            }))) || [],
    },
    structure: {
      data_model,
      fact_tables,
      dimension_tables,
      relationships: raw?.relationships || [],
    },
    renames: raw?.column_renames || raw?.renames || raw?.script?.table_column_renames || {},
  };

  const renames = raw?.column_renames || raw?.renames?.table_column_renames || raw?.script?.table_column_renames || [];
  return { parsed: mappedData, renames };
};

export default function ParsingResults({
  data,
  appName: propAppName,
  reportType: propReportType,
  dataModel: propDataModel,
  selectedAppName,
}: ParsingResultsProps) {
  const toast = useQlikToast();
  const [activeTab, setActiveTab] = useState("data-sources");
  const [parsingData, setParsingData] = useState<ParsingData>(defaultParsingData);
  const [tableRenames, setTableRenames] = useState<TableRename[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [appName, setAppName] = useState("Unknown Application");
  const [reportType, setReportType] = useState("Unknown");
  const [dataModel, setDataModel] = useState("Unknown");
  const [isLoading, setIsLoading] = useState(true);
  const [loadingText, setLoadingText] = useState("Processing Mapping, please wait...");
  const [renames, setRenames] = useState<any[]>([]);

  useEffect(() => {
    if (data) {
      try {
        const looksLikeUIShape = !!(data as any).file_name && !!(data as any).components;

        if (looksLikeUIShape) {
          const parsed = data as ParsingData;
          setParsingData(parsed);
          setTableRenames((parsed as any).renames?.table_column_renames || []);
          if (!propAppName) setAppName(removeTimestampFromFolderName(parsed.file_name));
          if (!propReportType) setReportType(parsed.report_type || "Unknown");
          if (!propDataModel) setDataModel(parsed.structure?.data_model || "Unknown");
        } else {
          const { parsed: mapped, renames } = mapRawParsedToParsingData(data);
          setParsingData(mapped);
          setTableRenames(renames || []);
          if (!propAppName) setAppName(removeTimestampFromFolderName(mapped.file_name));
          if (!propReportType) setReportType(mapped.report_type || "Unknown");
          if (!propDataModel) setDataModel(mapped.structure?.data_model || "Unknown");
        }

        setIsLoading(false);
        setError("");
      } catch (err) {
        console.error("Error mapping parsing prop:", err);
        setError("Failed to load parsing data from prop.");
      }
      return;
    }

    if (!data) {
      loadParsingData();
    }
  }, [data, propAppName, propReportType, propDataModel]);

  const removeTimestampFromFolderName = (folderName?: string): string => {
    if (!folderName) return "Unknown Application";
    const cleaned = folderName
      .replace(/_?\d{8}_\d{6}/g, "")
      .replace(/_?\d{8}/g, "")
      .replace(/_?\d{4}-\d{2}-\d{2}/g, "")
      .replace(/_{2,}/g, "_")
      .replace(/^_|_$/g, "");
    return cleaned.trim() || "Unknown Application";
  };

  useEffect(() => {
    if (propAppName) setAppName(propAppName);
    if (propReportType) setReportType(propReportType);
    if (propDataModel) setDataModel(propDataModel);
  }, [propAppName, propReportType, propDataModel]);

  const handleDownloadVisualizations = () => {
    try {
      const storedReportData = localStorage.getItem("api_results");
      if (!storedReportData) {
        toast.error("No visualization data found in local storage.");
        return;
      }

      const parsedReports = JSON.parse(storedReportData);
      let currentReport;

      if (Array.isArray(parsedReports)) {
        currentReport = parsedReports.find(
          (report: any) =>
            report.appId === selectedAppName ||
            report.appId === appName ||
            report.folder === parsingData.file_name ||
            report.script?.filename === parsingData.file_name ||
            report.assessmentData?.report_name === appName ||
            report.unbuildData?.folderName === parsingData.file_name ||
            report.folder_name === parsingData.file_name ||
            report.parsedData?.folder_name === parsingData.file_name
        );
        if (!currentReport) {
          toast.error("No matching report found for the current application.");
          return;
        }
      } else {
        currentReport = parsedReports;
      }

      const visualizations = currentReport.visualizations || currentReport.parsedData?.visualizations || {};
      if (Object.keys(visualizations).length === 0 && !Array.isArray(visualizations)) {
        toast.error("No visualizations data available for download.");
        return;
      }

      const jsonString = JSON.stringify(visualizations, null, 2);
      const blob = new Blob([jsonString], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${appName || "report"}_visualizations.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast.success("Visualizations JSON downloaded successfully!");
    } catch (error) {
      console.error("Error downloading visualizations:", error);
      toast.error("Failed to download visualizations. Check console for details.");
    }
  };

  const computeModelsFromRaw = (raw: any): { computedDataModel: string; computedReportType: string; factTables: string[]; dimensionTables: string[] } => {
    const factSources: any[] = [];
    if (Array.isArray(raw?.script?.tables)) factSources.push(...raw.script.tables);
    if (Array.isArray(raw?.tables)) factSources.push(...raw.tables);
    if (Array.isArray(raw?.script?.loadTables)) factSources.push(...raw.script.loadTables);
    if (!factSources.length && Array.isArray(raw?.script?.tables?.map ? raw.script.tables : [])) factSources.push(...(raw.script.tables as any[]));

    let factTables = factSources
      .map((t: any) => (typeof t === "string" ? t : t?.table_name || t?.name || t?.TABLE_NAME || ""))
      .filter(Boolean);
    factTables = Array.from(new Set(factTables));

    const dimCandidates: any[] = [];
    if (Array.isArray(raw?.dimensions)) dimCandidates.push(...raw.dimensions);
    if (Array.isArray(raw?.script?.dimensions)) dimCandidates.push(...raw.script.dimensions);
    if (raw?.dimensions && Array.isArray(raw.dimensions?.dimensions)) dimCandidates.push(...raw.dimensions.dimensions);

    const dimensionTablesFromDims = dimCandidates
      .map((d: any) => (d?.table ? d.table : d?.tables?.[0] ? d.tables[0] : d?.table_name || d?.sourceTable || ""))
      .filter(Boolean);

    let dimensionTables = Array.from(new Set(dimensionTablesFromDims));

    if (raw?.assessmentData?.results && Array.isArray(raw.assessmentData.results)) {
      raw.assessmentData.results.forEach((r: any) => {
        const cat = (r?.category || "").toString().toLowerCase();
        if (cat.includes("dimensional") || cat.includes("dimension") || cat.includes("dimensional model")) {
          const v = r?.value;
          if (typeof v === "string") {
            const matches = v.match(/'([^']+)'|"([^"]+)"/g);
            if (matches) {
              matches.forEach((m: string) => {
                const nm = m.replace(/^['"]|['"]$/g, "");
                if (nm) dimensionTables.push(nm);
              });
            }
          } else if (v?.details && Array.isArray(v.details)) {
            v.details.forEach((d: string) => {
              const match = d.match(/'([^']+)'/);
              if (match?.[1]) dimensionTables.push(match[1]);
            });
          }
        }
      });
    }

    dimensionTables = Array.from(new Set(dimensionTables.filter(Boolean)));

    const factCount = factTables.length;
    const dimCount = dimensionTables.length;

    let dataModel = "Unknown";
    if (factCount === 0 && dimCount === 0) dataModel = "Unknown";
    else if (factCount === 1 && dimCount === 0) dataModel = "Single Table";
    else if (factCount > 0 && dimCount === 0) dataModel = "Relational / Flat";
    else if (factCount > 0 && dimCount > 0) dataModel = dimCount < factCount ? "Dimensional (star-like)" : "Dimensional";

    let reportType = dataModel;
    if (dataModel === "Single Table") reportType = "Single Table";
    else if (dataModel.includes("star-like")) reportType = "Star Schema";
    else if (dataModel === "Relational / Flat") reportType = "Relational Model";
    else if (dataModel === "Dimensional") reportType = "Snowflake Schema";

    return { computedDataModel: dataModel, computedReportType: reportType, factTables, dimensionTables };
  };

  const loadParsingData = async (returnOnly = false) => {
    let finalAppName = propAppName || "Unknown Application";
    let finalReportType = propReportType || "Unknown";
    let finalDataModel = propDataModel || "Unknown";

    setAppName(finalAppName);

    if (!data) {
      setParsingData(defaultParsingData);
      setReportType(finalReportType);
      setDataModel(finalDataModel);
      setIsLoading(false);
      return;
    }

    const rawData = data as any;

    let computedReportType = finalReportType;
    let computedDataModel = finalDataModel;
    let computedFactTables: string[] = [];
    let computedDimensionTables: string[] = [];
    if (finalReportType === "Unknown" || finalDataModel === "Unknown") {
      const computed = computeModelsFromRaw(rawData);
      if (finalReportType === "Unknown") computedReportType = computed.computedReportType;
      if (finalDataModel === "Unknown") computedDataModel = computed.computedDataModel;
      computedFactTables = computed.factTables;
      computedDimensionTables = computed.dimensionTables;
    }

    let connections = rawData?.assessmentData?.results?.find((r: any) => r.category === "Database Name")?.value || [];
    if (!Array.isArray(connections)) connections = [connections];
    if (connections.length === 0 && rawData?.connection_details) {
      connections = [rawData.connection_details];
    }
    let dataFormat = "Unknown";
    if (rawData.script?.datasources_results?.[0]?.datasources?.[0]) {
      dataFormat = rawData.script.datasources_results[0].datasources[0].split(":")[0]?.trim() || "CSV";
    } else if (connections.length > 0) {
      dataFormat = connections[0]?.connection_details?.driver || connections[0]?.driver || connections[0]?.type || "CSV";
      if (connections[0]?.connection_details?.driver === "" && dataFormat === "CSV") dataFormat = "No Data Source Found";
    }

    const factTables = computedFactTables.length > 0 ? computedFactTables : (rawData.script?.tables || rawData.tables || []).map((t: any) => t.table_name || t.name).filter(Boolean);
    const dimensionTables = computedDimensionTables.length > 0 ? computedDimensionTables : ((rawData.script?.dimensions || rawData.dimensions || []).map((d: any) => d.table || d.tables?.[0] || d.table_name).filter(Boolean) || []);

    const tables: Array<{ name: string; fields: number; fieldNames: Array<{ Name: string; dataType: string }> }> = (() => {
      const tableSrc = rawData.script?.tables || rawData.tables || [];
      if (!Array.isArray(tableSrc)) return [];
      return tableSrc.map((table: any, index: number) => ({
        name: table.table_name || table.name || `Table ${index + 1}`,
        fields: table.fields?.length || 0,
        fieldNames: table.fields?.map((field: any) =>
          typeof field === "string" ? { Name: field, dataType: "Unknown" } : { Name: field.Name || field.name || "Unknown", dataType: field.dataType || "Unknown" }
        ) || [],
      }));
    })();

    const mappedData: ParsingData = {
      file_name: rawData.folder_name || rawData.folder || rawData.file_name || "Unknown",
      report_type: computedReportType,
      data_format: dataFormat,
      parsing_status: "Complete",
      components: {
        data_sources: (rawData.script?.datasources_results || []).flatMap((result: any, index: number) =>
          (result.datasources || []).map((source: string) => ({
            name: source.split(":").slice(1).join(":").trim() || `Data Source ${index + 1}`,
            type: source.split(":")[0]?.trim() || "CSV",
            format: source.split(":")[0]?.trim() || "CSV",
            filename: result.filename || "Unknown",
          }))
        ) || (connections.length > 0
          ? connections.map((conn: any, index: number) => ({
              name: conn.server || conn.name || `Connection ${index + 1}`,
              type: conn.driver || conn.source_connector || "Unknown",
              format: conn.driver || conn.source_connector || "Unknown",
              filename: conn.database || "Unknown",
            }))
          : []),
        tables,
        dimensions: (rawData.dimensions || rawData.script?.dimensions || []).map((dim: any) => ({
          name: dim.name,
          expression: dim.expression || "Unknown",
          table: dim.table || dim.tables?.[0] || tables[0]?.name || "Unknown",
        })),
        measures: (rawData.measures || []).map((measure: any) => ({
          name: measure.name,
          expression: measure.expression || "Unknown",
          table: tables.find((table: any) =>
            measure.expression.includes(table.name) || table.fieldNames?.some((field: any) => measure.expression.includes(field.Name))
          )?.name || tables[0]?.name || "Unknown",
        })),
        filters: (rawData.filter_panes || rawData.filters?.filter_panes || []).map((filter: any) => ({
          name: filter.title,
          condition: filter.title,
          id: filter.id || "Unknown",
          report: rawData.folder_name || rawData.folder || "Unknown",
        })),
        calculations: (Array.isArray(rawData.calculated_columns)
          ? rawData.calculated_columns.map((calc: any) => ({
              name: calc.column_name || calc.name || "Unknown",
              expression: calc.expression || "Unknown",
              table: calc.table_name || tables[0]?.name || "Unknown",
            }))
          : rawData.calculated_columns?.calculated_columns?.map((calc: any) => ({
              name: calc.column_name || calc.name || "Unknown",
              expression: calc.expression || "Unknown",
              table: calc.table_name || tables[0]?.name || "Unknown",
            }))) || [],
      },
      structure: {
        data_model: computedDataModel,
        fact_tables: factTables,
        dimension_tables: dimensionTables,
        relationships: rawData.script?.relationships || rawData.relationships || [],
      },
      renames: rawData.column_renames || rawData.renames || rawData.script?.table_column_renames || { table_column_renames: [] },
    };

    const renames = rawData.column_renames || rawData.renames?.table_column_renames || rawData.script?.table_column_renames || [];
    setTableRenames(renames.map((r: any) => ({ table_name: r.table_name || '', column_renames: r.column_renames || [] })));

    setReportType(computedReportType);
    setDataModel(computedDataModel);

    setIsLoading(false);
    if (returnOnly) {
      return mappedData;
    }
    setParsingData(mappedData);
    return mappedData;
  };

  useEffect(() => {
    if (propAppName) setAppName(propAppName);
    if (propReportType) setReportType(propReportType);
    if (propDataModel) setDataModel(propDataModel);

    let cancelled = false;
    async function doWork() {
      if (!data) {
        await loadParsingData();
        return;
      }

      try {
        const { parsed, renames: parsedRenames } = mapRawParsedToParsingData(data);
        const fallbackMapped = await loadParsingData(true) || defaultParsingData;

        const merged: ParsingData = {
          ...fallbackMapped,
          ...parsed,
          components: {
            ...fallbackMapped.components,
            ...parsed.components,
            dimensions: parsed.components?.dimensions?.length ? parsed.components.dimensions : fallbackMapped.components.dimensions,
            measures: parsed.components?.measures?.length ? parsed.components.measures : fallbackMapped.components.measures,
            data_sources: parsed.components?.data_sources?.length ? parsed.components.data_sources : fallbackMapped.components.data_sources,
          },
          structure: {
            ...fallbackMapped.structure,
            ...parsed.structure,
            data_model: parsed.structure?.data_model || fallbackMapped.structure?.data_model,
            fact_tables: parsed.structure?.fact_tables?.length ? parsed.structure.fact_tables : fallbackMapped.structure.fact_tables,
            dimension_tables: parsed.structure?.dimension_tables?.length ? parsed.structure.dimension_tables : fallbackMapped.structure.dimension_tables,
            relationships: parsed.structure?.relationships?.length ? parsed.structure.relationships : fallbackMapped.structure.relationships,
          },
        };

        if (!cancelled) {
          setParsingData(merged);
          setRenames(parsedRenames || []);
        }
      } catch (e) {
        console.error("Fallback merge failed:", e);
        try {
          const { parsed, renames: parsedRenames } = mapRawParsedToParsingData(data);
          if (!cancelled) {
            setParsingData(parsed);
            setRenames(parsedRenames || []);
          }
        } catch (err) {
          console.error("Error mapping parsing prop:", err);
          if (!cancelled) loadParsingData();
        }
      }
    }

    doWork();
    return () => {
      cancelled = true;
    };
  }, [data, propAppName, propReportType, propDataModel]);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (loading) {
      timer = setTimeout(() => {
        setLoadingText("It may take a few minutes, please wait...");
      }, 60000);
      return () => clearTimeout(timer);
    }
  }, [loading]);

  // UPDATED: No instance/session API
  const handleProceedToMapping = async () => {
    setLoading(true);
    setError("");
    let folderName = "unknown";

    try {
      const localData = localStorage.getItem("api_results");
      if (!localData) {
        throw new Error("No assessment data found. Please complete the assessment step first.");
      }

      let assessmentData;
      try {
        assessmentData = JSON.parse(localData);
        const appData = Array.isArray(assessmentData) ? assessmentData[0] : assessmentData;
        folderName = appData?.unbuildData?.folderName || appData?.assessmentData?.report_name || appData?.parsedData?.folder_name || appData?.folder_name || "unknown";
        if (folderName === "unknown" || !folderName) {
          throw new Error("Folder name not found in assessment data. Please complete the assessment again.");
        }
      } catch (parseError) {
        console.error("Failed to parse api_results:", parseError);
        throw new Error("Invalid assessment data format. Please complete the assessment again.");
      }

      const mappingPayload = {
        folder_name: folderName,
      };

      const mappingResponse = await fetch("/api/mapping", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json",
        },
        body: JSON.stringify(mappingPayload),
      });

      if (!mappingResponse.ok) {
        let errorMessage = await mappingResponse.text();
        try {
          const errorBody = JSON.parse(errorMessage);
          errorMessage = errorBody.message || errorBody.error || errorMessage;
        } catch (parseError) {
          console.error("Failed to parse mapping error response:", parseError);
        }
        throw new Error(`HTTP error! Status: ${mappingResponse.status} - ${mappingResponse.statusText}. Response: ${errorMessage}`);
      }

      const mappingData = await mappingResponse.json();
      const updatedData = {
        ...mappingData,
        file_data: {
          ...mappingData.file_data,
          file_name: mappingData.file_data?.file_name || "sample_report.qvf",
        },
      };

      localStorage.setItem("mappedReportData", JSON.stringify(updatedData));
      toast.success("Mapping completed successfully!");
      setTimeout(() => {
        window.location.href = "/mapping-results";
      }, 500);
    } catch (error: any) {
      console.error("Error in handleProceedToMapping:", error.message, error.stack);

      if (error.message.includes("No datasets available")) {
        setError(
          `Failed to fetch data from Mapping API: No datasets are available for the folder "${folderName}". Please ensure the folder contains valid datasets and try again.`
        );
        setLoading(false);
        return;
      }

      const fallbackData = {
        file_data: {
          file_name: "sample_report.qvf",
          database_name: "Unknown",
          database_platform: "Unknown",
        },
        mapping_report: {
          file_name: "sample_report.qvf",
          mapped_fields: 0,
          mapped_percentage: 0,
          total_fields: 0,
          total_tables: 0,
          table_mappings: [],
          unmapped_fields: [],
        },
        dax_measures_report: {
          measures: [],
          total_measures: 0,
        },
        dimensions_report: {
          dimensions: [],
          total_dimensions: 0,
        },
        relationships_report: {
          relationships: [],
          total_relationships: 0,
        },
        status: "failed",
      };
      localStorage.setItem("mappedReportData", JSON.stringify(fallbackData));
      setError(`Failed to process mapping: ${error.message}. Check console for details.`);
      setLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-4 border-b-4 border-blue-500 mx-auto mb-4" />
          <h2 className="text-2xl font-semibold text-foreground">Loading Parsing Result...</h2>
        </div>
      </div>
    );
  }

  return (
    <>
      {loading && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
          aria-live="polite"
          aria-busy="true"
        >
          <div className="flex flex-col items-center space-y-4">
            <div className="animate-spin rounded-full h-12 w-12 border-t-4 border-b-4 border-blue-500" />
            <p className="text-white text-lg">{loadingText}</p>
          </div>
        </div>
      )}
      <div className="flex min-h-screen flex-col">
        <main className="flex-1 container py-10">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center">
              <div>
                <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-red-600">
                  Parsing Results
                </h1>
              </div>
            </div>
          </div>

          {error && (
            <Alert variant="destructive" className="mb-6">
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <HeaderCards
            appName={appName || removeTimestampFromFolderName(parsingData.file_name)}
            reportType={reportType || parsingData.report_type}
            dataModel={dataModel || parsingData.structure?.data_model}
            factTablesCount={parsingData.structure.fact_tables.length}
            dimensionTablesCount={parsingData.structure.dimension_tables.length}
          />

          <Tabs defaultValue="data-sources" className="w-full" onValueChange={setActiveTab}>
            <TabsList className="flex flex-wrap justify-start overflow-x-auto">
              <TabsTrigger value="data-sources" className="flex-1 min-w-fit">Data Sources</TabsTrigger>
              <TabsTrigger value="tables-entities" className="flex-1 min-w-fit">Tables/Entities</TabsTrigger>
              <TabsTrigger value="dimensions" className="flex-1 min-w-fit">Dimensions</TabsTrigger>
              <TabsTrigger value="measures" className="flex-1 min-w-fit">Measures</TabsTrigger>
              <TabsTrigger value="filters" className="flex-1 min-w-fit">Calculations and Filters</TabsTrigger>
              <TabsTrigger value="Renamed Fields" className="flex-1 min-w-fit">Renamed Fields</TabsTrigger>
            </TabsList>

            <TabsContent value="data-sources" className="space-y-6 pt-6">
              <DataSourcesTab dataSources={parsingData.components.data_sources} />
            </TabsContent>
            <TabsContent value="tables-entities" className="space-y-6 pt-6">
              <TablesEntitiesTab tables={parsingData.components.tables} />
            </TabsContent>
            <TabsContent value="dimensions" className="space-y-6 stylized pt-6">
              <DimensionsTab dimensions={parsingData.components.dimensions} />
            </TabsContent>
            <TabsContent value="measures" className="space-y-6 pt-6">
              <MeasuresTab measures={parsingData.components.measures} />
            </TabsContent>
            <TabsContent value="filters" className="space-y-6 pt-6">
              <FiltersTab
                filters={parsingData.components.filters}
                calculations={parsingData.components.calculations}
              />
            </TabsContent>
            <TabsContent value="Renamed Fields" className="space-y-6 pt-6">
              <RenamedFieldsTab tableRenames={tableRenames} />
            </TabsContent>
          </Tabs>

          <div className="flex justify-between items-center mt-4">
            <Button
              onClick={handleDownloadVisualizations}
              variant="outline"
              style={{ backgroundColor: "#0033a0", color: "#ffffff" }}
            >
              Download Visualizations JSON
            </Button>
          </div>
        </main>
        <footer className="w-full border-t bg-background py-6">
          <div className="container flex flex-col items-center justify-between gap-4 md:flex-row">
            <p className="text-center text-sm leading-loose text-muted-foreground">© Vector Lab</p>
          </div>
        </footer>
      </div>
    </>
  );
}