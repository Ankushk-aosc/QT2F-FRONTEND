"use client";

import React, { useEffect, useState } from "react";

interface FadeInProps {
  children: React.ReactNode;
  /** Delay before starting the animation, in ms. Default: 0 */
  delay?: number;
  className?: string;
}

/** Wraps children in a subtle entrance animation (opacity + translateY). */
export function FadeIn({ children, delay = 0, className }: FadeInProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), delay);
    return () => clearTimeout(timer);
  }, [delay]);

  return (
    <div
      className={`ui-fade-in ${visible ? "ui-fade-in-visible" : ""} ${className ?? ""}`}
    >
      {children}
    </div>
  );
}
