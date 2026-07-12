"use client";
import { useParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import StudioLoadingScreen from '@/components/scholarly-editor/StudioLoadingScreen';

const LatexifyIDE = dynamic(() => import('@/components/scholarly-editor/Latexify/LatexifyIDE'), { 
  ssr: false,
  loading: () => <StudioLoadingScreen />
});

export default function LaTeXStudioProjectPage() {
  const params = useParams();
  const projectId = params?.projectId as string;

  if (!projectId) return null;

  return (
    <LatexifyIDE projectId={projectId} />
  );
}
