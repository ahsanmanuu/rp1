"use client";

import React from 'react';

interface EditorSidebarProps {
  files: { id: string, filename: string }[];
  outline: { level: number; text: string; id: string }[];
}

export default function EditorSidebar({ files, outline }: EditorSidebarProps) {
  return (
    <div className="glass" style={{ 
      width: '260px', 
      height: '100%', 
      borderRight: '1px solid var(--border)',
      display: 'flex',
      flexDirection: 'column',
      fontSize: '0.875rem'
    }}>
      {/* Files Section */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        <div style={{ 
          padding: '0.75rem 1rem', 
          background: 'var(--bg-secondary)', 
          borderBottom: '1px solid var(--border)',
          fontWeight: 600,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <span>Components 📦</span>
          <span style={{ fontSize: '0.7rem', opacity: 0.6 }}>{files.length} items</span>
        </div>
        <div className="custom-scroll" style={{ flex: 1, overflowY: 'auto', padding: '0.5rem 0' }}>
          {files.length === 0 ? (
            <div style={{ padding: '1rem', color: 'var(--text-secondary)', fontSize: '0.8rem', textAlign: 'center' }}>
              No assets uploaded
            </div>
          ) : (
            files.map(file => (
              <div 
                key={file.id} 
                style={{ 
                  padding: '0.4rem 1rem', 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '0.5rem',
                  cursor: 'default',
                  transition: 'background 0.2s'
                }}
                className="hover-bg"
              >
                <span style={{ opacity: 0.7 }}>
                  {file.filename.match(/\.(png|jpg|jpeg|gif|svg)$/i) ? '🖼️' : 
                   file.filename.endsWith('.bib') ? '📚' : 
                   file.filename.endsWith('.tex') ? '📝' :
                   file.filename.endsWith('.bst') ? '📑' :
                   file.filename.endsWith('.cls') || file.filename.endsWith('.sty') ? '⚙️' : '📄'}
                </span>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {file.filename}
                </span>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Structure Section */}
      <div style={{ flex: 1.5, display: 'flex', flexDirection: 'column', borderTop: '1px solid var(--border)', minHeight: 0 }}>
        <div style={{ 
          padding: '0.75rem 1rem', 
          background: 'var(--bg-secondary)', 
          borderBottom: '1px solid var(--border)',
          fontWeight: 600
        }}>
          Structure 📑
        </div>
        <div className="custom-scroll" style={{ flex: 1, overflowY: 'auto', padding: '0.5rem 0' }}>
          {outline.length === 0 ? (
            <div style={{ padding: '1rem', color: 'var(--text-secondary)', fontSize: '0.8rem', textAlign: 'center' }}>
              Empty document structure
            </div>
          ) : (
            outline.map((item, idx) => (
              <div 
                key={`${item.id}-${idx}`}
                style={{ 
                  padding: '0.3rem 1rem',
                  paddingLeft: `${1 * item.level}rem`,
                  cursor: 'pointer',
                  opacity: 0.8,
                  fontSize: item.level === 1 ? '0.85rem' : '0.8rem',
                  fontWeight: item.level === 1 ? 600 : 400,
                  transition: 'background 0.2s'
                }}
                className="hover-bg"
              >
                <span style={{ color: 'var(--accent-primary)', marginRight: '0.4rem' }}>•</span>
                {item.text}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
