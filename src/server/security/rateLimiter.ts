import { Request, Response, NextFunction } from 'express';

interface RateLimitRecord {
  timestamps: number[];
}

export class SlidingWindowRateLimiter {
  private windowMs: number;
  private maxRequests: number;
  private records: Map<string, RateLimitRecord> = new Map();
  private cleanupInterval: NodeJS.Timeout;

  constructor(windowMs: number, maxRequests: number) {
    this.windowMs = windowMs;
    this.maxRequests = maxRequests;

    // Periodic cleanup of expired records every minute
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, 60000);
    if (this.cleanupInterval.unref) this.cleanupInterval.unref();
  }

  private cleanup(): void {
    const now = Date.now();
    const cutoff = now - this.windowMs;
    for (const [key, record] of this.records.entries()) {
      record.timestamps = record.timestamps.filter((ts) => ts > cutoff);
      if (record.timestamps.length === 0) {
        this.records.delete(key);
      }
    }
  }

  public check(key: string): { allowed: boolean; remaining: number; resetMs: number } {
    const now = Date.now();
    const cutoff = now - this.windowMs;

    let record = this.records.get(key);
    if (!record) {
      record = { timestamps: [] };
      this.records.set(key, record);
    }

    record.timestamps = record.timestamps.filter((ts) => ts > cutoff);

    if (record.timestamps.length >= this.maxRequests) {
      const oldest = record.timestamps[0] || now;
      const resetMs = Math.max(0, oldest + this.windowMs - now);
      return {
        allowed: false,
        remaining: 0,
        resetMs,
      };
    }

    record.timestamps.push(now);
    const resetMs = this.windowMs;
    return {
      allowed: true,
      remaining: this.maxRequests - record.timestamps.length,
      resetMs,
    };
  }

  public middleware(errorMessage = 'Too many requests, please try again later.') {
    return (req: Request, res: Response, next: NextFunction): void => {
      // Key on authenticated user UID if present, fallback to client IP
      const user = (req as any).user;
      const ip = req.ip || req.socket.remoteAddress || '127.0.0.1';
      const key = user?.uid ? `user:${user.uid}` : `ip:${ip}`;

      const { allowed, remaining, resetMs } = this.check(key);

      res.setHeader('RateLimit-Limit', this.maxRequests);
      res.setHeader('RateLimit-Remaining', remaining);
      res.setHeader('RateLimit-Reset', Math.ceil(resetMs / 1000));

      if (!allowed) {
        res.setHeader('Retry-After', Math.ceil(resetMs / 1000));
        res.status(429).json({
          error: errorMessage,
          retryAfterSeconds: Math.ceil(resetMs / 1000),
        });
        return;
      }

      next();
    };
  }

  public dispose(): void {
    clearInterval(this.cleanupInterval);
    this.records.clear();
  }
}

// 1. Strict Auth Limiter: 10 attempts per 15 minutes (prevents brute forcing)
export const authRateLimiter = new SlidingWindowRateLimiter(15 * 60 * 1000, 10);

// 2. AI Intelligence Limiter: 25 queries per minute per user/IP
export const aiRateLimiter = new SlidingWindowRateLimiter(60 * 1000, 25);

// 3. Mutation Limiter (Track / Untrack / Fleet modify): 40 actions per minute
export const mutationRateLimiter = new SlidingWindowRateLimiter(60 * 1000, 40);

// 4. General AIS API Limiter: 300 queries per minute (allows fast map browsing without stutter)
export const generalApiRateLimiter = new SlidingWindowRateLimiter(60 * 1000, 300);

// 5. WebSocket Command Limiter: 20 commands per second per socket connection
export class WebSocketCommandLimiter {
  private timestamps: number[] = [];
  private readonly maxCommandsPerSec: number = 20;

  public allowCommand(): boolean {
    const now = Date.now();
    const cutoff = now - 1000;
    this.timestamps = this.timestamps.filter((ts) => ts > cutoff);
    if (this.timestamps.length >= this.maxCommandsPerSec) {
      return false;
    }
    this.timestamps.push(now);
    return true;
  }
}
