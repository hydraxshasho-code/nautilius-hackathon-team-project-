import React from 'react';
import {
  Layers,
  AlertOctagon,
  Wind,
  Compass,
  ShieldAlert,
  Anchor,
  Activity,
  Flame,
  Globe,
  X,
  Check,
  RotateCcw,
  Info,
  ExternalLink,
  Eye,
  EyeOff,
  Sparkles,
  Pentagon,
} from 'lucide-react';
import {
  SANCTIONED_ZONES,
  WEATHER_SYSTEMS,
  MAJOR_SHIPPING_LANES,
  MARITIME_RISK_ZONES,
  MAJOR_PORTS,
} from '../../data/maritimeMapData';

export interface MapLayerConfig {
  showSanctionedZones: boolean;
  setShowSanctionedZones: (val: boolean | ((prev: boolean) => boolean)) => void;
  showWeather: boolean;
  setShowWeather: (val: boolean | ((prev: boolean) => boolean)) => void;
  showLanes: boolean;
  setShowLanes: (val: boolean | ((prev: boolean) => boolean)) => void;
  showRiskZones: boolean;
  setShowRiskZones: (val: boolean | ((prev: boolean) => boolean)) => void;
  showPorts: boolean;
  setShowPorts: (val: boolean | ((prev: boolean) => boolean)) => void;
  showWakeTrails: boolean;
  setShowWakeTrails: (val: boolean | ((prev: boolean) => boolean)) => void;
  showHeatmap: boolean;
  setShowHeatmap: (val: boolean | ((prev: boolean) => boolean)) => void;
  showGraticule: boolean;
  setShowGraticule: (val: boolean | ((prev: boolean) => boolean)) => void;
  showGeofences?: boolean;
  setShowGeofences?: (val: boolean | ((prev: boolean) => boolean)) => void;
}

interface MapLayersControlPanelProps {
  isOpen: boolean;
  onClose: () => void;
  config: MapLayerConfig;
}

export const MapLayersControlPanel: React.FC<MapLayersControlPanelProps> = ({
  isOpen,
  onClose,
  config,
}) => {
  if (!isOpen) return null;

  const {
    showSanctionedZones,
    setShowSanctionedZones,
    showWeather,
    setShowWeather,
    showLanes,
    setShowLanes,
    showRiskZones,
    setShowRiskZones,
    showPorts,
    setShowPorts,
    showWakeTrails,
    setShowWakeTrails,
    showHeatmap,
    setShowHeatmap,
    showGraticule,
    setShowGraticule,
    showGeofences,
    setShowGeofences,
  } = config;

  const activeCount = [
    showSanctionedZones,
    showWeather,
    showLanes,
    showRiskZones,
    showPorts,
    showWakeTrails,
    showHeatmap,
    showGraticule,
    showGeofences,
  ].filter(Boolean).length;

  const handleEnableAll = () => {
    setShowSanctionedZones(true);
    setShowWeather(true);
    setShowLanes(true);
    setShowRiskZones(true);
    setShowPorts(true);
    setShowWakeTrails(true);
    setShowHeatmap(true);
    setShowGraticule(true);
  };

  const handleDisableAll = () => {
    setShowSanctionedZones(false);
    setShowWeather(false);
    setShowLanes(false);
    setShowRiskZones(false);
    setShowPorts(false);
    setShowWakeTrails(false);
    setShowHeatmap(false);
    setShowGraticule(false);
  };

  const handlePresetSanctions = () => {
    setShowSanctionedZones(true);
    setShowRiskZones(true);
    setShowLanes(true);
    setShowPorts(true);
    setShowWeather(false);
    setShowHeatmap(false);
  };

  const handlePresetWeather = () => {
    setShowWeather(true);
    setShowLanes(true);
    setShowPorts(true);
    setShowSanctionedZones(false);
    setShowRiskZones(false);
    setShowHeatmap(false);
  };

  const handlePresetStandard = () => {
    setShowSanctionedZones(true);
    setShowWeather(true);
    setShowLanes(true);
    setShowRiskZones(true);
    setShowPorts(true);
    setShowWakeTrails(true);
    setShowHeatmap(false);
    setShowGraticule(true);
  };

  const layers = [
    {
      id: 'sanctioned-zones',
      name: 'Sanctioned Zones & War Embargoes',
      shortName: 'Sanctioned Zones',
      description: `${SANCTIONED_ZONES.length} active OFAC, EU & UN Security Council exclusion and shadow fleet STS perimeters`,
      active: showSanctionedZones,
      toggle: () => setShowSanctionedZones((prev) => !prev),
      icon: AlertOctagon,
      iconColor: 'text-rose-400',
      iconBg: 'bg-rose-500/10 border-rose-500/30',
      badge: 'OFAC / EU / UN',
      badgeColor: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
      accentGlow: 'hover:border-rose-500/40',
      preview: 'Red Sea, Black Sea, Hormuz, DPRK STS, Baltic STS',
    },
    {
      id: 'weather-overlays',
      name: 'Weather Overlays & Storm Systems',
      shortName: 'Weather Overlays',
      description: `${WEATHER_SYSTEMS.length} real-time meteorological hazards with wind knots, wave heights & isobar spirals`,
      active: showWeather,
      toggle: () => setShowWeather((prev) => !prev),
      icon: Wind,
      iconColor: 'text-purple-400',
      iconBg: 'bg-purple-500/10 border-purple-500/30',
      badge: 'Severe Gale & Cyclones',
      badgeColor: 'bg-purple-500/20 text-purple-300 border-purple-500/40',
      accentGlow: 'hover:border-purple-500/40',
      preview: 'Super Typhoon HAIKUI (88 kn), N. Atlantic Gale (54 kn)',
    },
    {
      id: 'shipping-lanes',
      name: 'Major Shipping Corridors & TSS',
      shortName: 'Shipping Lanes',
      description: `${MAJOR_SHIPPING_LANES.length} primary global maritime arterials & Traffic Separation Schemes`,
      active: showLanes,
      toggle: () => setShowLanes((prev) => !prev),
      icon: Compass,
      iconColor: 'text-cyan-400',
      iconBg: 'bg-cyan-500/10 border-cyan-500/30',
      badge: 'TSS Chokepoints',
      badgeColor: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40',
      accentGlow: 'hover:border-cyan-500/40',
      preview: 'Malacca Strait, Suez Bab-el-Mandeb, Hormuz, Panama, Gibraltar',
    },
    {
      id: 'risk-zones',
      name: 'High-Risk & Conflict Zones',
      shortName: 'Risk Zones',
      description: `${MARITIME_RISK_ZONES.length} recognized high-risk conflict, anti-ship strike & piracy areas`,
      active: showRiskZones,
      toggle: () => setShowRiskZones((prev) => !prev),
      icon: ShieldAlert,
      iconColor: 'text-amber-400',
      iconBg: 'bg-amber-500/10 border-amber-500/30',
      badge: 'JWLA-030 Listed',
      badgeColor: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
      accentGlow: 'hover:border-amber-500/40',
      preview: 'Southern Red Sea, Black Sea, Gulf of Guinea, Taiwan Strait',
    },
    {
      id: 'major-ports',
      name: 'Global Container Ports & Terminals',
      shortName: 'Major Ports',
      description: `${MAJOR_PORTS.length} world-class maritime container hubs with UN/LOCODE and TEU rankings`,
      active: showPorts,
      toggle: () => setShowPorts((prev) => !prev),
      icon: Anchor,
      iconColor: 'text-teal-400',
      iconBg: 'bg-teal-500/10 border-teal-500/30',
      badge: 'Tier-1 Hubs',
      badgeColor: 'bg-teal-500/20 text-teal-300 border-teal-500/40',
      accentGlow: 'hover:border-teal-500/40',
      preview: 'SGSIN, NLRTM, CNSHA, USLAX, AEJEA, BEANR, KRPUS',
    },
    {
      id: 'wake-trails',
      name: 'Historical Wake Trails & Vectors',
      shortName: 'Wake Trails',
      description: 'Live vessel SOG and COG heading vectors with trailing wake path breadcrumbs',
      active: showWakeTrails,
      toggle: () => setShowWakeTrails((prev) => !prev),
      icon: Activity,
      iconColor: 'text-emerald-400',
      iconBg: 'bg-emerald-500/10 border-emerald-500/30',
      badge: 'AIS Telemetry',
      badgeColor: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
      accentGlow: 'hover:border-emerald-500/40',
      preview: '30-minute position historical trajectory',
    },
    {
      id: 'traffic-heatmap',
      name: 'Vessel Traffic Density Heatmap',
      shortName: 'Traffic Density',
      description: 'Multi-vessel density clustering gradients and congestion heat signatures',
      active: showHeatmap,
      toggle: () => setShowHeatmap((prev) => !prev),
      icon: Flame,
      iconColor: 'text-orange-400',
      iconBg: 'bg-orange-500/10 border-orange-500/30',
      badge: 'Congestion Map',
      badgeColor: 'bg-orange-500/20 text-orange-300 border-orange-500/40',
      accentGlow: 'hover:border-orange-500/40',
      preview: 'Dynamic density heat shader',
    },
    {
      id: 'nav-graticule',
      name: 'Coordinate Graticule & Nav Grid',
      shortName: 'Nav Graticule',
      description: 'Tactical latitude and longitude degree parallels with Greenwich meridian grid',
      active: showGraticule,
      toggle: () => setShowGraticule((prev) => !prev),
      icon: Globe,
      iconColor: 'text-slate-400',
      iconBg: 'bg-slate-500/10 border-slate-500/30',
      badge: 'WGS84 Grid',
      badgeColor: 'bg-slate-500/20 text-slate-300 border-slate-500/40',
      accentGlow: 'hover:border-slate-500/40',
      preview: '30° parallels & meridians',
    },
    ...(setShowGeofences && showGeofences !== undefined
      ? [
          {
            id: 'geofence-zones',
            name: 'Tactical Geofences & Exclusion Polygons',
            shortName: 'Geofences',
            description: 'Custom polygon perimeters with entry, departure and loitering dwell alerts',
            active: showGeofences,
            toggle: () => setShowGeofences((prev) => !prev),
            icon: Pentagon,
            iconColor: 'text-emerald-400',
            iconBg: 'bg-emerald-500/10 border-emerald-500/30',
            badge: 'Live Demarcation',
            badgeColor: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
            accentGlow: 'hover:border-emerald-500/40',
            preview: 'Bab-el-Mandeb, Singapore TSS, Hormuz Corridor',
          },
        ]
      : []),
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="bg-slate-900 border border-cyan-500/50 rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl shadow-cyan-950/80 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Panel Header */}
        <div className="p-4 sm:p-5 border-b border-slate-800 bg-slate-950/80 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-cyan-500/15 border border-cyan-500/40 text-cyan-400 shadow-inner">
              <Layers className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-white text-base tracking-wide">
                  Tactical Map Layers & Overlays
                </h3>
                <span className="px-2 py-0.5 rounded-full text-xs font-mono font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">
                  {activeCount} of {layers.length} Active
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Toggle geospatial intelligence, compliance embargoes, meteorology & navigation corridors
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            title="Close Layers Panel"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Quick Presets Bar */}
        <div className="px-4 sm:px-5 py-2.5 bg-slate-950/50 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-slate-400 text-[11px] font-mono uppercase tracking-wider flex items-center gap-1 mr-1">
              <Sparkles className="w-3 h-3 text-cyan-400" /> Presets:
            </span>
            <button
              onClick={handlePresetStandard}
              className="px-2.5 py-1 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-[11px] font-medium transition-colors"
            >
              Standard Tactical
            </button>
            <button
              onClick={handlePresetSanctions}
              className="px-2.5 py-1 rounded-md bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/30 text-[11px] font-medium transition-colors"
            >
              Sanctions & Compliance
            </button>
            <button
              onClick={handlePresetWeather}
              className="px-2.5 py-1 rounded-md bg-purple-500/15 hover:bg-purple-500/25 text-purple-300 border border-purple-500/30 text-[11px] font-medium transition-colors"
            >
              Weather & Storms
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleEnableAll}
              className="text-[11px] text-cyan-400 hover:text-cyan-300 font-medium underline-offset-2 hover:underline"
            >
              Enable All
            </button>
            <span className="text-slate-600">·</span>
            <button
              onClick={handleDisableAll}
              className="text-[11px] text-slate-400 hover:text-slate-200 font-medium underline-offset-2 hover:underline"
            >
              Disable All
            </button>
          </div>
        </div>

        {/* Scrollable Layer Toggles List */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-2.5 scrollbar-thin scrollbar-thumb-slate-800">
          {layers.map((layer) => {
            const Icon = layer.icon;
            return (
              <div
                key={layer.id}
                onClick={layer.toggle}
                className={`p-3 sm:p-3.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                  layer.active
                    ? 'bg-slate-950/80 border-slate-700/80 shadow-md ' + layer.accentGlow
                    : 'bg-slate-950/40 border-slate-800/60 opacity-60 hover:opacity-90'
                }`}
              >
                <div className="flex items-start sm:items-center gap-3 min-w-0">
                  <div className={`p-2 sm:p-2.5 rounded-xl border shrink-0 ${layer.iconBg}`}>
                    <Icon className={`w-4 h-4 sm:w-5 sm:h-5 ${layer.iconColor}`} />
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-bold text-white text-xs sm:text-sm tracking-wide">
                        {layer.name}
                      </span>
                      <span
                        className={`text-[10px] font-mono px-2 py-0.2 rounded border ${layer.badgeColor}`}
                      >
                        {layer.badge}
                      </span>
                    </div>
                    <p className="text-[11px] sm:text-xs text-slate-400 mt-0.5 line-clamp-1">
                      {layer.description}
                    </p>
                    <p className="text-[10px] text-slate-500 font-mono mt-0.5">
                      Target: {layer.preview}
                    </p>
                  </div>
                </div>

                {/* Switch Button */}
                <div className="shrink-0 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      layer.toggle();
                    }}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      layer.active ? 'bg-cyan-500 shadow-sm shadow-cyan-500/50' : 'bg-slate-800'
                    }`}
                  >
                    <span
                      aria-hidden="true"
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                        layer.active ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                  <span className="hidden sm:inline-block w-8 text-[11px] font-mono font-bold text-slate-400">
                    {layer.active ? (
                      <span className="text-cyan-400 flex items-center gap-0.5">
                        <Eye className="w-3 h-3" /> ON
                      </span>
                    ) : (
                      <span className="text-slate-500 flex items-center gap-0.5">
                        <EyeOff className="w-3 h-3" /> OFF
                      </span>
                    )}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Panel Footer */}
        <div className="p-3.5 sm:p-4 border-t border-slate-800 bg-slate-950/80 flex items-center justify-between text-xs">
          <div className="flex items-center gap-1.5 text-slate-400 text-[11px]">
            <Info className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
            <span>Layer states persist in real-time tactical 2D and 3D globe views.</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs shadow-md shadow-cyan-950/50 transition-all"
          >
            Apply & Close
          </button>
        </div>
      </div>
    </div>
  );
};
