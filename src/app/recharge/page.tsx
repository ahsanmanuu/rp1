"use client";
import '../app-shared.css';

import { useSession } from "@/lib/pb-auth-react";
import { useState } from "react";
import Link from "next/link";
import toast from "react-hot-toast";

const PLANS = [
  { id: 'bronze', name: 'Bronze', points: 50, price: 5, description: 'Perfect for single project' },
  { id: 'silver', name: 'Silver', points: 200, price: 15, description: 'Best for standard users', popular: true },
  { id: 'gold', name: 'Gold', points: 1000, price: 50, description: 'For professional researchers' },
];

export default function RechargePage() {
  const { data: session, update } = useSession();
  const [loading, setLoading] = useState<string | null>(null);

  const handlePurchase = async (planId: string) => {
    setLoading(planId);
    const toastId = toast.loading("Processing payment...");
    try {
      const res = await fetch('/api/points/recharge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId })
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      
      // Update session to reflect new points
      await update();
      toast.success(`Success! Added ${data.addedPoints} points to your account.`, { id: toastId });
    } catch (err: any) {
      toast.error("Purchase failed: " + err.message, { id: toastId });
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="container" style={{ padding: '4rem 1.5rem', maxWidth: '1000px' }}>
      <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
        <h1 style={{ fontSize: '2.5rem', fontWeight: 800, marginBottom: '1rem' }}>Recharge Your Points</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '1.1rem' }}>
          Your current balance: <span style={{ color: 'var(--accent-primary)', fontWeight: 700 }}>{session?.user?.points ?? 0} Points</span>
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '2rem' }}>
        {PLANS.map((plan) => (
          <div key={plan.id} className={`card glass ${plan.popular ? 'popular-plan' : ''}`} style={{ 
            display: 'flex', 
            flexDirection: 'column', 
            padding: '2.5rem',
            position: 'relative',
            border: plan.popular ? '2px solid var(--accent-primary)' : '1px solid var(--border)',
            transform: plan.popular ? 'scale(1.05)' : 'none',
            zIndex: plan.popular ? 1 : 0
          }}>
            {plan.popular && (
              <div style={{ 
                position: 'absolute', 
                top: '-12px', 
                left: '50%', 
                transform: 'translateX(-50%)',
                background: 'var(--accent-primary)',
                color: 'white',
                padding: '0.25rem 1rem',
                borderRadius: '20px',
                fontSize: '0.75rem',
                fontWeight: 700,
                textTransform: 'uppercase'
              }}>
                Most Popular
              </div>
            )}
            <h3 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.5rem' }}>{plan.name}</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1.5rem', flex: 1 }}>{plan.description}</p>
            
            <div style={{ marginBottom: '2rem' }}>
              <div style={{ fontSize: '3rem', fontWeight: 800, color: 'var(--text-primary)' }}>${plan.price}</div>
              <div style={{ color: 'var(--accent-primary)', fontWeight: 600 }}>{plan.points} Points</div>
            </div>

            <button 
              className={`btn ${plan.popular ? 'btn-primary' : 'btn-secondary'}`}
              style={{ width: '100%', padding: '1rem' }}
              onClick={() => handlePurchase(plan.id)}
              disabled={!!loading}
            >
              {loading === plan.id ? 'Processing...' : 'Buy Now'}
            </button>
          </div>
        ))}
      </div>

      <div style={{ marginTop: '4rem', textAlign: 'center' }}>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
          Secure payment processing. Points are added instantly to your account.
          <br />
          Need a custom plan? <Link href="/contact-us" style={{ color: 'var(--accent-primary)' }}>Contact Support</Link>
        </p>
      </div>


    </div>
  );
}
