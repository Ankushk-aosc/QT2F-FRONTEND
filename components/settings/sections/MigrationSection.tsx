"use client"

import React, { useCallback, useEffect, useState } from "react"
import {
  Button,
  Dropdown,
  Input,
  Option,
  Spinner,
  Switch,
  Text,
  makeStyles,
  tokens,
} from "@fluentui/react-components"

import { isLiteMode } from "@/lib/config"
import { recordsService } from "@/services/records.service"
import { useUIStore } from "@/stores/ui.store"

import { SettingRow, SettingsGroup, SettingsPanel } from "../SettingsPrimitives"

/**
 * Migration pipeline and deployment target configuration.
 *
 * These controls were previously the whole of the settings drawer. They are
 * preserved here unchanged in behaviour — same store actions, same records
 * service calls, same optimistic-update-with-rollback pattern — so moving to
 * the Administration Center does not alter how the pipeline is configured.
 *
 * Unlike the other sections, this state lives in `ui.store` and is persisted by
 * the backend records API rather than the platform settings document.
 */

const DEPLOYMENT_TYPE_LABELS: Record<string, string> = {
  GIT: "GitHub",
  DIRECT_FABRIC: "Direct to Fabric",
  AZURE_DEVOPS: "Azure DevOps",
}

const useStyles = makeStyles({
  fullWidth: { width: "100%" },
  stack: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
    width: "100%",
  },
  inline: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
  },
  hint: { color: tokens.colorNeutralForeground3 },
  label: {
    fontSize: tokens.fontSizeBase200,
    fontWeight: tokens.fontWeightSemibold,
  },
})

export function MigrationSection() {
  const styles = useStyles()

  const {
    mode,
    setMode,
    dataLayerEnabled,
    setDataLayerEnabled,
    fetchDataLayerStatus,
    deploymentType,
    setDeploymentType,
    fetchDeploymentType,
  } = useUIStore()

  const [loading, setLoading] = useState(false)
  const [updatingMode, setUpdatingMode] = useState(false)
  const [updatingDataLayer, setUpdatingDataLayer] = useState(false)
  const [updatingDeploymentType, setUpdatingDeploymentType] = useState(false)
  const [loadingCredentials, setLoadingCredentials] = useState(false)
  const [savingCredentials, setSavingCredentials] = useState(false)
  const [credentialsMessage, setCredentialsMessage] = useState("")

  const [azureDevopsOrg, setAzureDevopsOrg] = useState("")
  const [azureDevopsProject, setAzureDevopsProject] = useState("")
  const [azureDevopsRepo, setAzureDevopsRepo] = useState("")
  const [azureDevopsBranch, setAzureDevopsBranch] = useState("")
  const [azureDevopsPat, setAzureDevopsPat] = useState("")

  const [gitOrg, setGitOrg] = useState("")
  const [gitRepo, setGitRepo] = useState("")
  const [gitBranch, setGitBranch] = useState("")
  const [gitPat, setGitPat] = useState("")

  const lite = isLiteMode()

  const loadCredentials = useCallback(async (type: string) => {
    const normalised = (type || "").toUpperCase()
    if (normalised !== "AZURE_DEVOPS" && normalised !== "GIT") {
      setCredentialsMessage("")
      return
    }

    setLoadingCredentials(true)
    setCredentialsMessage("")

    try {
      if (normalised === "AZURE_DEVOPS") {
        const data = await recordsService.getAzureDevOpsDeploymentSettings()
        setAzureDevopsOrg(data.azure_devops_org || "")
        setAzureDevopsProject(data.azure_devops_project || "")
        setAzureDevopsRepo(data.azure_devops_repo || "")
        setAzureDevopsBranch(data.azure_devops_branch || "")
        // Never populate the token field from the server; it is write-only.
        setAzureDevopsPat("")
      } else {
        const data = await recordsService.getGitDeploymentSettings()
        setGitOrg(data.git_org || "")
        setGitRepo(data.git_repo || "")
        setGitBranch(data.git_branch || "")
        setGitPat("")
      }
    } catch (error) {
      console.error("[MigrationSection] Failed to load deployment settings:", error)
      setCredentialsMessage("Unable to load deployment settings.")
    } finally {
      setLoadingCredentials(false)
    }
  }, [])

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      setLoading(true)
      try {
        const [interactive] = await Promise.all([
          recordsService.getInteractiveStatus(),
          fetchDataLayerStatus(true),
          fetchDeploymentType(true),
        ])
        if (cancelled) return
        setMode(interactive.status === true ? "single" : "full")

        const activeType = (await recordsService.getDeploymentType())?.deployment_type || ""
        if (!cancelled && activeType) {
          const normalised = activeType.toUpperCase()
          setDeploymentType(normalised)
          await loadCredentials(normalised)
        }
      } catch (error) {
        console.error("[MigrationSection] Failed to load migration settings:", error)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [fetchDataLayerStatus, fetchDeploymentType, setMode, setDeploymentType, loadCredentials])

  const handleModeChange = async (interactive: boolean) => {
    const next = interactive ? "single" : "full"
    const previous = mode
    setUpdatingMode(true)
    setMode(next)

    try {
      await recordsService.updateInteractiveStatus(next === "single")
    } catch (error) {
      console.error("[MigrationSection] Failed to update migration mode:", error)
      setMode(previous)
    } finally {
      setUpdatingMode(false)
    }
  }

  const handleDataLayerToggle = async (checked: boolean) => {
    const previous = dataLayerEnabled
    setUpdatingDataLayer(true)
    setDataLayerEnabled(checked)

    try {
      await recordsService.updateDataLayerStatus(checked)
      await fetchDataLayerStatus(true)
    } catch (error) {
      console.error("[MigrationSection] Failed to update data layer status:", error)
      setDataLayerEnabled(previous)
    } finally {
      setUpdatingDataLayer(false)
    }
  }

  const handleDeploymentTypeChange = async (type: string) => {
    if (!type || type === deploymentType) return

    const previous = deploymentType
    setUpdatingDeploymentType(true)
    setCredentialsMessage("")
    setDeploymentType(type)

    try {
      await recordsService.updateDeploymentType(type)
      await loadCredentials(type)
    } catch (error) {
      console.error("[MigrationSection] Failed to update deployment type:", error)
      setDeploymentType(previous)
    } finally {
      setUpdatingDeploymentType(false)
    }
  }

  const handleSaveCredentials = async () => {
    setSavingCredentials(true)
    setCredentialsMessage("")

    try {
      if (deploymentType === "AZURE_DEVOPS") {
        if (!azureDevopsOrg.trim() || !azureDevopsProject.trim() || !azureDevopsRepo.trim()) {
          setCredentialsMessage("Organization, project and repository are required.")
          return
        }

        await recordsService.saveAzureDevOpsDeploymentSettings({
          azure_devops_org: azureDevopsOrg.trim(),
          azure_devops_project: azureDevopsProject.trim(),
          azure_devops_repo: azureDevopsRepo.trim(),
          azure_devops_branch: azureDevopsBranch.trim() || undefined,
          azure_devops_pat: azureDevopsPat.trim() || undefined,
        })

        setAzureDevopsPat("")
        setCredentialsMessage("Azure DevOps settings saved securely.")
      }

      if (deploymentType === "GIT") {
        if (!gitOrg.trim() || !gitRepo.trim()) {
          setCredentialsMessage("Organization and repository are required.")
          return
        }

        await recordsService.saveGitDeploymentSettings({
          git_org: gitOrg.trim(),
          git_repo: gitRepo.trim(),
          git_branch: gitBranch.trim() || undefined,
          git_pat: gitPat.trim() || undefined,
        })

        setGitPat("")
        setCredentialsMessage("GitHub settings saved securely.")
      }
    } catch (error) {
      console.error("[MigrationSection] Failed to save deployment settings:", error)
      setCredentialsMessage("Failed to save deployment settings.")
    } finally {
      setSavingCredentials(false)
    }
  }

  if (loading) {
    return (
      <SettingsPanel title="Migration" description="Pipeline behaviour and deployment target.">
        <Spinner size="large" label="Loading migration settings…" />
      </SettingsPanel>
    )
  }

  return (
    <SettingsPanel
      title="Migration"
      description="How the migration pipeline runs and where generated assets are deployed."
    >
      {!lite ? (
        <SettingsGroup title="Pipeline">
          <SettingRow
            label="Interactive mode"
            hint={
              mode === "single"
                ? `Pauses after Parsing. Later stages include ${dataLayerEnabled ? "Data Layer, " : ""}Mapping, Report Generation and Validation.`
                : `Runs the full pipeline automatically: Assessment, Parsing, ${dataLayerEnabled ? "Data Layer, " : ""}Mapping, Report Generation and Validation.`
            }
          >
            <div className={styles.inline}>
              {updatingMode ? <Spinner size="tiny" /> : null}
              <Switch
                checked={mode === "single"}
                disabled={updatingMode}
                onChange={(_, data) => void handleModeChange(data.checked)}
              />
            </div>
          </SettingRow>

          <SettingRow
            label="Data layer discovery"
            hint="Automated discovery and validation of underlying data sources, schema parity and relationship integrity."
          >
            <div className={styles.inline}>
              {updatingDataLayer ? <Spinner size="tiny" /> : null}
              <Switch
                checked={dataLayerEnabled}
                disabled={updatingDataLayer}
                onChange={(_, data) => void handleDataLayerToggle(data.checked)}
              />
            </div>
          </SettingRow>
        </SettingsGroup>
      ) : null}

      {!lite ? (
        <SettingsGroup title="Deployment target">
          <SettingRow label="Deployment type" hint="Where generated assets are stored or deployed.">
            <div className={styles.inline}>
              {updatingDeploymentType ? <Spinner size="tiny" /> : null}
              <Dropdown
                className={styles.fullWidth}
                value={DEPLOYMENT_TYPE_LABELS[deploymentType] || deploymentType}
                selectedOptions={[deploymentType]}
                disabled={updatingDeploymentType}
                onOptionSelect={(_, data) =>
                  data.optionValue && void handleDeploymentTypeChange(data.optionValue)
                }
              >
                {Object.entries(DEPLOYMENT_TYPE_LABELS).map(([value, label]) => (
                  <Option key={value} value={value} text={label}>
                    {label}
                  </Option>
                ))}
              </Dropdown>
            </div>
          </SettingRow>

          {deploymentType === "AZURE_DEVOPS" && !loadingCredentials ? (
            <SettingRow label="Azure DevOps" hint="Target repository for generated assets." stacked>
              <div className={styles.stack}>
                <Text className={styles.label}>Organization</Text>
                <Input
                  value={azureDevopsOrg}
                  onChange={(e) => setAzureDevopsOrg(e.target.value)}
                  disabled={savingCredentials}
                />
                <Text className={styles.label}>Project</Text>
                <Input
                  value={azureDevopsProject}
                  onChange={(e) => setAzureDevopsProject(e.target.value)}
                  disabled={savingCredentials}
                />
                <Text className={styles.label}>Repository</Text>
                <Input
                  value={azureDevopsRepo}
                  onChange={(e) => setAzureDevopsRepo(e.target.value)}
                  disabled={savingCredentials}
                />
                <Text className={styles.label}>Branch</Text>
                <Input
                  value={azureDevopsBranch}
                  onChange={(e) => setAzureDevopsBranch(e.target.value)}
                  disabled={savingCredentials}
                />
                <Text className={styles.label}>Personal access token</Text>
                <Input
                  type="password"
                  value={azureDevopsPat}
                  placeholder="Enter a new token only when rotating"
                  onChange={(e) => setAzureDevopsPat(e.target.value)}
                  disabled={savingCredentials}
                />
              </div>
            </SettingRow>
          ) : null}

          {deploymentType === "GIT" && !loadingCredentials ? (
            <SettingRow label="GitHub" hint="Target repository for generated assets." stacked>
              <div className={styles.stack}>
                <Text className={styles.label}>Organization</Text>
                <Input
                  value={gitOrg}
                  onChange={(e) => setGitOrg(e.target.value)}
                  disabled={savingCredentials}
                />
                <Text className={styles.label}>Repository</Text>
                <Input
                  value={gitRepo}
                  onChange={(e) => setGitRepo(e.target.value)}
                  disabled={savingCredentials}
                />
                <Text className={styles.label}>Branch</Text>
                <Input
                  value={gitBranch}
                  onChange={(e) => setGitBranch(e.target.value)}
                  disabled={savingCredentials}
                />
                <Text className={styles.label}>Personal access token</Text>
                <Input
                  type="password"
                  value={gitPat}
                  placeholder="Enter a new token only when rotating"
                  onChange={(e) => setGitPat(e.target.value)}
                  disabled={savingCredentials}
                />
              </div>
            </SettingRow>
          ) : null}

          {deploymentType === "AZURE_DEVOPS" || deploymentType === "GIT" ? (
            <SettingRow
              label="Save credentials"
              hint="Tokens are sent through server-side routes and stored in Key Vault. They are never read back into this form."
            >
              <div className={styles.stack}>
                <Button
                  appearance="primary"
                  disabled={savingCredentials || loadingCredentials}
                  onClick={() => void handleSaveCredentials()}
                >
                  {savingCredentials ? "Saving…" : "Save credentials"}
                </Button>
                {credentialsMessage ? (
                  <Text size={200} className={styles.hint}>
                    {credentialsMessage}
                  </Text>
                ) : null}
              </div>
            </SettingRow>
          ) : null}
        </SettingsGroup>
      ) : null}

      {lite ? (
        <Text size={200} className={styles.hint}>
          Pipeline and deployment configuration is not available in lite mode.
        </Text>
      ) : null}
    </SettingsPanel>
  )
}
