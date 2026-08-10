"use client"

import React, { useCallback, useEffect, useState } from "react"
import {
  makeStyles,
  tokens,
  Button,
  Text,
  DrawerHeader,
  DrawerBody,
  DrawerHeaderTitle,
  OverlayDrawer,
  Dropdown,
  Option,
  Input,
  Spinner,
  Switch,
  Divider,
  Combobox,
} from "@fluentui/react-components"
import { 
  Dismiss24Regular, 
  Settings24Regular, 
  Database24Regular, 
  Sparkle24Regular, 
  CloudArrowUp24Regular 
} from "@fluentui/react-icons"
import { useUIStore } from "@/stores/ui.store"
import { recordsService } from "@/services/records.service"
import { isLiteMode } from "@/lib/config"

const useStyles = makeStyles({
  drawer: {
    width: "400px",
    backgroundColor: tokens.colorNeutralBackground1,
  },
  header: {
    borderBottom: `1px solid ${tokens.colorNeutralStroke2}`,
    paddingBottom: "12px",
    marginBottom: "20px",
  },
  section: {
    display: "flex",
    flexDirection: "column",
    gap: "16px",
    marginTop: "24px",
  },
  radioGroup: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
  },
  radioItem: {
    display: "flex",
    flexDirection: "column",
    gap: "4px",
    padding: "8px",
    borderRadius: tokens.borderRadiusMedium,
    transition: "background-color 0.2s",
    ":hover": {
      backgroundColor: tokens.colorNeutralBackground1Hover,
    },
  },
  radioLabel: {
    fontWeight: tokens.fontWeightSemibold,
    fontSize: tokens.fontSizeBase300,
  },
  radioDescription: {
    fontSize: tokens.fontSizeBase200,
    color: tokens.colorNeutralForeground3,
  },
  loadingContainer: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    height: "200px",
    gap: "12px",
  },
  switchRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "12px",
    borderRadius: tokens.borderRadiusMedium,
    backgroundColor: tokens.colorNeutralBackground2,
    transition: "background-color 0.2s",
    ":hover": {
      backgroundColor: tokens.colorNeutralBackground2Hover,
    },
  },
  switchLabel: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
  },
  settingCard: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
    padding: "12px",
    borderRadius: tokens.borderRadiusMedium,
    backgroundColor: tokens.colorNeutralBackground2,
  },
  settingHeader: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
  },
  timezoneDropdown: {
    width: "100%",
  },
  inputLabel: {
    fontSize: tokens.fontSizeBase200,
    fontWeight: tokens.fontWeightSemibold,
  },
})

export function SettingsDrawer() {
  const styles = useStyles()
  const { 
    isSettingsOpen, 
    setSettingsOpen, 
    mode, 
    setMode, 
    dataLayerEnabled, 
    setDataLayerEnabled, 
    fetchDataLayerStatus,
    deploymentType,
    setDeploymentType,
    fetchDeploymentType,
    timezone,
    setTimezone,
    fetchTimezone,
    theme,
    setTheme,
  } = useUIStore()
  const { SUPPORTED_TIMEZONES } = require("@/lib/constants")
  
  const timezoneOptions = SUPPORTED_TIMEZONES
  
  // Also include the currently active timezone if it's not in the options (e.g. detected from browser)
  if (timezone && !timezoneOptions.includes(timezone)) {
    timezoneOptions.push(timezone)
  }
  
  const defaultTimezone = "Australia/Sydney"

  const deploymentTypeDisplayMap: Record<string, string> = {
    "GIT": "GIT",
    "DIRECT_FABRIC": "Direct Fabric",
    "AZURE_DEVOPS": "Azure DevOps"
  }
  const [loading, setLoading] = useState(false)
  const [updating, setUpdating] = useState(false)
  const [updatingDataLayer, setUpdatingDataLayer] = useState(false)
  const [updatingTimezone, setUpdatingTimezone] = useState(false)
  const [updatingDeploymentType, setUpdatingDeploymentType] = useState(false)
  const [loadingDeploymentSettings, setLoadingDeploymentSettings] = useState(false)
  const [savingDeploymentSettings, setSavingDeploymentSettings] = useState(false)
  const [deploymentSettingsMessage, setDeploymentSettingsMessage] = useState("")

  const [azureDevopsOrg, setAzureDevopsOrg] = useState("")
  const [azureDevopsProject, setAzureDevopsProject] = useState("")
  const [azureDevopsRepo, setAzureDevopsRepo] = useState("")
  const [azureDevopsPat, setAzureDevopsPat] = useState("")

  const [gitOrg, setGitOrg] = useState("")
  const [gitRepo, setGitRepo] = useState("")
  const [gitPat, setGitPat] = useState("")

  const [selectedAzureDevopsBranch, setSelectedAzureDevopsBranch] = useState("")
  const [selectedGitBranch, setSelectedGitBranch] = useState("")

  const getTimezoneFromSettings = useCallback((settingsData: any): string => {
    return settingsData?.settings?.timezone || settingsData?.timezone || defaultTimezone
  }, [])

  const loadDeploymentSettings = useCallback(async (type: string) => {
    const normalizedType = (type || "").toUpperCase()
    if (normalizedType !== "AZURE_DEVOPS" && normalizedType !== "GIT") {
      setDeploymentSettingsMessage("")
      return
    }

    setLoadingDeploymentSettings(true)
    setDeploymentSettingsMessage("")

    try {
      if (normalizedType === "AZURE_DEVOPS") {
        const data = await recordsService.getAzureDevOpsDeploymentSettings()
        setAzureDevopsOrg(data.azure_devops_org || "")
        setAzureDevopsProject(data.azure_devops_project || "")
        setAzureDevopsRepo(data.azure_devops_repo || "")
        setSelectedAzureDevopsBranch(data.azure_devops_branch || "")
        setAzureDevopsPat("")
      } else {
        const data = await recordsService.getGitDeploymentSettings()
        setGitOrg(data.git_org || "")
        setGitRepo(data.git_repo || "")
        setSelectedGitBranch(data.git_branch || "")
        setGitPat("")
      }
    } catch (error) {
      console.error("Failed to load deployment settings:", error)
      setDeploymentSettingsMessage("Unable to load deployment settings.")
    } finally {
      setLoadingDeploymentSettings(false)
    }
  }, [])

  const fetchStatus = useCallback(async () => {
    setLoading(true)
    try {
      // Fetch both statuses in parallel from Cosmos DB (GET)
      const [interactiveData] = await Promise.all([
        recordsService.getInteractiveStatus(),
        fetchDataLayerStatus(true),
        fetchDeploymentType(true),
        fetchTimezone(true),
      ])
      setMode(interactiveData.status === true ? "single" : "full")

      const activeDeploymentType = (await recordsService.getDeploymentType())?.deployment_type || ""
      if (activeDeploymentType) {
        const normalizedType = activeDeploymentType.toUpperCase()
        setDeploymentType(normalizedType)
        await loadDeploymentSettings(normalizedType)
      }
    } catch (error) {
      console.error("Failed to fetch settings:", error)
    } finally {
      setLoading(false)
    }
  }, [setMode, fetchDataLayerStatus, fetchDeploymentType, fetchTimezone, setDeploymentType, loadDeploymentSettings])

  // Fetch status when drawer opens
  useEffect(() => {
    if (isSettingsOpen) {
      fetchStatus()
    }
  }, [isSettingsOpen, fetchStatus])

  const handleModeChange = async (checked: boolean) => {
    const newMode = checked ? "single" : "full"
    setUpdating(true)
    // Optimistic update
    const prevMode = mode
    setMode(newMode)
    
    try {
      await recordsService.updateInteractiveStatus(newMode === "single")
    } catch (error) {
      console.error("Failed to update settings:", error)
      // Revert on failure
      setMode(prevMode)
    } finally {
      setUpdating(false)
    }
  }

  const handleDataLayerToggle = async (checked: boolean) => {
    setUpdatingDataLayer(true)
    const prev = dataLayerEnabled
    setDataLayerEnabled(checked) // Optimistic update

    try {
      await recordsService.updateDataLayerStatus(checked)
      // After PATCH, re-fetch from Cosmos DB to confirm the backend accepted the change
      await fetchDataLayerStatus(true)
    } catch (error) {
      console.error("Failed to update data layer status:", error)
      setDataLayerEnabled(prev) // Revert on failure
    } finally {
      setUpdatingDataLayer(false)
    }
  }

  const handleTimezoneChange = async (nextTimezone: string) => {
    if (!nextTimezone || nextTimezone === timezone) return

    const previous = timezone
    setTimezone(nextTimezone)   // Optimistic update to global store
    setUpdatingTimezone(true)

    try {
      await recordsService.updateTimezone(nextTimezone)
      // Store is already updated optimistically; verify in background
      console.log("[SettingsDrawer] Timezone updated to:", nextTimezone)
    } catch (error) {
      console.error("Failed to update timezone:", error)
      setTimezone(previous)     // Revert global store on failure
    } finally {
      setUpdatingTimezone(false)
    }
  }

  const handleDeploymentTypeChange = async (type: string) => {
    if (!type || type === deploymentType) return

    setUpdatingDeploymentType(true)
    setDeploymentSettingsMessage("")
    const prev = deploymentType
    setDeploymentType(type)

    try {
      await recordsService.updateDeploymentType(type)
      await loadDeploymentSettings(type)
    } catch (error) {
      console.error("Failed to update deployment type:", error)
      setDeploymentType(prev)
    } finally {
      setUpdatingDeploymentType(false)
    }
  }

  const handleSaveDeploymentSettings = async () => {
    setSavingDeploymentSettings(true)
    setDeploymentSettingsMessage("")

    try {
      if (deploymentType === "AZURE_DEVOPS") {
        if (!azureDevopsOrg.trim() || !azureDevopsProject.trim() || !azureDevopsRepo.trim()) {
          setDeploymentSettingsMessage("Azure DevOps org, project, and repo are required.")
          return
        }

        await recordsService.saveAzureDevOpsDeploymentSettings({
          azure_devops_org: azureDevopsOrg.trim(),
          azure_devops_project: azureDevopsProject.trim(),
          azure_devops_repo: azureDevopsRepo.trim(),
          azure_devops_branch: selectedAzureDevopsBranch.trim() || undefined,
          azure_devops_pat: azureDevopsPat.trim() || undefined,
        })

        setAzureDevopsPat("")
        setDeploymentSettingsMessage("Azure DevOps settings saved securely.")
      }

      if (deploymentType === "GIT") {
        if (!gitOrg.trim() || !gitRepo.trim()) {
          setDeploymentSettingsMessage("Git org and repo are required.")
          return
        }

        await recordsService.saveGitDeploymentSettings({
          git_org: gitOrg.trim(),
          git_repo: gitRepo.trim(),
          git_branch: selectedGitBranch.trim() || undefined,
          git_pat: gitPat.trim() || undefined,
        })

        setGitPat("")
        setDeploymentSettingsMessage("GitHub settings saved securely.")
      }
    } catch (error) {
      console.error("Failed to save deployment settings:", error)
      setDeploymentSettingsMessage("Failed to save deployment settings.")
    } finally {
      setSavingDeploymentSettings(false)
    }
  }

  return (
    <OverlayDrawer
      position="end"
      open={isSettingsOpen}
      onOpenChange={(_, { open }) => setSettingsOpen(open)}
      className={styles.drawer}
      style={{ height: "100vh" }}
    >
      <DrawerHeader className={styles.header}>
        <DrawerHeaderTitle
          action={
            <Button
              appearance="subtle"
              aria-label="Close"
              icon={<Dismiss24Regular />}
              onClick={() => setSettingsOpen(false)}
            />
          }
        >
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <Settings24Regular />
            <Text size={500} weight="semibold">Settings</Text>
          </div>
        </DrawerHeaderTitle>
      </DrawerHeader>

      <DrawerBody>
        {loading ? (
          <div className={styles.loadingContainer}>
            <Spinner size="large" label="Loading settings..." />
          </div>
        ) : (
          <>
            {!isLiteMode() && (
              <>
                <div className={styles.section}>
                  <Text size={400} weight="semibold">Migration Mode</Text>
                  
                  <div className={styles.switchRow}>
                    <div className={styles.switchLabel}>
                      <Sparkle24Regular />
                      <div>
                        <Text size={300} weight="semibold">
                          {mode === "single" ? "Interactive Mode" : "Autonomous Migration"}
                        </Text>
                        <br />
                        <Text className={styles.radioDescription}>
                          {mode === "single" ? "Active: Step-by-Step" : "Active: Full Pipeline"}
                        </Text>
                      </div>
                    </div>
                    <Switch
                      checked={true}
                      onChange={() => handleModeChange(mode === "full")}
                      disabled={updating}
                    />
                  </div>

                  {updating && (
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "4px" }}>
                      <Spinner size="tiny" />
                      <Text size={200} italic>Updating mode...</Text>
                    </div>
                  )}
                  
                  <div style={{ marginTop: "8px", padding: "0 12px" }}>
                    <Text size={200} className={styles.radioDescription}>
                      {mode === "single" 
                        ? `Interactive mode pauses after Parsing. Subsequent stages include ${dataLayerEnabled ? "Data Layer, " : ""}Mapping, Report Generation, and Validation.` 
                        : `Full migration mode runs the complete automated pipeline: Assessment, Parsing, ${dataLayerEnabled ? "Data Layer, " : ""}Mapping, Report Generation, and Validation sequentially.`}
                    </Text>
                  </div>
                </div>

                <Divider style={{ margin: "24px 0" }} />
              </>
            )}

            <div className={styles.section} style={{ marginTop: "0" }}>
              <Text size={400} weight="semibold">Timezone</Text>
              <div className={styles.settingCard}>
                <div className={styles.settingHeader}>
                  <Settings24Regular />
                  <div>
                    <Text size={300} weight="semibold">Run History & Logs Timezone</Text>
                    <Text block className={styles.radioDescription}>{timezone}</Text>
                  </div>
                </div>
                <Dropdown
                  className={styles.timezoneDropdown}
                  value={timezone}
                  selectedOptions={[timezone]}
                  disabled={updatingTimezone}
                  onOptionSelect={(_, data) => handleTimezoneChange(String(data.optionValue || ""))}
                >
                  {timezoneOptions.map((tz: string) => (
                    <Option key={tz} value={tz}>{tz}</Option>
                  ))}
                </Dropdown>
              </div>
              <div style={{ marginTop: "4px", padding: "0 12px" }}>
                <Text size={200} className={styles.radioDescription}>
                  Persisted to records settings as key &quot;timezone&quot;.
                </Text>
              </div>
              {updatingTimezone && (
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "4px" }}>
                  <Spinner size="tiny" />
                  <Text size={200} italic>Updating timezone...</Text>
                </div>
              )}
            </div>

            <Divider style={{ margin: "24px 0" }} />

            <div className={styles.section} style={{ marginTop: "0" }}>
              <Text size={400} weight="semibold">Theme</Text>
              <div className={styles.settingCard}>
                <div className={styles.settingHeader}>
                  <Sparkle24Regular />
                  <div>
                    <Text size={300} weight="semibold">Application Theme</Text>
                    <Text block className={styles.radioDescription}>{theme === "dark" ? "Dark Theme" : "Light Theme"}</Text>
                  </div>
                </div>
                <Dropdown
                  className={styles.timezoneDropdown}
                  value={theme === "dark" ? "Dark Theme" : "Light Theme"}
                  selectedOptions={[theme]}
                  onOptionSelect={(_, data) => setTheme(data.optionValue as "light" | "dark")}
                >
                  <Option value="light">Light Theme</Option>
                  <Option value="dark">Dark Theme</Option>
                </Dropdown>
              </div>
            </div>

            {!isLiteMode() && (
              <>
                <Divider style={{ margin: "24px 0" }} />

                <div className={styles.section} style={{ marginTop: "0" }}>
                  <Text size={400} weight="semibold">Data Layer</Text>
                  <div className={styles.switchRow}>
                    <div className={styles.switchLabel}>
                      <Database24Regular />
                      <div>
                        <Text size={300} weight="semibold">Data Layer Discovery</Text>
                        <br />
                        <Text className={styles.radioDescription}>
                          {dataLayerEnabled ? "Enabled" : "Disabled"}
                        </Text>
                      </div>
                    </div>
                    <Switch
                      checked={dataLayerEnabled}
                      onChange={(_, data) => handleDataLayerToggle(data.checked)}
                      disabled={updatingDataLayer}
                    />
                  </div>
                  <div style={{ marginTop: "4px", padding: "0 12px" }}>
                    <Text size={200} className={styles.radioDescription}>
                      Automated discovery and validation of underlying data sources, schema parity, and relationship integrity.
                    </Text>
                  </div>
                  {updatingDataLayer && (
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "4px" }}>
                      <Spinner size="tiny" />
                      <Text size={200} italic>Updating data layer status...</Text>
                    </div>
                  )}
                </div>
                <Divider style={{ margin: "24px 0" }} />

                <div className={styles.section} style={{ marginTop: "0" }}>
                  <Text size={400} weight="semibold">Deployment Type</Text>
                  <div className={styles.settingCard}>
                    <div className={styles.settingHeader}>
                      <CloudArrowUp24Regular />
                      <Text size={300} weight="semibold">Select Deployment Target</Text>
                    </div>
                    
                    <Dropdown
                      className={styles.timezoneDropdown}
                      value={deploymentTypeDisplayMap[deploymentType] || deploymentType}
                      onOptionSelect={(_, data) => handleDeploymentTypeChange(data.optionValue || "GIT")}
                      disabled={updatingDeploymentType || loading}
                    >
                      <Option key="GIT" value="GIT">GIT</Option>
                      <Option key="DIRECT_FABRIC" value="DIRECT_FABRIC">Direct Fabric</Option>
                      <Option key="AZURE_DEVOPS" value="AZURE_DEVOPS">Azure DevOps</Option>
                    </Dropdown>

                    <div style={{ marginTop: "4px" }}>
                      <Text size={200} style={{ color: tokens.colorNeutralForeground3 }}>
                        Choose how generated assets should be stored or deployed.
                      </Text>
                    </div>

                    {loadingDeploymentSettings && (
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "8px" }}>
                        <Spinner size="tiny" />
                        <Text size={200} italic>Loading deployment settings...</Text>
                      </div>
                    )}

                    {!loadingDeploymentSettings && deploymentType === "AZURE_DEVOPS" && (
                      <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginTop: "8px" }}>
                        <Text className={styles.inputLabel}>Azure DevOps Organization</Text>
                        <Input
                          value={azureDevopsOrg}
                          onChange={(e) => setAzureDevopsOrg(e.target.value)}
                          placeholder="vectorlabai"
                          disabled={savingDeploymentSettings}
                        />

                        <Text className={styles.inputLabel}>Azure DevOps Project</Text>
                        <Input
                          value={azureDevopsProject}
                          onChange={(e) => setAzureDevopsProject(e.target.value)}
                          placeholder="SwitchbladeT2F"
                          disabled={savingDeploymentSettings}
                        />

                        <Text className={styles.inputLabel}>Azure DevOps Repository</Text>
                        <Input
                          value={azureDevopsRepo}
                          onChange={(e) => setAzureDevopsRepo(e.target.value)}
                          placeholder="vl-t2f-TMDL"
                          disabled={savingDeploymentSettings}
                        />

                        <Text className={styles.inputLabel}>Azure DevOps PAT</Text>
                        <Input
                          type="password"
                          value={azureDevopsPat}
                          onChange={(e) => setAzureDevopsPat(e.target.value)}
                          placeholder="Enter new PAT only when rotating"
                          disabled={savingDeploymentSettings}
                        />

                        <Text className={styles.inputLabel}>Azure DevOps Branch</Text>
                        <Input
                          value={selectedAzureDevopsBranch}
                          onChange={(e) => setSelectedAzureDevopsBranch(e.target.value)}
                          placeholder="dev"
                          disabled={savingDeploymentSettings}
                        />
                      </div>
                    )}

                    {!loadingDeploymentSettings && deploymentType === "GIT" && (
                      <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginTop: "8px" }}>
                        <Text className={styles.inputLabel}>Git Organization</Text>
                        <Input
                          value={gitOrg}
                          onChange={(e) => setGitOrg(e.target.value)}
                          placeholder="dotnetittest"
                          disabled={savingDeploymentSettings}
                        />

                        <Text className={styles.inputLabel}>Git Repository</Text>
                        <Input
                          value={gitRepo}
                          onChange={(e) => setGitRepo(e.target.value)}
                          placeholder="testrepo"
                          disabled={savingDeploymentSettings}
                        />

                        <Text className={styles.inputLabel}>Git PAT</Text>
                        <Input
                          type="password"
                          value={gitPat}
                          onChange={(e) => setGitPat(e.target.value)}
                          placeholder="Enter new PAT only when rotating"
                          disabled={savingDeploymentSettings}
                        />

                        <Text className={styles.inputLabel}>Git Branch</Text>
                        <Input
                          value={selectedGitBranch}
                          onChange={(e) => setSelectedGitBranch(e.target.value)}
                          placeholder="main"
                          disabled={savingDeploymentSettings}
                        />
                      </div>
                    )}

                    {(deploymentType === "AZURE_DEVOPS" || deploymentType === "GIT") && (
                      <>
                        <Button
                          appearance="primary"
                          onClick={handleSaveDeploymentSettings}
                          disabled={savingDeploymentSettings || loadingDeploymentSettings}
                          style={{ marginTop: "8px" }}
                        >
                          {savingDeploymentSettings ? "Saving..." : "Save Deployment Credentials"}
                        </Button>

                        <Text size={200} style={{ color: tokens.colorNeutralForeground3 }}>
                          Tokens are sent through server-side routes and stored in Key Vault.
                        </Text>
                      </>
                    )}

                    {!!deploymentSettingsMessage && (
                      <Text size={200} style={{ color: tokens.colorNeutralForeground2, marginTop: "4px" }}>
                        {deploymentSettingsMessage}
                      </Text>
                    )}

                    {updatingDeploymentType && (
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "8px" }}>
                        <Spinner size="tiny" />
                        <Text size={200} italic>Saving deployment type...</Text>
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}
          </>
        )}
      </DrawerBody>
    </OverlayDrawer>
  )
}
