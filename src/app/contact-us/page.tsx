'use client';
import { useState } from 'react';
import Link from 'next/link';

export default function ContactUsPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, phone, subject, message }),
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Something went wrong');
      }

      setSuccess(data.message || 'Query submitted successfully');
      setName('');
      setEmail('');
      setPhone('');
      setSubject('');
      setMessage('');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 py-12">
        <nav className="flex items-center gap-2 text-sm text-gray-500 mb-8">
          <Link href="/" className="hover:text-[#00685f] transition-colors">Home</Link>
          <span>/</span>
          <span className="text-gray-800 font-medium">Contact Us</span>
        </nav>

        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-bold text-gray-800 mb-3">Contact Us</h1>
          <p className="text-lg text-gray-500">We&apos;d love to hear from you</p>
        </div>

        <div className="grid md:grid-cols-2 gap-8">
          <div className="bg-white rounded-2xl p-8 shadow-sm border border-gray-100">
            <h2 className="text-xl font-semibold text-gray-800 mb-6">Send us a message</h2>

            {success && (
              <div className="mb-6 p-4 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl text-sm font-medium">
                {success}
              </div>
            )}

            {error && (
              <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm font-medium">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Full Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white text-gray-800 outline-none focus:ring-2 focus:ring-[#00685f] focus:border-transparent transition-all"
                  placeholder="Your name"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white text-gray-800 outline-none focus:ring-2 focus:ring-[#00685f] focus:border-transparent transition-all"
                  placeholder="your@email.com"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Phone <span className="text-gray-400 font-normal">(optional)</span></label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white text-gray-800 outline-none focus:ring-2 focus:ring-[#00685f] focus:border-transparent transition-all"
                  placeholder="+91 522 456 7890"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Subject</label>
                <input
                  type="text"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  required
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white text-gray-800 outline-none focus:ring-2 focus:ring-[#00685f] focus:border-transparent transition-all"
                  placeholder="How can we help?"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Message</label>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  required
                  rows={5}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-white text-gray-800 outline-none focus:ring-2 focus:ring-[#00685f] focus:border-transparent transition-all resize-none"
                  placeholder="Tell us more about your query..."
                />
              </div>
              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 rounded-xl font-semibold text-white transition-all flex items-center justify-center gap-2 disabled:opacity-60 bg-[#00685f] hover:bg-[#005048] active:bg-[#004038]"
              >
                {loading ? (
                  <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                ) : 'Send Message'}
              </button>
            </form>
          </div>

          <div className="space-y-6">
            <div className="bg-white rounded-2xl p-8 shadow-sm border border-gray-100">
              <h2 className="text-xl font-semibold text-gray-800 mb-6">Get in touch</h2>
              <div className="space-y-5">
                <div className="flex items-start gap-4">
                  <span className="text-xl flex-shrink-0 mt-0.5">📍</span>
                  <div>
                    <p className="font-semibold text-gray-800">Address</p>
                    <p className="text-gray-500 text-sm mt-0.5">Latexify HQ, Vibhuti Khand, Gomti Nagar, Lucknow, Uttar Pradesh 226010</p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <span className="text-xl flex-shrink-0 mt-0.5">📧</span>
                  <div>
                    <p className="font-semibold text-gray-800">Email</p>
                    <p className="text-gray-500 text-sm mt-0.5">support@latexify.com</p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <span className="text-xl flex-shrink-0 mt-0.5">📞</span>
                  <div>
                    <p className="font-semibold text-gray-800">Phone</p>
                    <p className="text-gray-500 text-sm mt-0.5">+91 522 456 7890</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl p-8 shadow-sm border border-gray-100">
              <h2 className="text-xl font-semibold text-gray-800 mb-4">Business Hours</h2>
              <p className="text-gray-500 text-sm">Mon - Sat: 9:00 AM - 6:00 PM IST</p>
            </div>

            <div className="bg-white rounded-2xl overflow-hidden shadow-sm border border-gray-100">
              <iframe
                src="https://www.openstreetmap.org/export/embed.html?bbox=80.9%2C26.8%2C81.0%2C26.9&layer=mapnik&marker=26.85%2C80.95"
                width="100%"
                height="300"
                style={{ border: '1px solid #e2e8f0', borderRadius: '12px' }}
                title="Latexify Location"
              />
            </div>
          </div>
        </div>
      </div>

      <footer className="border-t border-gray-200 bg-white">
        <div className="max-w-6xl mx-auto px-4 py-8 text-center text-sm text-gray-400">
          &copy; {new Date().getFullYear()} Latexify. All rights reserved.
        </div>
      </footer>
    </div>
  );
}
