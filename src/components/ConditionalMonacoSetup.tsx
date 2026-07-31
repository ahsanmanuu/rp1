"use client";

import { usePathname } from "next/navigation";
import dynamic from "next/dynamic";

// Lazy-load MonacoSetup only when needed — avoids loading ~2MB bundle on non-editor pages
const MonacoSetup = dynamic(() => import("@/components/MonacoSetup"), {
  ssr: false,
});

const EDITOR_PREFIXES = [
  "/latex-studio/",
  "/editor/",
  "/diagrams/",
  "/doc2latex/",
  "/guest-studio",
  "/template-migrator/",
  "/citations/",
];

export default function ConditionalMonacoSetup() {
  const pathname = usePathname();

  const needsMonaco = EDITOR_PREFIXES.some((prefix) =>
    pathname.startsWith(prefix)
  );

  if (!needsMonaco) return null;

  return <MonacoSetup />;
}
