import React from "react";

export const Select = React.forwardRef<any, any>(({ children, style, onValueChange, onChange, ...props }, ref) => {
  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    if (onValueChange) onValueChange(e.target.value);
    if (onChange) onChange(e);
  };

  return (
    <select
      ref={ref}
      onChange={handleChange}
      // Width stays 100% by default because form rows across Settings rely on
      // it; pass `style={{ width: "auto" }}` for inline controls like filter
      // bars. Colours and metrics come from the design tokens so this control
      // matches the rest of the application.
      style={{
        padding: "0 12px",
        height: "var(--control-h-md)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-md)",
        width: "100%",
        backgroundColor: "var(--surface)",
        color: "var(--text)",
        fontSize: "var(--text-base)",
        ...style,
      }}
      {...props}
    >
      {children}
    </select>
  );
});

Select.displayName = "Select";

export const SelectTrigger = ({ children, ...props }: any) => <div {...props}>{children}</div>;
export const SelectValue = ({ children, ...props }: any) => <span {...props}>{children}</span>;
export const SelectContent = ({ children, ...props }: any) => <>{children}</>;
export const SelectItem = ({ value, children, ...props }: any) => <option value={value} {...props}>{children}</option>;
