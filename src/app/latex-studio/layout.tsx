/**
 * LaTeX Studio Layout
 * Overrides the root layout for the /latex-studio/* routes.
 * Uses a full-screen, no-navbar layout suitable for the IDE.
 */
export default function LaTeXStudioLayout({ children }: { children: React.ReactNode }) {
  // The IDE is full-screen — no top navbar, no padding
  // The root layout Navbar is suppressed by providing our own layout
  return <>{children}</>;
}
