'use client';
import { useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { BookOpen, Calendar, Clock, User, ArrowRight } from 'lucide-react';
import SiteFooter from '@/components/SiteFooter';
import LoginPromptModal from '@/components/LoginPromptModal';

const POSTS = [
  {
    title: 'Mastering TikZ: A Guide to Perfect Vector Diagrams in LaTeX',
    desc: 'Learn how to generate pristine diagrams, flowcharts, and plots natively in your document using TikZ commands and visual canvas libraries.',
    tag: 'Tutorial',
    date: 'July 10, 2026',
    readTime: '6 min read',
    author: 'Dr. Arjun Mehta',
    color: '#00685f',
  },
  {
    title: 'How AI is Changing the Peer Review Process',
    desc: 'An in-depth look at how automated critique, formatting validation, and citation matching speed up scholarly publication pipelines.',
    tag: 'Research',
    date: 'June 28, 2026',
    readTime: '8 min read',
    author: 'Dr. Sneha Patel',
    color: '#6b38d4',
  },
  {
    title: 'Latexify Studio v2.4: Real-time Collab and Git Workflows',
    desc: 'Announcing our latest update introducing branch commits, offline merge resolvers, and high-performance WebAssembly compilation.',
    tag: 'Product News',
    date: 'June 15, 2026',
    readTime: '4 min read',
    author: 'Priya Sharma',
    color: '#0891b2',
  },
  {
    title: 'Structuring a PhD Thesis in LaTeX: Best Practices',
    desc: 'A step-by-step checklist to configure main files, sub-directories, bibliographies, and complex indices for long-form academic manuscripts.',
    tag: 'Academic Writing',
    date: 'May 30, 2026',
    readTime: '10 min read',
    author: 'Prof. Rajesh Kumar',
    color: '#f59e0b',
  },
  {
    title: 'Word to LaTeX: Bridging the Collaborative Gap',
    desc: 'Why Word document parsers are critical for mixed-tool research labs, and how to convert complex files without losing math formatting.',
    tag: 'Tech Stack',
    date: 'May 12, 2026',
    readTime: '7 min read',
    author: 'Priya Sharma',
    color: '#dc2626',
  },
  {
    title: 'Introduction to BibLaTeX and Citation Styles',
    desc: 'Unlock citation automation. Understand the differences between BibTeX and BibLaTeX, and how to customize style rules for top journals.',
    tag: 'Guides',
    date: 'April 22, 2026',
    readTime: '5 min read',
    author: 'Dr. Arjun Mehta',
    color: '#059669',
  },
];

export default function BlogPage() {
  const [selectedTag, setSelectedTag] = useState('All');
  const [showLoginModal, setShowLoginModal] = useState(false);

  const tags = ['All', 'Tutorial', 'Research', 'Product News', 'Academic Writing', 'Tech Stack', 'Guides'];

  const filteredPosts = selectedTag === 'All' 
    ? POSTS 
    : POSTS.filter(post => post.tag === selectedTag);

  return (
    <div style={{ background: 'var(--bg-primary)', color: 'var(--text-primary)', fontFamily: 'var(--font-inter)', overflowX: 'hidden' }}>
      
      {/* Hero Section */}
      <section className="relative pt-32 pb-16 px-6 overflow-hidden">
        <div className="absolute inset-0 pointer-events-none hero-grid" />
        <div className="absolute top-[12%] left-[10%] w-[350px] h-[350px] rounded-full pointer-events-none opacity-20"
          style={{ background: 'radial-gradient(circle, var(--accent-primary) 0%, transparent 70%)', filter: 'blur(50px)' }} />

        <div className="max-w-4xl mx-auto text-center relative z-10">
          <h1 className="text-4xl md:text-5xl font-black tracking-tight mb-4">
            The Latexify <span className="gradient-text-animated">Blog</span>
          </h1>
          <p className="text-base opacity-75 max-w-2xl mx-auto text-justify md:text-center">
            Insights, tutorials, product updates, and expert guides on academic writing, LaTeX compilers, and AI-assisted scientific publication.
          </p>
        </div>
      </section>

      {/* Filter Tabs */}
      <section className="pb-8 px-6">
        <div className="max-w-6xl mx-auto flex flex-wrap gap-2 justify-center border-b pb-8" style={{ borderColor: 'var(--border)' }}>
          {tags.map((tag) => (
            <button
              key={tag}
              onClick={() => setSelectedTag(tag)}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${selectedTag === tag ? 'text-white' : 'opacity-60 hover:opacity-100'}`}
              style={{
                background: selectedTag === tag ? 'var(--accent-primary)' : 'var(--bg-secondary)',
                border: '1px solid var(--border)'
              }}
            >
              {tag}
            </button>
          ))}
        </div>
      </section>

      {/* Blog Grid */}
      <section className="py-12 px-6">
        <div className="max-w-6xl mx-auto">
          {filteredPosts.length > 0 ? (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
              {filteredPosts.map((post, idx) => (
                <article
                  key={idx}
                  className="rounded-3xl border flex flex-col justify-between overflow-hidden transition-all duration-300 hover:scale-[1.02] hover:-translate-y-1"
                  style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border)' }}
                >
                  <div className="p-6">
                    <div className="flex items-center gap-2 mb-4">
                      <span className="px-2.5 py-1 rounded-lg text-xs font-black uppercase tracking-wider"
                        style={{ background: `color-mix(in srgb, ${post.color} 15%, transparent)`, color: post.color }}>
                        {post.tag}
                      </span>
                    </div>
                    <h3 className="text-lg font-bold mb-3 leading-snug hover:text-white transition-colors">
                      <Link href="#">{post.title}</Link>
                    </h3>
                    <p className="text-sm opacity-60 leading-relaxed mb-4 text-justify">{post.desc}</p>
                  </div>

                  <div className="p-6 pt-0 border-t border-dashed" style={{ borderColor: 'var(--border)' }}>
                    <div className="flex items-center justify-between text-xs opacity-50 mt-4">
                      <div className="flex items-center gap-1.5">
                        <User size={13} />
                        <span>{post.author}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="flex items-center gap-1"><Calendar size={13} /> {post.date}</span>
                        <span className="flex items-center gap-1"><Clock size={13} /> {post.readTime}</span>
                      </div>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <p className="text-center opacity-60 py-12">No blog posts found under this tag.</p>
          )}
        </div>
      </section>

      {/* Newsletter */}
      <section className="py-16 px-6">
        <div className="max-w-4xl mx-auto">
          <div className="p-8 md:p-12 rounded-3xl text-center relative overflow-hidden"
            style={{ background: 'linear-gradient(135deg, color-mix(in srgb, var(--accent-primary) 8%, transparent), color-mix(in srgb, #6b38d4 5%, transparent))', border: '1px solid color-mix(in srgb, var(--accent-primary) 15%, transparent)' }}>
            <h2 className="text-2xl md:text-3xl font-black mb-3">Subscribe to our Newsletter</h2>
            <p className="text-sm opacity-70 mb-6 max-w-xl mx-auto">
              Get monthly updates on LaTeX formatting hacks, research writing tips, and Latexify product features directly to your inbox.
            </p>
            <form onSubmit={(e) => e.preventDefault()} className="flex flex-col sm:flex-row gap-3 max-w-md mx-auto">
              <input
                type="email"
                placeholder="Enter your academic email"
                required
                className="flex-1 px-4 py-3 rounded-xl border text-sm transition-all focus:outline-none focus:ring-2 focus:ring-accent-primary"
                style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border)' }}
              />
              <button
                type="submit"
                className="px-6 py-3 rounded-xl text-sm font-bold text-white transition-all whitespace-nowrap hover:scale-[1.02]"
                style={{ background: 'linear-gradient(135deg, var(--accent-primary), #6b38d4)' }}
              >
                Subscribe
              </button>
            </form>
          </div>
        </div>
      </section>

      <SiteFooter onLoginRequired={() => setShowLoginModal(true)} />
      <LoginPromptModal isOpen={showLoginModal} onClose={() => setShowLoginModal(false)} />
    </div>
  );
}
