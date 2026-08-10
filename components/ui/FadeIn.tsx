"use client";

import React, { useEffect, useState } from "react";
import { makeStyles, tokens } from "@fluentui/react-components";

const useStyles = makeStyles({
  enter: {
    opacity: 0,
    transform: "translateY(8px)",
    transition: `opacity 220ms ${tokens.curveEasyEase}, transform 220ms ${tokens.curveEasyEase}`,
  },
  visible: {
    opacity: 1,
    transform: "translateY(0)",
  },
});

interface FadeInProps {
  children: React.ReactNode;
  /** Delay before starting the animation, in ms. Default: 0 */
  delay?: number;
  className?: string;
}

/**
 * FadeIn – wraps children in a subtle entrance animation.
 * Uses Fluent UI motion tokens for consistent timing.
 */
export function FadeIn({ children, delay = 0, className }: FadeInProps) {
  const styles = useStyles();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setVisible(true), delay);
    return () => clearTimeout(timer);
  }, [delay]);

  return (
    <div
      className={`${styles.enter} ${visible ? styles.visible : ""} ${className ?? ""}`}
    >
      {children}
    </div>
  );
}
