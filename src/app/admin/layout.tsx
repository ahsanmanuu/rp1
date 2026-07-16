import AdminThemeStyles from "@/components/AdminThemeStyles";
import Script from "next/script";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <Script id="admin-theme-preboot" strategy="beforeInteractive">
        {`
          (function() {
            try {
              const savedTheme = localStorage.getItem("latexify-admin-theme") || "indigo";
              const savedMode = localStorage.getItem("latexify-admin-mode") !== "light"; // default to dark
              const themes = {
                indigo: { primary: "#c3c0ff", primaryContainer: "rgba(195, 192, 255, 0.15)", onPrimaryContainer: "#dad7ff", secondary: "#c0c1ff", secondaryContainer: "rgba(192, 193, 255, 0.15)", onSecondaryContainer: "#b0b2ff", surfaceContainer: "#171f33", outlineVariant: "#464555", lightPrimary: "#4f46e5", lightPrimaryContainer: "#e0e7ff", lightOnPrimaryContainer: "#1e1b4b", lightSecondary: "#6366f1", lightSecondaryContainer: "#e0e7ff", lightOnSecondaryContainer: "#1e1b4b" },
                emerald: { primary: "#6ee7b7", primaryContainer: "rgba(110, 231, 183, 0.15)", onPrimaryContainer: "#d1fae5", secondary: "#a7f3d0", secondaryContainer: "rgba(167, 243, 208, 0.15)", onSecondaryContainer: "#ecfdf5", surfaceContainer: "#0f2c20", outlineVariant: "#2d4a3e", lightPrimary: "#059669", lightPrimaryContainer: "#d1fae5", lightOnPrimaryContainer: "#022c22", lightSecondary: "#10b981", lightSecondaryContainer: "#d1fae5", lightOnSecondaryContainer: "#022c22" },
                rose: { primary: "#fda4af", primaryContainer: "rgba(253, 164, 175, 0.15)", onPrimaryContainer: "#ffe4e6", secondary: "#fecdd3", secondaryContainer: "rgba(254, 205, 211, 0.15)", onSecondaryContainer: "#fff1f2", surfaceContainer: "#33181b", outlineVariant: "#553639", lightPrimary: "#e11d48", lightPrimaryContainer: "#ffe4e6", lightOnPrimaryContainer: "#4c0519", lightSecondary: "#f43f5e", lightSecondaryContainer: "#ffe4e6", lightOnSecondaryContainer: "#4c0519" },
                violet: { primary: "#d8b4fe", primaryContainer: "rgba(216, 180, 254, 0.15)", onPrimaryContainer: "#f3e8ff", secondary: "#e9d5ff", secondaryContainer: "rgba(233, 213, 255, 0.15)", onSecondaryContainer: "#faf5ff", surfaceContainer: "#2e1065", outlineVariant: "#4c1d95", lightPrimary: "#7c3aed", lightPrimaryContainer: "#ede9fe", lightOnPrimaryContainer: "#2e1065", lightSecondary: "#8b5cf6", lightSecondaryContainer: "#ede9fe", lightOnSecondaryContainer: "#2e1065" },
                amber: { primary: "#fcd34d", primaryContainer: "rgba(252, 211, 77, 0.15)", onPrimaryContainer: "#fef3c7", secondary: "#fde68a", secondaryContainer: "rgba(253, 230, 138, 0.15)", onSecondaryContainer: "#fffbeb", surfaceContainer: "#451a03", outlineVariant: "#78350f", lightPrimary: "#d97706", lightPrimaryContainer: "#fef3c7", lightOnPrimaryContainer: "#451a03", lightSecondary: "#f59e0b", lightSecondaryContainer: "#fef3c7", lightOnSecondaryContainer: "#451a03" },
                cyan: { primary: "#67e8f9", primaryContainer: "rgba(103, 232, 249, 0.15)", onPrimaryContainer: "#ecfeff", secondary: "#a5f3fc", secondaryContainer: "rgba(165, 243, 252, 0.15)", onSecondaryContainer: "#f0fdfa", surfaceContainer: "#083344", outlineVariant: "#164e63", lightPrimary: "#0891b2", lightPrimaryContainer: "#cffafe", lightOnPrimaryContainer: "#164e63", lightSecondary: "#06b6d4", lightSecondaryContainer: "#cffafe", lightOnSecondaryContainer: "#164e63" }
              };
              const colors = themes[savedTheme] || themes.indigo;
              const style = document.createElement('style');
              style.id = 'admin-theme-preboot';
              style.innerHTML = \`
                :root {
                  \${savedMode ? \`
                    --color-admin-primary: \${colors.primary};
                    --color-admin-primary-container: \${colors.primaryContainer};
                    --color-admin-on-primary-container: \${colors.onPrimaryContainer};
                    --color-admin-secondary: \${colors.secondary};
                    --color-admin-secondary-container: \${colors.secondaryContainer};
                    --color-admin-on-secondary-container: \${colors.onSecondaryContainer};
                    --color-admin-outline-variant: \${colors.outlineVariant};
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
                    --color-admin-tertiary: \${colors.primary};
                    --color-admin-tertiary-container: \${colors.primaryContainer};
                    --color-admin-on-tertiary-container: \${colors.onPrimaryContainer};
                    --color-admin-error: #ffb4ab !important;
                    --color-admin-on-error: #690005 !important;
                    --color-admin-error-container: #93000a !important;
                    --color-admin-on-error-container: #ffdad6 !important;
                    --color-admin-inverse-surface: #dae2fd;
                    --color-admin-inverse-on-surface: #283044;
                    --color-admin-inverse-primary: \${colors.primary};
                    --color-admin-surface-tint: \${colors.primary};
                    --color-admin-surface-variant: #2d3449 !important;
                  \` : \`
                    --color-admin-primary: \${colors.lightPrimary} !important;
                    --color-admin-primary-container: \${colors.lightPrimaryContainer} !important;
                    --color-admin-on-primary-container: \${colors.lightOnPrimaryContainer} !important;
                    --color-admin-secondary: \${colors.lightSecondary} !important;
                    --color-admin-secondary-container: \${colors.lightSecondaryContainer} !important;
                    --color-admin-on-secondary-container: \${colors.lightOnSecondaryContainer} !important;
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
                    --color-admin-tertiary: \${colors.lightPrimary} !important;
                    --color-admin-tertiary-container: \${colors.lightPrimaryContainer} !important;
                    --color-admin-on-tertiary-container: \${colors.lightOnPrimaryContainer} !important;
                    --color-admin-error: #ba1a1a !important;
                    --color-admin-on-error: #ffffff !important;
                    --color-admin-error-container: #ffdad6 !important;
                    --color-admin-on-error-container: #410002 !important;
                    --color-admin-inverse-surface: #1e293b !important;
                    --color-admin-inverse-on-surface: #f1f5f9 !important;
                    --color-admin-inverse-primary: \${colors.primary} !important;
                    --color-admin-surface-tint: \${colors.lightPrimary} !important;
                    --color-admin-surface-variant: #e2e8f0 !important;
                  \`}
                }
              \`;
              document.head.appendChild(style);
            } catch (e) {}
          })();
        `}
      </Script>
      <AdminThemeStyles />
      {children}
    </>
  );
}
