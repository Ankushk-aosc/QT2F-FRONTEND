/**
 * Presentation tokens and styles for the migration validation view.
 *
 * `useFluentStyles` used to be a Griffel `makeStyles` object; it is now a
 * plain function returning static class-name strings, one per the CSS rules
 * in `app/globals.css` (`.mv-*`). Every key and its meaning is unchanged, so
 * none of `MigrationValidationView.tsx`'s call sites — `className={fluentStyles.categoryItem}`
 * and so on — needed to change. Kept as a function (not a plain object
 * export) purely so the `useFluentStyles()` call sites didn't need editing
 * either.
 */

export const T = {
    font: "'DM Sans','Segoe UI',system-ui,sans-serif",
    mono: "'Cascadia Code','Fira Code','Consolas',monospace"
} as const;

// Global vl-* classes (same system as AssessmentTab / ParsingTab) — unchanged.
export const useGlobalStyles = () => ({
    container: "vl-container",
    header: "vl-header",
    title: "vl-title",
    subtitle: "vl-subtitle",
    metricsGrid: "vl-metrics-grid",
    metricCard: "vl-metric-card",
    metricValue: "vl-metric-value",
    metricLabel: "vl-metric-label",
    sectionCard: "vl-section-card",
    sectionHeader: "vl-section-header",
    tableContainer: "vl-table-container",
    wrapCell: "vl-wrap-cell",
    emptyState: "vl-empty-state",
    infoItem: "vl-info-item",
    infoLabel: "vl-info-label",
    infoValue: "vl-info-value",
    grid2: "vl-grid-2",
    grid3: "vl-grid-3",
    grid4: "vl-grid-4",
    sectionIndicator: "vl-section-indicator",
    sectionTitleText: "vl-section-title-text",
    categoryList: "vl-category-list",
});

export const useFluentStyles = () => ({
    categoryItem: "mv-categoryItem",
    tabsCard: "mv-tabsCard",
    tabContent: "mv-tabContent",
    categoryInfo: "mv-categoryInfo",
    categoryText: "mv-categoryText",
    categoryName: "mv-categoryName",
    categoryParity: "mv-categoryParity",
    categoryActions: "mv-categoryActions",
    detailCard: "mv-detailCard",
    detailHeader: "mv-detailHeader",
    codeBlock: "mv-codeBlock",
    sectionLabel: "mv-sectionLabel",
    remediationItem: "mv-remediationItem",
    remediationHeader: "mv-remediationHeader",
    remediationReason: "mv-remediationReason",
    aiSummaryCard: "mv-aiSummaryCard",
    sectionLabelUpper: "mv-sectionLabelUpper",
    reconciliationCard: "mv-reconciliationCard",
    insightBox: "mv-insightBox",
    insightText: "mv-insightText",
    emptyState: "mv-emptyState",
    dialogContent: "mv-dialogContent",
    comparisonGroup: "mv-comparisonGroup",
    comparisonTitle: "mv-comparisonTitle",
    cardActionGroup: "mv-cardActionGroup",
    cardContent: "mv-cardContent",
    scrollableContent: "mv-scrollableContent",
    sourceBorder: "mv-sourceBorder",
    targetBorder: "mv-targetBorder",
    aiSummaryText: "mv-aiSummaryText",
    summaryGrid: "mv-summaryGrid",
    summaryCard: "mv-summaryCard",
    summaryCardLabel: "mv-summaryCardLabel",
    summaryCardValue: "mv-summaryCardValue",
    remediationGrid: "mv-remediationGrid",
    remediationSeverityHeader: "mv-remediationSeverityHeader",
    remediationRecommendationText: "mv-remediationRecommendationText",
    remediationIssueLabel: "mv-remediationIssueLabel",
    flexColumn: "mv-flexColumn",
    statusTextMatched: "mv-statusTextMatched",
    statusTextMissing: "mv-statusTextMissing",
    statusTextExtra: "mv-statusTextExtra",
    statusTextPlaceholder: "mv-statusTextPlaceholder",
    dialogSurface: "mv-dialogSurface",
    labelCell: "mv-labelCell",
    badgeSmall: "mv-badgeSmall",
    accuracyMetricValue: "mv-accuracyMetricValue",
    aiSummaryHeader: "mv-aiSummaryHeader",
    headerGroup: "mv-headerGroup",
    iconBox: "mv-iconBox",
    textBlock: "mv-textBlock",
    remediationSection: "mv-remediationSection",
    iconInline: "mv-iconInline",
    remediationIconContainer: "mv-remediationIconContainer",
    remediationStepBadge: "mv-remediationStepBadge",
    categorySection: "mv-categorySection",
    sectionHeader: "mv-sectionHeader",
    sectionIndicator: "mv-sectionIndicator",
    sectionTitleText: "mv-sectionTitleText",
    categoryList: "mv-categoryList",
    headerCell: "mv-headerCell",
    statusHeaderCell: "mv-statusHeaderCell",
    groupHeader: "mv-groupHeader",
    groupTitle: "mv-groupTitle",
    hoverCard: "mv-hoverCard",
});
