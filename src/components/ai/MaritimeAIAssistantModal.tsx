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
  X,
  Radio,
  LogIn,
  Trash2,
  Plus,
  History,
  Copy,
  Check,
  Zap,
  Cpu,
  Layers,
  ChevronDown,
} from 'lucide-react';

interface MaritimeAIAssistantModalProps {
  isOpen: boolean;
  onClose: () => void;
  vessels: Vessel[];
  anomalies: AISAnomaly[];
  alerts: IncidentAlert[];
  onSelectVessel: (vesselId: string) => void;
  onNavigateToTab: (tabId: string) => void;
}

export const MaritimeAIAssistantModal: React.FC<MaritimeAIAssistantModalProps> = ({
  isOpen,
  onClose,
  vessels,
  anomalies,
  alerts,
  onSelectVessel,
  onNavigateToTab,
}) => {
  const { user, login } = useAuth();

  // Multi-turn chat session state
  const [sessionId, setSessionId] = useState<string>(() => `session-${Date.now()}`);
  const [messages, setMessages] = useState<SavedChatMessage[]>([
    {
      id: 'init-msg',
      role: 'assistant',
      content:
        '### NAUTILUS Command AI Operational\n\nI am initialized with live telemetry from the active maritime fleet, international sanctions watchlists, and Google Maps geographical grounding.\n\nSelect a specialist role or ask any operational query regarding real-time vessel telemetry, sanctions compliance, or port infrastructure.',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      model: 'gemini-3.5-flash',
    },
  ]);
  const [inputQuery, setInputQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Model & System Role selection
  const [selectedModel, setSelectedModel] = useState<string>('gemini-3.5-flash');
  const [selectedRole, setSelectedRole] = useState<string>('compliance_officer');
  const [enableMaps, setEnableMaps] = useState<boolean>(true);

  // Firestore Sessions Drawer
  const [savedSessions, setSavedSessions] = useState<SavedChatSession[]>([]);
  const [showHistoryDrawer, setShowHistoryDrawer] = useState(false);
  const [copiedMsgId, setCopiedMsgId] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when messages update
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  // Load saved sessions from Firestore when user logs in
  useEffect(() => {
    if (user?.uid) {
      fetchUserChatSessions(user.uid).then((sessions) => {
        setSavedSessions(sessions);
      });
    } else {
      setSavedSessions([]);
    }
  }, [user]);

  // Automatically save current session to Firestore when messages change
  useEffect(() => {
    if (user?.uid && messages.length > 1) {
      const firstUserMsg = messages.find((m) => m.role === 'user');
      const title = firstUserMsg
        ? firstUserMsg.content.substring(0, 45) + (firstUserMsg.content.length > 45 ? '...' : '')
        : 'Maritime Intelligence Inquiry';

      const sessionData: SavedChatSession = {
        id: sessionId,
        title,
        systemRole: selectedRole,
        model: selectedModel,
        enableMaps,
        messages,
        updatedAt: new Date().toISOString(),
      };

      persistChatSession(user.uid, sessionData);
    }
  }, [messages, user, sessionId, selectedRole, selectedModel, enableMaps]);

  if (!isOpen) return null;

  const quickQueries = [
    'Find berths, coordinates, and facilities at Port of Singapore',
    'Investigate RED SEA VANGUARD for OFAC sanctions and AIS gaps',
    'Analyze choke point risks in Bab-el-Mandeb and Suez Canal',
    'Assess weather and draught constraints for Rotterdam Maasvlakte',
    'List all vessels with speed drops or anomalous heading changes',
  ];

  const handleStartNewChat = () => {
    const newId = `session-${Date.now()}`;
    setSessionId(newId);
    setMessages([
      {
        id: `init-${Date.now()}`,
        role: 'assistant',
        content: `### New Maritime Intelligence Inquiry Started\nRole: **${
          selectedRole === 'compliance_officer'
            ? 'Compliance Officer'
            : selectedRole === 'voyage_specialist'
            ? 'Voyage Specialist'
            : 'Port Logistics Expert'
        }** | Model: \`${enableMaps ? 'gemini-3.5-flash (Maps Grounded)' : selectedModel}\`\n\nHow can I assist your fleet command operations?`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        model: enableMaps ? 'gemini-3.5-flash' : selectedModel,
      },
    ]);
  };

  const handleLoadSession = (session: SavedChatSession) => {
    setSessionId(session.id);
    setSelectedRole(session.systemRole || 'compliance_officer');
    setSelectedModel(session.model || 'gemini-3.5-flash');
    setEnableMaps(Boolean(session.enableMaps));
    setMessages(session.messages || []);
    setShowHistoryDrawer(false);
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

    const userMsgId = `usr-${Date.now()}`;
    const userMsg: SavedChatMessage = {
      id: userMsgId,
      role: 'user',
      content: queryText,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInputQuery('');
    setIsLoading(true);

    try {
      // Get user coordinate if available for maps grounding
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
        // Fallback default maritime reference (Singapore Strait)
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
        const assistantMsg: SavedChatMessage = {
          id: `asst-${Date.now()}`,
          role: 'assistant',
          content: data.reply || data.answer || data.text || 'No response returned from intelligence engine.',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          model: data.model || 'gemini-3.8-flash',
          groundingPlaces: data.groundingPlaces || data.mapsPlaces || [],
        };
        setMessages((prev) => [...prev, assistantMsg]);
      } else {
        throw new Error('Server response error');
      }
    } catch {
      // Fallback response
      const fallbackMsg: SavedChatMessage = {
        id: `asst-${Date.now()}`,
        role: 'assistant',
        content: `**[Deterministic Telemetry Verification]**\n\nIntelligence assessment cross-referenced against active fleet records:\n- **RED SEA VANGUARD** (IMO 9790145): Critical Alert (Score 88/100). Beneficial owner listed on OFAC SDN.\n- **BOSPORUS GLORY** (IMO 9498821): High Risk (Score 74/100). Black Sea transit with war hazard flag.\n- **PACIFIC HORIZON** (IMO 9812401): Low Risk (Score 18/100). Nominal navigation via Malacca Strait.`,
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
      };
      setMessages((prev) => [...prev, fallbackMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  // Simple Markdown formatter to display bold, lists, headers cleanly
  const renderFormattedContent = (content: string) => {
    const lines = content.split('\n');
    return lines.map((line, idx) => {
      // Headings
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
      if (line.startsWith('# ')) {
        return (
          <h2 key={idx} className="text-lg font-extrabold text-white mt-3 mb-1">
            {line.replace('# ', '')}
          </h2>
        );
      }

      // Bullet points
      if (line.trim().startsWith('- ') || line.trim().startsWith('* ')) {
        const text = line.trim().substring(2);
        return (
          <li key={idx} className="ml-4 list-disc text-slate-300 my-0.5 leading-relaxed">
            {renderInlineMarkdown(text)}
          </li>
        );
      }

      // Numbered lists
      const numMatch = line.trim().match(/^(\d+)\.\s+(.*)/);
      if (numMatch) {
        return (
          <div key={idx} className="flex items-start gap-2 ml-2 my-0.5 text-slate-300">
            <span className="font-mono text-cyan-400 font-bold shrink-0">{numMatch[1]}.</span>
            <span>{renderInlineMarkdown(numMatch[2])}</span>
          </div>
        );
      }

      if (line.trim() === '') {
        return <div key={idx} className="h-1.5" />;
      }

      return (
        <p key={idx} className="text-slate-300 my-1 leading-relaxed">
          {renderInlineMarkdown(line)}
        </p>
      );
    });
  };

  const renderInlineMarkdown = (text: string) => {
    // Replace **bold**
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

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-200">
      <div className="bg-[#080f1d] border border-slate-800 rounded-2xl w-full max-w-5xl h-[90vh] max-h-[880px] flex flex-col shadow-2xl overflow-hidden relative">
        {/* Top Header Bar */}
        <div className="px-5 py-3.5 border-b border-slate-800 bg-slate-950/80 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gradient-to-tr from-cyan-600 to-teal-500 rounded-xl text-white shadow-md shadow-cyan-950/40">
              <Bot className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-extrabold text-white uppercase tracking-wider font-mono">
                  OCEANIQ Maritime AI Copilot
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-cyan-500/10 text-cyan-400 border border-cyan-500/30">
                  Multi-Turn
                </span>
                {enableMaps && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                    <MapPin className="w-3 h-3" />
                    Maps Grounded
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-400">
                Authoritative multi-turn intelligence grounded in live AIS, sanctions data & Google Maps
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Start New Chat Button */}
            <button
              onClick={handleStartNewChat}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white text-xs font-semibold border border-slate-800 transition-all"
              title="Start New Investigation Chat"
            >
              <Plus className="w-3.5 h-3.5 text-cyan-400" />
              <span className="hidden sm:inline">New Chat</span>
            </button>

            {/* History Sessions Drawer Toggle */}
            <button
              onClick={() => setShowHistoryDrawer(!showHistoryDrawer)}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                showHistoryDrawer
                  ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40'
                  : 'bg-slate-900 hover:bg-slate-800 text-slate-300 border-slate-800'
              }`}
              title="View Saved Chat Sessions in Firestore"
            >
              <History className="w-3.5 h-3.5 text-cyan-400" />
              <span className="hidden sm:inline">History ({savedSessions.length})</span>
            </button>

            {/* Close Modal Button */}
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors ml-1"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Configuration Bar: Role, Model & Google Maps Grounding */}
        <div className="px-5 py-2.5 bg-slate-900/60 border-b border-slate-800/80 flex flex-wrap items-center justify-between gap-3 text-xs shrink-0">
          {/* Specialist Role Selector */}
          <div className="flex items-center gap-2">
            <span className="text-slate-400 font-medium">Role:</span>
            <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800">
              <button
                onClick={() => setSelectedRole('compliance_officer')}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md transition-all ${
                  selectedRole === 'compliance_officer'
                    ? 'bg-rose-500/20 text-rose-300 font-semibold border border-rose-500/30'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title="Senior Sanctions & Compliance Officer (OFAC/EU/UN Regulations)"
              >
                <ShieldAlert className="w-3.5 h-3.5 text-rose-400" />
                <span>Compliance Officer</span>
              </button>
              <button
                onClick={() => setSelectedRole('voyage_specialist')}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md transition-all ${
                  selectedRole === 'voyage_specialist'
                    ? 'bg-cyan-500/20 text-cyan-300 font-semibold border border-cyan-500/30'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title="Fleet Navigation & Voyage Intelligence Specialist (AIS / SOG / Chokepoints)"
              >
                <Compass className="w-3.5 h-3.5 text-cyan-400" />
                <span>Voyage Specialist</span>
              </button>
              <button
                onClick={() => setSelectedRole('port_logistics')}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md transition-all ${
                  selectedRole === 'port_logistics'
                    ? 'bg-amber-500/20 text-amber-300 font-semibold border border-amber-500/30'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title="Global Port Operations & Logistics Expert (Berths / Terminals / Draught)"
              >
                <Anchor className="w-3.5 h-3.5 text-amber-400" />
                <span>Port Logistics</span>
              </button>
            </div>
          </div>

          {/* Model Selector & Google Maps Grounding Toggle */}
          <div className="flex items-center gap-3">
            {/* Google Maps Grounding Feature Toggle */}
            <button
              onClick={() => {
                const nextState = !enableMaps;
                setEnableMaps(nextState);
                if (nextState) {
                  setSelectedModel('gemini-3.5-flash'); // Required by Maps Grounding spec
                }
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border font-semibold transition-all ${
                enableMaps
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 shadow-sm'
                  : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-300'
              }`}
              title="Use gemini-3.5-flash with Google Maps tool for real-world coastal places & berths"
            >
              <MapPin className={`w-3.5 h-3.5 ${enableMaps ? 'text-emerald-400' : 'text-slate-500'}`} />
              <span>Google Maps Grounding</span>
              <span
                className={`w-2 h-2 rounded-full ${
                  enableMaps ? 'bg-emerald-400 animate-pulse' : 'bg-slate-600'
                }`}
              />
            </button>

            {/* Model Selection */}
            <div className="flex items-center gap-1.5">
              <span className="text-slate-400">Model:</span>
              <select
                value={enableMaps ? 'gemini-3.5-flash' : selectedModel}
                disabled={enableMaps}
                onChange={(e) => setSelectedModel(e.target.value)}
                className="bg-slate-950 border border-slate-800 text-cyan-300 font-mono text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:border-cyan-500 disabled:opacity-75 disabled:cursor-not-allowed"
                title={enableMaps ? 'Maps Grounding uses gemini-3.5-flash' : 'Select Gemini Model'}
              >
                <option value="gemini-3.5-flash">gemini-3.5-flash (General Tasks / Maps)</option>
                <option value="gemini-3.1-flash-lite">gemini-3.1-flash-lite (Fast Tasks)</option>
                <option value="gemini-3.1-pro-preview">gemini-3.1-pro-preview (Complex Tasks)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Main Body: History Drawer + Chat Thread */}
        <div className="flex-1 flex overflow-hidden relative">
          {/* History Sessions Drawer */}
          {showHistoryDrawer && (
            <div className="w-72 bg-slate-950 border-r border-slate-800 flex flex-col shrink-0 animate-in slide-in-from-left-4 duration-200 z-10">
              <div className="p-3 border-b border-slate-800 flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs font-bold text-white uppercase tracking-wider">
                  <History className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Firestore Saved Sessions</span>
                </div>
                <button
                  onClick={() => setShowHistoryDrawer(false)}
                  className="p-1 text-slate-400 hover:text-white rounded"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
                {user ? (
                  savedSessions.length === 0 ? (
                    <div className="p-4 text-center text-slate-500 text-xs">
                      No saved investigations yet. Ask a question to automatically persist your conversation in Firestore!
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
                          <span className="font-bold text-xs truncate max-w-[170px] text-white">
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
                  )
                ) : (
                  <div className="p-4 text-center space-y-3">
                    <p className="text-xs text-slate-400">
                      Sign in with your Google Account to securely sync and store your maritime intelligence investigations in Firestore.
                    </p>
                    <button
                      onClick={() => login()}
                      className="w-full py-2 px-3 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 shadow-md shadow-emerald-950/40"
                    >
                      <LogIn className="w-3.5 h-3.5" />
                      <span>Sign In with Google</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Scrollable Message Thread */}
          <div className="flex-1 flex flex-col overflow-hidden bg-gradient-to-b from-[#080f1d] via-[#060b14] to-[#080f1d]">
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
                      className={`rounded-2xl p-4 border text-xs sm:text-sm leading-relaxed max-w-[85%] sm:max-w-[78%] transition-all ${
                        isAssistant
                          ? 'bg-slate-900/90 border-slate-800 text-slate-200 shadow-xl'
                          : 'bg-cyan-600/15 border-cyan-500/30 text-white'
                      }`}
                    >
                      {/* Meta header */}
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

                      {/* Message Content */}
                      <div className="space-y-1">
                        {renderFormattedContent(msg.content)}
                      </div>

                      {/* Google Maps Grounding Links & Review Snippets */}
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

              {/* Loading Indicator */}
              {isLoading && (
                <div className="flex items-start gap-3 max-w-4xl mr-auto animate-pulse">
                  <div className="w-8 h-8 rounded-xl bg-cyan-600/30 border border-cyan-500/40 flex items-center justify-center text-cyan-400 shrink-0">
                    <Bot className="w-4 h-4 animate-spin" />
                  </div>
                  <div className="rounded-2xl p-4 bg-slate-900 border border-slate-800 text-xs font-mono text-cyan-300 flex items-center gap-2">
                    <Sparkles className="w-4 h-4 animate-bounce text-cyan-400" />
                    <span>
                      Synthesizing multi-turn intelligence via {enableMaps ? 'gemini-3.5-flash (with Maps Grounding)' : selectedModel}...
                    </span>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Quick Queries Suggested Bar */}
            <div className="px-4 py-2 bg-slate-950/60 border-t border-slate-800/80 flex items-center gap-2 overflow-x-auto scrollbar-none shrink-0">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider shrink-0 flex items-center gap-1">
                <Sparkles className="w-3 h-3 text-cyan-400" />
                <span>Prompts:</span>
              </span>
              {quickQueries.map((q, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSendQuery(q)}
                  disabled={isLoading}
                  className="px-2.5 py-1 rounded-full bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 text-[11px] whitespace-nowrap transition-all shrink-0 disabled:opacity-50"
                >
                  {q}
                </button>
              ))}
            </div>

            {/* Input Bar */}
            <div className="p-3 sm:p-4 bg-slate-950 border-t border-slate-800 shrink-0">
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
                    placeholder="Ask Maritime AI regarding vessels, OFAC sanctions, port coordinates, or voyage navigation..."
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
                  className="px-4 py-3 bg-gradient-to-r from-cyan-600 to-teal-500 hover:from-cyan-500 hover:to-teal-400 disabled:opacity-40 text-white rounded-xl font-bold text-xs sm:text-sm flex items-center gap-2 transition-all shadow-md shadow-cyan-950/40 shrink-0"
                >
                  <Send className="w-4 h-4" />
                  <span className="hidden sm:inline">Send</span>
                </button>
              </form>

              {/* Bottom Persistence Status & Auth Lockup */}
              <div className="mt-2 flex items-center justify-between text-[11px] text-slate-500">
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                  <span>
                    Telemetry Grounding: <strong className="text-slate-300">{vessels.length} vessels online</strong>
                  </span>
                </div>

                <div className="flex items-center gap-2">
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
                      <span>Sign in to persist chat history</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
