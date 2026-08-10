import React from "react";
import {
  Accordion as FluentAccordion,
  AccordionItem as FluentAccordionItem,
  AccordionHeader as FluentAccordionHeader,
  AccordionPanel as FluentAccordionPanel,
} from "@fluentui/react-components";

export function Accordion({ children, type, collapsible, defaultValue, ...props }: any) {
  return (
    <FluentAccordion
      collapsible={collapsible}
      defaultValue={defaultValue}
      {...props}
    >
      {children}
    </FluentAccordion>
  );
}

export function AccordionItem({ value, children, ...props }: any) {
  return (
    <FluentAccordionItem value={value} {...props}>
      {children}
    </FluentAccordionItem>
  );
}

export function AccordionTrigger({ children, ...props }: any) {
  return (
    <FluentAccordionHeader {...props}>
      {children}
    </FluentAccordionHeader>
  );
}

export function AccordionContent({ children, ...props }: any) {
  return (
    <FluentAccordionPanel {...props}>
      {children}
    </FluentAccordionPanel>
  );
}
