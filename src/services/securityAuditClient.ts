import { auth } from './firebase';

export interface ImmutableAuditLogClient {
  id: string;
  sequence: number;
  timestamp: string;
  eventType: string;
  user: string;
  role: string;
  module: string;
  entity: string;
  entityId: string;
  details: Record<string, any>;
  previousState?: string;
  newState?: string;
  ipAddress: string;
  previousHash: string;
  currentHash: string;
  signature: string;
}

export interface SecurityAuditStats {
  totalEvents: number;
  logins: number;
  roleModifications: number;
  vesselMutations: number;
  chainIntegrity: boolean;
}

export interface SecurityAuditReportClient {
  generatedAt: string;
  complianceStandard: string;
  timeRange: {
    from: string;
    to: string;
  };
  chainIntegrity: {
    verified: boolean;
    totalRecords: number;
    corruptedIndex: number | null;
  };
  summary: {
    totalEvents: number;
    totalLogins: number;
    failedLogins: number;
    failedMfaAttempts: number;
    passwordChanges: number;
    roleSwitchEvents: number;
    accessAnomalies: number;
    accountLockouts: number;
  };
  sections: {
    recentLoginAttempts: Array<{
      timestamp: string;
      user: string;
      role: string;
      ipAddress: string;
      status: 'SUCCESS' | 'FAILED' | 'LOCKED';
      details: Record<string, any>;
    }>;
    passwordAndCredentialChanges: Array<{
      timestamp: string;
      user: string;
      action: string;
      entity: string;
      ipAddress: string;
      details: Record<string, any>;
    }>;
    systemAccessAnomalies: Array<{
      timestamp: string;
      user: string;
      type: string;
      severity: 'WARN' | 'CRITICAL';
      description: string;
      ipAddress: string;
      details: Record<string, any>;
    }>;
    roleSwitchingEvents: Array<{
      timestamp: string;
      user: string;
      previousRole: string;
      activeProfile: string;
      reason?: string;
      durationMinutes?: number;
      ipAddress: string;
    }>;
  };
}

class SecurityAuditClient {
  /**
   * Fetches authoritative immutable audit logs from server (Admin only)
   */
  public async getAuditLogs(): Promise<{ logs: ImmutableAuditLogClient[]; isVerified: boolean; error?: string }> {
    try {
      let token = '';
      if (auth.currentUser) {
        token = await auth.currentUser.getIdToken().catch(() => '');
      }

      const res = await fetch('/api/security-audit/logs', {
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      if (!res.ok) {
        if (res.status === 403 || res.status === 401) {
          return {
            logs: [],
            isVerified: false,
            error: 'Access restricted: Immutable security logs are strictly accessible by Super Admin and Compliance Officers.',
          };
        }
        return { logs: [], isVerified: false, error: `Server status: ${res.status}` };
      }

      const data = await res.json();
      return {
        logs: data.logs || [],
        isVerified: Boolean(data.chainIntegrity),
      };
    } catch (err: any) {
      return { logs: [], isVerified: false, error: err.message || 'Network error' };
    }
  }

  /**
   * Records a client-initiated sensitive security event (e.g. login, vessel creation)
   */
  public async recordEvent(event: {
    eventType: string;
    entity: string;
    entityId: string;
    details?: Record<string, any>;
    previousState?: string;
    newState?: string;
  }): Promise<boolean> {
    try {
      let token = '';
      if (auth.currentUser) {
        token = await auth.currentUser.getIdToken().catch(() => '');
      }

      const res = await fetch('/api/security-audit/log', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(event),
      });

      return res.ok;
    } catch {
      return false;
    }
  }

  /**
   * Fetches the automated Security Audit Compliance Report from the server
   */
  public async getComplianceReport(sinceHours = 720): Promise<{ report: SecurityAuditReportClient | null; error?: string }> {
    try {
      let token = '';
      if (auth.currentUser) {
        token = await auth.currentUser.getIdToken().catch(() => '');
      }

      const res = await fetch(`/api/security-audit/compliance-report?sinceHours=${sinceHours}`, {
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      if (!res.ok) {
        return { report: null, error: `Failed to load compliance report (${res.status})` };
      }

      const report = await res.json();
      return { report };
    } catch (err: any) {
      return { report: null, error: err.message || 'Network error fetching report' };
    }
  }

  /**
   * Triggers download of the automated Security Audit Compliance Report (CSV or JSON)
   */
  public async downloadComplianceReport(format: 'csv' | 'json' = 'csv', sinceHours = 720): Promise<boolean> {
    try {
      let token = '';
      if (auth.currentUser) {
        token = await auth.currentUser.getIdToken().catch(() => '');
      }

      const res = await fetch(`/api/security-audit/compliance-report/export?format=${format}&sinceHours=${sinceHours}`, {
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });

      if (!res.ok) return false;

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Nautilus_Security_Audit_Report_${Date.now()}.${format}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      return true;
    } catch {
      return false;
    }
  }
}

export const securityAuditClient = new SecurityAuditClient();
