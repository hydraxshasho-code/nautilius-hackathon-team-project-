import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged, User } from 'firebase/auth';
import {
  getFirestore,
  doc,
  getDocFromServer,
  collection,
  getDocs,
  setDoc,
  deleteDoc,
  onSnapshot,
  writeBatch,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import { Vessel } from '../types/maritime';

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// CRITICAL: The app will break without specifying firestoreDatabaseId
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Startup connection verification
export async function testFirestoreConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn('Firestore offline / check connection:', error.message);
    }
  }
}

// Helper to recursively strip undefined values to ensure 100% Firestore schema compliance
export function removeUndefinedValues<T = any>(obj: T): T {
  if (obj === null || obj === undefined) return null as any;
  if (Array.isArray(obj)) {
    return obj.map((item) => removeUndefinedValues(item)) as any;
  }
  if (typeof obj === 'object') {
    const cleanObj: Record<string, any> = {};
    for (const [key, value] of Object.entries(obj)) {
      if (value !== undefined) {
        cleanObj[key] = removeUndefinedValues(value);
      }
    }
    return cleanObj as any;
  }
  return obj;
}

// Deduplicated error logger to prevent console flooding
const recentFirestoreErrors = new Map<string, number>();
function logFirestoreNotice(action: string, error: any) {
  const msg = error instanceof Error ? error.message : String(error);
  const key = `${action}:${msg}`;
  const now = Date.now();
  const lastTime = recentFirestoreErrors.get(key) || 0;
  if (now - lastTime > 30000) {
    recentFirestoreErrors.set(key, now);
    console.warn(`[Firestore ${action} Notice]`, msg);
  }
}

// Clean vessel data to conform to Firestore rules schema
export function sanitizeVesselForFirestore(vessel: Partial<Vessel>): Record<string, any> {
  const mmsiClean = String(vessel.mmsi || '').replace(/[^a-zA-Z0-9_-]/g, '');
  const imoClean = String(vessel.imo || '').replace(/[^a-zA-Z0-9_-]/g, '');
  const uniqueId = String(
    vessel.id ||
      (mmsiClean ? `mmsi-${mmsiClean}` : imoClean ? `imo-${imoClean}` : `vessel-${Date.now()}`)
  );

  const clean: Record<string, any> = {
    id: uniqueId,
    name: String(vessel.name || 'VESSEL').substring(0, 100),
    imo: String(vessel.imo || (imoClean || '9000000')).substring(0, 32),
    mmsi: String(vessel.mmsi || (mmsiClean || '100000000')).substring(0, 32),
    lat: Number(Number(vessel.lat ?? 0).toFixed(5)),
    lon: Number(Number(vessel.lon ?? 0).toFixed(5)),
    speed: Number(Math.max(0, Math.min(150, Number(vessel.speed ?? 12))).toFixed(1)),
    course: Number(Math.round(((Number(vessel.course ?? 0) % 360) + 360) % 360)),
    heading: Number(Math.round(((Number(vessel.heading ?? 0) % 360) + 360) % 360)),
    navStatus: String(vessel.navStatus || 'Under way using engine').substring(0, 64),
    riskLevel: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].includes(vessel.riskLevel || '')
      ? vessel.riskLevel
      : 'LOW',
    riskScore: Number(Math.max(0, Math.min(100, Number(vessel.riskScore ?? 15))).toFixed(0)),
  };

  // Optional string fields with max length
  if (vessel.callSign) clean.callSign = String(vessel.callSign).substring(0, 32);
  if (vessel.type) clean.type = String(vessel.type).substring(0, 64);
  if (vessel.flag) clean.flag = String(vessel.flag).substring(0, 64);
  if (vessel.flagCode) clean.flagCode = String(vessel.flagCode).substring(0, 8);
  if (vessel.destination) clean.destination = String(vessel.destination).substring(0, 100);
  if (vessel.destinationPortCode) clean.destinationPortCode = String(vessel.destinationPortCode).substring(0, 16);
  if (vessel.origin) clean.origin = String(vessel.origin).substring(0, 100);
  if (vessel.originPortCode) clean.originPortCode = String(vessel.originPortCode).substring(0, 16);
  if (vessel.eta) clean.eta = String(vessel.eta).substring(0, 64);
  if (vessel.timestamp) clean.timestamp = String(vessel.timestamp).substring(0, 64);
  if (vessel.aisSource) clean.aisSource = String(vessel.aisSource).substring(0, 32);
  if (vessel.dataQuality) clean.dataQuality = String(vessel.dataQuality).substring(0, 32);
  if (vessel.classificationSociety) clean.classificationSociety = String(vessel.classificationSociety).substring(0, 64);
  if (vessel.owner) clean.owner = String(vessel.owner).substring(0, 128);
  if (vessel.operator) clean.operator = String(vessel.operator).substring(0, 128);
  if (vessel.manager) clean.manager = String(vessel.manager).substring(0, 128);
  if (vessel.beneficialOwner) clean.beneficialOwner = String(vessel.beneficialOwner).substring(0, 128);
  if (vessel.kycStatus) clean.kycStatus = String(vessel.kycStatus).substring(0, 32);
  if (vessel.amlStatus) clean.amlStatus = String(vessel.amlStatus).substring(0, 32);

  // Optional numbers
  if (vessel.prevLat !== undefined) clean.prevLat = Number(vessel.prevLat);
  if (vessel.prevLon !== undefined) clean.prevLon = Number(vessel.prevLon);
  if (vessel.length !== undefined) clean.length = Number(vessel.length);
  if (vessel.beam !== undefined) clean.beam = Number(vessel.beam);
  if (vessel.draught !== undefined) clean.draught = Number(vessel.draught);
  if (vessel.grossTonnage !== undefined) clean.grossTonnage = Number(vessel.grossTonnage);
  if (vessel.deadweightTonnage !== undefined) clean.deadweightTonnage = Number(vessel.deadweightTonnage);
  if (vessel.yearBuilt !== undefined) clean.yearBuilt = Number(vessel.yearBuilt);
  if (vessel.totalDistanceNm !== undefined) clean.totalDistanceNm = Number(vessel.totalDistanceNm);
  if (vessel.distanceTraveledNm !== undefined) clean.distanceTraveledNm = Number(vessel.distanceTraveledNm);
  if (vessel.anomaliesDetected !== undefined) clean.anomaliesDetected = Number(vessel.anomaliesDetected);
  if (vessel.lastUpdatedSecondsAgo !== undefined) clean.lastUpdatedSecondsAgo = Number(vessel.lastUpdatedSecondsAgo);

  // Optional booleans
  if (vessel.isTransmitting !== undefined) clean.isTransmitting = Boolean(vessel.isTransmitting);
  if (vessel.isStale !== undefined) clean.isStale = Boolean(vessel.isStale);

  // Historical track
  if (Array.isArray(vessel.historicalTrack)) {
    clean.historicalTrack = vessel.historicalTrack.slice(-30).map((pt) => ({
      lat: Number(pt.lat),
      lon: Number(pt.lon),
      timestamp: String(pt.timestamp || ''),
      speed: Number(pt.speed || 0),
      course: Number(pt.course || 0),
      heading: Number(pt.heading || 0),
    }));
  }

  // Predicted track: MUST be flat objects with { lat, lon }, NEVER nested arrays!
  if (Array.isArray(vessel.predictedTrack)) {
    clean.predictedTrack = vessel.predictedTrack.map((pt: any) => {
      if (Array.isArray(pt)) {
        return { lat: Number(pt[0] ?? 0), lon: Number(pt[1] ?? 0) };
      }
      return { lat: Number(pt?.lat ?? 0), lon: Number(pt?.lon ?? 0) };
    });
  }

  // Ownership structure
  if (Array.isArray(vessel.ownershipStructure)) {
    clean.ownershipStructure = vessel.ownershipStructure.map((node) => ({
      name: String(node.name || ''),
      role: String(node.role || 'Operating Company'),
      country: String(node.country || ''),
      registrationNumber: String(node.registrationNumber || ''),
      sanctionStatus: String(node.sanctionStatus || 'CLEARED'),
      sharePercentage: node.sharePercentage !== undefined ? Number(node.sharePercentage) : 100,
    }));
  }

  // Port calls
  if (Array.isArray(vessel.portCalls)) {
    clean.portCalls = vessel.portCalls.map((pc) => {
      const callObj: Record<string, any> = {
        portName: String(pc.portName || ''),
        country: String(pc.country || ''),
        arrival: String(pc.arrival || ''),
        departure: String(pc.departure || ''),
        status: String(pc.status || 'Completed'),
      };
      if (pc.draughtArrival !== undefined && pc.draughtArrival !== null) {
        callObj.draughtArrival = Number(pc.draughtArrival);
      }
      if (pc.draughtDeparture !== undefined && pc.draughtDeparture !== null) {
        callObj.draughtDeparture = Number(pc.draughtDeparture);
      }
      return callObj;
    });
  }

  // Risk breakdown
  if (vessel.riskBreakdown) {
    clean.riskBreakdown = {
      vesselRisk: Number(vessel.riskBreakdown.vesselRisk ?? 10),
      ownershipRisk: Number(vessel.riskBreakdown.ownershipRisk ?? 10),
      amlRisk: Number(vessel.riskBreakdown.amlRisk ?? 10),
      sanctionsRisk: Number(vessel.riskBreakdown.sanctionsRisk ?? 10),
      routeRisk: Number(vessel.riskBreakdown.routeRisk ?? 10),
      aisRisk: Number(vessel.riskBreakdown.aisRisk ?? 10),
      portRisk: Number(vessel.riskBreakdown.portRisk ?? 10),
      documentationRisk: Number(vessel.riskBreakdown.documentationRisk ?? 10),
      behavioralRisk: Number(vessel.riskBreakdown.behavioralRisk ?? 10),
    };
  }

  // Risk evidence
  if (Array.isArray(vessel.riskEvidence)) {
    clean.riskEvidence = vessel.riskEvidence.map((e) => String(e));
  }

  if (vessel.amlMatchConfidence !== undefined) {
    clean.amlMatchConfidence = Number(vessel.amlMatchConfidence);
  }

  return removeUndefinedValues(clean);
}

// Persistent Firestore API for Real-Time Fleet Sharing
export async function initializeFirestoreVessels(): Promise<Vessel[]> {
  const vesselsPath = 'vessels';
  try {
    const snapshot = await getDocs(collection(db, vesselsPath));
    if (!snapshot.empty) {
      const liveVessels: Vessel[] = [];
      snapshot.forEach((docSnap) => {
        liveVessels.push(docSnap.data() as Vessel);
      });
      // Cache last known Firestore state
      try {
        localStorage.setItem('nautilus_firestore_vessels_cache', JSON.stringify(liveVessels));
      } catch {
        // ignore
      }
      return liveVessels;
    }

    // Collection is empty: return empty array. NEVER auto-seed or restore demo/default data!
    try {
      localStorage.setItem('nautilus_firestore_vessels_cache', JSON.stringify([]));
    } catch {
      // ignore
    }
    return [];
  } catch (error) {
    console.warn('Notice: Firestore fleet fetch failed, attempting cached Firestore data:', error);
    try {
      const cached = localStorage.getItem('nautilus_firestore_vessels_cache');
      if (cached) return JSON.parse(cached);
    } catch {
      // ignore
    }
    return [];
  }
}

// Real-time snapshot listener across all users
export function subscribeToFirestoreVessels(
  onUpdate: (vessels: Vessel[]) => void,
  onError?: (err: Error) => void
): () => void {
  const vesselsPath = 'vessels';
  return onSnapshot(
    collection(db, vesselsPath),
    (snapshot) => {
      const vessels: Vessel[] = [];
      snapshot.forEach((d) => {
        vessels.push(d.data() as Vessel);
      });
      // Always cache to localStorage to preserve across page refreshes and offline states
      try {
        localStorage.setItem('nautilus_firestore_vessels_cache', JSON.stringify(vessels));
      } catch {
        // ignore
      }
      onUpdate(vessels);
    },
    (error) => {
      console.warn('Firestore vessels snapshot listener status:', error.message);
      if (onError) onError(error);
    }
  );
}

// Permanent write for newly added vessel
export async function persistNewVessel(vessel: Vessel): Promise<void> {
  const path = `vessels/${vessel.id}`;
  try {
    const clean = sanitizeVesselForFirestore(vessel);
    await setDoc(doc(db, 'vessels', vessel.id), clean);
  } catch (error) {
    logFirestoreNotice(`persistNewVessel(${path})`, error);
  }
}

// Permanent removal of vessel from Firestore
export async function persistRemoveVessel(vesselId: string): Promise<void> {
  const path = `vessels/${vesselId}`;
  try {
    await deleteDoc(doc(db, 'vessels', vesselId));
  } catch (error) {
    logFirestoreNotice(`persistRemoveVessel(${path})`, error);
  }
}

// Periodic synchronization of live moving positions
export async function persistVesselTelemetryBatch(vessels: Vessel[]): Promise<void> {
  if (vessels.length === 0) return;
  try {
    const batch = writeBatch(db);
    // Persist a slice of moving/active vessels to prevent high write bursts
    const toUpdate = vessels.slice(0, 10);
    for (const v of toUpdate) {
      const clean = sanitizeVesselForFirestore(v);
      batch.set(doc(db, 'vessels', v.id), clean, { merge: true });
    }
    await batch.commit();
  } catch (error) {
    logFirestoreNotice('persistVesselTelemetryBatch', error);
  }
}

// Auth Helpers
let inFlightLoginPromise: Promise<User | null> | null = null;

export async function loginWithGoogle(): Promise<User | null> {
  if (inFlightLoginPromise) {
    return inFlightLoginPromise;
  }

  inFlightLoginPromise = (async () => {
    try {
      const result = await signInWithPopup(auth, googleProvider);
      return result.user;
    } catch (error: any) {
      const code = error?.code || '';
      const msg = error?.message || String(error);

      // Handle user voluntarily closing popup, browser blocking popup in iframe, or Firebase internal assertion race condition
      if (
        code === 'auth/popup-closed-by-user' ||
        code === 'auth/cancelled-popup-request' ||
        code === 'auth/popup-blocked' ||
        msg.includes('INTERNAL ASSERTION FAILED') ||
        msg.includes('Pending promise was never set')
      ) {
        console.warn('Google sign-in popup handled gracefully:', code || msg);
        return null;
      }
      console.warn('Google Sign-in status notice:', msg);
      return null;
    } finally {
      setTimeout(() => {
        inFlightLoginPromise = null;
      }, 500);
    }
  })();

  return inFlightLoginPromise;
}

export async function logoutUser(): Promise<void> {
  try {
    await signOut(auth);
  } catch (error) {
    console.error('Logout failed:', error);
    throw error;
  }
}

export function subscribeToAuth(callback: (user: User | null) => void): () => void {
  return onAuthStateChanged(auth, callback);
}

// Persistent Chat Sessions in Firestore
export interface SavedChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'model';
  content: string;
  timestamp: string;
  model?: string;
  groundingPlaces?: {
    title: string;
    uri: string;
    reviewSnippets?: string[];
  }[];
  mapsPlaces?: {
    title: string;
    uri: string;
    reviewSnippets?: string[];
  }[];
}

export interface SavedChatSession {
  id: string;
  title: string;
  systemRole: string;
  model: string;
  enableMaps?: boolean;
  messages: SavedChatMessage[];
  updatedAt: string;
  createdAt?: string;
}

export async function persistChatSession(userId: string, session: SavedChatSession): Promise<void> {
  if (!userId || !session.id) return;
  const path = `users/${userId}/chats/${session.id}`;
  try {
    await setDoc(doc(db, 'users', userId, 'chats', session.id), {
      id: session.id,
      title: session.title || 'Maritime Intelligence Inquiry',
      systemRole: session.systemRole || 'compliance_officer',
      model: session.model || 'gemini-3.5-flash',
      enableMaps: Boolean(session.enableMaps),
      messages: session.messages || [],
      updatedAt: session.updatedAt || new Date().toISOString(),
    });
  } catch (error) {
    console.warn('Notice persisting chat session to Firestore:', error);
  }
}

export async function fetchUserChatSessions(userId: string): Promise<SavedChatSession[]> {
  if (!userId) return [];
  try {
    const snap = await getDocs(collection(db, 'users', userId, 'chats'));
    const sessions: SavedChatSession[] = [];
    snap.forEach((d) => {
      sessions.push(d.data() as SavedChatSession);
    });
    return sessions.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  } catch (error) {
    console.warn('Notice loading chat sessions from Firestore:', error);
    return [];
  }
}

export async function removeUserChatSession(userId: string, sessionId: string): Promise<void> {
  if (!userId || !sessionId) return;
  try {
    await deleteDoc(doc(db, 'users', userId, 'chats', sessionId));
  } catch (error) {
    console.warn('Notice deleting chat session from Firestore:', error);
  }
}

