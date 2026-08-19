"use client"

import React, { useEffect, useMemo, useState } from "react"

import {
  getConnectorFields,
  isFieldApplicable,
  getDefaultValues,
  type ConnectorDefinition,
} from "@/lib/connectors/registry"
import type { ConnectorConnection, ConnectorField, ConnectorSavePayload } from "@/types/connectors"
import { Button } from "@/components/ui/button"
import { Field } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Select, SelectItem } from "@/components/ui/select"
import { Spinner } from "@/components/ui/spinner"
import { Switch } from "@/components/ui/switch"

/**
 * The connection form, generated from a connector's field schema.
 *
 * This is the component that makes the framework reusable: it renders whatever
 * `ConnectorDefinition.fieldGroups` declares and has no knowledge of any
 * particular platform. Adding Snowflake adds a registry entry, not a form.
 *
 * Two behaviours are worth stating explicitly, because both are easy to get
 * subtly wrong and both matter:
 *
 * **Secrets are never populated.** A secret input always renders blank, even
 * when a credential is stored. The placeholder says so, and an untouched secret
 * field is omitted from the payload — meaning "leave the stored one alone"
 * rather than "clear it". Without that distinction, editing a URL would wipe
 * the API key.
 *
 * **Hidden fields are not submitted.** `visibleWhen` uses the same
 * `isFieldApplicable` the server validates with, so the form cannot hide a
 * field that the server then demands, and switching authentication method
 * cannot leave the previous method's values behind.
 */

/** Placeholder shown on a secret input that already has a stored value. */
const STORED_SECRET_PLACEHOLDER = "Configured — enter a new value only when rotating"

export interface ConnectorFormProps {
  connector: ConnectorDefinition
  connection: ConnectorConnection | null
  /** Field-level errors from the last rejected save, keyed by field key. */
  fieldErrors: Record<string, string>
  saving: boolean
  onSave: (payload: ConnectorSavePayload) => void
  onCancel?: () => void
}

export function ConnectorForm({
  connector,
  connection,
  fieldErrors,
  saving,
  onSave,
  onCancel,
}: ConnectorFormProps) {
  const [connectionName, setConnectionName] = useState("")
  const [values, setValues] = useState<Record<string, string | number | boolean>>({})
  /** Only the secrets the administrator typed this session. */
  const [secrets, setSecrets] = useState<Record<string, string>>({})

  const storedSecrets = useMemo(
    () => new Set(connection?.secretsPresent ?? []),
    [connection?.secretsPresent],
  )

  // Seed from the saved connection, falling back to the schema's defaults.
  // Re-runs when switching connector so the form never shows another
  // platform's values.
  useEffect(() => {
    setConnectionName(connection?.connectionName || connector.name)
    setValues({ ...getDefaultValues(connector), ...(connection?.values ?? {}) })
    setSecrets({})
  }, [connector, connection])

  const setValue = (key: string, value: string | number | boolean) => {
    setValues((current) => ({ ...current, [key]: value }))
  }

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault()

    // Submit only applicable, non-secret fields. Hidden fields are dropped so a
    // change of authentication method does not carry stale values forward.
    const applicable: Record<string, string | number | boolean> = {}
    for (const field of getConnectorFields(connector)) {
      if (field.secret) continue
      if (!isFieldApplicable(field, values)) continue
      if (values[field.key] !== undefined) applicable[field.key] = values[field.key]
    }

    onSave({ connectionName, values: applicable, secrets })
  }

  function renderField(field: ConnectorField) {
    if (!isFieldApplicable(field, values)) return null

    const error = fieldErrors[field.key]
    const validationState = error ? ("error" as const) : ("none" as const)

    // A switch reads better as a row with its label on the left than as a
    // Field with a control beneath it.
    if (field.type === "boolean") {
      return (
        <div key={field.key} className="connector-form-switch-row">
          <div className="connector-form-switch-text">
            <span className="settings-row-label">{field.label}</span>
            {field.hint ? <span className="settings-row-hint">{field.hint}</span> : null}
          </div>
          <Switch
            checked={values[field.key] === true}
            onChange={(checked) => setValue(field.key, checked)}
            aria-label={field.label}
          />
        </div>
      )
    }

    if (field.type === "select") {
      const current = String(values[field.key] ?? "")

      return (
        <Field key={field.key} label={field.label} hint={field.hint} required={field.required} validationState={validationState} validationMessage={error}>
          <Select
            value={current}
            onValueChange={(value: string) => setValue(field.key, value)}
          >
            {field.options?.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </Select>
        </Field>
      )
    }

    if (field.secret) {
      const alreadyStored = storedSecrets.has(field.key)

      return (
        <Field
          key={field.key}
          label={field.label}
          hint={field.hint}
          // A stored secret satisfies the requirement, so the field should not
          // wear a required marker that implies the admin must retype it.
          required={field.required && !alreadyStored}
          validationState={validationState}
          validationMessage={error}
        >
          <Input
            type="password"
            value={secrets[field.key] ?? ""}
            placeholder={alreadyStored ? STORED_SECRET_PLACEHOLDER : field.placeholder}
            autoComplete="new-password"
            onChange={(e) => setSecrets((current) => ({ ...current, [field.key]: e.target.value }))}
          />
        </Field>
      )
    }

    return (
      <Field key={field.key} label={field.label} hint={field.hint} required={field.required} validationState={validationState} validationMessage={error}>
        <Input
          type={field.type === "number" ? "number" : "text"}
          value={String(values[field.key] ?? "")}
          placeholder={field.placeholder}
          min={field.min}
          max={field.max}
          onChange={(e) =>
            setValue(field.key, field.type === "number" ? Number(e.target.value) : e.target.value)
          }
        />
      </Field>
    )
  }

  return (
    <form className="connector-form" onSubmit={handleSubmit}>
      <div className="connector-form-group-card">
        <Field
          label="Connection name"
          hint="How this connection is identified across the platform."
          required
          className="connector-form-name-field"
          validationState={fieldErrors.connectionName ? "error" : "none"}
          validationMessage={fieldErrors.connectionName}
        >
          <Input value={connectionName} onChange={(e) => setConnectionName(e.target.value)} />
        </Field>
      </div>

      {connector.fieldGroups.map((group) => {
        const rendered = group.fields.map(renderField).filter(Boolean)
        // A group whose every field is hidden by `visibleWhen` should not leave
        // an empty card behind.
        if (rendered.length === 0) return null

        return (
          <section key={group.title} className="connector-form-group">
            <span className="settings-group-header" style={{ marginBottom: 0 }}>
              {group.title}
            </span>
            {group.description ? <p className="connector-form-group-description">{group.description}</p> : null}
            <div className="connector-form-group-card">{rendered}</div>
          </section>
        )
      })}

      <div className="connector-form-actions">
        <Button type="submit" disabled={saving}>
          {saving ? <Spinner size="tiny" /> : null}
          {saving ? "Saving and discovering…" : "Save"}
        </Button>
        {onCancel ? (
          <Button type="button" variant="secondary" onClick={onCancel} disabled={saving}>
            Cancel
          </Button>
        ) : null}
        <span className="settings-row-hint">
          Saving verifies the credentials and discovers metadata automatically.
        </span>
      </div>
    </form>
  )
}
