import React, { useEffect, useRef } from "react";

export function Checkbox({
  label,
  checked,
  onChange,
  disabled,
  className,
  style,
}: {
  label?: React.ReactNode;
  checked?: boolean | "mixed";
  onChange?: (event: React.ChangeEvent<HTMLInputElement>, data: { checked: boolean | "mixed" }) => void;
  disabled?: boolean;
  className?: string;
  style?: React.CSSProperties;
}) {
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (ref.current) ref.current.indeterminate = checked === "mixed";
  }, [checked]);

  return (
    <label
      className={className}
      style={{ display: "inline-flex", alignItems: "center", gap: "8px", cursor: disabled ? "not-allowed" : "pointer", ...style }}
    >
      <input
        ref={ref}
        type="checkbox"
        checked={checked === "mixed" ? false : !!checked}
        disabled={disabled}
        onChange={(e) => onChange?.(e, { checked: e.target.checked })}
      />
      {label}
    </label>
  );
}
