export type UserRole =
  | 'Super Admin'
  | 'Compliance Officer'
  | 'Risk Analyst'
  | 'Operations Manager'
  | 'Investigator'
  | 'Auditor'
  | 'Vessel Analyst'
  | 'Viewer';

export type SystemFeature =
  | 'vessel_registry'
  | 'dashboard_ais_feed'
  | 'dashboard_priority_risk'
  | 'dashboard_ais_anomalies'
  | 'kyc_aml_compliance'
  | 'ais_anomalies_view'
  | 'reports_view'
  | 'reports_export'
  | 'reports_edit_status'
  | 'onsite_incident_alerts'
  | 'ai_chat_access';

export interface AuthenticatedUser {
  uid: string;
  email?: string;
  displayName?: string;
  role: UserRole;
  isAnonymous?: boolean;
}

export interface WsAuthTicket {
  ticket: string;
  uid: string;
  role: UserRole;
  email?: string;
  expiresAt: number;
}

export interface ServerAuditLogEntry {
  id: string;
  timestamp: string;
  user: string;
  role: UserRole;
  action: string;
  module: string;
  entity: string;
  entityId: string;
  previousState?: string;
  newState?: string;
  ipAddress: string;
  integrityHash: string;
}
