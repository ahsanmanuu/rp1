"use client";
import IDEContainer from '@/components/scholarly-editor/IDEContainer';

export default function GuestStudioPage() {
  return (
    <main style={{ height: '100vh', width: '100vw', overflow: 'hidden' }}>
      <IDEContainer isGuest={true} />
    </main>
  );
}
