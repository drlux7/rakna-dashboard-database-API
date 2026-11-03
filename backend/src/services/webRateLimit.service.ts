import fs from 'fs';
import path from 'path';

interface IpUsageRecord {
  count: number;
  date: string; // YYYY-MM-DD
  lastUsedAt: string;
}

interface CarBlockRecord {
  status: 'BLOCKED' | 'IGNORED';
  blockedAt: string;
  until?: string;
}

export class WebRateLimitService {
  private static instance: WebRateLimitService;
  public static readonly DAILY_LIMIT = 999999;

  private storeFile: string;
  private cache: Record<string, IpUsageRecord> = {};
  private carBlocks: Record<string, CarBlockRecord> = {}; // key: `${carId}:${ip}`
  private sessionToIp: Record<string, string> = {}; // key: sessionToken -> ip

  private constructor() {
    const dataDir = path.join(process.cwd(), 'data');
    if (!fs.existsSync(dataDir)) {
      try {
        fs.mkdirSync(dataDir, { recursive: true });
      } catch (_) {}
    }
    this.storeFile = path.join(dataDir, 'web_ip_limits.json');
    this.loadStore();
  }

  public static getInstance(): WebRateLimitService {
    if (!WebRateLimitService.instance) {
      WebRateLimitService.instance = new WebRateLimitService();
    }
    return WebRateLimitService.instance;
  }

  /**
   * استخراج وتوحيد عنوان الـ IP
   */
  public normalizeIp(rawIp?: string | null): string {
    if (!rawIp) return '127.0.0.1';
    let ip = rawIp.trim();
    if (ip.startsWith('::ffff:')) {
      ip = ip.substring(7);
    }
    if (ip === '::1' || ip === 'localhost') {
      ip = '127.0.0.1';
    }
    return ip;
  }

  /**
   * استخراج الـ IP بدقة من Express Request مع دعم Reverse Proxies
   */
  public extractIp(req: any): string {
    if (!req) return '127.0.0.1';
    const forwarded = req.headers ? (req.headers['x-forwarded-for'] || req.headers['x-real-ip']) : null;
    if (typeof forwarded === 'string') {
      const first = forwarded.split(',')[0].trim();
      if (first) return this.normalizeIp(first);
    }
    if (Array.isArray(forwarded) && forwarded.length > 0) {
      return this.normalizeIp(forwarded[0]);
    }
    const sockIp = req.socket ? req.socket.remoteAddress : null;
    return this.normalizeIp(sockIp || req.ip || '127.0.0.1');
  }

  /**
   * الحصول على تاريخ اليوم بنسق YYYY-MM-DD
   */
  private getTodayDate(): string {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  /**
   * قراءة السجل من القرص
   */
  private loadStore(): void {
    try {
      if (fs.existsSync(this.storeFile)) {
        const content = fs.readFileSync(this.storeFile, 'utf8');
        const parsed = JSON.parse(content) || {};
        this.cache = parsed.cache || parsed;
        this.carBlocks = parsed.carBlocks || {};
        this.cleanOldRecords();
      }
    } catch (err) {
      this.cache = {};
      this.carBlocks = {};
    }
  }

  /**
   * حفظ السجل على القرص
   */
  private saveStore(): void {
    try {
      const dataToSave = {
        cache: this.cache,
        carBlocks: this.carBlocks,
      };
      fs.writeFileSync(this.storeFile, JSON.stringify(dataToSave, null, 2), 'utf8');
    } catch (err) {
      console.error('[WebRateLimit] Error saving store file:', err);
    }
  }

  /**
   * حذف السجلات القديمة تلقائياً لتوفير المساحة
   */
  private cleanOldRecords(): void {
    const today = this.getTodayDate();
    let changed = false;
    for (const ip of Object.keys(this.cache)) {
      if (this.cache[ip].date !== today) {
        delete this.cache[ip];
        changed = true;
      }
    }

    // Clean expired car blocks
    const now = Date.now();
    for (const key of Object.keys(this.carBlocks)) {
      if (this.carBlocks[key].until && new Date(this.carBlocks[key].until!).getTime() < now) {
        delete this.carBlocks[key];
        changed = true;
      }
    }

    if (changed) {
      this.saveStore();
    }
  }

  /**
   * ربط جلسة المُبلّغ بعنوان الـ IP لحظر أي محاولات تلاعب
   */
  public mapSessionToIp(sessionToken: string, rawIp?: string | null): void {
    if (!sessionToken) return;
    this.sessionToIp[sessionToken] = this.normalizeIp(rawIp);
  }

  public getIpBySession(sessionToken: string): string | null {
    return this.sessionToIp[sessionToken] || null;
  }

  /**
   * حظر أو تجاهل IP لسيارة معينة لمنعه من المراسلة ثانية
   */
  public blockIpForCar(rawIp: string | null | undefined, carId: string, status: 'BLOCKED' | 'IGNORED'): void {
    const ip = this.normalizeIp(rawIp);
    const key = `${carId}:${ip}`;
    const durationHours = status === 'BLOCKED' ? 30 * 24 : 24; // 30 days for BLOCKED, 24 hours for IGNORED
    const until = new Date(Date.now() + durationHours * 3600 * 1000).toISOString();

    this.carBlocks[key] = {
      status,
      blockedAt: new Date().toISOString(),
      until,
    };
    this.saveStore();
  }

  /**
   * التحقق مما إذا كان الـ IP محظوراً أو متجاهلاً لسيارة معينة
   */
  public getCarBlockStatus(rawIp: string | null | undefined, carId: string): 'BLOCKED' | 'IGNORED' | null {
    const ip = this.normalizeIp(rawIp);
    const key = `${carId}:${ip}`;
    const rec = this.carBlocks[key];
    if (!rec) return null;

    if (rec.until && new Date(rec.until).getTime() < Date.now()) {
      delete this.carBlocks[key];
      this.saveStore();
      return null;
    }
    return rec.status;
  }

  /**
   * جلب تفاصيل الاستهلاك لعنوان IP معين
   */
  public getUsage(rawIp?: string | null): {
    count: number;
    maxAllowed: number;
    remaining: number;
    isLimitReached: boolean;
    date: string;
  } {
    const ip = this.normalizeIp(rawIp);
    const today = this.getTodayDate();
    const record = this.cache[ip];

    let count = 0;
    if (record && record.date === today) {
      count = record.count;
    }

    return {
      count,
      maxAllowed: WebRateLimitService.DAILY_LIMIT,
      remaining: 999999,
      isLimitReached: false,
      date: today,
    };
  }

  /**
   * التحقق مما إذا كان مسموحاً لهذا الـ IP بإرسال رسالة سريعة
   */
  public canSendMessage(_rawIp?: string | null): boolean {
    return true; // تم تعطيل الحد اليومي مؤقتاً
  }

  /**
   * زيادة عدد الرسائل المستهلكة لهذا الـ IP بواحد وحفظها فوراً
   */
  public incrementUsage(rawIp?: string | null): {
    count: number;
    maxAllowed: number;
    remaining: number;
    isLimitReached: boolean;
  } {
    const ip = this.normalizeIp(rawIp);
    const today = this.getTodayDate();

    if (!this.cache[ip] || this.cache[ip].date !== today) {
      this.cache[ip] = {
        count: 1,
        date: today,
        lastUsedAt: new Date().toISOString(),
      };
    } else {
      this.cache[ip].count += 1;
      this.cache[ip].lastUsedAt = new Date().toISOString();
    }

    this.saveStore();

    return {
      count: this.cache[ip].count,
      maxAllowed: WebRateLimitService.DAILY_LIMIT,
      remaining: 999999,
      isLimitReached: false,
    };
  }

  /**
   * إعادة ضبط الاستهلاك لـ IP محدد (للاختبار والدعم)
   */
  public resetIp(rawIp?: string | null): void {
    const ip = this.normalizeIp(rawIp);
    delete this.cache[ip];
    this.saveStore();
  }
}

export const webRateLimitService = WebRateLimitService.getInstance();
