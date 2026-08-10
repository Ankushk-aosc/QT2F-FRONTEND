import React, { createContext, useContext, useState, useEffect } from "react";
import { TabList, Tab } from "@fluentui/react-components";

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
}: any) {
  const [active, setActive] = useState(value || defaultValue);

  useEffect(() => {
    if (value !== undefined) {
      setActive(value);
    }
  }, [value]);

  const handleValueChange = (val: string) => {
    setActive(val);
    if (onValueChange) {
      onValueChange(val);
    }
  };

  return (
    <TabsContext.Provider value={{ value: active, onValueChange: handleValueChange }}>
      <div {...props}>{children}</div>
    </TabsContext.Provider>
  );
}

export function TabsList({ children, ...props }: any) {
  const { value, onValueChange } = useContext(TabsContext);
  return (
    <TabList
      selectedValue={value}
      onTabSelect={(_, data) => onValueChange?.(data.value as string)}
      {...props}
    >
      {children}
    </TabList>
  );
}

export function TabsTrigger({ value, children, ...props }: any) {
  return (
    <Tab value={value} {...props}>
      {children}
    </Tab>
  );
}

export function TabsContent({ value, children, ...props }: any) {
  const { value: activeValue } = useContext(TabsContext);
  if (activeValue !== value) return null;
  return <div style={{ marginTop: "12px" }} {...props}>{children}</div>;
}
