"use client"

import { Card } from "@/components/ui/card"
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion"

const assessmentMetadata = [
  {
    category: "Inventory",
    items: [
      "Total sites, projects, workbooks, dashboards, stories",
      "Published vs unpublished",
      "Workbook owner & last modified",
    ],
  },
  {
    category: "Data Sources – Type",
    items: [
      "Live vs Extract",
      "Database type (SQL Server, Snowflake, BigQuery, Oracle, PostgreSQL, Redshift, MySQL, etc.)",
      "File-based (Excel, CSV, Google Sheets)",
      "Cubes / multidimensional (SSAS, Essbase, SAP BW, etc.)",
      "Web data connectors / APIs",
    ],
  },
  {
    category: "Data Sources – Custom SQL",
    items: [
      "Presence of Custom SQL",
      "Line count of custom SQL blocks",
      "Uses parameters in custom SQL",
    ],
  },
  {
    category: "Extracts",
    items: [
      "Number of Hyper extracts",
      "Total extract size in GB",
      "Refresh frequency & last refresh",
    ],
  },
  {
    category: "Calculated Fields",
    items: [
      "Total count per workbook",
      "% using LOD expressions",
      "% using Table Calculations",
      "% using Parameters",
      "% using RAWSQL / SCRIPT_ functions",
    ],
  },
  {
    category: "LOD Expressions",
    items: [
      "FIXED / INCLUDE / EXCLUDE counts",
      "Nested LODs (2+ levels)",
      "LOD + dimension filters",
    ],
  },
  {
    category: "Parameters & Sets",
    items: [
      "Parameter types (string, int, date, list)",
      "Dynamic sets vs computed sets",
    ],
  },
  {
    category: "Actions",
    items: [
      "Filter actions",
      "Highlight actions",
      "URL actions",
      "Navigation actions",
      "Parameter actions",
    ],
  },
  {
    category: "Visual Types",
    items: [
      "Standard visuals (bar, line, pie, map, etc.)",
      "Custom visuals / extensions",
      "Spatial files (.shp, KML)",
    ],
  },
  {
    category: "Formatting & Layout",
    items: [
      "Custom colors, fonts, borders",
      "Dashboard device layouts",
      "Floating vs tiled containers",
    ],
  },
  {
    category: "Permissions & RLS",
    items: [
      "Row-level security (user filters, entitlements)",
      "View / Interact / Download permissions per workbook",
    ],
  },
  {
    category: "Embedded Content",
    items: [
      "Embedded images",
      "Web page objects",
      "Embedded credentials",
    ],
  },
  {
    category: "Unsupported / Legacy",
    items: [
      "Tableau version < 2020.3 features",
      "Legacy connection types",
      "Story points",
    ],
  },
  {
    category: "Complexity Score",
    items: [
      "Auto-calculated score (0–100) based on weighted risk factors above",
    ],
  },
]

const parsingMetadata = [
  {
    category: "Workbook Metadata",
    items: [
      "File structure and version (.twb vs .twbx details)",
      "Source build and locale information",
    ]
  },
  {
    category: "Data Sources & Custom SQL",
    items: [
      "Server paths, connection types, and database schemas",
      "Extraction of raw Custom SQL queries mapping directly to datasources",
    ]
  },
  {
    category: "Data Model (Logical & Physical)",
    items: [
      "Logical relationships (from/to tables, join conditions, cardinality)",
      "Physical layer joins (inner, left, right, full outer)",
    ]
  },
  {
    category: "Analytical Model (Calculations & LODs)",
    items: [
      "Dimensions and Measures breakdown",
      "Extraction of raw formulas for all calculated fields",
      "Level of Detail (LOD) expression types (FIXED, INCLUDE, EXCLUDE)",
      "Usage count tracking for fields to detect unused calculations",
    ]
  },
  {
    category: "Parameters & Sets",
    items: [
      "Parameter definitions (data types, current values, allowable values/ranges)",
      "Set definitions (base fields, static vs. dynamic conditions)",
    ]
  },
  {
    category: "Visuals, Dashboards & Stories",
    items: [
      "Worksheet definitions (rows, columns, active filters, visual mark types)",
      "Deep formatting extraction (colors, fonts, tooltips, axis formatting, borders)",
      "Dashboard containers (horizontal/vertical) and actions (filters, highlights, URLs)",
      "Nested device layout hierarchy (Desktop, Phone, Tablet sizes, positions, and local styles)",
      "Story points, navigation styles, and descriptions",
    ]
  },
  {
    category: "Permissions",
    items: [
      "Workbook tags",
      "Workbook-level access control lists (grantees and IDs)",
      "Granular capability mapping (Allow/Deny for View, Comment, Filter, Export, etc.)",
    ]
  },
  {
    category: "Embedded Assets",
    items: [
      "Hyper extract previews (schemas, exact table names, and row counts)",
      "Embedded images and custom shape palettes (file sizes, relative paths)",
      "Embedded database credentials (usernames, auth types, embed flags)",
    ]
  }
]

const datalayerMetadata = [
  {
    category: "Hyper Extract Processing",
    items: [
      "Automatic detection and extraction of embedded .hyper files from workbooks",
      "Schema introspection (table names, column definitions, row counts)",
      "Hyper-to-Parquet conversion for cloud-native compatibility",
    ]
  },
  {
    category: "Medallion Architecture",
    items: [
      "Bronze layer: Raw Parquet file ingestion into OneLake landing zone",
      "Silver layer: Schema validation, type normalization, and data cleansing",
      "Gold layer: Business-ready tables with optimized partitioning",
    ]
  },
  {
    category: "OneLake Integration",
    items: [
      "Target Fabric Lakehouse provisioning and configuration",
      "Delta table creation with managed metadata",
      "Shortcut and mount point setup for cross-workspace access",
    ]
  },
  {
    category: "Pipeline Orchestration",
    items: [
      "End-to-end pipeline status tracking and error handling",
      "File-level processing summary (extracted, converted, uploaded counts)",
      "Automatic retry logic for transient OneLake upload failures",
    ]
  }
]

const mappingMetadata = [
  {
    category: "Structure Translation",
    items: [
      "Tableau semantic concepts to generic Semantic Models",
      "Calculated fields to DAX or SQL expressions",
      "Parameter bindings to variables",
    ]
  },
  {
    category: "Visuals Mapping",
    items: [
      "Tableau marks (bars, lines, maps) to Power BI or generic visual equivalents",
      "Formatting logic translation (colors, conditional logic)",
      "Interactive features mapping (tooltips, cross-filtering, drill-throughs)",
    ]
  },
  {
    category: "Datasource & Model Mapping",
    items: [
      "Table joins and relationships tracking",
      "Extraction configurations and refresh schedules translation",
      "Row-level security conversion logic",
    ]
  }
]

const generationMetadata = [
  {
    category: "Artifact Generation",
    items: [
      "Power BI Project (.pbip) folder structure creation",
      "Semantic model TMDL (Tabular Model Definition Language) generation",
      "Report layout and visual property serialization",
    ]
  },
  {
    category: "Deployment & Integration",
    items: [
      "Target Fabric workspace and capacity identification",
      "Automated deployment via Fabric REST APIs",
      "Git integration and branch synchronization",
    ]
  },
  {
    category: "Capacity Management",
    items: [
      "Fabric capacity assignment and workload scaling",
      "Workspace-level permissions and access persistence",
    ]
  }
]

const validationMetadata = [
  {
    category: "Data Accuracy",
    items: [
      "Row count and granularity matching between source and target",
      "Aggregated metric fidelity (Sum, Avg, Min, Max matches)",
      "Data type preservation and conversion handling",
    ]
  },
  {
    category: "Visual & Formatting",
    items: [
      "Chart types and visualization parity",
      "Color palettes, fonts, and conditional formatting validation",
      "Axis scales and tooltip precision checks",
    ]
  },
  {
    category: "Model & Logic",
    items: [
      "Formula and DAX complexity parity",
      "Cross-filtering behavior tests",
      "Security and role mapping verification",
    ]
  }
]

function MetadataGroups({ groups }: { groups: { category: string; items: string[] }[] }) {
  return (
    <>
      {groups.map((group) => (
        <div key={group.category} style={{ marginBottom: "14px" }}>
          <span className="cc-category-title">{group.category}</span>
          <ul className="cc-bullet-list">
            {group.items.map((item, idx) => (
              <li key={idx} className="cc-bullet-item">
                <span className="cc-bullet-strong">•</span> {item}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </>
  )
}

export default function ConfigurationsContent() {
  return (
    <div className="cc-root">
      <Accordion>
        {/* Assessment Agent */}
        <AccordionItem value="assessment" className="cc-accordion-item">
          <AccordionTrigger className="cc-accordion-header">
            Assessment Agent
          </AccordionTrigger>

          <AccordionContent>
            <Card className="cc-card">
              <div className="cc-card-header">
                <span className="cc-card-title" style={{ display: "block" }}>Assessment Configuration</span>
                <span className="cc-card-description">
                  Discovers Tableau estate, assesses complexity, and estimates effort/risk
                </span>
              </div>

              <div className="cc-section">
                <span style={{ fontWeight: 600, fontSize: "15px" }}>
                  Key Metadata Captured
                </span>

                <hr className="cc-divider" style={{ margin: "16px 0" }} />

                <MetadataGroups groups={assessmentMetadata} />

                <hr className="cc-divider" style={{ margin: "24px 0 16px" }} />
              </div>
            </Card>
          </AccordionContent>
        </AccordionItem>

        {/* Parsing Agent */}
        <AccordionItem value="parsing" className="cc-accordion-item">
          <AccordionTrigger className="cc-accordion-header">
            Parsing Agent
          </AccordionTrigger>
          <AccordionContent>
            <Card className="cc-card">
              <div className="cc-card-header">
                <span className="cc-card-title" style={{ display: "block" }}>Parsing Configuration</span>
                <span className="cc-card-description">
                  Extracts workbook structure and metadata from .twb / .twbx files
                </span>
              </div>

              <div className="cc-section">
                <span style={{ display: "block", marginBottom: "16px", color: "var(--text-secondary)", fontSize: "var(--text-sm)" }}>
                  Runs automatically after the Assessment Agent discovers and downloads relevant Tableau files. It structurally unpacks the XML to provide a granular blueprint for migration.
                </span>

                <span style={{ fontWeight: 600, fontSize: "15px", display: "block", marginTop: "8px" }}>
                  Key Structural Data Extracted
                </span>

                <hr className="cc-divider" style={{ margin: "16px 0" }} />

                <MetadataGroups groups={parsingMetadata} />

                <hr className="cc-divider" style={{ margin: "24px 0 16px" }} />
              </div>
            </Card>
          </AccordionContent>
        </AccordionItem>

        {/* Data Layer Agent */}
        <AccordionItem value="datalayer" className="cc-accordion-item">
          <AccordionTrigger className="cc-accordion-header">
            Data Layer Agent
          </AccordionTrigger>
          <AccordionContent>
            <Card className="cc-card">
              <div className="cc-card-header">
                <span className="cc-card-title" style={{ display: "block" }}>Data Layer Configuration</span>
                <span className="cc-card-description">
                  Extracts, transforms, and loads Hyper data into Microsoft Fabric OneLake via a medallion architecture
                </span>
              </div>

              <div className="cc-section">
                <span style={{ display: "block", marginBottom: "16px", color: "var(--text-secondary)", fontSize: "var(--text-sm)" }}>
                  Runs automatically after the Mapping Agent when the Data Layer toggle is enabled and the workbook uses Extract-based connections. It processes embedded Hyper files through a bronze → silver → gold pipeline and lands cleansed data into a Fabric Lakehouse.
                </span>

                <span style={{ fontWeight: 600, fontSize: "15px", display: "block", marginTop: "8px" }}>
                  Key Data Layer Operations
                </span>

                <hr className="cc-divider" style={{ margin: "16px 0" }} />

                <MetadataGroups groups={datalayerMetadata} />

                <hr className="cc-divider" style={{ margin: "24px 0 16px" }} />
              </div>
            </Card>
          </AccordionContent>
        </AccordionItem>

        {/* Mapping Agent */}
        <AccordionItem value="mapping" className="cc-accordion-item">
          <AccordionTrigger className="cc-accordion-header">
            Mapping Agent
          </AccordionTrigger>
          <AccordionContent>
            <Card className="cc-card">
              <div className="cc-card-header">
                <span className="cc-card-title" style={{ display: "block" }}>Mapping Configuration</span>
                <span className="cc-card-description">
                  Translates parsed Tableau structures into the target BI platform architecture
                </span>
              </div>

              <div className="cc-section">
                <span style={{ display: "block", marginBottom: "16px", color: "var(--text-secondary)", fontSize: "var(--text-sm)" }}>
                  This agent uses the detailed structural blueprint from the Parsing Agent to map calculations, metrics, models, and layout to the destination platform equivalents (e.g. Power BI DAX, semantic models).
                </span>

                <span style={{ fontWeight: 600, fontSize: "15px", display: "block", marginTop: "8px" }}>
                  Key Mapping Operations
                </span>

                <hr className="cc-divider" style={{ margin: "16px 0" }} />

                <MetadataGroups groups={mappingMetadata} />

                <hr className="cc-divider" style={{ margin: "24px 0 16px" }} />
              </div>
            </Card>
          </AccordionContent>
        </AccordionItem>

        {/* Report Generation Agent */}
        <AccordionItem value="generation" className="cc-accordion-item">
          <AccordionTrigger className="cc-accordion-header">
            Report Generation Agent
          </AccordionTrigger>
          <AccordionContent>
            <Card className="cc-card">
              <div className="cc-card-header">
                <span className="cc-card-title" style={{ display: "block" }}>Report Generation Configuration</span>
                <span className="cc-card-description">
                  Generates and deploys the target BI project to the cloud environment
                </span>
              </div>

              <div className="cc-section">
                <span style={{ display: "block", marginBottom: "16px", color: "var(--text-secondary)", fontSize: "var(--text-sm)" }}>
                  This agent takes the mapped logic and visuals to construct a native project file (e.g. .pbip) and automatically deploys it to the target Fabric workspace via API integration.
                </span>

                <span style={{ fontWeight: 600, fontSize: "15px", display: "block", marginTop: "8px" }}>
                  Key Generation Steps
                </span>

                <hr className="cc-divider" style={{ margin: "16px 0" }} />

                <MetadataGroups groups={generationMetadata} />

                <hr className="cc-divider" style={{ margin: "24px 0 16px" }} />
              </div>
            </Card>
          </AccordionContent>
        </AccordionItem>

        {/* Validation Agent */}
        <AccordionItem value="validation" className="cc-accordion-item">
          <AccordionTrigger className="cc-accordion-header">
            Validation Agent
          </AccordionTrigger>
          <AccordionContent>
            <Card className="cc-card">
              <div className="cc-card-header">
                <span className="cc-card-title" style={{ display: "block" }}>Validation Configuration</span>
                <span className="cc-card-description">
                  Verifies data, logic, and visual fidelity between the source and migrated target
                </span>
              </div>

              <div className="cc-section">
                <span style={{ display: "block", marginBottom: "16px", color: "var(--text-secondary)", fontSize: "var(--text-sm)" }}>
                  This agent acts as the quality assurance gate, deeply inspecting the newly generated generic semantic models and visuals to ensure mathematical and visual parity with the original Tableau dashboard.
                </span>

                <span style={{ fontWeight: 600, fontSize: "15px", display: "block", marginTop: "8px" }}>
                  Key Validation Checks
                </span>

                <hr className="cc-divider" style={{ margin: "16px 0" }} />

                <MetadataGroups groups={validationMetadata} />

                <hr className="cc-divider" style={{ margin: "24px 0 16px" }} />
              </div>
            </Card>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  )
}
