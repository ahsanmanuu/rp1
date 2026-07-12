import { prisma } from "@/lib/prisma";
import PdfPreview from "@/components/scholarly-editor/PdfPreview";
import CodeEditor from "@/components/scholarly-editor/CodeEditor";

export default async function SharePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  const shareLink = await prisma.shareLink.findUnique({
    where: { shareToken: token },
    include: {
      project: true
    }
  });

  if (!shareLink) {
    return (
      <div className="container" style={{ padding: '8rem 2rem', textAlign: 'center' }}>
        <h1 style={{ fontSize: '3rem', marginBottom: '1rem' }}>404</h1>
        <p style={{ color: 'var(--text-secondary)' }}>This share link is invalid or has expired.</p>
      </div>
    );
  }

  const { project } = shareLink;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - var(--nav-height))' }}>
      <div className="glass" style={{ padding: '0.75rem 1.5rem', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <span style={{ color: 'var(--text-secondary)' }}>Shared Project: </span>
          <span style={{ fontWeight: 600 }}>{project.title}</span>
        </div>
        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
          Read-only View
        </div>
      </div>

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <div style={{ width: '50%', borderRight: '1px solid var(--border)' }}>
          <CodeEditor code={project.latexContent || ""} readOnly={true} />
        </div>
        <div style={{ width: '50%', background: '#525659' }}>
           <PdfPreview status="idle" pdfUrl={null} isStaticReview={true} />
           {/* In a real app we'd have a pre-compiled PDF available for shared projects */}
           <div style={{ position: 'absolute', top: '50%', left: '75%', transform: 'translate(-50%, -50%)', textAlign: 'center', color: 'white' }}>
             <p>PDF Preview for shared projects</p>
             <p style={{ fontSize: '0.8rem', opacity: 0.7 }}>Sharing the source code and preview.</p>
           </div>
        </div>
      </div>
    </div>
  );
}
