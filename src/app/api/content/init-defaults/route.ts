import { NextResponse } from 'next/server';
import { pbAdmin } from '@/lib/pb';

export const dynamic = 'force-dynamic';

const GALLERY_ITEMS = [
  { title: 'Latexify Dashboard', imageUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAfrx0rEK6VFLoe2g-XBz3W3v-F9ySny3wIO0GvOU4er61lUuTBVHvwYLUuqIs0AJoAKS007oi-Eol9Htta-GTRBF4xxAzzuqQgAhgqDtjr8p6Z7Q6hg2CSB3wQNqCGWWMQXkcp8v6Lso_Le622A3nyeH7Lev3cMioXKpnxZKCMHLPVS0ExSKUiPxYmzKIWcN6Coo758Jx_tmEY5RDPLzN1a48mBPKfpqaAgI6i5xGtO4pQLyEzyTTvYn2VnmuYr49zlqcD5RuJ2VLq', icon: 'FileEdit', isActive: true, sortOrder: 1 },
  { title: 'Doc2Latex Dashboard', imageUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDFtYyOpkpxGhljL4YEO1ZBLJZMbOn9gPHP8fXetmJnFR08eYC253o5M68i_jcmYGp_5iIjQ-JcBvvPO2alyZtkmAQ9nUYWjTd93LI_3N2A-FX8hLaCsZj-SLMSfhLToozbAF84ghM2FjYb4cnBUrA3DL-8YbTm4JPkf2ykIRWS461AjyRuzsmLCfQRunK5eOGjPJt5kFsqPzc3IF5aWizqmst_t4ttOirs6mspuA6M1RDIUXBrfirHyzXDyIaZJ5vtvRC3UkZz_A_o', icon: 'Wand2', isActive: true, sortOrder: 2 },
  { title: 'Diagram Studio', imageUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCOfpdp7avfxHVymJ06UtjZny3PXYwWBlHy4rpi8PV7-YGXFfygei_YZV65NdCKAQfE4DuhwJVAdCrE4-JoRKmljz10dSgkNXgv5F3blSGIPbm-6vQRe0_OrtZzV49Mxi7nwF-XXZzkzf8YjZrLYr2o4KLZflRtfrY3WY0NNTblCY-q7F0rLGOfjwoHMxC6LNP6KqqBj_jnRgs7NOX4Me-ldmMJtt38-V4YCjxpmuUxTRgfP3TncR6coVeklb0q5ABJYPH4zCIbqmoe', icon: 'PenTool', isActive: true, sortOrder: 3 },
  { title: 'Template Migrator', imageUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAvQz491UjMaxItAqkAnkLEZDgbYQ9z3q4zdYq38xoFSNUtLSnoZEOYC584Bvw7070Yl5ia_mk8-wXycVUgmpjy6ZlOR6rh7vzwgjoolh01S0287jDHSpx6jQRhXuoo6B5SD7y4-MHAERQDO1wARSXJLiGs6dkIMw3gnQHs8Jlvr5c888M_d6SJ3VZIJVy69OKgQ2F7064lqQ1EtLt8PJIq-QQNF-enp8jKqJpjS1A9yNc61ktBXG8LfIZV7x6MET473uxu1fQKjpDl', icon: 'Layout', isActive: true, sortOrder: 4 },
  { title: 'Citation Studio', imageUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDXqWg4r7vKDSzOnA0vncm3Wcm8hiUnA9ngYcljj07eIpRK1_hbIL48t5ZMclJE_UHSwtLaKqtgC2X-457idjJlXGAtQnmbg9Kb0q5B4XzhowAyZXfRN4mFH_7aHmOOky0uti0CXVHCteoBw8TiLZVjkqa-acr8ayfGU3zI-lFqdMZaib4Gc5ZzR7Pad7NVXJpW8hokDNJvZYX30qVrX5sR6Uc9OE8nJHJOHkRH-9uIoq6HLMBZxEmozks34yZZRKMtb_IkwqULnDop', icon: 'Library', isActive: true, sortOrder: 5 },
  { title: 'AI Peer Reviewer', imageUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAfrx0rEK6VFLoe2g-XBz3W3v-F9ySny3wIO0GvOU4er61lUuTBVHvwYLUuqIs0AJoAKS007oi-Eol9Htta-GTRBF4xxAzzuqQgAhgqDtjr8p6Z7Q6hg2CSB3wQNqCGWWMQXkcp8v6Lso_Le622A3nyeH7Lev3cMioXKpnxZKCMHLPVS0ExSKUiPxYmzKIWcN6Coo758Jx_tmEY5RDPLzN1a48mBPKfpqaAgI6i5xGtO4pQLyEzyTTvYn2VnmuYr49zlqcD5RuJ2VLq', icon: 'Brain', isActive: true, sortOrder: 6 },
];

const INSTITUTION_LOGOS = [
  { name: 'MIT', icon: 'School', isActive: true, sortOrder: 1 },
  { name: 'Stanford', icon: 'Building2', isActive: true, sortOrder: 2 },
  { name: 'Oxford', icon: 'BookOpen', isActive: true, sortOrder: 3 },
  { name: 'CERN', icon: 'Atom', isActive: true, sortOrder: 4 },
  { name: 'Harvard', icon: 'GraduationCap', isActive: true, sortOrder: 5 },
];

const FEATURES = [
  { title: 'Latexify Dashboard', description: 'A modern, powerful, collaborative LaTeX editor designed for the web. Write with joy, compile with speed, share with ease.', icon: 'FileEdit', iconBg: 'var(--accent-primary)', glow: 'var(--accent-primary)', tags: ['Real-time Collab', 'Cloud Sync'], href: '/latex-studio', isActive: true, sortOrder: 1 },
  { title: 'Doc2Latex', description: 'Instantly convert Word documents into clean, well-structured LaTeX code. Bridge the gap with co-authors seamlessly.', icon: 'Wand2', iconBg: 'var(--accent-secondary)', glow: 'var(--accent-secondary)', tags: ['DOCX → LaTeX', 'Smart Parsing'], href: '/upload', isActive: true, sortOrder: 2 },
  { title: 'Diagram Studio', description: 'Create beautiful TikZ diagrams with an intuitive visual canvas. No more wrestling with coordinates and syntax.', icon: 'PenTool', iconBg: '#f59e0b', glow: '#f59e0b', tags: ['Visual Editor', 'TikZ Export'], href: '/diagrams', isActive: true, sortOrder: 3 },
  { title: 'Template Migrator', description: 'Switch journals effortlessly. One click updates your document styling, margins, and bibliography formats instantly.', icon: 'Layout', iconBg: '#0891b2', glow: '#0891b2', tags: ['55+ Templates', 'IEEE, Nature, ACM'], href: '/template-migrator', isActive: true, sortOrder: 4 },
  { title: 'Citation Studio', description: 'Manage your bibliography seamlessly. Auto-fetch metadata via DOI, organize references with tags and export BibTeX.', icon: 'Library', iconBg: '#059669', glow: '#059669', tags: ['DOI Auto-fetch', 'BibTeX Export'], href: '/citations', isActive: true, sortOrder: 5 },
  { title: 'AI Peer Reviewer', description: 'Get instant, scholarly feedback on clarity, argumentation, and methodology. Like having a senior researcher on speed dial.', icon: 'Brain', iconBg: '#dc2626', glow: '#dc2626', tags: ['Logic Check', 'Grammar AI'], href: '/reviewer', isActive: true, sortOrder: 6 },
];

const BENEFITS = [
  { title: 'Lightning-Fast Compilation', description: 'Cloud-powered LaTeX cluster compiles your manuscript in under 3 seconds. No local installation needed.', icon: 'Zap', color: '#f59e0b', isActive: true, sortOrder: 1 },
  { title: 'Enterprise-Grade Security', description: 'AES-256 encrypted storage with isolated project namespaces. Your research stays private.', icon: 'Shield', color: '#0891b2', isActive: true, sortOrder: 2 },
  { title: 'Works Everywhere', description: 'Browser-based IDE works on any device. Start on your laptop, continue on your tablet.', icon: 'Globe', color: '#6b38d4', isActive: true, sortOrder: 3 },
  { title: 'Real-time Collaboration', description: 'Invite co-authors, share links, and review changes together in real time.', icon: 'Users', color: 'var(--accent-primary)', isActive: true, sortOrder: 4 },
];

const PRODUCT_DETAILS = [
  { key: 'latexify_studio', title: 'Latexify Studio', description: 'A modern, powerful, collaborative LaTeX editor designed for the web. Write with joy, compile with speed, share with ease.', icon: 'FileEdit', color: '#00685f', href: '/latex-studio', features: ['Real-time collaboration with co-authors', 'Cloud-sync across all devices', 'pdfLaTeX, LuaLaTeX, XeLaTeX support', 'Live PDF preview with split view', 'Syntax highlighting & auto-complete', 'Version history & restore'], isActive: true, sortOrder: 1 },
  { key: 'doc2latex', title: 'Doc2LateX', description: 'Instantly convert Word documents into clean, well-structured LaTeX code. Bridge the gap with co-authors seamlessly.', icon: 'Wand2', color: '#545f73', href: '/upload', features: ['DOCX to LaTeX in one click', 'Smart formatting preservation', 'Table & image handling', 'Bibliography conversion', 'Math equation parsing', 'Batch document processing'], isActive: true, sortOrder: 2 },
  { key: 'diagram_studio', title: 'AI Diagram Studio', description: 'Create beautiful TikZ diagrams with an intuitive visual canvas. No more wrestling with coordinates and syntax.', icon: 'PenTool', color: '#f59e0b', href: '/diagrams', features: ['Visual drag-and-drop canvas', 'AI-powered diagram generation', 'Export to TikZ code', 'Pre-built template library', 'Real-time preview', 'Import from Visio & Draw.io'], isActive: true, sortOrder: 3 },
  { key: 'template_migrator', title: 'Template Migrator', description: 'Switch journals effortlessly. One click updates your document styling, margins, and bibliography formats instantly.', icon: 'Layout', color: '#0891b2', href: '/template-migrator', features: ['55+ journal templates', 'One-click format switching', 'Automatic margin & spacing', 'Bibliography style conversion', 'IEEE, Nature, ACM, Elsevier support', 'Custom template import'], isActive: true, sortOrder: 4 },
  { key: 'citation_studio', title: 'AI Citation Studio', description: 'Manage your bibliography seamlessly. Auto-fetch metadata via DOI, organize references with tags and export BibTeX.', icon: 'Library', color: '#059669', href: '/citations', features: ['DOI auto-fetch metadata', 'BibTeX & BibLaTeX export', 'Tag-based organization', 'Duplicate detection', 'Multi-style formatting', 'Zotero & Mendeley import'], isActive: true, sortOrder: 5 },
  { key: 'ai_peer_reviewer', title: 'AI Peer Reviewer', description: 'Get instant, scholarly feedback on clarity, argumentation, and methodology. Like having a senior researcher on speed dial.', icon: 'Brain', color: '#dc2626', href: '/reviewer', features: ['Grammar & style analysis', 'Logical gap detection', 'Methodology assessment', 'Citation quality check', 'Readability scoring', 'Revision suggestions'], isActive: true, sortOrder: 6 },
];

const FOOTER_LINKS = [
  { groupTitle: 'Products', label: 'Latexify Studio', href: '/latex-studio', linkKey: 'Latexify Studio', isActive: true, sortOrder: 1 },
  { groupTitle: 'Products', label: 'Doc2Latex', href: '/doc2latex', linkKey: 'Doc2Latex', isActive: true, sortOrder: 2 },
  { groupTitle: 'Products', label: 'Diagram Studio', href: '/diagrams', linkKey: 'Diagram Studio', isActive: true, sortOrder: 3 },
  { groupTitle: 'Products', label: 'Template Migrator', href: '/template-migrator', linkKey: 'Template Migrator', isActive: true, sortOrder: 4 },
  { groupTitle: 'Products', label: 'Citation Studio', href: '/citations', linkKey: 'Citation Studio', isActive: true, sortOrder: 5 },
  { groupTitle: 'Products', label: 'AI Peer Reviewer', href: '/reviewer', linkKey: 'AI Peer Reviewer', isActive: true, sortOrder: 6 },
  { groupTitle: 'Resources', label: 'Pricing', href: '/pricing', isActive: true, sortOrder: 1 },
  { groupTitle: 'Resources', label: 'Templates Gallery', href: '/templates', isActive: true, sortOrder: 2 },
  { groupTitle: 'Resources', label: 'Help Center', href: '/help', isActive: true, sortOrder: 3 },
  { groupTitle: 'Company', label: 'About Us', href: '/about', isActive: true, sortOrder: 1 },
  { groupTitle: 'Company', label: 'Careers', href: '/careers', isActive: true, sortOrder: 2 },
  { groupTitle: 'Company', label: 'Blog', href: '/blog', isActive: true, sortOrder: 3 },
  { groupTitle: 'Company', label: 'Contact', href: '/contact-us', isActive: true, sortOrder: 4 },
  { groupTitle: 'Legal', label: 'Privacy Policy', href: '/privacy', isActive: true, sortOrder: 1 },
  { groupTitle: 'Legal', label: 'Terms of Service', href: '/terms', isActive: true, sortOrder: 2 },
  { groupTitle: 'Legal', label: 'Cookie Policy', href: '/cookies', isActive: true, sortOrder: 3 },
  { groupTitle: 'Legal', label: 'GDPR', href: '/gdpr', isActive: true, sortOrder: 4 },
];

const HOW_IT_WORKS = [
  { title: 'Sign Up', description: 'Create your free account in seconds. No credit card required.', stepNumber: 1, icon: 'UserPlus', isActive: true, sortOrder: 1 },
  { title: 'Choose a Tool', description: 'Select from LaTeX editor, template migrator, citation studio, AI reviewer, and more.', stepNumber: 2, icon: 'MousePointerClick', isActive: true, sortOrder: 2 },
  { title: 'Create & Collaborate', description: 'Write, edit, and collaborate in real-time with co-authors from anywhere.', stepNumber: 3, icon: 'Users', isActive: true, sortOrder: 3 },
  { title: 'Publish & Share', description: 'Export to PDF, share links, or submit directly to journals with confidence.', stepNumber: 4, icon: 'Upload', isActive: true, sortOrder: 4 },
];

const BANNERS: any[] = [];

const TASAR_STATS = [
  { label: 'Active Users', value: 50000, suffix: '+', icon: 'Users', color: 'var(--accent-primary)', category: 'engagement', isActive: true, sortOrder: 1 },
  { label: 'Projects Created', value: 150000, suffix: '+', icon: 'FileText', color: '#f59e0b', category: 'usage', isActive: true, sortOrder: 2 },
  { label: 'Templates Available', value: 55, suffix: '+', icon: 'Layout', color: '#0891b2', category: 'content', isActive: true, sortOrder: 3 },
  { label: 'AI Reviews Done', value: 25000, suffix: '+', icon: 'Brain', color: '#dc2626', category: 'engagement', isActive: true, sortOrder: 4 },
];

const PLATFORM_STATS = [
  { key: 'total_users', label: 'Total Users', value: 50000, suffix: '+', isActive: true },
  { key: 'total_projects', label: 'Total Projects', value: 150000, suffix: '+', isActive: true },
  { key: 'total_reviews', label: 'AI Reviews', value: 25000, suffix: '+', isActive: true },
  { key: 'uptime', label: 'Uptime', value: 99.9, suffix: '%', decimals: 1, isActive: true },
];

const FLOATING_BANNERS = [
  { title: 'Try AI Peer Reviewer', imageUrl: 'https://placehold.co/400x600/4f46e5/ffffff?text=Try+AI+Review', linkUrl: '/reviewer', targetType: 'global', targetEmail: '', width: 4, height: 6, duration: 5, isActive: true, sortOrder: 1 },
];

const TESTIMONIALS = [
  { name: 'James Chen', role: 'PhD Candidate, Stanford University', content: "Latexify's template migrator saved me weeks of reformatting when my paper was transferred between journals. The UI is incredibly clean.", avatarUrl: 'https://ui-avatars.com/api/?name=James+Chen&background=4f46e5&color=fff&size=96', rating: 5, isActive: true, sortOrder: 1 },
  { name: 'Prof. Sarah Jenkins', role: 'Principal Investigator, University of Oxford', content: "The AI Peer Reviewer caught several logical gaps in my methodology section before submission. An absolute game-changer for solo researchers.", avatarUrl: 'https://ui-avatars.com/api/?name=Sarah+Jenkins&background=059669&color=fff&size=96', rating: 5, isActive: true, sortOrder: 2 },
  { name: 'Dr. Marcus Rivera', role: 'Postdoctoral Fellow, MIT', content: "I've moved my entire lab to Latexify. Collaborative writing is finally seamless, and the Doc2Latex feature means my undergrads can contribute easily.", avatarUrl: 'https://ui-avatars.com/api/?name=Marcus+Rivera&background=f59e0b&color=fff&size=96', rating: 5, isActive: true, sortOrder: 3 },
  { name: 'Prof. Emily Nakamura', role: 'Department Chair, Tokyo University', content: "The citation studio alone is worth it. Managing 200+ references across multiple projects has never been easier. Real-time sync is flawless.", avatarUrl: 'https://ui-avatars.com/api/?name=Emily+Nakamura&background=0891b2&color=fff&size=96', rating: 5, isActive: true, sortOrder: 4 },
  { name: 'Dr. Alex Thompson', role: 'Research Scientist, CERN', content: "Diagram Studio replaced our entire TikZ workflow. The visual editor is intuitive, and the export quality matches hand-crafted diagrams.", avatarUrl: 'https://ui-avatars.com/api/?name=Alex+Thompson&background=dc2626&color=fff&size=96', rating: 5, isActive: true, sortOrder: 5 },
];

const SEED_DATA: Record<string, any[]> = {
  banners: BANNERS || [],
  testimonials: TESTIMONIALS,
  gallery_items: GALLERY_ITEMS,
  institution_logos: INSTITUTION_LOGOS,
  features: FEATURES,
  benefits: BENEFITS,
  product_details: PRODUCT_DETAILS,
  footer_links: FOOTER_LINKS,
  how_it_works: HOW_IT_WORKS,
  tasar_stats: TASAR_STATS,
  platform_stats: PLATFORM_STATS,
  floating_banners: FLOATING_BANNERS,
};

export async function POST() {
  try {
    const pb = await pbAdmin();
    const results: Record<string, { seeded: number }> = {};

    for (const [collection, items] of Object.entries(SEED_DATA)) {
      const existing = await pb.collection(collection).getFullList({ requestKey: `seed_check_${collection}` });
      if (existing.length === 0) {
        let count = 0;
        for (const item of items) {
          await pb.collection(collection).create(item, { requestKey: `seed_create_${collection}_${count}` });
          count++;
        }
        results[collection] = { seeded: count };
      } else {
        results[collection] = { seeded: 0 };
      }
    }

    return NextResponse.json({ success: true, results });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
