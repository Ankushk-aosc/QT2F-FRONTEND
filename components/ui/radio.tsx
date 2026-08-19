import React, { createContext, useContext } from "react";

const RadioGroupContext = createContext<{
  value?: string;
  onChange?: (event: React.ChangeEvent<HTMLInputElement>, data: { value: string }) => void;
  disabled?: boolean;
}>({});

export function RadioGroup({
  value,
  onChange,
  disabled,
  layout,
  children,
  style,
}: {
  value?: string;
  onChange?: (event: React.ChangeEvent<HTMLInputElement>, data: { value: string }) => void;
  disabled?: boolean;
  layout?: "horizontal" | "vertical";
  children?: React.ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <RadioGroupContext.Provider value={{ value, onChange, disabled }}>
      <div style={{ display: "flex", flexDirection: layout === "vertical" ? "column" : "row", gap: "12px", ...style }}>
        {children}
      </div>
    </RadioGroupContext.Provider>
  );
}

export function Radio({ value, label, disabled }: { value: string; label?: React.ReactNode; disabled?: boolean }) {
  const { value: groupValue, onChange, disabled: groupDisabled } = useContext(RadioGroupContext);
  const isDisabled = disabled ?? groupDisabled;

  return (
    <label style={{ display: "inline-flex", alignItems: "center", gap: "8px", cursor: isDisabled ? "not-allowed" : "pointer" }}>
      <input
        type="radio"
        checked={groupValue === value}
        disabled={isDisabled}
        onChange={(e) => {
          if (e.target.checked) onChange?.(e, { value });
        }}
      />
      {label}
    </label>
  );
}
