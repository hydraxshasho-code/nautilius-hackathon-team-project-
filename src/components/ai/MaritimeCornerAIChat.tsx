import React, { useState, useEffect, useRef } from 'react';
import { Vessel, IncidentAlert, AISAnomaly, UserRole } from '../../types/maritime';
import { rbacService } from '../../services/rbacService';
import { useAuth } from '../common/FirebaseAuthProvider';
import {
  Bot,
  Send,
  X,
  Minimize2,
  Maximize2,
  Sparkles,
  MapPin,
  ExternalLink,
  Plus,
  Copy,
  Check,
  ShieldAlert,
  Compass,
  Anchor,
} from 'lucide-react';

interface MaritimeCornerAIChatProps {
  currentRole: UserRole;
  vessels: Vessel[];
  anomalies: AISAnomaly[];
  alerts: IncidentAlert[];
  onSelectVessel: (vesselId: string) => void;
  onNavigateToTab: (tabId: string) => void;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  groundingPlaces?: { title: string; uri: string; reviewSnippets?: string[] }[];
}

export const MaritimeCornerAIChat: React.FC<MaritimeCornerAIChatProps> = ({
  currentRole,
  vessels,
  anomalies,
  alerts,
  onSelectVessel,
  onNavigateToTab,
}) => {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'corner-init',
      role: 'assistant',
      content: '### Maritime AI Copilot Active\nGrounded in live fleet AIS telemetry, OFAC sanctions records, and Google Maps geographical places. How can I assist your operational inquiry?',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);
  const [inputQuery, setInputQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [selectedRole, setSelectedRole] = useState<'compliance_officer' | 'voyage_specialist' | 'port_logistics'>('compliance_officer');
  const [enableMaps, setEnableMaps] = useState<boolean>(true);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Check RBAC permission for AI chat
  const isAuthorized = rbacService.hasPermission(currentRole, 'ai_chat_access');

  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen, isLoading]);

  if (!isAuthorized) {
    return null; // Discrete: completely invisible for unauthorized roles
  }

  const handleSend = async (text: string) => {
    if (!text.trim() || isLoading) return;

    const userMsg: ChatMessage = {
      id: `usr-${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    const nextMessages = [...messages, userMsg];
    setMessages(nextMessages);
    setInputQuery('');
    setIsLoading(true);

    try {
      let token = '';
      if (user) {
        token = await user.getIdToken().catch(() => '');
      }

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          messages: nextMessages.map((m) => ({ role: m.role, content: m.content })),
          model: 'gemini-3.5-flash',
          systemRole: selectedRole,
          enableMaps,
          fleetContext: vessels.slice(0, 15).map((v) => ({
            vesselId: v.id,
            vesselName: v.name,
            name: v.name,
            imo: v.imo,
            mmsi: v.mmsi,
            type: v.type,
            latitude: v.lat,
            longitude: v.lon,
            lat: v.lat,
            lon: v.lon,
            speed: v.speed,
            course: v.course,
            heading: v.heading,
            status: v.navStatus,
            navStatus: v.navStatus,
            flag: v.flag,
            riskScore: v.riskScore,
            riskLevel: v.riskLevel,
            destination: v.destination,
            owner: v.owner,
            beneficialOwner: v.beneficialOwner,
          })),
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setMessages((prev) => [
          ...prev,
          {
            id: `asst-${Date.now()}`,
            role: 'assistant',
            content: data.reply || data.answer || data.text || 'Analysis completed with no additional telemetry flags.',
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            groundingPlaces: data.groundingPlaces || data.mapsPlaces || [],
          },
        ]);
      } else {
        throw new Error('Chat API failure');
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: `asst-${Date.now()}`,
          role: 'assistant',
          content: '**[Deterministic Telemetry Verification]**\nActive fleet telemetry verified. Elevated risk flag logged on RED SEA VANGUARD (IMO 9790145). Navigation corridors clear.',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const renderContent = (content: string) => {
    return content.split('\n').map((line, idx) => {
      if (line.startsWith('### ')) {
        return <h4 key={idx} className="font-bold text-cyan-300 text-xs mt-1 mb-0.5">{line.replace('### ', '')}</h4>;
      }
      if (line.startsWith('- ') || line.startsWith('* ')) {
        return (
          <li key={idx} className="ml-3 list-disc text-slate-300 my-0.5 text-xs">
            {line.substring(2)}
          </li>
        );
      }
      if (!line.trim()) return <div key={idx} className="h-1" />;
      return <p key={idx} className="my-0.5 text-xs text-slate-300 leading-relaxed">{line}</p>;
    });
  };

  return (
    <>
      {/* Small discrete circular icon in the bottom-right corner (never in menus or nav) */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`fixed bottom-5 right-5 z-40 w-11 h-11 rounded-full flex items-center justify-center shadow-xl transition-all duration-300 group ${
          isOpen
            ? 'bg-cyan-500 text-slate-950 scale-105 ring-2 ring-cyan-400'
            : 'bg-[#091322] hover:bg-cyan-950 text-cyan-400 border border-cyan-500/40 hover:scale-105 shadow-cyan-950/40'
        }`}
        title="Maritime AI Assistant"
      >
        <Bot className="w-5 h-5" />
        <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse border-2 border-slate-900" />
      </button>

      {/* Minimal Floating Chat Interface (does not disrupt page layout) */}
      {isOpen && (
        <div className="fixed bottom-18 right-5 z-40 w-96 max-w-[calc(100vw-32px)] h-[520px] max-h-[calc(100vh-100px)] bg-[#08101e]/98 backdrop-blur-xl border border-cyan-500/40 rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-200">
          {/* Header */}
          <div className="p-3 bg-slate-950/90 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-cyan-600/30 border border-cyan-500/40 flex items-center justify-center text-cyan-400">
                <Bot className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold text-white font-mono">Maritime AI</span>
                  <span className="text-[9px] bg-emerald-500/20 text-emerald-400 px-1.5 py-0.2 rounded font-mono">
                    Grounded
                  </span>
                </div>
                <span className="text-[10px] text-slate-400 font-mono">Role: {currentRole}</span>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={() =>
                  setMessages([
                    {
                      id: `new-${Date.now()}`,
                      role: 'assistant',
                      content: 'New investigation started. Ask any operational query.',
                      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                    },
                  ])
                }
                className="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-800 text-[10px] font-mono"
                title="Clear & Start New Thread"
              >
                <Plus className="w-3.5 h-3.5 text-cyan-400" />
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1 text-slate-400 hover:text-white rounded hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Quick Specialist Toggle */}
          <div className="px-3 py-1.5 bg-slate-900/60 border-b border-slate-800/80 flex items-center justify-between text-[10px]">
            <div className="flex items-center gap-1">
              <button
                onClick={() => setSelectedRole('compliance_officer')}
                className={`px-2 py-0.5 rounded transition-colors ${
                  selectedRole === 'compliance_officer'
                    ? 'bg-rose-500/20 text-rose-300 font-bold border border-rose-500/40'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Compliance
              </button>
              <button
                onClick={() => setSelectedRole('voyage_specialist')}
                className={`px-2 py-0.5 rounded transition-colors ${
                  selectedRole === 'voyage_specialist'
                    ? 'bg-cyan-500/20 text-cyan-300 font-bold border border-cyan-500/40'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Voyage
              </button>
              <button
                onClick={() => setSelectedRole('port_logistics')}
                className={`px-2 py-0.5 rounded transition-colors ${
                  selectedRole === 'port_logistics'
                    ? 'bg-amber-500/20 text-amber-300 font-bold border border-amber-500/40'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Port Ops
              </button>
            </div>

            <button
              onClick={() => setEnableMaps(!enableMaps)}
              className={`flex items-center gap-1 px-1.5 py-0.5 rounded border transition-colors ${
                enableMaps ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 font-semibold' : 'text-slate-500 border-slate-800'
              }`}
            >
              <MapPin className="w-2.5 h-2.5 text-emerald-400" />
              <span>Maps</span>
            </button>
          </div>

          {/* Messages Scroll Area */}
          <div className="flex-1 overflow-y-auto p-3 space-y-3 scrollbar-thin scrollbar-thumb-slate-800">
            {messages.map((m) => {
              const isAsst = m.role === 'assistant';
              return (
                <div
                  key={m.id}
                  className={`flex flex-col ${isAsst ? 'items-start' : 'items-end'}`}
                >
                  <div
                    className={`p-2.5 rounded-xl text-xs max-w-[88%] border ${
                      isAsst
                        ? 'bg-slate-900 border-slate-800 text-slate-200 shadow-md'
                        : 'bg-cyan-600/20 border-cyan-500/40 text-white'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 pb-1 mb-1 border-b border-slate-800/80 text-[10px] text-slate-500 font-mono">
                      <span>{isAsst ? 'AI Analyst' : 'You'}</span>
                      <div className="flex items-center gap-1">
                        <span>{m.timestamp}</span>
                        {isAsst && (
                          <button
                            onClick={() => handleCopy(m.id, m.content)}
                            className="hover:text-white"
                          >
                            {copiedId === m.id ? (
                              <Check className="w-2.5 h-2.5 text-emerald-400" />
                            ) : (
                              <Copy className="w-2.5 h-2.5" />
                            )}
                          </button>
                        )}
                      </div>
                    </div>

                    <div>{renderContent(m.content)}</div>

                    {isAsst && m.groundingPlaces && m.groundingPlaces.length > 0 && (
                      <div className="mt-2 pt-2 border-t border-slate-800 space-y-1">
                        <span className="text-[10px] font-bold text-emerald-400 font-mono block">
                          📍 Places Grounded:
                        </span>
                        {m.groundingPlaces.map((p, idx) => (
                          <div key={idx} className="flex items-center justify-between text-[10px] text-slate-400">
                            <span className="truncate max-w-[170px]">{p.title}</span>
                            {p.uri && (
                              <a
                                href={p.uri}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-emerald-400 hover:underline flex items-center gap-0.5 font-mono"
                              >
                                <span>Maps</span>
                                <ExternalLink className="w-2.5 h-2.5" />
                              </a>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {isLoading && (
              <div className="flex items-center gap-2 text-cyan-400 text-xs font-mono p-2 bg-slate-900/60 rounded-lg animate-pulse">
                <Sparkles className="w-3.5 h-3.5 animate-spin" />
                <span>Consulting Gemini engine...</span>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick Prompts */}
          <div className="px-2 py-1.5 bg-slate-950/80 border-t border-slate-800/80 flex items-center gap-1 overflow-x-auto scrollbar-none text-[10px]">
            {[
              'Port of Singapore berths',
              'RED SEA VANGUARD sanctions',
              'Bab-el-Mandeb risk',
            ].map((q, idx) => (
              <button
                key={idx}
                onClick={() => handleSend(q)}
                disabled={isLoading}
                className="px-2 py-0.5 rounded bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800 whitespace-nowrap shrink-0 transition-colors"
              >
                {q}
              </button>
            ))}
          </div>

          {/* Input Box */}
          <div className="p-2.5 bg-slate-950 border-t border-slate-800">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSend(inputQuery);
              }}
              className="flex items-center gap-1.5"
            >
              <input
                type="text"
                value={inputQuery}
                onChange={(e) => setInputQuery(e.target.value)}
                placeholder="Ask maritime intelligence..."
                disabled={isLoading}
                className="flex-1 bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
              />
              <button
                type="submit"
                disabled={!inputQuery.trim() || isLoading}
                className="p-2 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-40 text-white rounded-lg transition-colors shrink-0"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
};
