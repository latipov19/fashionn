"use client";

import { RouteError } from "@/components/shell/route-error";

export default function ProductError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <RouteError reset={reset} />;
}
