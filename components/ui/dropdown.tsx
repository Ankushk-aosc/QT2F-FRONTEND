import React, { Children, isValidElement } from "react";

/**
 * `Option` never renders on its own — `Dropdown` reads its props (value/text/children)
 * to build a native `<select>`'s options. This mirrors the previous Fluent
 * `Dropdown`/`Option` pair's shape so call sites didn't need to change.
 */
export function Option({
  children,
}: {
  value?: string;
  text?: string;
  disabled?: boolean;
  style?: React.CSSProperties;
  children?: React.ReactNode;
}) {
  return <>{children}</>;
}

export interface DropdownOptionSelectData {
  optionValue?: string;
  optionText?: string;
  selectedOptions: string[];
}

export function Dropdown({
  children,
  placeholder,
  selectedOptions,
  onOptionSelect,
  disabled,
  className,
  style,
  multiselect,
}: {
  children?: React.ReactNode;
  placeholder?: string;
  value?: string;
  selectedOptions?: string[];
  onOptionSelect?: (event: React.ChangeEvent<HTMLSelectElement>, data: DropdownOptionSelectData) => void;
  disabled?: boolean;
  className?: string;
  style?: React.CSSProperties;
  multiselect?: boolean;
  /** Accepted for API compatibility with the previous Fluent usage; not otherwise used. */
  positioning?: string;
}) {
  const options: { value: string; text: string; disabled?: boolean }[] = [];
  Children.forEach(children, (child) => {
    if (isValidElement(child)) {
      const props = child.props as any;
      options.push({
        value: props.value,
        text: props.text ?? (typeof props.children === "string" ? props.children : props.value),
        disabled: props.disabled,
      });
    }
  });

  if (multiselect) {
    return (
      <select
        multiple
        className={["ui-input", className].filter(Boolean).join(" ")}
        style={style}
        disabled={disabled}
        value={selectedOptions ?? []}
        onChange={(e) => {
          const values = Array.from(e.target.selectedOptions).map((o) => o.value);
          onOptionSelect?.(e, { selectedOptions: values });
        }}
      >
        {options.map((o) => (
          <option key={o.value ?? o.text} value={o.value} disabled={o.disabled}>
            {o.text}
          </option>
        ))}
      </select>
    );
  }

  const selectedValue = selectedOptions && selectedOptions.length > 0 ? selectedOptions[0] : "";

  return (
    <select
      className={["ui-input", className].filter(Boolean).join(" ")}
      style={style}
      disabled={disabled}
      value={selectedValue}
      onChange={(e) => {
        const opt = options.find((o) => o.value === e.target.value);
        onOptionSelect?.(e, { optionValue: e.target.value, optionText: opt?.text, selectedOptions: [e.target.value] });
      }}
    >
      {placeholder && (
        <option value="" disabled hidden>
          {placeholder}
        </option>
      )}
      {options.map((o) => (
        <option key={o.value ?? o.text} value={o.value} disabled={o.disabled}>
          {o.text}
        </option>
      ))}
    </select>
  );
}
