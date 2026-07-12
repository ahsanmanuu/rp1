"use client";

import React, { useState, useEffect, useRef } from "react";
import Image from "next/image";
import { useSession } from "@/lib/pb-auth-react";

interface Message {
  id: string;
  senderType: "user" | "admin";
  content: string;
  attachmentUrl?: string | null;
  attachmentName?: string | null;
  createdAt: string;
}

export default function ChatWidget() {
  const { data: session } = useSession();
  const [isOpen, setIsOpen] = useState(false);
  const [isLive, setIsLive] = useState(false);
  const [showPremiumModal, setShowPremiumModal] = useState(false);
  const [chatSession, setChatSession] = useState<any>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [uploading, setUploading] = useState(false);
  const [loadingSession, setLoadingSession] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messageEndRef = useRef<HTMLDivElement>(null);

  // Poll admin live status
  useEffect(() => {
    const checkLiveStatus = async () => {
      try {
        const res = await fetch("/api/chat/status");
        if (res.ok) {
          const data = await res.json();
          if (data.success) {
            setIsLive(data.isLive);
          }
        }
      } catch (err) {
        console.warn("[ChatWidget] Failed to check admin live status:", err);
      }
    };
    checkLiveStatus();
    const interval = setInterval(checkLiveStatus, 15000);
    return () => clearInterval(interval);
  }, []);

  // Poll messages if chat is open and we have a session
  useEffect(() => {
    if (!isOpen || !chatSession?.id) return;

    const fetchMessages = async () => {
      try {
        const res = await fetch(`/api/chat/message?sessionId=${chatSession.id}`);
        if (res.ok) {
          const data = await res.json();
          if (data.success) {
            setMessages(data.messages || []);
            if (data.sessionStatus !== "open") {
              // Session closed by admin
              setChatSession((prev: any) => prev ? { ...prev, status: data.sessionStatus } : null);
            }
          }
        }
      } catch (err) {
        console.warn("[ChatWidget] Failed to poll messages:", err);
      }
    };

    fetchMessages();
    const interval = setInterval(fetchMessages, 3000);
    return () => clearInterval(interval);
  }, [isOpen, chatSession?.id]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messageEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isOpen]);

  const handleOpenWidget = async () => {
    if (!session?.user) return;
    setLoadingSession(true);
    try {
      const res = await fetch("/api/chat/session");
      if (res.status === 403) {
        setShowPremiumModal(true);
        setLoadingSession(false);
        return;
      }
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.session) {
          setChatSession(data.session);
          setIsOpen(true);
        }
      } else {
        setShowPremiumModal(true);
      }
    } catch (err) {
      console.warn("[ChatWidget] Error starting chat session:", err);
    } finally {
      setLoadingSession(false);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !chatSession?.id) return;

    const text = newMessage;
    setNewMessage("");

    try {
      const res = await fetch("/api/chat/message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: chatSession.id,
          content: text
        })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.message) {
          setMessages(prev => [...prev, data.message]);
        }
      }
    } catch (err) {
      console.error("[ChatWidget] Send message error:", err);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !chatSession?.id) return;
    const file = files[0];
    
    setUploading(true);
    const formData = new FormData();
    formData.append("file", file);

    try {
      const uploadRes = await fetch("/api/chat/upload", {
        method: "POST",
        body: formData
      });
      if (!uploadRes.ok) throw new Error("Upload failed");
      const uploadData = await uploadRes.json();

      if (uploadData.url) {
        const messageRes = await fetch("/api/chat/message", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sessionId: chatSession.id,
            content: `Sent attachment: ${file.name}`,
            attachmentUrl: uploadData.url,
            attachmentName: uploadData.filename
          })
        });

        if (messageRes.ok) {
          const msgData = await messageRes.json();
          if (msgData.success && msgData.message) {
            setMessages(prev => [...prev, msgData.message]);
          }
        }
      }
    } catch (err) {
      console.error("[ChatWidget] Attachment upload failed:", err);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <>
      {/* Floating Chat Trigger Button */}
      {!isOpen && (
        <button
          onClick={handleOpenWidget}
          disabled={loadingSession}
          className="fixed bottom-6 right-6 z-[9999] p-4 rounded-full shadow-2xl transition-all duration-300 hover:scale-105 active:scale-95 flex items-center justify-center gap-2 group text-white font-bold bg-gradient-to-r from-violet-600 to-indigo-600 dark:from-violet-500 dark:to-indigo-500"
        >
          <span className="material-symbols-outlined text-2xl">chat</span>
          <span className="max-w-0 overflow-hidden group-hover:max-w-xs transition-all duration-500 text-sm whitespace-nowrap">
            {loadingSession ? "Connecting..." : isLive ? "Live Chat" : "Support"}
          </span>
          <span className={`w-2.5 h-2.5 rounded-full border border-white/20 ${isLive ? "bg-green-400 animate-pulse" : "bg-zinc-400"}`}></span>
        </button>
      )}

      {/* Premium Membership Restrict Dialog */}
      {showPremiumModal && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
          <div 
            className="rounded-3xl border text-center shadow-2xl p-8 bg-zinc-900 border-zinc-800 text-white flex flex-col items-center justify-center"
            style={{ width: '460px', maxWidth: '90vw', minHeight: '320px' }}
          >
            <span className="material-symbols-outlined text-6xl text-amber-400 animate-bounce" style={{ fontVariationSettings: "'FILL' 1" }}>workspace_premium</span>
            <h3 className="text-2xl font-black mt-4 tracking-tight" style={{ color: '#fbbf24' }}>Premium Feature</h3>
            <p className="text-sm mt-3 leading-relaxed text-zinc-300 font-medium px-2">
              This live chat is only for premium members, please upgrade your membership for hassle-free writing.
            </p>
            <div className="mt-8 flex flex-col gap-3 w-full px-4">
              <button
                onClick={() => {
                  setShowPremiumModal(false);
                  window.location.href = "/dashboard?tab=billing";
                }}
                className="w-full py-3 rounded-xl font-bold bg-amber-400 hover:bg-amber-500 text-zinc-950 transition-colors uppercase tracking-wider text-xs"
              >
                UPGRADE NOW
              </button>
              <button
                onClick={() => setShowPremiumModal(false)}
                className="w-full py-3 rounded-xl font-bold border border-zinc-700 hover:bg-zinc-800 text-zinc-300 transition-colors text-xs"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Active Live Chat Window */}
      {isOpen && chatSession && (
        <div className="fixed bottom-6 right-6 z-[9999] w-[380px] sm:w-[480px] h-[550px] rounded-3xl border shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-bottom-6 duration-300 bg-zinc-950 border-zinc-800 text-white">
          {/* Header */}
          <div className="p-4 border-b border-zinc-800 bg-zinc-900 flex justify-between items-center">
            <div className="flex items-center gap-2">
              <span className={`w-3 h-3 rounded-full ${isLive ? "bg-green-400 animate-pulse" : "bg-zinc-400"}`}></span>
              <div>
                <p className="text-sm font-bold leading-none">Support Representative</p>
                <p className="text-[10px] text-zinc-400 mt-1">
                  {isLive ? "Admin is online" : "Admin is offline - drop message"}
                </p>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="p-1 hover:bg-zinc-800 rounded-full transition-colors"
            >
              <span className="material-symbols-outlined text-lg block">close</span>
            </button>
          </div>

          {/* Messages List */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scroll">
            {messages.length === 0 ? (
              <div className="text-center py-8 text-zinc-500 text-xs">
                Send a message to start conversation.
              </div>
            ) : (
              messages.map(m => {
                const isSystem = m.content.startsWith("[SYSTEM_NOTIFICATION]");
                if (isSystem) {
                  const cleanedText = m.content.replace("[SYSTEM_NOTIFICATION]", "").trim();
                  return (
                    <div key={m.id} className="text-center my-3">
                      <span className="text-[9px] px-2 py-0.5 rounded bg-zinc-800/80 text-zinc-400 border border-zinc-800 uppercase tracking-widest font-black">
                        {cleanedText}
                      </span>
                    </div>
                  );
                }

                const isMe = m.senderType === "user";
                return (
                  <div key={m.id} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
                    <div
                      className={`max-w-[80%] rounded-2xl px-3 py-2 text-xs relative ${
                        isMe
                          ? "bg-indigo-600 text-white rounded-tr-none"
                          : "bg-zinc-800 text-zinc-100 rounded-tl-none"
                      }`}
                    >
                      {m.attachmentUrl ? (
                        <div className="space-y-1.5">
                          <div className="flex items-center gap-1.5 font-bold border-b border-white/10 pb-1 mb-1">
                            <span className="material-symbols-outlined text-sm">attachment</span>
                            <span className="truncate max-w-[150px]">{m.attachmentName || "File Attachment"}</span>
                          </div>
                          {m.attachmentUrl.match(/\.(jpeg|jpg|gif|png|webp)/i) ? (
                            <Image
                              src={m.attachmentUrl}
                              alt={m.attachmentName || "Upload"}
                              width={0}
                              height={0}
                              sizes="100%"
                              className="rounded max-w-full max-h-40 object-cover border border-white/5 cursor-pointer"
                              unoptimized
                              onClick={() => window.open(m.attachmentUrl || "", "_blank")}
                            />
                          ) : (
                            <a
                              href={m.attachmentUrl}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 hover:underline text-amber-300 font-bold"
                            >
                              Download File
                              <span className="material-symbols-outlined text-[10px]">open_in_new</span>
                            </a>
                          )}
                        </div>
                      ) : (
                        <p className="leading-relaxed break-words">{m.content}</p>
                      )}
                      <span className="block text-[8px] text-white/40 text-right mt-1">
                        {new Date(m.createdAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
            <div ref={messageEndRef} />
          </div>

          {/* Attachment Input Form */}
          {chatSession.status === "open" ? (
            <form onSubmit={handleSendMessage} className="p-3 border-t border-zinc-800 bg-zinc-900/50 flex gap-2 items-center">
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileUpload}
                className="hidden"
                accept="image/*,.pdf,.doc,.docx,.txt,.zip,.tex"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="p-2 hover:bg-zinc-800 text-zinc-400 rounded-xl transition-colors disabled:opacity-50"
                title="Add Attachment"
              >
                {uploading ? (
                  <div className="w-4 h-4 rounded-full border border-zinc-400 border-t-transparent animate-spin shrink-0"></div>
                ) : (
                  <span className="material-symbols-outlined text-lg block">attachment</span>
                )}
              </button>
              <input
                type="text"
                value={newMessage}
                onChange={e => setNewMessage(e.target.value)}
                placeholder="Type your message..."
                className="flex-1 bg-zinc-800 border border-zinc-700 text-white rounded-xl px-3 py-1.5 text-xs outline-none focus:ring-1 focus:ring-indigo-500"
              />
              <button
                type="submit"
                disabled={!newMessage.trim()}
                className="p-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl transition-colors disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-sm block">send</span>
              </button>
            </form>
          ) : (
            <div className="p-4 text-center text-xs bg-zinc-900 border-t border-zinc-800 text-zinc-400 font-bold">
              This session was terminated. Start a new chat session to continue.
              <button
                onClick={handleOpenWidget}
                className="block mx-auto mt-2 text-indigo-400 hover:underline"
              >
                Start New Session
              </button>
            </div>
          )}
        </div>
      )}
    </>
  );
}
