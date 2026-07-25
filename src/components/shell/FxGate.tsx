"use client";

import type { ReactNode } from "react";
import { usePhoneViewport } from "./viewport";
import { Clouds, type CloudsProps } from "@/components/canvasui/Clouds";
import { Ripple, type RippleProps } from "@/components/canvasui/Ripple";

/**
 * Canvas effects wear a viewport gate: on a phone the experimental
 * html-in-canvas surface can swallow touches, so interactive content goes
 * without the effect and the content renders plainly. Desktop keeps the
 * full treatment.
 */
export function CloudsGate({ children, ...props }: CloudsProps & { children: ReactNode }) {
  const phone = usePhoneViewport();
  return phone ? <>{children}</> : <Clouds {...props}>{children}</Clouds>;
}

export function RippleGate({ children, ...props }: RippleProps & { children: ReactNode }) {
  const phone = usePhoneViewport();
  return phone ? <>{children}</> : <Ripple {...props}>{children}</Ripple>;
}
