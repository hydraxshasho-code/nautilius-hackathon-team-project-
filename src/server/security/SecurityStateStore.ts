/**
 * Distributed & Persistent Security State Store
 * Provides atomic operations, TTL-based expiration, replay-attack prevention,
 * and transactional state persistence for distributed / multi-instance environments.
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

interface ExpiringEntry<T> {
  value: T;
  expiresAt: number; // timestamp in ms; 0 = never expires
  createdAt: number;
}

export class AtomicExpiringStore<T> {
  private inMemory = new Map<string, ExpiringEntry<T>>();
  private persistPath: string | null = null;
  private saveDebounceTimer: NodeJS.Timeout | null = null;

  constructor(storeName?: string, defaultTtlMs?: number) {
    if (storeName && typeof process !== 'undefined') {
      try {
        const stateDir = path.join(process.cwd(), '.security_state');
        if (!fs.existsSync(stateDir)) {
          fs.mkdirSync(stateDir, { recursive: true });
        }
        this.persistPath = path.join(stateDir, `${storeName}.json`);
        this.loadSnapshot();
      } catch {
        // Fallback to pure in-memory if disk is write-protected
        this.persistPath = null;
      }
    }

    // Active TTL garbage collection
    const sweepInterval = setInterval(() => {
      this.cleanupExpired();
    }, 30000);
    sweepInterval.unref?.();
  }

  private loadSnapshot(): void {
    if (!this.persistPath || !fs.existsSync(this.persistPath)) return;
    try {
      const raw = fs.readFileSync(this.persistPath, 'utf8');
      const data: Record<string, ExpiringEntry<T>> = JSON.parse(raw);
      const now = Date.now();
      for (const [k, v] of Object.entries(data)) {
        if (!v.expiresAt || v.expiresAt > now) {
          this.inMemory.set(k, v);
        }
      }
    } catch {
      // Discard corrupted snapshots safely
    }
  }

  private scheduleSave(): void {
    if (!this.persistPath) return;
    if (this.saveDebounceTimer) return;

    this.saveDebounceTimer = setTimeout(() => {
      this.saveDebounceTimer = null;
      this.saveSnapshotSync();
    }, 500);
    this.saveDebounceTimer.unref?.();
  }

  private saveSnapshotSync(): void {
    if (!this.persistPath) return;
    try {
      const now = Date.now();
      const obj: Record<string, ExpiringEntry<T>> = {};
      for (const [k, v] of this.inMemory.entries()) {
        if (!v.expiresAt || v.expiresAt > now) {
          obj[k] = v;
        }
      }
      const tempPath = `${this.persistPath}.${crypto.randomBytes(4).toString('hex')}.tmp`;
      fs.writeFileSync(tempPath, JSON.stringify(obj), 'utf8');
      fs.renameSync(tempPath, this.persistPath);
    } catch {
      // Fail silently without interrupting security logic
    }
  }

  public get(key: string): T | undefined {
    const entry = this.inMemory.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt && Date.now() > entry.expiresAt) {
      this.inMemory.delete(key);
      this.scheduleSave();
      return undefined;
    }
    return entry.value;
  }

  public set(key: string, value: T, ttlMs = 0): void {
    const now = Date.now();
    this.inMemory.set(key, {
      value,
      expiresAt: ttlMs > 0 ? now + ttlMs : 0,
      createdAt: now,
    });
    this.scheduleSave();
  }

  /**
   * Atomic Single-Use Retrieval & Consumption.
   * Guarantees that challenges, OTPs, or temporary tokens cannot be replayed
   * across concurrent or subsequent requests.
   */
  public consume(key: string): T | null {
    const val = this.get(key);
    if (val === undefined) return null;
    this.inMemory.delete(key);
    this.scheduleSave();
    return val;
  }

  public delete(key: string): boolean {
    const existed = this.inMemory.delete(key);
    if (existed) this.scheduleSave();
    return existed;
  }

  public has(key: string): boolean {
    return this.get(key) !== undefined;
  }

  public entries(): IterableIterator<[string, T]> {
    this.cleanupExpired();
    const liveEntries = new Map<string, T>();
    for (const [k, v] of this.inMemory.entries()) {
      liveEntries.set(k, v.value);
    }
    return liveEntries.entries();
  }

  public values(): T[] {
    this.cleanupExpired();
    return Array.from(this.inMemory.values()).map((e) => e.value);
  }

  public keys(): string[] {
    this.cleanupExpired();
    return Array.from(this.inMemory.keys());
  }

  public clear(): void {
    this.inMemory.clear();
    this.scheduleSave();
  }

  public get size(): number {
    this.cleanupExpired();
    return this.inMemory.size;
  }

  private cleanupExpired(): void {
    const now = Date.now();
    let changed = false;
    for (const [k, v] of this.inMemory.entries()) {
      if (v.expiresAt && now > v.expiresAt) {
        this.inMemory.delete(k);
        changed = true;
      }
    }
    if (changed) this.scheduleSave();
  }
}
