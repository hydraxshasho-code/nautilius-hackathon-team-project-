import React, { useState, useEffect } from 'react';
import { Plus } from 'lucide-react';
import { Vessel, IncidentAlert, AISAnomaly, UserRole } from './types/maritime';
import { generateLiveAlerts, generateLiveAnomalies } from './services/telemetryEventsService';
import { aisStreamService } from './services/aisStreamService';
import { initializeFirestoreVessels, subscribeToFirestoreVessels } from './services/firebase';
import { liveAISClient } from './services/liveAisClient';
import { rbacService } from './services/rbacService';
import { profileSwitchService } from './services/profileSwitchService';
import { FirebaseAuthProvider } from './components/common/FirebaseAuthProvider';

// Layout & Navigation
import { Sidebar } from './components/layout/Sidebar';
import { TopBar } from './components/layout/TopBar';
import { SystemHealthModal } from './components/layout/SystemHealthModal';
import { GlobalSearchModal } from './components/common/GlobalSearchModal';
import { MaritimeFloatingAssistant } from './components/ai/MaritimeFloatingAssistant';
import { MaritimeAICopilotView } from './components/ai/MaritimeAICopilotView';
import { VesselAddModal } from './components/vessels/VesselAddModal';
import { VesselRemoveConfirmModal } from './components/vessels/VesselRemoveConfirmModal';
import { Forbidden403View } from './components/common/Forbidden403View';

// Views
import { DashboardView } from './components/dashboard/DashboardView';
import { VesselRegistryView } from './components/vessels/VesselRegistryView';
import { VesselProfileView } from './components/vessels/VesselProfileView';
import { TacticalMaritimeMap } from './components/map/TacticalMaritimeMap';
import { VoyageIntelligenceView } from './components/voyage/VoyageIntelligenceView';
import { KYCComplianceView } from './components/kyc/KYCComplianceView';
import { AMLScreeningView } from './components/aml/AMLScreeningView';
import { RiskAssessmentView } from './components/risk/RiskAssessmentView';
import { AISAnomaliesView } from './components/anomalies/AISAnomaliesView';
import { AlertCenterView } from './components/alerts/AlertCenterView';
import { ReportingView } from './components/reports/ReportingView';
import { UserRolesView } from './components/rbac/UserRolesView';
import { SecuritySettingsView } from './components/security/SecuritySettingsView';
import { AuditLogsView } from './components/audit/AuditLogsView';
import { geofenceService } from './services/geofenceService';
import { INITIAL_VESSELS } from './data/mockVessels';

export default function App() {
  const [vessels, setVessels] = useState<Vessel[]>(() => {
    const live = liveAISClient.getTrackedVessels();
    if (live && live.length > 0) return live;
    const local = aisStreamService.getVessels();
    if (local && local.length > 0) return local;
    return INITIAL_VESSELS;
  });
  const [alerts, setAlerts] = useState<IncidentAlert[]>(() => generateLiveAlerts(INITIAL_VESSELS));
  const [anomalies, setAnomalies] = useState<AISAnomaly[]>(() => generateLiveAnomalies(INITIAL_VESSELS));
  const [selectedVesselId, setSelectedVesselId] = useState<string>(() => {
    const live = liveAISClient.getTrackedVessels();
    if (live && live.length > 0) return live[0].id;
    return INITIAL_VESSELS[0]?.id || '';
  });
  const [currentTab, setCurrentTab] = useState<string>('dashboard');
  const [currentRole, setCurrentRole] = useState<UserRole>(() => profileSwitchService.getActiveProfile());

  // Synchronize with centralized profile switch layer
  useEffect(() => {
    const unsubscribe = profileSwitchService.subscribe((activeProfile) => {
      handleRoleChange(activeProfile);
    });
    return unsubscribe;
  }, [currentTab]);

  // Modals state
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isHealthOpen, setIsHealthOpen] = useState(false);
  const [isAddVesselModalOpen, setIsAddVesselModalOpen] = useState(false);
  const [vesselToRemove, setVesselToRemove] = useState<Vessel | null>(null);

  // Initialize and synchronize persistent Firestore ship data across all visitors
  useEffect(() => {
    // 0. Connect Live Real-Time AIS WebSocket Stream (1000 real-time ships) & eager REST fetch
    liveAISClient.fetchInitialFleet().then((initialFleet) => {
      if (initialFleet && initialFleet.length > 0) {
        setVessels(initialFleet);
        setSelectedVesselId((prev) => prev || initialFleet[0].id);
        setAlerts((prev) => (prev.length === 0 ? generateLiveAlerts(initialFleet) : prev));
        setAnomalies((prev) => (prev.length === 0 ? generateLiveAnomalies(initialFleet) : prev));
      }
    }).catch(() => {});

    const unsubscribeLiveAIS = liveAISClient.subscribeVessels((liveFleet) => {
      if (liveFleet && liveFleet.length > 0) {
        setVessels(liveFleet);
        setSelectedVesselId((prev) => prev || liveFleet[0].id);
        setAlerts((prev) => (prev.length === 0 ? generateLiveAlerts(liveFleet) : prev));
        setAnomalies((prev) => (prev.length === 0 ? generateLiveAnomalies(liveFleet) : prev));
      }
    });

    // 1. Initial permanent fetch from Firestore (reads single source of truth)
    initializeFirestoreVessels()
      .then((fleet) => {
        if (fleet && fleet.length > 0) {
          aisStreamService.setFleet(fleet);
          setVessels((prev) => (prev.length === 0 ? fleet : prev));
          setSelectedVesselId((prev) => prev || fleet[0].id);
        }
      })
      .catch((err) => console.warn('Firestore initial load notice:', err));

    // 2. Real-time multi-user live synchronization via Firestore onSnapshot
    const unsubscribeFirestore = subscribeToFirestoreVessels((remoteFleet) => {
      if (remoteFleet && remoteFleet.length > 0) {
        aisStreamService.syncFromRemote(remoteFleet);
      }
    });

    // 3. AIS Geofence evaluation stream (does not overwrite live vessel fleet)
    const unsubscribeAIS = aisStreamService.subscribe((updatedVessels) => {
      geofenceService.evaluateVessels(updatedVessels);
    });

    // 4. Geofence Alerts Listener
    const unsubscribeGeofence = geofenceService.onAlert((newAlert) => {
      setAlerts((prev) => {
        if (prev.some((a) => a.id === newAlert.id)) return prev;
        return [newAlert, ...prev];
      });
    });

    return () => {
      unsubscribeLiveAIS();
      unsubscribeFirestore();
      unsubscribeAIS();
      unsubscribeGeofence();
    };
  }, []);

  // Synchronize alerts and anomalies with latest active fleet data & update timestamps
  useEffect(() => {
    if (vessels.length > 0) {
      setAlerts((prev) => {
        const live = generateLiveAlerts(vessels);
        const geofenceAlerts = prev.filter((a) => a.category === 'Geofence Breach');
        const ids = new Set(geofenceAlerts.map((a) => a.id));
        const nonGeofenceLive = live.filter((a) => !ids.has(a.id));
        return [...geofenceAlerts, ...nonGeofenceLive];
      });
      setAnomalies(generateLiveAnomalies(vessels));
    }
  }, [vessels.length]);

  // Keyboard shortcut for Cmd/Ctrl + K (Search)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsSearchOpen(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Role change handler with strict automatic redirect if current tab is restricted
  const handleRoleChange = (newRole: UserRole) => {
    setCurrentRole(newRole);
    if (profileSwitchService.getActiveProfile() !== newRole) {
      profileSwitchService.switchProfile(newRole).catch(() => {});
    }
    if (newRole === 'Operations Manager') {
      if (['registry', 'kyc', 'aml', 'risk', 'reports', 'audit', 'rbac'].includes(currentTab)) {
        setCurrentTab('dashboard');
      }
    } else if (newRole === 'Investigator' || newRole === 'Auditor') {
      if (['registry', 'anomalies', 'risk', 'rbac'].includes(currentTab)) {
        setCurrentTab('dashboard');
      }
    } else if (newRole === 'Risk Analyst') {
      if (['registry', 'rbac', 'audit'].includes(currentTab)) {
        setCurrentTab('dashboard');
      }
    } else if (newRole !== 'Super Admin' && currentTab === 'rbac') {
      setCurrentTab('dashboard');
    } else if (newRole !== 'Super Admin' && newRole !== 'Compliance Officer' && currentTab === 'registry') {
      setCurrentTab('dashboard');
    }
  };

  // Open any vessel directly on the Real-Time World Map
  const handleOpenVessel = (vesselId: string) => {
    setSelectedVesselId(vesselId);
    aisStreamService.selectVessel(vesselId);
    setCurrentTab('tracking');
  };

  // Open any vessel's full intelligence dossier
  const handleOpenDossier = (vesselId: string) => {
    setSelectedVesselId(vesselId);
    aisStreamService.selectVessel(vesselId);
    setCurrentTab('vessel-profile');
  };

  const handleRegisterNewVessel = async (newVesselData: Partial<Vessel>) => {
    const imo = newVesselData.imo;
    const mmsi = newVesselData.mmsi;
    const identifier = imo || mmsi;

    if (identifier) {
      console.log('[App] 🚀 handleRegisterNewVessel requested for identifier:', identifier);
      const liveRes = await liveAISClient.trackVessel(identifier);
      if (liveRes.success && liveRes.vessel) {
        console.log('[App] ✅ Live AIS tracking started for:', liveRes.vessel.name, liveRes.vessel.id);
        setSelectedVesselId(liveRes.vessel.id);
        setVessels([...aisStreamService.getVessels()]);
        setCurrentTab('vessel-profile');
        return;
      }
    }

    const created = aisStreamService.addVessel(newVesselData);
    setVessels([...aisStreamService.getVessels()]);
    setSelectedVesselId(created.id);
    setCurrentTab('vessel-profile');
  };

  const handleRemoveVessel = (vesselId: string) => {
    liveAISClient.untrackVessel(vesselId);
    aisStreamService.removeVessel(vesselId);
    const remaining = aisStreamService.getVessels();
    setVessels([...remaining]);
    if (selectedVesselId === vesselId) {
      setSelectedVesselId(remaining[0]?.id || '');
    }
    setVesselToRemove(null);
  };

  // Robust selected vessel resolution supporting ID, IMO, or MMSI lookup
  const selectedVessel =
    vessels.find((v) => {
      if (!selectedVesselId) return false;
      const cleanTarget = selectedVesselId.replace(/[^0-9]/g, '');
      return (
        v.id === selectedVesselId ||
        (cleanTarget && (v.imo === cleanTarget || v.mmsi === cleanTarget)) ||
        selectedVesselId.includes(v.imo) ||
        selectedVesselId.includes(v.mmsi)
      );
    }) || vessels[0];

  // Role-routed alert and anomaly metrics:
  // - Broad alert broadcasting is forbidden; alerts filter strictly by currentRole
  // - Investigator & Auditor do NOT see AIS Anomalies
  const roleAlerts = rbacService.filterAlertsForRole(currentRole, alerts);
  const activeAlertCount = roleAlerts.filter((a) => a.status === 'NEW' || a.status === 'INVESTIGATING').length;

  const canSeeAnomalies = currentRole !== 'Investigator' && currentRole !== 'Auditor';
  const activeAnomalyCount = canSeeAnomalies ? anomalies.filter((a) => a.status === 'ACTIVE').length : 0;

  return (
    <FirebaseAuthProvider>
      <div className="flex h-screen w-screen overflow-hidden bg-[#060b13] text-slate-100 font-sans">
        {/* Persistent Enterprise Sidebar (Filtered strictly by Role) */}
        <Sidebar
          currentTab={currentTab}
          onSelectTab={(tabId) => setCurrentTab(tabId)}
          alertCount={activeAlertCount}
          anomalyCount={activeAnomalyCount}
          currentRole={currentRole}
        />

        {/* Main Viewport Container */}
        <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
          {/* Top Header Bar with Google Sign-in and Fast Role Switcher */}
          <TopBar
            currentTab={currentTab}
            onOpenSearch={() => setIsSearchOpen(true)}
            onOpenAI={() => {}}
            onOpenHealth={() => setIsHealthOpen(true)}
            onNavigateToTab={(tabId) => setCurrentTab(tabId)}
            unreadAlertCount={activeAlertCount}
            currentRole={currentRole}
            onRoleChange={handleRoleChange}
          />

          {/* Dynamic Content View Area */}
          <main className="flex-1 overflow-y-auto p-4 sm:p-6 bg-gradient-to-b from-[#060b13] via-[#08101e] to-[#060b13] scrollbar-thin scrollbar-thumb-slate-800">
            <div className="max-w-[1720px] mx-auto w-full">
              {currentTab === 'dashboard' && (
                <DashboardView
                  vessels={vessels}
                  alerts={alerts}
                  anomalies={anomalies}
                  selectedVesselId={selectedVesselId}
                  onSelectVessel={handleOpenDossier}
                  onOpenDossier={handleOpenDossier}
                  onNavigateToTab={(tabId) => setCurrentTab(tabId)}
                  currentRole={currentRole}
                />
              )}

              {currentTab === 'registry' && (
                <VesselRegistryView
                  vessels={vessels}
                  onSelectVessel={handleOpenVessel}
                  onNavigateToTab={(tabId) => setCurrentTab(tabId)}
                  onRegisterVessel={handleRegisterNewVessel}
                  onRemoveVessel={handleRemoveVessel}
                  currentRole={currentRole}
                />
              )}

              {currentTab === 'vessel-profile' && (
                selectedVessel ? (
                  <VesselProfileView
                    vessel={selectedVessel}
                    allVessels={vessels}
                    alerts={roleAlerts}
                    anomalies={canSeeAnomalies ? anomalies : []}
                    onNavigateToTab={(tabId) => setCurrentTab(tabId)}
                    onSelectVessel={handleOpenVessel}
                    onRemoveVessel={handleRemoveVessel}
                  />
                ) : (
                  <div className="bg-slate-900/90 backdrop-blur-md rounded-2xl border border-slate-800 p-12 text-center shadow-2xl space-y-4">
                    <p className="text-sm font-bold text-white">No Vessel Selected</p>
                    <p className="text-xs text-slate-400 font-mono">
                      No vessel is currently selected or enrolled in the Firestore fleet. Click below to view the registry or enroll a new ship.
                    </p>
                    <button
                      onClick={() => setCurrentTab('registry')}
                      className="px-4 py-2 bg-gradient-to-r from-cyan-600 to-teal-500 hover:from-cyan-500 hover:to-teal-400 text-slate-950 font-bold rounded-lg text-xs"
                    >
                      Open Vessel Registry
                    </button>
                  </div>
                )
              )}

              {currentTab === 'tracking' && (
                <div className="h-[calc(100vh-140px)] w-full flex flex-col gap-2">
                  <div className="flex items-center justify-between pb-1">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                      <h1 className="text-sm font-extrabold text-white uppercase tracking-wider font-mono">
                        NAUTILUS Real-Time World Map ({vessels.length} Live Vessels)
                      </h1>
                    </div>
                    <div className="flex items-center gap-2">
                      {(currentRole === 'Super Admin' || currentRole === 'Compliance Officer') && (
                        <button
                          onClick={() => setIsAddVesselModalOpen(true)}
                          className="px-2.5 py-1 rounded-lg bg-gradient-to-r from-cyan-600 to-teal-500 hover:from-cyan-500 hover:to-teal-400 text-white text-xs font-bold flex items-center gap-1 shadow-md shadow-cyan-950/40 transition-all"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Add Vessel</span>
                        </button>
                      )}
                      <span className="text-xs text-cyan-400 font-mono hidden sm:inline">AIS Stream 60FPS</span>
                    </div>
                  </div>
                  <div className="flex-1 w-full rounded-2xl overflow-hidden border border-slate-800 shadow-2xl">
                    <TacticalMaritimeMap
                      vessels={vessels}
                      selectedVesselId={selectedVesselId}
                      onSelectVessel={(id) => setSelectedVesselId(id)}
                      onOpenDossier={(id) => {
                        setSelectedVesselId(id);
                        setCurrentTab('vessel-profile');
                      }}
                      onAddVesselClick={() => setIsAddVesselModalOpen(true)}
                      onRemoveVesselClick={(id) => {
                        const target = vessels.find((v) => v.id === id);
                        if (target) setVesselToRemove(target);
                      }}
                      className="w-full h-full"
                      allowFullscreen={true}
                    />
                  </div>
                </div>
              )}

              {currentTab === 'voyage' && (
                <VoyageIntelligenceView
                  vessels={vessels}
                  selectedVesselId={selectedVesselId}
                  onSelectVessel={handleOpenVessel}
                />
              )}

              {currentTab === 'kyc' && (
                <KYCComplianceView
                  vessels={vessels}
                  onSelectVessel={handleOpenVessel}
                  currentRole={currentRole}
                  onNavigateToTab={(tabId) => setCurrentTab(tabId)}
                />
              )}

              {currentTab === 'aml' && (
                <AMLScreeningView
                  vessels={vessels}
                  onSelectVessel={handleOpenVessel}
                  currentRole={currentRole}
                  onNavigateToTab={(tabId) => setCurrentTab(tabId)}
                />
              )}

              {currentTab === 'risk' && (
                <RiskAssessmentView
                  vessels={vessels}
                  onSelectVessel={handleOpenVessel}
                />
              )}

              {currentTab === 'anomalies' && (
                <AISAnomaliesView
                  anomalies={anomalies}
                  vessels={vessels}
                  onSelectVessel={handleOpenVessel}
                  onNavigateToTab={(tabId) => setCurrentTab(tabId)}
                  currentRole={currentRole}
                />
              )}

              {currentTab === 'alerts' && (
                <AlertCenterView
                  alerts={alerts}
                  onSelectVesselByName={(name) => {
                    const target = vessels.find((v) => v.name.toLowerCase() === name.toLowerCase());
                    if (target) {
                      handleOpenVessel(target.id);
                    }
                  }}
                  onNavigateToTab={(tabId) => setCurrentTab(tabId)}
                  currentRole={currentRole}
                />
              )}

              {currentTab === 'reports' && (
                currentRole === 'Operations Manager' ? (
                  <Forbidden403View
                    currentRole={currentRole}
                    moduleName="Statutory Compliance Reports"
                    allowedRoles={['Super Admin', 'Compliance Officer', 'Risk Analyst', 'Investigator', 'Auditor']}
                    onReturnToDashboard={() => setCurrentTab('dashboard')}
                  />
                ) : (
                  <ReportingView vessels={vessels} />
                )
              )}

              {currentTab === 'rbac' && (
                currentRole === 'Super Admin' ? (
                  <UserRolesView
                    currentRole={currentRole}
                    onRoleChange={handleRoleChange}
                    onNavigateToTab={(tabId) => setCurrentTab(tabId)}
                  />
                ) : (
                  <Forbidden403View
                    currentRole={currentRole}
                    moduleName="Users & Role Management"
                    allowedRoles={['Super Admin']}
                    onReturnToDashboard={() => setCurrentTab('dashboard')}
                  />
                )
              )}

              {(currentTab === 'security-management' || currentTab === 'security-settings') && (
                currentRole === 'Super Admin' ? (
                  <SecuritySettingsView
                    currentRole={currentRole}
                    onNavigateToTab={(tabId) => setCurrentTab(tabId)}
                  />
                ) : (
                  <Forbidden403View
                    currentRole={currentRole}
                    moduleName="Security Management & Credentials"
                    allowedRoles={['Super Admin']}
                    onReturnToDashboard={() => setCurrentTab('dashboard')}
                  />
                )
              )}

              {currentTab === 'audit' && (
                ['Super Admin', 'Compliance Officer', 'Investigator', 'Auditor'].includes(currentRole) ? (
                  <AuditLogsView vessels={vessels} />
                ) : (
                  <Forbidden403View
                    currentRole={currentRole}
                    moduleName="Immutable Audit Logs"
                    allowedRoles={['Super Admin', 'Compliance Officer', 'Investigator', 'Auditor']}
                    onReturnToDashboard={() => setCurrentTab('dashboard')}
                  />
                )
              )}

              {currentTab === 'ai-copilot' && (
                ['Super Admin', 'Compliance Officer', 'Risk Analyst'].includes(currentRole) ? (
                  <MaritimeAICopilotView
                    vessels={vessels}
                    anomalies={anomalies}
                    alerts={roleAlerts}
                    onSelectVessel={handleOpenVessel}
                    onNavigateToTab={(tabId) => setCurrentTab(tabId)}
                  />
                ) : (
                  <Forbidden403View
                    currentRole={currentRole}
                    moduleName="Maritime AI Copilot"
                    allowedRoles={['Super Admin', 'Compliance Officer', 'Risk Analyst']}
                    onReturnToDashboard={() => setCurrentTab('dashboard')}
                  />
                )
              )}
            </div>
          </main>
        </div>

        {/* Global Search Modal */}
        <GlobalSearchModal
          isOpen={isSearchOpen}
          onClose={() => setIsSearchOpen(false)}
          vessels={vessels}
          alerts={roleAlerts}
          anomalies={canSeeAnomalies ? anomalies : []}
          onSelectVessel={handleOpenDossier}
          onNavigateToTab={(tabId) => setCurrentTab(tabId)}
        />

        {/* System Telemetry Modal */}
        <SystemHealthModal
          isOpen={isHealthOpen}
          onClose={() => setIsHealthOpen(false)}
        />

        {/* Add Vessel Modal */}
        <VesselAddModal
          isOpen={isAddVesselModalOpen}
          onClose={() => setIsAddVesselModalOpen(false)}
          onAddVessel={handleRegisterNewVessel}
        />

        {/* Remove Vessel Confirmation Modal */}
        <VesselRemoveConfirmModal
          isOpen={!!vesselToRemove}
          vessel={vesselToRemove}
          onClose={() => setVesselToRemove(null)}
          onConfirmRemove={handleRemoveVessel}
        />

        {/* Discrete Floating AI Assistant Icon & Interface (Active on every page, visible for authorized roles ONLY) */}
        <MaritimeFloatingAssistant
          vessels={vessels}
          anomalies={anomalies}
          alerts={alerts}
          currentRole={currentRole}
          onSelectVessel={handleOpenVessel}
          onNavigateToTab={(tabId) => setCurrentTab(tabId)}
        />
      </div>
    </FirebaseAuthProvider>
  );
}
