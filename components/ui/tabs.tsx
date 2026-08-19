import React, { createContext, useContext, useState, useEffect } from "react";

const TabsContext = createContext<{
  value?: string;
  onValueChange?: (val: string) => void;
}>({});

export function Tabs({
  value,
  defaultValue,
  onValueChange,
  children,
  ...props
}: {
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  children?: React.ReactNode;
} & React.HTMLAttributes<HTMLDivElement>) {
  const [active, setActive] = useState(value || defaultValue);

  useEffect(() => {
    if (value !== undefined) {
      setActive(value);
    }
  }, [value]);

  const handleValueChange = (val: string) => {
    setActive(val);
    onValueChange?.(val);
  };

  return (
    <TabsContext.Provider value={{ value: active, onValueChange: handleValueChange }}>
      <div {...props}>{children}</div>
    </TabsContext.Provider>
  );
}

export function TabsList({ children, className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div role="tablist" className={["ui-tablist", className].filter(Boolean).join(" ")} {...props}>
      {children}
    </div>
  );
}

export function TabsTrigger({
  value,
  children,
  className,
  ...props
}: { value: string } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const { value: activeValue, onValueChange } = useContext(TabsContext);
  const selected = activeValue === value;

  return (
    <button
      type="button"
      role="tab"
      aria-selected={selected}
      tabIndex={selected ? 0 : -1}
      className={["ui-tab", className].filter(Boolean).join(" ")}
      onClick={() => onValueChange?.(value)}
      {...props}
    >
      {children}
    </button>
  );
}

export function TabsContent({
  value,
  children,
  style,
  ...props
}: { value: string } & React.HTMLAttributes<HTMLDivElement>) {
  const { value: activeValue } = useContext(TabsContext);
  if (activeValue !== value) return null;
  return (
    <div role="tabpanel" style={{ marginTop: "12px", ...style }} {...props}>
      {children}
    </div>
  );
}
