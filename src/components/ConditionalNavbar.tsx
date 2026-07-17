"use client";
import { usePathname } from 'next/navigation';
import { ScholarlyNavbar } from '@/components/Navigation/ScholarlyNavbar';

export function ConditionalNavbar() {
  const pathname = usePathname();
  
  // Hide the global navbar inside specialized LaTeX Studio / Editor views
  // This preserves the full-screen IDE experience and avoids layout overlaps
  const hideNavbar = 
    (pathname.startsWith('/latex-studio/') && pathname !== '/latex-studio/projects') || 
    pathname.startsWith('/editor/') || 
    pathname.startsWith('/diagrams/') || 
    pathname.startsWith('/doc2latex/') || 
    pathname.startsWith('/guest-studio') || 
    pathname.startsWith('/template-migrator/') ||
    pathname.startsWith('/citations/') ||
    pathname.startsWith('/share/') ||
    pathname.startsWith('/admin');
  
  if (hideNavbar) return null;
  
  return <ScholarlyNavbar />;
}
