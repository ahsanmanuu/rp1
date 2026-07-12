"use client";
import { useParams } from "next/navigation";
import { use } from "react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function LatexStudioEditorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: projectId } = use(params);
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!projectId) return;

    fetch(`/api/projects/${projectId}`)
      .then(res => res.json())
      .then(data => {
        const type = data.project?.projectType;
        if (type === 'DOC2LATEX' || type === 'CONVERTER') {
          router.replace(`/doc2latex/${projectId}`);
        } else if (type === 'TEMPLATE_MIGRATOR') {
          router.replace(`/template-migrator/${projectId}`);
        } else {
          router.replace(`/latex-studio/${projectId}`);
        }
      })
      .catch(() => {
        router.replace(`/latex-studio/${projectId}`);
      })
      .finally(() => setLoading(false));
  }, [projectId, router]);

  if (loading) {
    return (
      <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#000', color: '#fff' }}>
        Initialising Studio Environment...
      </div>
    );
  }

  return null;
}
