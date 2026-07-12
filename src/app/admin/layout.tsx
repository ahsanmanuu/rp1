import AdminThemeStyles from "@/components/AdminThemeStyles";

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <AdminThemeStyles />
      {children}
    </>
  );
}
