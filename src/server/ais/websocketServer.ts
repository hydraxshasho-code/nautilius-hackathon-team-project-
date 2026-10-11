import { WebSocketServer, WebSocket } from 'ws';
import { IncomingMessage, Server } from 'http';
import { serverAISService } from './aisService';
import { NormalizedAISVessel, WebSocketAISMessage } from './types';
import {
  consumeWsTicket,
  verifyFirebaseIdToken,
} from '../security/auth';
import type { AuthenticatedUser } from '../security/types';
import { WebSocketCommandLimiter } from '../security/rateLimiter';
import { isValidId, isValidImo, isValidMmsi } from '../security/validation';
import { projectFleetForRole, projectVesselForRole } from '../security/dataClassification';
import { securityAuditService } from '../security/SecurityAuditService';

interface AuthenticatedClient {
  ws: WebSocket;
  user: AuthenticatedUser | null;
  ip: string;
  limiter: WebSocketCommandLimiter;
  lastActive: number;
}

export class AISWebSocketServer {
  private wss: WebSocketServer;
  private clients: Map<WebSocket, AuthenticatedClient> = new Map();
  private ipConnections: Map<string, number> = new Map();
  private pingInterval: NodeJS.Timeout | null = null;
  private readonly maxConnectionsPerIp = 20;
  private readonly maxTotalConnections = 500;
  private readonly maxMessageSizeBytes = 16384; // 16KB max payload
  private readonly idleTimeoutMs = 60000; // 60s idle threshold

  constructor() {
    this.wss = new WebSocketServer({ noServer: true });
    this.setupAISListeners();
  }

  public handleUpgrade(req: IncomingMessage, socket: any, head: Buffer): void {
    const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      req.socket.remoteAddress ||
      '127.0.0.1';

    // Connection limits check
    const currentIpCount = this.ipConnections.get(ip) || 0;
    if (currentIpCount >= this.maxConnectionsPerIp || this.clients.size >= this.maxTotalConnections) {
      socket.write('HTTP/1.1 429 Too Many Requests\r\n\r\n');
      socket.destroy();
      return;
    }

    this.wss.handleUpgrade(req, socket, head, (ws) => {
      this.wss.emit('connection', ws, req);
    });
  }

  public initialize(server: Server): void {
    server.on('upgrade', (req, socket, head) => {
      const url = req.url || '';
      if (url.startsWith('/api/ais/ws') || url.startsWith('/ws/ais')) {
        this.handleUpgrade(req, socket, head);
      }
    });

    this.wss.on('connection', async (ws: WebSocket, req: IncomingMessage) => {
      const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
        req.socket.remoteAddress ||
        '127.0.0.1';

      // Track IP connection
      this.ipConnections.set(ip, (this.ipConnections.get(ip) || 0) + 1);

      // Check URL query parameters for short-lived ticket
      let initialUser: AuthenticatedUser | null = null;
      try {
        const fullUrl = new URL(req.url || '', `http://${req.headers.host || 'localhost'}`);
        const ticketParam = fullUrl.searchParams.get('ticket');
        if (ticketParam) {
          initialUser = consumeWsTicket(ticketParam);
        }
      } catch {
        // ignore parse error
      }

      const clientRecord: AuthenticatedClient = {
        ws,
        user: initialUser,
        ip,
        limiter: new WebSocketCommandLimiter(),
        lastActive: Date.now(),
      };
      this.clients.set(ws, clientRecord);

      // Send initial state to newly connected client projected for their role
      const rawFleet = serverAISService.getTrackedVessels();
      const role = initialUser?.role || 'Guest';
      const projectedFleet = projectFleetForRole(rawFleet, role);

      const initialBatch: WebSocketAISMessage = {
        type: 'vessel_batch',
        payload: projectedFleet,
        timestamp: new Date().toISOString(),
      };
      this.safeSend(ws, initialBatch);

      const statusMsg: WebSocketAISMessage = {
        type: 'provider_status',
        payload: serverAISService.getProviderStatus(),
        timestamp: new Date().toISOString(),
      };
      this.safeSend(ws, statusMsg);

      if (initialUser) {
        this.safeSend(ws, {
          type: 'auth_success' as any,
          payload: { uid: initialUser.uid, role: initialUser.role },
          timestamp: new Date().toISOString(),
        });
      }

      ws.on('message', async (data: Buffer | string) => {
        clientRecord.lastActive = Date.now();

        // 1. Enforce payload size limit
        const byteLength = typeof data === 'string' ? Buffer.byteLength(data) : data.length;
        if (byteLength > this.maxMessageSizeBytes) {
          this.safeSend(ws, {
            type: 'error' as any,
            payload: { message: 'Message size exceeds maximum allowed limit (16KB)' },
            timestamp: new Date().toISOString(),
          });
          return;
        }

        // 2. Enforce per-socket command rate limiter
        if (!clientRecord.limiter.allowCommand()) {
          this.safeSend(ws, {
            type: 'error' as any,
            payload: { message: 'Command rate limit exceeded. Please pace requests.' },
            timestamp: new Date().toISOString(),
          });
          return;
        }

        try {
          const msg = JSON.parse(data.toString());
          if (!msg || typeof msg !== 'object') return;

          // 3. Command: Authenticate connection
          if (msg.type === 'auth') {
            let authenticatedUser: AuthenticatedUser | null = null;
            if (msg.ticket && typeof msg.ticket === 'string') {
              authenticatedUser = consumeWsTicket(msg.ticket);
            } else if (msg.token && typeof msg.token === 'string') {
              authenticatedUser = await verifyFirebaseIdToken(msg.token);
            }

            if (authenticatedUser) {
              clientRecord.user = authenticatedUser;
              this.safeSend(ws, {
                type: 'auth_success' as any,
                payload: { uid: authenticatedUser.uid, role: authenticatedUser.role },
                timestamp: new Date().toISOString(),
              });

              // Send freshly authorized full intelligence fleet batch
              const authorizedFleet = projectFleetForRole(
                serverAISService.getTrackedVessels(),
                authenticatedUser.role
              );
              this.safeSend(ws, {
                type: 'vessel_batch',
                payload: authorizedFleet,
                timestamp: new Date().toISOString(),
              });
            } else {
              this.safeSend(ws, {
                type: 'auth_error' as any,
                payload: { message: 'Authentication ticket or token is invalid or expired' },
                timestamp: new Date().toISOString(),
              });
            }
            return;
          }

          // 4. Command: Ping
          if (msg.type === 'ping') {
            this.safeSend(ws, { type: 'pong', timestamp: new Date().toISOString() });
            return;
          }

          // 5. Command: Track Vessel
          if (msg.type === 'track_vessel' && msg.identifier) {
            const rawId = String(msg.identifier).trim();
            if (!isValidImo(rawId) && !isValidMmsi(rawId) && !isValidId(rawId)) {
              this.safeSend(ws, {
                type: 'error' as any,
                payload: { message: 'Invalid vessel identifier. Must be valid IMO or MMSI.' },
                timestamp: new Date().toISOString(),
              });
              return;
            }

            // Authorization check: User must be authenticated with authorized role
            const userRole = clientRecord.user?.role;
            const canTrack = [
              'Super Admin',
              'Compliance Officer',
              'Risk Analyst',
              'Operations Manager',
              'Vessel Analyst',
            ].includes(userRole || '');

            if (!canTrack) {
              this.safeSend(ws, {
                type: 'error' as any,
                payload: {
                  message: 'Authentication with Operator or Analyst privileges required to track vessels.',
                },
                timestamp: new Date().toISOString(),
              });
              return;
            }

            const res = await serverAISService.startTracking(rawId);
            securityAuditService.logVesselMutation(
              'TRACKED',
              rawId,
              (res as any)?.vessel?.name || rawId,
              clientRecord.user?.uid || 'unknown',
              clientRecord.user?.role || 'Viewer',
              { wsCommand: true, resultSuccess: res.success },
              clientRecord.ip
            );

            this.safeSend(ws, {
              type: 'search_result',
              payload: res,
              timestamp: new Date().toISOString(),
            });
            return;
          }

          // 6. Command: Untrack Vessel
          if (msg.type === 'untrack_vessel' && msg.identifier) {
            const rawId = String(msg.identifier).trim();
            if (!isValidImo(rawId) && !isValidMmsi(rawId) && !isValidId(rawId)) {
              this.safeSend(ws, {
                type: 'error' as any,
                payload: { message: 'Invalid vessel identifier' },
                timestamp: new Date().toISOString(),
              });
              return;
            }

            const userRole = clientRecord.user?.role;
            const canUntrack = [
              'Super Admin',
              'Compliance Officer',
              'Operations Manager',
            ].includes(userRole || '');

            if (!canUntrack) {
              this.safeSend(ws, {
                type: 'error' as any,
                payload: {
                  message: 'Authentication with Operator or Compliance privileges required to untrack vessels.',
                },
                timestamp: new Date().toISOString(),
              });
              return;
            }

            const ok = serverAISService.stopTracking(rawId);
            securityAuditService.logVesselMutation(
              'UNTRACKED',
              rawId,
              rawId,
              clientRecord.user?.uid || 'unknown',
              clientRecord.user?.role || 'Viewer',
              { wsCommand: true, success: ok },
              clientRecord.ip
            );

            this.safeSend(ws, {
              type: 'vessel_removed',
              payload: { id: rawId, success: ok },
              timestamp: new Date().toISOString(),
            });
            return;
          }

          // 7. Command: Get Tracked Fleet
          if (msg.type === 'get_tracked') {
            const fleet = serverAISService.getTrackedVessels();
            const projected = projectFleetForRole(fleet, clientRecord.user?.role || 'Guest');
            this.safeSend(ws, {
              type: 'vessel_batch',
              payload: projected,
              timestamp: new Date().toISOString(),
            });
            return;
          }
        } catch {
          // ignore malformed client message safely without terminating socket
        }
      });

      const handleClose = () => {
        this.clients.delete(ws);
        const current = this.ipConnections.get(ip) || 1;
        if (current <= 1) {
          this.ipConnections.delete(ip);
        } else {
          this.ipConnections.set(ip, current - 1);
        }
      };

      ws.on('close', handleClose);
      ws.on('error', handleClose);
    });

    // Heartbeat & Idle connection reaper loop every 20s
    this.pingInterval = setInterval(() => {
      const now = Date.now();
      const pingMsg: WebSocketAISMessage = {
        type: 'pong',
        payload: { heartbeat: true },
        timestamp: new Date().toISOString(),
      };

      for (const [ws, client] of this.clients.entries()) {
        if (ws.readyState === WebSocket.OPEN) {
          // Check for dead / idle connection
          if (now - client.lastActive > this.idleTimeoutMs * 2) {
            ws.close(1000, 'Idle timeout');
            continue;
          }
          this.safeSend(ws, pingMsg);
        }
      }
    }, 20000);
  }

  private setupAISListeners(): void {
    serverAISService.on('vessel_batch', (fleet: NormalizedAISVessel[]) => {
      for (const [ws, client] of this.clients.entries()) {
        if (ws.readyState === WebSocket.OPEN) {
          const projected = projectFleetForRole(fleet, client.user?.role || 'Guest');
          this.safeSend(ws, {
            type: 'vessel_batch',
            payload: projected,
            timestamp: new Date().toISOString(),
          });
        }
      }
    });

    serverAISService.on('vessel_update', (vessel: NormalizedAISVessel) => {
      for (const [ws, client] of this.clients.entries()) {
        if (ws.readyState === WebSocket.OPEN) {
          const projected = projectVesselForRole(vessel, client.user?.role || 'Guest');
          this.safeSend(ws, {
            type: 'vessel_update',
            payload: projected,
            timestamp: new Date().toISOString(),
          });
        }
      }
    });

    serverAISService.on('vessel_added', (vessel: NormalizedAISVessel) => {
      for (const [ws, client] of this.clients.entries()) {
        if (ws.readyState === WebSocket.OPEN) {
          const projected = projectVesselForRole(vessel, client.user?.role || 'Guest');
          this.safeSend(ws, {
            type: 'vessel_update',
            payload: projected,
            timestamp: new Date().toISOString(),
          });
        }
      }
    });

    serverAISService.on('vessel_removed', (info: any) => {
      const msg: WebSocketAISMessage = {
        type: 'vessel_removed',
        payload: info,
        timestamp: new Date().toISOString(),
      };
      this.broadcast(msg);
    });

    serverAISService.on('tracked_list_change', (fleet: NormalizedAISVessel[]) => {
      for (const [ws, client] of this.clients.entries()) {
        if (ws.readyState === WebSocket.OPEN) {
          const projected = projectFleetForRole(fleet, client.user?.role || 'Guest');
          this.safeSend(ws, {
            type: 'vessel_batch',
            payload: projected,
            timestamp: new Date().toISOString(),
          });
        }
      }
    });
  }

  private safeSend(ws: WebSocket, msg: WebSocketAISMessage): void {
    if (ws.readyState === WebSocket.OPEN) {
      try {
        ws.send(JSON.stringify(msg));
      } catch {
        // ignore send error
      }
    }
  }

  public broadcast(msg: WebSocketAISMessage): void {
    const json = JSON.stringify(msg);
    for (const ws of this.clients.keys()) {
      if (ws.readyState === WebSocket.OPEN) {
        try {
          ws.send(json);
        } catch {
          this.clients.delete(ws);
        }
      }
    }
  }

  public dispose(): void {
    if (this.pingInterval) clearInterval(this.pingInterval);
    for (const ws of this.clients.keys()) {
      ws.close();
    }
    this.clients.clear();
    this.ipConnections.clear();
    this.wss.close();
  }
}

export const aisWebSocketServer = new AISWebSocketServer();
