"use client";

import type { ErrorInfo, ReactNode } from "react";
import { Component } from "react";

/** Catches a failing 3D scene so the page keeps its DOM fallback. */
export class SceneBoundary extends Component<{ name: string; onError: () => void; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: unknown, info: ErrorInfo) {
    console.error(`${this.props.name} scene failed, showing the fallback`, error, info.componentStack);
    this.props.onError();
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

export function hasWebGL(): boolean {
  try {
    const canvas = document.createElement("canvas");
    return Boolean(canvas.getContext("webgl2") ?? canvas.getContext("webgl"));
  } catch {
    return false;
  }
}
