"use client";

import { useEffect, useState } from "react";

export type Theme =
  | "indigo"
  | "emerald"
  | "rose"
  | "violet"
  | "amber"
  | "cyan"
  | "sky"
  | "pink"
  | "orange"
  | "lime"
  | "teal"
  | "fuchsia"
  | "red"
  | "yellow"
  | "stone"
  | "zinc";

export interface ThemeColors {
  primary: string;
  primaryContainer: string;
  onPrimaryContainer: string;
  secondary: string;
  secondaryContainer: string;
  onSecondaryContainer: string;
  surfaceContainer: string;
  outlineVariant: string;
  lightPrimary: string;
  lightPrimaryContainer: string;
  lightOnPrimaryContainer: string;
  lightSecondary: string;
  lightSecondaryContainer: string;
  lightOnSecondaryContainer: string;
}

export const themes: Record<Theme, ThemeColors> = {
  indigo: {
    primary: "#c3c0ff",
    primaryContainer: "rgba(195, 192, 255, 0.15)",
    onPrimaryContainer: "#dad7ff",
    secondary: "#c0c1ff",
    secondaryContainer: "rgba(192, 193, 255, 0.15)",
    onSecondaryContainer: "#b0b2ff",
    surfaceContainer: "#171f33",
    outlineVariant: "#464555",
    lightPrimary: "#4f46e5",
    lightPrimaryContainer: "#e0e7ff",
    lightOnPrimaryContainer: "#1e1b4b",
    lightSecondary: "#6366f1",
    lightSecondaryContainer: "#e0e7ff",
    lightOnSecondaryContainer: "#1e1b4b",
  },
  emerald: {
    primary: "#6ee7b7",
    primaryContainer: "rgba(110, 231, 183, 0.15)",
    onPrimaryContainer: "#d1fae5",
    secondary: "#a7f3d0",
    secondaryContainer: "rgba(167, 243, 208, 0.15)",
    onSecondaryContainer: "#ecfdf5",
    surfaceContainer: "#0f2c20",
    outlineVariant: "#2d4a3e",
    lightPrimary: "#059669",
    lightPrimaryContainer: "#d1fae5",
    lightOnPrimaryContainer: "#022c22",
    lightSecondary: "#10b981",
    lightSecondaryContainer: "#d1fae5",
    lightOnSecondaryContainer: "#022c22",
  },
  rose: {
    primary: "#fda4af",
    primaryContainer: "rgba(253, 164, 175, 0.15)",
    onPrimaryContainer: "#ffe4e6",
    secondary: "#fecdd3",
    secondaryContainer: "rgba(254, 205, 211, 0.15)",
    onSecondaryContainer: "#fff1f2",
    surfaceContainer: "#33181b",
    outlineVariant: "#553639",
    lightPrimary: "#e11d48",
    lightPrimaryContainer: "#ffe4e6",
    lightOnPrimaryContainer: "#4c0519",
    lightSecondary: "#f43f5e",
    lightSecondaryContainer: "#ffe4e6",
    lightOnSecondaryContainer: "#4c0519",
  },
  violet: {
    primary: "#d8b4fe",
    primaryContainer: "rgba(216, 180, 254, 0.15)",
    onPrimaryContainer: "#f3e8ff",
    secondary: "#e9d5ff",
    secondaryContainer: "rgba(233, 213, 255, 0.15)",
    onSecondaryContainer: "#faf5ff",
    surfaceContainer: "#2e1065",
    outlineVariant: "#4c1d95",
    lightPrimary: "#7c3aed",
    lightPrimaryContainer: "#ede9fe",
    lightOnPrimaryContainer: "#2e1065",
    lightSecondary: "#8b5cf6",
    lightSecondaryContainer: "#ede9fe",
    lightOnSecondaryContainer: "#2e1065",
  },
  amber: {
    primary: "#fcd34d",
    primaryContainer: "rgba(252, 211, 77, 0.15)",
    onPrimaryContainer: "#fef3c7",
    secondary: "#fde68a",
    secondaryContainer: "rgba(253, 230, 138, 0.15)",
    onSecondaryContainer: "#fffbeb",
    surfaceContainer: "#451a03",
    outlineVariant: "#78350f",
    lightPrimary: "#d97706",
    lightPrimaryContainer: "#fef3c7",
    lightOnPrimaryContainer: "#451a03",
    lightSecondary: "#f59e0b",
    lightSecondaryContainer: "#fef3c7",
    lightOnSecondaryContainer: "#451a03",
  },
  cyan: {
    primary: "#67e8f9",
    primaryContainer: "rgba(103, 232, 249, 0.15)",
    onPrimaryContainer: "#ecfeff",
    secondary: "#a5f3fc",
    secondaryContainer: "rgba(165, 243, 252, 0.15)",
    onSecondaryContainer: "#f0fdfa",
    surfaceContainer: "#083344",
    outlineVariant: "#164e63",
    lightPrimary: "#0891b2",
    lightPrimaryContainer: "#cffafe",
    lightOnPrimaryContainer: "#164e63",
    lightSecondary: "#06b6d4",
    lightSecondaryContainer: "#cffafe",
    lightOnSecondaryContainer: "#164e63",
  },
  sky: {
    primary: "#bae6fd",
    primaryContainer: "rgba(186, 230, 253, 0.15)",
    onPrimaryContainer: "#e0f2fe",
    secondary: "#7dd3fc",
    secondaryContainer: "rgba(125, 211, 252, 0.15)",
    onSecondaryContainer: "#f0f9ff",
    surfaceContainer: "#0c2d48",
    outlineVariant: "#1e4976",
    lightPrimary: "#0284c7",
    lightPrimaryContainer: "#e0f2fe",
    lightOnPrimaryContainer: "#0c2d48",
    lightSecondary: "#38bdf8",
    lightSecondaryContainer: "#e0f2fe",
    lightOnSecondaryContainer: "#0c2d48",
  },
  pink: {
    primary: "#f9a8d4",
    primaryContainer: "rgba(249, 168, 212, 0.15)",
    onPrimaryContainer: "#fce7f3",
    secondary: "#f472b6",
    secondaryContainer: "rgba(244, 114, 182, 0.15)",
    onSecondaryContainer: "#fdf2f8",
    surfaceContainer: "#4a0e2a",
    outlineVariant: "#831843",
    lightPrimary: "#db2777",
    lightPrimaryContainer: "#fce7f3",
    lightOnPrimaryContainer: "#4a0e2a",
    lightSecondary: "#ec4899",
    lightSecondaryContainer: "#fce7f3",
    lightOnSecondaryContainer: "#4a0e2a",
  },
  orange: {
    primary: "#fdba74",
    primaryContainer: "rgba(253, 186, 116, 0.15)",
    onPrimaryContainer: "#fff7ed",
    secondary: "#fb923c",
    secondaryContainer: "rgba(251, 146, 60, 0.15)",
    onSecondaryContainer: "#fff7ed",
    surfaceContainer: "#431407",
    outlineVariant: "#9a3412",
    lightPrimary: "#ea580c",
    lightPrimaryContainer: "#fff7ed",
    lightOnPrimaryContainer: "#431407",
    lightSecondary: "#f97316",
    lightSecondaryContainer: "#fff7ed",
    lightOnSecondaryContainer: "#431407",
  },
  lime: {
    primary: "#bef264",
    primaryContainer: "rgba(190, 242, 100, 0.15)",
    onPrimaryContainer: "#f7fee7",
    secondary: "#a3e635",
    secondaryContainer: "rgba(163, 230, 53, 0.15)",
    onSecondaryContainer: "#f7fee7",
    surfaceContainer: "#1a2e05",
    outlineVariant: "#3f6212",
    lightPrimary: "#65a30d",
    lightPrimaryContainer: "#f7fee7",
    lightOnPrimaryContainer: "#1a2e05",
    lightSecondary: "#84cc16",
    lightSecondaryContainer: "#f7fee7",
    lightOnSecondaryContainer: "#1a2e05",
  },
  teal: {
    primary: "#99f6e4",
    primaryContainer: "rgba(153, 246, 228, 0.15)",
    onPrimaryContainer: "#f0fdfa",
    secondary: "#5eead4",
    secondaryContainer: "rgba(94, 234, 212, 0.15)",
    onSecondaryContainer: "#f0fdfa",
    surfaceContainer: "#042f2e",
    outlineVariant: "#115e59",
    lightPrimary: "#0d9488",
    lightPrimaryContainer: "#f0fdfa",
    lightOnPrimaryContainer: "#042f2e",
    lightSecondary: "#14b8a6",
    lightSecondaryContainer: "#f0fdfa",
    lightOnSecondaryContainer: "#042f2e",
  },
  fuchsia: {
    primary: "#f0abfc",
    primaryContainer: "rgba(240, 171, 252, 0.15)",
    onPrimaryContainer: "#fdf4ff",
    secondary: "#e879f9",
    secondaryContainer: "rgba(232, 121, 249, 0.15)",
    onSecondaryContainer: "#fdf4ff",
    surfaceContainer: "#4a044e",
    outlineVariant: "#86198f",
    lightPrimary: "#c026d3",
    lightPrimaryContainer: "#fdf4ff",
    lightOnPrimaryContainer: "#4a044e",
    lightSecondary: "#d946ef",
    lightSecondaryContainer: "#fdf4ff",
    lightOnSecondaryContainer: "#4a044e",
  },
  red: {
    primary: "#fca5a5",
    primaryContainer: "rgba(252, 165, 165, 0.15)",
    onPrimaryContainer: "#fef2f2",
    secondary: "#f87171",
    secondaryContainer: "rgba(248, 113, 113, 0.15)",
    onSecondaryContainer: "#fef2f2",
    surfaceContainer: "#450a0a",
    outlineVariant: "#991b1b",
    lightPrimary: "#dc2626",
    lightPrimaryContainer: "#fef2f2",
    lightOnPrimaryContainer: "#450a0a",
    lightSecondary: "#ef4444",
    lightSecondaryContainer: "#fef2f2",
    lightOnSecondaryContainer: "#450a0a",
  },
  yellow: {
    primary: "#fde047",
    primaryContainer: "rgba(253, 224, 71, 0.15)",
    onPrimaryContainer: "#fefce8",
    secondary: "#facc15",
    secondaryContainer: "rgba(250, 204, 21, 0.15)",
    onSecondaryContainer: "#fefce8",
    surfaceContainer: "#422006",
    outlineVariant: "#a16207",
    lightPrimary: "#ca8a04",
    lightPrimaryContainer: "#fefce8",
    lightOnPrimaryContainer: "#422006",
    lightSecondary: "#eab308",
    lightSecondaryContainer: "#fefce8",
    lightOnSecondaryContainer: "#422006",
  },
  stone: {
    primary: "#d6d3d1",
    primaryContainer: "rgba(214, 211, 209, 0.15)",
    onPrimaryContainer: "#f5f5f4",
    secondary: "#a8a29e",
    secondaryContainer: "rgba(168, 162, 158, 0.15)",
    onSecondaryContainer: "#f5f5f4",
    surfaceContainer: "#1c1917",
    outlineVariant: "#57534e",
    lightPrimary: "#78716c",
    lightPrimaryContainer: "#f5f5f4",
    lightOnPrimaryContainer: "#1c1917",
    lightSecondary: "#a8a29e",
    lightSecondaryContainer: "#f5f5f4",
    lightOnSecondaryContainer: "#1c1917",
  },
  zinc: {
    primary: "#d4d4d8",
    primaryContainer: "rgba(212, 212, 216, 0.15)",
    onPrimaryContainer: "#f4f4f5",
    secondary: "#a1a1aa",
    secondaryContainer: "rgba(161, 161, 170, 0.15)",
    onSecondaryContainer: "#f4f4f5",
    surfaceContainer: "#18181b",
    outlineVariant: "#52525b",
    lightPrimary: "#71717a",
    lightPrimaryContainer: "#f4f4f5",
    lightOnPrimaryContainer: "#18181b",
    lightSecondary: "#a1a1aa",
    lightSecondaryContainer: "#f4f4f5",
    lightOnSecondaryContainer: "#18181b",
  },
};

export const themeAccentColors: Record<Theme, { dark: string; light: string }> = {
  indigo:  { dark: "#c3c0ff", light: "#4f46e5" },
  emerald: { dark: "#6ee7b7", light: "#059669" },
  rose:    { dark: "#fda4af", light: "#e11d48" },
  violet:  { dark: "#d8b4fe", light: "#7c3aed" },
  amber:   { dark: "#fcd34d", light: "#d97706" },
  cyan:    { dark: "#67e8f9", light: "#0891b2" },
  sky:     { dark: "#bae6fd", light: "#0284c7" },
  pink:    { dark: "#f9a8d4", light: "#db2777" },
  orange:  { dark: "#fdba74", light: "#ea580c" },
  lime:    { dark: "#bef264", light: "#65a30d" },
  teal:    { dark: "#99f6e4", light: "#0d9488" },
  fuchsia: { dark: "#f0abfc", light: "#c026d3" },
  red:     { dark: "#fca5a5", light: "#dc2626" },
  yellow:  { dark: "#fde047", light: "#ca8a04" },
  stone:   { dark: "#d6d3d1", light: "#78716c" },
  zinc:    { dark: "#d4d4d8", light: "#71717a" },
};

export function getAccentColor(theme: Theme, isDark: boolean): string {
  const c = themeAccentColors[theme];
  return isDark ? c.dark : c.light;
}

export default function AdminThemeStyles() {
  const [theme, setTheme] = useState<Theme>("indigo");
  const [isDarkMode, setIsDarkMode] = useState(true);

  useEffect(() => {
    const updateTheme = () => {
      const savedTheme = localStorage.getItem("latexify-admin-theme") as Theme | null;
      const savedMode = localStorage.getItem("latexify-admin-mode");
      if (savedTheme && themes[savedTheme]) setTheme(savedTheme);
      if (savedMode) setIsDarkMode(savedMode === "dark");
    };

    updateTheme();
    window.addEventListener("storage", updateTheme);
    window.addEventListener("admin-theme-changed", updateTheme);

    return () => {
      window.removeEventListener("storage", updateTheme);
      window.removeEventListener("admin-theme-changed", updateTheme);
    };
  }, []);

  const colors = themes[theme];

  return (
    <style jsx global>{`
      :root {
        ${isDarkMode
          ? `
          --color-admin-primary: ${colors.primary};
          --color-admin-primary-container: ${colors.primaryContainer};
          --color-admin-on-primary-container: ${colors.onPrimaryContainer};
          --color-admin-secondary: ${colors.secondary};
          --color-admin-secondary-container: ${colors.secondaryContainer};
          --color-admin-on-secondary-container: ${colors.onSecondaryContainer};
          --color-admin-outline-variant: ${colors.outlineVariant};
          --color-admin-background: #0b1326 !important;
          --color-admin-surface: #0b1326 !important;
          --color-admin-surface-dim: #0b1326 !important;
          --color-admin-surface-bright: #31394d !important;
          --color-admin-surface-container-lowest: #060e20 !important;
          --color-admin-surface-container-low: #131b2e !important;
          --color-admin-surface-container: #171f33 !important;
          --color-admin-surface-container-high: #222a3d !important;
          --color-admin-surface-container-highest: #2d3449 !important;
          --color-admin-on-surface: #dae2fd !important;
          --color-admin-on-surface-variant: #c7c4d8 !important;
          --color-admin-on-background: #dae2fd !important;
          --color-admin-outline: #918fa1 !important;
          --color-admin-tertiary: ${colors.primary};
          --color-admin-tertiary-container: ${colors.primaryContainer};
          --color-admin-on-tertiary-container: ${colors.onPrimaryContainer};
          --color-admin-error: #ffb4ab !important;
          --color-admin-on-error: #690005 !important;
          --color-admin-error-container: #93000a !important;
          --color-admin-on-error-container: #ffdad6 !important;
          --color-admin-inverse-surface: #dae2fd;
          --color-admin-inverse-on-surface: #283044;
          --color-admin-inverse-primary: ${colors.primary};
          --color-admin-surface-tint: ${colors.primary};
          --color-admin-surface-variant: #2d3449 !important;
          `
          : `
          --color-admin-primary: ${colors.lightPrimary} !important;
          --color-admin-primary-container: ${colors.lightPrimaryContainer} !important;
          --color-admin-on-primary-container: ${colors.lightOnPrimaryContainer} !important;
          --color-admin-secondary: ${colors.lightSecondary} !important;
          --color-admin-secondary-container: ${colors.lightSecondaryContainer} !important;
          --color-admin-on-secondary-container: ${colors.lightOnSecondaryContainer} !important;
          --color-admin-outline-variant: #cbd5e1 !important;
          --color-admin-background: #f8fafc !important;
          --color-admin-surface: #ffffff !important;
          --color-admin-surface-dim: #f1f5f9 !important;
          --color-admin-surface-bright: #ffffff !important;
          --color-admin-surface-container-lowest: #ffffff !important;
          --color-admin-surface-container-low: #f1f5f9 !important;
          --color-admin-surface-container: #e2e8f0 !important;
          --color-admin-surface-container-high: #cbd5e1 !important;
          --color-admin-surface-container-highest: #94a3b8 !important;
          --color-admin-on-surface: #0f172a !important;
          --color-admin-on-surface-variant: #475569 !important;
          --color-admin-on-background: #0f172a !important;
          --color-admin-outline: #64748b !important;
          --color-admin-tertiary: ${colors.lightPrimary} !important;
          --color-admin-tertiary-container: ${colors.lightPrimaryContainer} !important;
          --color-admin-on-tertiary-container: ${colors.lightOnPrimaryContainer} !important;
          --color-admin-error: #ba1a1a !important;
          --color-admin-on-error: #ffffff !important;
          --color-admin-error-container: #ffdad6 !important;
          --color-admin-on-error-container: #410002 !important;
          --color-admin-inverse-surface: #1e293b !important;
          --color-admin-inverse-on-surface: #f1f5f9 !important;
          --color-admin-inverse-primary: ${colors.primary} !important;
          --color-admin-surface-tint: ${colors.lightPrimary} !important;
          --color-admin-surface-variant: #e2e8f0 !important;
          `
        }
      }

      ::selection {
        background-color: ${isDarkMode ? colors.primary : colors.lightPrimary} !important;
        color: ${isDarkMode ? '#0b1326' : '#ffffff'} !important;
      }

      *:focus-visible {
        outline: 2px solid ${isDarkMode ? colors.primary : colors.lightPrimary} !important;
        outline-offset: 2px;
      }
    `}</style>
  );
}
