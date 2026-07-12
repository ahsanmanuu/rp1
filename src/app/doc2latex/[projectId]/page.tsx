"use client";
import { useParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import StudioLoadingScreen from '@/components/scholarly-editor/StudioLoadingScreen';

const DocIDE = dynamic(() => import('@/components/scholarly-editor/Doc2Latex/DocIDE'), { 
  ssr: false,
  loading: () => <StudioLoadingScreen />
});

export default function Doc2LatexProjectPage() {
  const params = useParams();
  const projectId = params?.projectId as string;

  if (!projectId) return null;

  return (
    <DocIDE projectId={projectId} />
  );
}
