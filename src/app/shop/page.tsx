'use client';
import '../app-shared.css';

import Link from 'next/link';
import { 
  Zap, 
  CheckCircle2, 
  ArrowRight, 
  ShieldCheck, 
  Globe, 
  Sparkles,
  ShoppingBag
} from 'lucide-react';

const PACKS = [
  { id: 'starter', name: 'Starter Pack', points: 50, price: '$4.99', desc: 'Perfect for a single research paper and a few revisions.', popular: false },
  { id: 'researcher', name: 'Researcher Pack', points: 150, price: '$12.99', desc: 'Ideal for PhD students and researchers with multiple projects.', popular: true },
  { id: 'professional', name: 'Professional Pack', points: 500, price: '$34.99', desc: 'Best for academic labs and high-frequency publishing.', popular: false }
];

export default function ShopPage() {
  const handlePurchase = (packId: string) => {
     alert(`Proceeding to Stripe Checkout for ${packId}... (Stripe keys required)`);
  };

  return (
    <div className="min-h-screen bg-[var(--bg-deep)] py-20 pb-32 overflow-hidden relative">
      {/* Background Decor */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-[var(--primary)] opacity-10 blur-[150px] -translate-y-1/2"></div>
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-[var(--secondary)] opacity-10 blur-[150px] translate-y-1/2"></div>

      <div className="container mx-auto px-6 max-w-[1240px] relative z-10 text-center">
        {/* Header Section */}
        <section className="mb-20">
           <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs font-bold text-[var(--primary)] mb-6">
              <Sparkles size={14} className="fill-[var(--primary)]" />
              <span>Limited Time Boost: +10% Extra Points</span>
           </div>
           <h1 className="text-5xl md:text-7xl font-black mb-8 tracking-tighter bg-gradient-to-b from-white to-white/30 bg-clip-text text-transparent italic">
              Points Shop
           </h1>
           <p className="text-[var(--text-muted)] text-xl max-w-2xl mx-auto leading-relaxed">
              Latexify uses a simple points-based system. <br />
              <span className="text-white font-bold underline decoration-[var(--primary)]">10 points per new project download.</span> 
              Unlimited repeat downloads for the same project.
           </p>
        </section>

        {/* Packs Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-32 items-end">
           {PACKS.map((pack) => (
              <div 
                key={pack.id} 
                className={`glass p-10 relative flex flex-col items-center text-center transition-all duration-500 hover:translate-y-[-12px] group h-full border ${pack.popular ? 'border-[var(--primary)] shadow-2xl shadow-[var(--primary-glow)] scale-105 z-10' : 'border-white/5 opacity-80 hover:opacity-100 hover:border-white/20'}`}
              >
                 {pack.popular && (
                    <div className="absolute -top-4 bg-[var(--primary)] text-white text-[10px] font-black uppercase tracking-widest px-4 py-1.5 rounded-full shadow-lg">
                       Best Value
                    </div>
                 )}

                 <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center mb-8 border border-white/5 group-hover:scale-110 transition duration-500">
                    <ShoppingBag size={32} className={pack.popular ? 'text-[var(--primary)]' : 'text-[var(--text-dim)]'} />
                 </div>

                 <h3 className="text-2xl font-black mb-2">{pack.name}</h3>
                 <p className="text-[var(--text-muted)] text-sm mb-10 leading-relaxed max-w-[200px]">
                    {pack.desc}
                 </p>

                 <div className="border-y border-white/5 py-8 w-full mb-10">
                    <div className="text-5xl font-black text-white mb-1 group-hover:scale-110 transition-transform">{pack.points}</div>
                    <div className="text-[10px] uppercase font-black tracking-widest text-[var(--secondary)]">Points</div>
                 </div>

                 <div className="text-4xl font-black text-white mb-10">{pack.price}</div>

                 <button 
                  onClick={() => handlePurchase(pack.id)}
                  className={`btn w-full py-5 flex items-center justify-center gap-3 text-lg font-bold transition-all ${pack.popular ? 'btn-primary shadow-xl shadow-[var(--primary-glow)]' : 'btn-outline border border-white/10 hover:border-white/30'}`}
                 >
                    Get Package
                    <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
                 </button>
              </div>
           ))}
        </div>

        {/* Benefits Grid */}
        <section className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-32">
           {[
              { icon: <CheckCircle2 className="text-green-400" />, title: "No Subscription", desc: "One-time payment. Points never expire." },
              { icon: <ShieldCheck className="text-blue-400" />, title: "Secure Checkout", desc: "Powered by Stripe PCI-compliant gateway." },
              { icon: <Globe className="text-[var(--primary)]" />, title: "Global Support", desc: "We accept 135+ currencies including Cards & Apple Pay." },
              { icon: <Zap className="text-[var(--secondary)]" />, title: "Instant Access", desc: "Points are credited to your account instantly." }
           ].map((benefit, idx) => (
              <div key={idx} className="flex flex-col items-center text-center p-6 bg-white/[0.02] border border-white/5 rounded-3xl hover:bg-white/5 transition">
                 <div className="w-12 h-12 bg-white/5 rounded-full flex items-center justify-center mb-6">
                    {benefit.icon}
                 </div>
                 <h4 className="text-lg font-bold mb-3">{benefit.title}</h4>
                 <p className="text-[var(--text-muted)] text-xs leading-relaxed">
                    {benefit.desc}
                 </p>
              </div>
           ))}
        </section>

        {/* Pro Plan Teaser */}
        <section className="p-16 rounded-[48px] bg-gradient-to-br from-[#0a0e1a] to-[#12121c] border relative overflow-hidden group text-left" style={{ borderColor: 'rgba(0, 104, 95, 0.3)' }}>
           <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-[var(--primary)] opacity-5 blur-[120px] pointer-events-none group-hover:scale-125 transition-transform duration-1000"></div>
           
           <div className="flex flex-col md:flex-row items-center justify-between gap-12 relative z-10">
              <div className="max-w-2xl">
                 <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[10px] font-black uppercase text-[var(--primary)] mb-6" style={{ background: 'rgba(0, 104, 95, 0.1)', borderColor: 'rgba(0, 104, 95, 0.3)', borderWidth: '1px' }}>
                    Enterprise
                 </div>
                 <h2 className="text-4xl md:text-5xl font-black text-white mb-6 tracking-tighter leading-tight">
                    Unlimited Writing <br /> with Latexify Pro
                 </h2>
                 <p className="text-[var(--text-muted)] text-xl mb-10 leading-relaxed">
                    For research labs and professional writers who need high-volume output. Get unlimited conversions, 
                    priority rendering, and team collaboration features for one flat monthly price.
                 </p>
                 <div className="flex flex-wrap gap-4">
                    <button className="btn btn-primary px-10 py-4 font-bold shadow-2xl shadow-[var(--primary-glow)]">Join Pro Waiting List</button>
                    <Link href="#contact" className="btn btn-outline px-10 py-4 font-bold">Contact Sales</Link>
                 </div>
              </div>
              <div className="w-64 h-64 rounded-full flex items-center justify-center relative shrink-0" style={{ background: 'rgba(0, 104, 95, 0.1)' }}>
                 <Zap size={100} className="text-[var(--primary)] animate-pulse" />
                 <div className="absolute inset-0 border-4 border-dashed rounded-full animate-spin-slow" style={{ borderColor: 'rgba(0, 104, 95, 0.2)' }}></div>
              </div>
           </div>
        </section>
      </div>


    </div>
  );
}
