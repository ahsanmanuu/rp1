"use client";
import { useParams } from 'next/navigation';
import MigratorIDE from '@/components/scholarly-editor/Migrator/MigratorIDE';

export default function TemplateMigratorProjectPage() {
  const params = useParams();
  const projectId = params?.projectId as string;

  if (!projectId) return null;

  return (
    <MigratorIDE projectId={projectId} />
  );
}
