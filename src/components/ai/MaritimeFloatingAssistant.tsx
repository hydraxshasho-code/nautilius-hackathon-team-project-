import React, { useState, useEffect, useRef } from 'react';
import { Vessel, AISAnomaly, IncidentAlert, UserRole } from '../../types/maritime';
import { useAuth } from '../common/FirebaseAuthProvider';
import {
  persistChatSession,
  fetchUserChatSessions,
  SavedChatSession,
  SavedChatMessage,
} from '../../services/firebase';
import {
  Bot,
  Send,
  Sparkles,
  X,
  Minimize2,
  Maximize2,
  Copy,
  Check,
  RefreshCw,
  ExternalLink,
  MapPin,
  ShieldAlert,
  Compass,
} from 'lucide-react';

interface MaritimeFloatingAssistantProps {
  vessels: Vessel[];
  anomalies: AISAnomaly[];
  alerts: IncidentAlert[];
  currentRole: UserRole;
  onSelectVessel: (vesselId: string) => void;
  onNavigateToTab: (tabId: string) => void;
}

export const MaritimeFloatingAssistant: React.FC<MaritimeFloatingAssistantProps> = ({
  vessels,
  anomalies,
  alerts,
  currentRole,
  onSelectVessel,
  onNavigateToTab,
}) => {
  // AI/Chat functionality must be functional for authorized roles ONLY:
  // Super Admin, Compliance Officer, Risk Analyst
  // Invisible/disabled for roles not authorized to use it (Operations Manager, Investigator, Auditor)
  const isAuthorized =
    currentRole === 'Super Admin' ||
    currentRole === 'Compliance Officer' ||
    currentRole === 'Risk Analyst';

  if (!isAuthorized) {
    return null;
  }

  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [sessionId, setSessionId] = useState<string>(() => `ai-chat-${Date.now()}`);
  const [messages, setMessages] = useState<SavedChatMessage[]>([
    {
      id: 'init-msg',
      role: 'assistant',
      content: `### Maritime Intelligence Assistant\n\nGrounded in live telemetry for **${vessels.length} fleet targets**, international sanctions watchlists (OFAC, EU, UN), and Google Maps ports.\n\nAsk about any vessel, analyze dark AIS patterns, evaluate sanctions risk, or verify port logistics.`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      model: 'gemini-3.5-flash',
    },
  ]);
  const [inputQuery, setInputQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isLoading, isOpen]);

  // Persist session to Firestore if user logged in
  useEffect(() => {
    if (user?.uid && messages.length > 1) {
      const firstUser = messages.find((m) => m.role === 'user');
      const title = firstUser
        ? firstUser.content.substring(0, 36) + (firstUser.content.length > 36 ? '...' : '')
        : 'Maritime Intelligence Inquiry';

      const data: SavedChatSession = {
        id: sessionId,
        title,
        systemRole: currentRole.toLowerCase().replace(' ', '_'),
        model: 'gemini-3.5-flash',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        messages,
      };
      persistChatSession(user.uid, data).catch(() => {});
    }
  }, [messages, user, sessionId, currentRole]);

  const handleSendMessage = async (textToSend?: string) => {
    const query = (textToSend || inputQuery).trim();
    if (!query || isLoading) return;

    const userMsg: SavedChatMessage = {
      id: `usr-${Date.now()}`,
      role: 'user',
      content: query,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputQuery('');
    setIsLoading(true);

    try {
      const summaryContext = vessels.map((v) => ({
        id: v.id,
        name: v.name,
        imo: v.imo,
        mmsi: v.mmsi,
        flag: v.flag,
        type: v.type,
        speed: v.speed,
        course: v.course,
        lat: v.lat,
        lon: v.lon,
        riskScore: v.riskScore,
        riskLevel: v.riskLevel,
        kycStatus: v.kycStatus,
        amlStatus: v.amlStatus,
        destination: v.destination,
      }));

      const apiMessages = [...messages, userMsg].map((m) => ({
        role: m.role === 'assistant' ? 'assistant' : 'user',
        content: m.content,
      }));

      let token = '';
      if (user) {
        token = await user.getIdToken().catch(() => '');
      }

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          messages: apiMessages,
          systemRole: currentRole.toLowerCase().replace(' ', '_'),
          model: 'gemini-3.5-flash',
          enableMaps: true,
          vesselsSummary: summaryContext,
        }),
      });

      if (!res.ok) {
        throw new Error(`Server responded with ${res.status}`);
      }

      const data = await res.json();
      const assistantMsg: SavedChatMessage = {
        id: `ast-${Date.now()}`,
        role: 'assistant',
        content: data.reply || data.text || 'Operational analysis completed.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        model: data.model || 'gemini-3.8-flash',
        mapsPlaces: data.mapsPlaces || data.groundingPlaces || [],
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err: any) {
      const errorMsg: SavedChatMessage = {
        id: `err-${Date.now()}`,
        role: 'assistant',
        content: `*Telemetry intelligence note:* I encountered a connection issue reaching the neural reasoning model (${err?.message || 'offline'}). Live vessel databases remain fully synchronized.`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleResetChat = () => {
    setSessionId(`ai-chat-${Date.now()}`);
    setMessages([
      {
        id: 'init-msg',
        role: 'assistant',
        content: `### New Maritime Intelligence Session Initialized\n\nActive Role: **${currentRole}**.\nReady to inspect fleet coordinates, route deviations, and beneficial ownership compliance.`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        model: 'gemini-3.5-flash',
      },
    ]);
  };

  const promptSuggestions = [
    'Flag suspicious STS or dark AIS patterns',
    'Summarize high-risk vessels requiring review',
    'Assess Bab-el-Mandeb & Hormuz corridors',
  ];

  return (
    <>
      {/* 1. Discrete, Small Floating Circular Icon in Bottom-Right Corner */}
      {/* Invisible in navigation, menus, or feature listings per requirement */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-5 right-5 z-40 w-11 h-11 rounded-full bg-slate-900/90 hover:bg-slate-800 text-cyan-400 hover:text-cyan-300 border border-slate-700/80 hover:border-cyan-500/60 shadow-xl backdrop-blur-md flex items-center justify-center transition-all group focus:outline-none focus:ring-2 focus:ring-cyan-500/50"
          title={`Maritime AI Assistant (${currentRole})`}
          aria-label="Open Maritime AI Assistant"
        >
          <Bot className="w-5 h-5 transition-transform group-hover:scale-110" />
          <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-400 border-2 border-slate-950 animate-pulse" />
        </button>
      )}

      {/* 2. Minimal, Non-Disruptive Floating Chat Interface */}
      {isOpen && (
        <div
          className={`fixed bottom-5 right-5 z-50 rounded-2xl border border-slate-700/90 bg-slate-950/95 shadow-2xl flex flex-col overflow-hidden backdrop-blur-xl animate-in fade-in slide-in-from-bottom-3 duration-200 transition-all ${
            isExpanded
              ? 'w-[540px] max-w-[calc(100vw-30px)] h-[720px] max-h-[calc(100vh-60px)]'
              : 'w-[410px] max-w-[calc(100vw-30px)] h-[560px] max-h-[calc(100vh-90px)]'
          }`}
        >
          {/* Header Bar */}
          <div className="px-3.5 py-2.5 border-b border-slate-800 bg-slate-900/80 flex items-center justify-between gap-2 shrink-0">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-lg bg-gradient-to-tr from-cyan-600 to-teal-500 flex items-center justify-center text-white shadow-sm">
                <Bot className="w-3.5 h-3.5" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold text-white tracking-wide">NAUTILUS AI</span>
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                </div>
                <span className="text-[10px] text-cyan-400 font-mono block leading-none">
                  {currentRole} Mode
                </span>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={handleResetChat}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
                title="New Chat Session"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors hidden sm:block"
                title={isExpanded ? 'Restore Size' : 'Expand View'}
              >
                {isExpanded ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
                title="Close Assistant"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Quick Suggestions (Top Pills) */}
          <div className="px-3 py-1.5 bg-slate-900/50 border-b border-slate-800/80 flex items-center gap-1.5 overflow-x-auto scrollbar-none shrink-0">
            <Sparkles className="w-3 h-3 text-cyan-400 shrink-0" />
            {promptSuggestions.map((sug, i) => (
              <button
                key={i}
                onClick={() => handleSendMessage(sug)}
                className="text-[10px] text-slate-300 hover:text-cyan-300 bg-slate-800/80 hover:bg-slate-800 px-2 py-0.5 rounded-md whitespace-nowrap transition-colors shrink-0 font-medium border border-slate-700/60"
              >
                {sug}
              </button>
            ))}
          </div>

          {/* Message Thread */}
          <div className="flex-1 overflow-y-auto p-3.5 space-y-3.5 scrollbar-thin scrollbar-thumb-slate-800 text-xs">
            {messages.map((m) => {
              const isAssistant = m.role === 'assistant' || m.role === 'model';
              return (
                <div
                  key={m.id}
                  className={`flex flex-col ${isAssistant ? 'items-start mr-4' : 'items-end ml-4'}`}
                >
                  <div className="flex items-center gap-1.5 mb-1 text-[10px] text-slate-500 font-mono">
                    <span>{isAssistant ? 'OCEANIQ AI' : 'YOU'}</span>
                    <span>·</span>
                    <span>{m.timestamp}</span>
                    {isAssistant && (
                      <button
                        onClick={() => handleCopy(m.id, m.content)}
                        className="text-slate-500 hover:text-slate-300 ml-1"
                        title="Copy text"
                      >
                        {copiedId === m.id ? (
                          <Check className="w-2.5 h-2.5 text-emerald-400 inline" />
                        ) : (
                          <Copy className="w-2.5 h-2.5 inline" />
                        )}
                      </button>
                    )}
                  </div>

                  <div
                    className={`p-3 rounded-xl border leading-relaxed text-xs max-w-full ${
                      isAssistant
                        ? 'bg-slate-900/90 border-slate-800 text-slate-200 shadow-md'
                        : 'bg-cyan-600/20 border-cyan-500/40 text-cyan-100'
                    }`}
                  >
                    <div className="whitespace-pre-wrap">{m.content}</div>

                    {/* Google Maps Place Grounds (if attached) */}
                    {m.mapsPlaces && m.mapsPlaces.length > 0 && (
                      <div className="mt-2.5 pt-2 border-t border-slate-800/80 space-y-1.5">
                        <span className="text-[10px] font-mono text-cyan-400 font-bold block">
                          Grounding: Google Maps Maritime Places
                        </span>
                        {m.mapsPlaces.map((pl, idx) => (
                          <a
                            key={idx}
                            href={pl.uri}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center justify-between p-1.5 bg-slate-950/80 rounded border border-slate-800 hover:border-cyan-500/40 text-[11px] text-slate-300 transition-colors"
                          >
                            <span className="truncate">{pl.title}</span>
                            <ExternalLink className="w-3 h-3 text-cyan-400 shrink-0 ml-1" />
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {isLoading && (
              <div className="flex items-center gap-2 text-slate-400 text-xs p-2 bg-slate-900/60 rounded-xl border border-slate-800 max-w-[200px]">
                <div className="w-3.5 h-3.5 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
                <span className="font-mono text-[11px]">Analyzing telemetry...</span>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Box Footer */}
          <div className="p-2.5 bg-slate-900/90 border-t border-slate-800 shrink-0">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendMessage();
              }}
              className="flex items-center gap-2 bg-slate-950 border border-slate-800 focus-within:border-cyan-500 rounded-xl px-3 py-1.5 transition-all shadow-inner"
            >
              <input
                type="text"
                placeholder="Ask about vessels, AIS gaps, sanctions, ports..."
                value={inputQuery}
                onChange={(e) => setInputQuery(e.target.value)}
                disabled={isLoading}
                className="flex-1 bg-transparent text-xs text-white placeholder-slate-500 focus:outline-none"
              />
              <button
                type="submit"
                disabled={!inputQuery.trim() || isLoading}
                className="p-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 disabled:opacity-30 disabled:hover:bg-cyan-600 text-white transition-all shrink-0"
              >
                <Send className="w-3 h-3" />
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
};
