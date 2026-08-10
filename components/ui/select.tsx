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
      style={{
        padding: "8px 12px",
        border: "1px solid #d1d5db",
        borderRadius: "6px",
        width: "100%",
        backgroundColor: "white",
        color: "black",
        fontSize: "14px",
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
