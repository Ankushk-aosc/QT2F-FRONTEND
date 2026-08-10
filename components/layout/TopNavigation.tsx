"use client"

import React, { useState } from "react"   // ← added React + useState
import {
  Avatar,
  Button,
  Menu,
  MenuTrigger,
  MenuPopover,
  MenuList,
  MenuItem,
  makeStyles,
  shorthands,
  tokens,
  Tooltip,
} from "@fluentui/react-components"
import {
  Dismiss24Regular,
  List24Regular,
  SignOut20Regular,
  Settings24Regular,
} from "@fluentui/react-icons"
import { useAuth } from "@/hooks/useAuth"
import { useUIStore } from "@/stores/ui.store"
import { useDashboardStore } from "@/stores/dashboard.store"
import { SettingsDrawer } from "./SettingsDrawer"
import Image from "next/image"

const useStyles = makeStyles({
  header: {
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
    zIndex: 50,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    width: "100%",
    padding: "16px 24px",
    backgroundColor: "var(--background)",
    borderBottom: `1px solid ${tokens.colorNeutralStroke2}`,
  },
  logoContainer: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
  },
  titleContainer: {
    position: "absolute",
    top: 0,
    bottom: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    transition: "left 0.3s ease-in-out, width 0.3s ease-in-out",
    pointerEvents: "none",
    "@media (max-width: 767px)": {
      left: "0 !important",
      width: "100% !important",
    }
  },
  menuButton: {
    padding: "0",
    minWidth: "auto",
  },
  logo: {
    height: "48px",
    width: "auto",
    objectFit: "contain",
  },
  rightSection: {
    display: "flex",
    alignItems: "center",
    gap: "16px",
  },
  avatarButton: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: "40px",
    height: "40px",
    ...shorthands.borderRadius("50%"),
    backgroundColor: tokens.colorNeutralBackground4,
    color: tokens.colorNeutralForeground2,
    fontSize: tokens.fontSizeBase300,
    fontWeight: tokens.fontWeightSemibold,
    cursor: "pointer",
    transitionProperty: "background-color",
    transitionDuration: tokens.durationNormal,
    ":hover": {
      backgroundColor: tokens.colorNeutralBackground3,
    },
    ":focus": {
      outlineStyle: "none",
    },
  },
  settingsButton: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: "40px",
    height: "40px",
    ...shorthands.borderRadius("50%"),
    backgroundColor: "transparent",
    color: tokens.colorNeutralForeground2,
    border: "none",
    cursor: "pointer",
    transitionProperty: "background-color",
    transitionDuration: tokens.durationNormal,
    ":hover": {
      backgroundColor: tokens.colorSubtleBackgroundHover,
    },
    ":focus": {
      outlineStyle: "none",
    },
  },
  dropdown: {
    position: "absolute",
    right: 0,
    top: "100%",
    marginTop: "12px",
    width: "192px",
    ...shorthands.borderRadius(tokens.borderRadiusMedium),
    backgroundColor: tokens.colorNeutralBackground1,
    boxShadow: tokens.shadow8,
    zIndex: 60,
    overflow: "hidden",
  },
  settingsDropdown: {
    width: "192px",
    ...shorthands.borderRadius(tokens.borderRadiusMedium),
    backgroundColor: tokens.colorNeutralBackground1,
    boxShadow: tokens.shadow8,
    zIndex: 60,
    overflow: "hidden",
    ...shorthands.padding("4px", "0"),
  },
  userInfo: {
    padding: "8px 16px",
    fontSize: tokens.fontSizeBase300,
    color: tokens.colorNeutralForeground1,
    borderBottom: `1px solid ${tokens.colorNeutralStroke2}`,
  },
  menuItem: {
    width: "100%",
    textAlign: "left",
    padding: "8px 16px",
    fontSize: tokens.fontSizeBase300,
    color: tokens.colorNeutralForeground1,
    cursor: "pointer",
    ":hover": {
      backgroundColor: tokens.colorSubtleBackgroundHover,
    },
  },
})

export function TopNavigation() {
  const styles = useStyles()
  const { user, logout } = useAuth()
  const { mode, setMode } = useUIStore()
  const { isProcessing } = useDashboardStore()
  const { isSettingsOpen, setSettingsOpen, isSidebarOpen, workspace } = useUIStore()
  const [isUserDropdownOpen, setIsUserDropdownOpen] = useState(false)

  const userInitial = user?.name?.charAt(0)?.toUpperCase() ||
                      user?.email?.charAt(0)?.toUpperCase() ||
                      "U"

  const userDisplayName = user?.name || user?.email || "User"

  const handleLogout = () => {
    logout()
    setIsUserDropdownOpen(false)
  }

  return (
    <div className={styles.header}>
      <div className={styles.logoContainer}>
        <Image
          src="/Switchblade_Logo.png"
          alt="Switchblade Logo"
          width={360}
          height={65}
          className={styles.logo}
          priority
        />
      </div>

      <div 
        className={styles.titleContainer}
        style={{
          left: isSidebarOpen ? '340px' : '64px',
          width: `calc(100vw - ${isSidebarOpen ? '340px' : '64px'})`
        }}
      >
        <span style={{ 
          fontSize: "24px", 
          fontWeight: 600, 
          color: tokens.colorNeutralForeground1,
          letterSpacing: "0.5px",
          whiteSpace: "nowrap"
        }}>
          {workspace === "qlik" ? "Qlik Sense → Microsoft Fabric Migration" : "Tableau → Microsoft Fabric Migration"}
        </span>
      </div>

      <div className={styles.rightSection}>
        {isProcessing ? (
          <Tooltip content="Cannot change mode while a migration is in progress" relationship="label">
            <span style={{ display: "inline-block" }}>
              <button 
                className={styles.settingsButton} 
                aria-label="Settings" 
                disabled 
                style={{ opacity: 0.5, cursor: "not-allowed" }}
              >
                <Settings24Regular />
              </button>
            </span>
          </Tooltip>
        ) : (
          <button 
            className={styles.settingsButton} 
            aria-label="Settings"
            onClick={() => setSettingsOpen(true)}
          >
            <Settings24Regular />
          </button>
        )}

        <SettingsDrawer />

        <Menu
          open={isUserDropdownOpen}
          onOpenChange={(_, data) => setIsUserDropdownOpen(data.open)}
        >
          <MenuTrigger disableButtonEnhancement>
            <div className={styles.avatarButton}>
              <Avatar
                name={userDisplayName}
                initials={userInitial}
                color="neutral"
                size={40}
                active="unset"
              />
            </div>
          </MenuTrigger>

          <MenuPopover className={styles.dropdown}>
            <MenuList>
              <div className={styles.userInfo}>
                {userDisplayName}
              </div>
              <MenuItem
                className={styles.menuItem}
                icon={<SignOut20Regular />}
                onClick={handleLogout}
              >
                Logout
              </MenuItem>
            </MenuList>
          </MenuPopover>
        </Menu>
      </div>
    </div>
  )
}