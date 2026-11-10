import { Request, Response } from 'express';
import QRCode from 'qrcode';
import { prisma } from '../config/prisma';
import { webRateLimitService } from '../services/webRateLimit.service';

export class WebChatController {
  /**
   * Render the public stranger web chat page for a tag
   * GET /t/:tagCode
   */
  static async renderTagPage(req: Request, res: Response): Promise<void> {
    try {
      const rawTag = (req.params.tagCode as string) || '';
      const cleanTag = rawTag.startsWith('#') ? rawTag : `#${rawTag}`;

      // 0. Detect Operating System / Device Type:
      // Allow phones and tablets (Android, iOS, iPadOS, etc.)
      // Block desktop computers (Windows, Mac, Linux Desktop)
      const userAgent = (req.headers['user-agent'] as string) || '';
      const uaLower = userAgent.toLowerCase();

      const isExplicitMobileOrTablet =
        /android|iphone|ipad|ipod|windows phone|iemobile|mobile|tablet|harmonyos|silk|kindle/i.test(userAgent);

      const isDesktopUA =
        !isExplicitMobileOrTablet &&
        (uaLower.includes('windows nt') ||
          uaLower.includes('win64') ||
          uaLower.includes('wow64') ||
          uaLower.includes('win32') ||
          (uaLower.includes('macintosh') && !uaLower.includes('iphone') && !uaLower.includes('ipad')) ||
          (uaLower.includes('linux') && !uaLower.includes('android')) ||
          uaLower.includes('cros'));

      const isForceMobile = req.query.force_mobile === '1';
      const isGuardRequested = req.query.guard === 'desktop';

      if ((isDesktopUA || isGuardRequested) && !isForceMobile) {
        const protocol = req.headers['x-forwarded-proto'] || req.protocol || 'https';
        const host = req.get('host') || 'rakna.tech';
        const pageUrl = `${protocol}://${host}/t/${encodeURIComponent(rawTag)}`;

        let qrCodeDataUrl = '';
        try {
          qrCodeDataUrl = await QRCode.toDataURL(pageUrl, {
            margin: 1,
            scale: 6,
            color: { dark: '#000000', light: '#FFFFFF' },
          });
        } catch (_) {}

        const desktopGuardHtml = WebChatController.buildDesktopGuardHtml(pageUrl, qrCodeDataUrl);
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.send(desktopGuardHtml);
        return;
      }

      // Check daily IP rate limit (5 quick messages per day)
      const clientIp = webRateLimitService.extractIp(req);
      const ipUsage = webRateLimitService.getUsage(clientIp);

      // 1. Fetch tag and car details
      const tag: any = await prisma.tag.findFirst({
        where: {
          OR: [
            { tagCode: cleanTag },
            { tagCode: rawTag },
            { secretToken: rawTag },
            { secretToken: cleanTag.replace(/^#/, '') },
            { secretToken: { startsWith: rawTag } },
            { secretToken: { startsWith: cleanTag.replace(/^#/, '') } },
          ],
        },
        include: {
          car: true,
        },
      });

      // 2. Fetch active quick messages from DB
      const quickMessages = await prisma.quickMessage.findMany({
        where: { isActive: true },
        orderBy: { displayOrder: 'asc' },
      });

      // 3. Fallback quick messages if DB is empty
      const defaultQuickMessages = [
        { id: 'qm-1', title: 'سيارتك تعيق خروجي', text: 'السلام عليكم، سيارتك تعيق خروجي برجاء تحريكها في أقرب وقت وشكراً لك.' },
        { id: 'qm-2', title: 'النافذة مفتوحة', text: 'تنبيه: لاحظت أن نافذة سيارتك مفتوحة جزئياً أو كلياً.' },
        { id: 'qm-3', title: 'الأنوار مضاءة', text: 'تنبيه: أضواء سيارتك تركت مضاءة وقد تستنزف البطارية.' },
        { id: 'qm-4', title: 'تنبيه سيارة متوقفة بشكل خاطئ', text: 'برجاء تعديل وقفة السيارة لأنها في مكان يمنع حركة السيارات الأخرى.' },
        { id: 'qm-5', title: 'أنا في انتظارك', text: 'أنا واقف بجوار سيارتك في انتظارك لتحريكها.' },
        { id: 'qm-6', title: 'شكراً جزيلاً', text: 'شكراً جزيلاً لتعاونك وسرعة استجابتك!' },
      ];

      const activeList = quickMessages.length > 0 ? quickMessages : defaultQuickMessages;

      // ── Determine page state based on tag status ──────────────────────────
      // SCENARIO 1a: Tag doesn't exist at all
      // SCENARIO 1b: Tag exists but not yet activated (IN_STOCK / UNASSIGNED)
      // SCENARIO 1c: Tag is PAUSED by owner
      // SCENARIO 2:  Tag is ACTIVE → show emergency chat page
      type PageState = 'NOT_FOUND' | 'NOT_ACTIVATED' | 'PAUSED' | 'ACTIVE';

      let pageState: PageState;
      if (!tag) {
        pageState = 'NOT_FOUND';
      } else if (tag.status === 'ACTIVE' && tag.car && tag.car.isTagActive) {
        pageState = 'ACTIVE';
      } else if (tag.status === 'PAUSED') {
        pageState = 'PAUSED';
      } else {
        // IN_STOCK or UNASSIGNED (not yet activated by owner)
        pageState = 'NOT_ACTIVATED';
      }

      const isReady = pageState === 'ACTIVE';

      const carInfo = tag?.car
        ? {
          displayTitle: tag.car.nickname || `${tag.car.brand} ${tag.car.model}`,
          brand: tag.car.brand,
          model: tag.car.model,
          colorName: tag.car.colorName || 'غير محدد',
        }
        : null;

      const html = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>ركنة - تواصل مع صاحب السيارة</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&display=swap" rel="stylesheet">
  <style>
    :root {
      --primary: #EAB308;
      --primary-light: #FEF08A;
      --primary-dark: #CA8A04;
      --bg-page: #F8FAFC;
      --card-bg: #FFFFFF;
      --card-border: #E2E8F0;
      --text-main: #0F172A;
      --text-muted: #64748B;
      --bubble-user: #FACC15;
      --bubble-owner: #F1F5F9;
      --danger: #EF4444;
      --success: #10B981;
    }
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
      -webkit-tap-highlight-color: transparent;
      font-family: 'Cairo', system-ui, -apple-system, sans-serif;
    }
    body {
      background-color: var(--bg-page);
      background-image: 
        radial-gradient(circle at 50% 0%, rgba(250, 204, 21, 0.22) 0%, transparent 55%),
        radial-gradient(circle at 10% 80%, rgba(234, 179, 8, 0.12) 0%, transparent 50%),
        radial-gradient(circle at 90% 40%, rgba(250, 204, 21, 0.15) 0%, transparent 45%);
      color: var(--text-main);
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      user-select: none;
      -webkit-user-select: none;
    }

    /* Top Sticky App Download Banner */
    .app-banner {
      position: sticky;
      top: 0;
      z-index: 100;
      background: rgba(255, 255, 255, 0.94);
      backdrop-filter: blur(14px);
      -webkit-backdrop-filter: blur(14px);
      border-bottom: 1.5px solid rgba(234, 179, 8, 0.35);
      padding: 10px 16px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.04), 0 2px 10px rgba(234, 179, 8, 0.12);
    }
    .app-banner-left {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .app-logo-badge {
      width: 44px;
      height: 44px;
      border-radius: 12px;
      background: #FFFFFF;
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
      flex-shrink: 0;
      box-shadow: 0 2px 10px rgba(0, 0, 0, 0.06), 0 0 10px rgba(234, 179, 8, 0.25);
      border: 1.5px solid rgba(234, 179, 8, 0.45);
    }
    .app-logo-badge img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
    }
    .app-banner-text h4 {
      font-size: 14px;
      font-weight: 800;
      color: #0F172A;
      line-height: 1.2;
    }
    .app-banner-text p {
      font-size: 11px;
      color: #64748B;
      margin-top: 2px;
    }
    .btn-download {
      background: linear-gradient(135deg, #FACC15 0%, #EAB308 100%);
      color: #0F172A;
      font-size: 12px;
      font-weight: 800;
      padding: 8px 16px;
      border-radius: 20px;
      text-decoration: none;
      display: flex;
      align-items: center;
      gap: 6px;
      box-shadow: 0 4px 14px rgba(234, 179, 8, 0.35);
      transition: all 0.2s ease;
      white-space: nowrap;
    }
    .btn-download:hover {
      transform: translateY(-1px);
      box-shadow: 0 6px 18px rgba(234, 179, 8, 0.5);
    }

    /* Container */
    .container {
      max-width: 520px;
      width: 100%;
      margin: 0 auto;
      padding: 16px;
      flex: 1;
      display: flex;
      flex-direction: column;
    }

    /* Car Protection Card */
    .car-card {
      background: #FFFFFF;
      border: 1px solid #E2E8F0;
      border-radius: 18px;
      padding: 16px;
      margin-bottom: 16px;
      box-shadow: 0 10px 30px -5px rgba(0, 0, 0, 0.05), 0 0 25px rgba(234, 179, 8, 0.08);
      position: relative;
      overflow: hidden;
    }
    .car-card::before {
      content: '';
      position: absolute;
      top: 0;
      right: 0;
      left: 0;
      height: 3px;
      background: linear-gradient(90deg, #FACC15 0%, #EAB308 100%);
    }
    .car-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 12px;
    }
    .status-pill {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 4px 10px;
      border-radius: 20px;
      font-size: 12px;
      font-weight: 700;
      background: rgba(16, 185, 129, 0.12);
      color: #059669;
      border: 1px solid rgba(16, 185, 129, 0.3);
    }
    .status-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: #10B981;
      box-shadow: 0 0 8px #10B981;
      animation: pulse 2s infinite;
    }
    @keyframes pulse {
      0%, 100% { opacity: 1; transform: scale(1); }
      50% { opacity: 0.5; transform: scale(0.85); }
    }
    .car-title {
      font-size: 18px;
      font-weight: 800;
      color: #0F172A;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .car-meta {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-top: 8px;
    }
    .meta-tag {
      font-size: 12px;
      background: #F1F5F9;
      border: 1px solid #E2E8F0;
      padding: 4px 10px;
      border-radius: 8px;
      color: #475569;
    }
    .meta-tag b {
      color: #0F172A;
    }
    .zero-knowledge-notice {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 11px;
      color: #64748B;
      margin-top: 10px;
      padding-top: 10px;
      border-top: 1px dashed #E2E8F0;
    }

    /* Inactive / Error State Cards */
    .state-card {
      text-align: center;
      padding: 48px 24px 40px;
      background: #FFFFFF;
      border: 1px solid #E2E8F0;
      border-radius: 20px;
      margin: 48px auto;
      max-width: 440px;
      position: relative;
      overflow: hidden;
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.05);
    }
    .state-card::before {
      content: '';
      position: absolute;
      top: 0; right: 0; left: 0;
      height: 3px;
    }
    .state-card.not-found::before  { background: linear-gradient(90deg, #EF4444, #B91C1C); }
    .state-card.not-activated::before { background: linear-gradient(90deg, #F59E0B, #D97706); }
    .state-card.paused::before     { background: linear-gradient(90deg, #6366F1, #4F46E5); }
    .state-icon { font-size: 60px; margin-bottom: 18px; display: block; }
    .state-title {
      font-size: 20px;
      font-weight: 800;
      color: #0F172A;
      margin-bottom: 10px;
      line-height: 1.3;
    }
    .state-body {
      font-size: 13px;
      color: #64748B;
      line-height: 1.7;
      max-width: 340px;
      margin: 0 auto 24px;
    }
    .state-body b { color: #1E293B; }
    .state-cta {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      background: linear-gradient(135deg, #FACC15 0%, #EAB308 100%);
      color: #0F172A;
      font-size: 13px;
      font-weight: 800;
      padding: 12px 24px;
      border-radius: 24px;
      text-decoration: none;
      box-shadow: 0 4px 16px rgba(234, 179, 8, 0.35);
      transition: all 0.2s ease;
    }
    .state-cta:hover { transform: translateY(-2px); box-shadow: 0 6px 20px rgba(234, 179, 8, 0.5); }
    .state-tag-pill {
      display: inline-block;
      margin-bottom: 16px;
      background: #F1F5F9;
      border: 1px solid #E2E8F0;
      padding: 4px 14px;
      border-radius: 20px;
      font-size: 13px;
      color: #475569;
      font-weight: 700;
      letter-spacing: 0.5px;
    }

    /* Chat Section */
    .chat-section {
      flex: 1;
      display: flex;
      flex-direction: column;
      background: #FFFFFF;
      border: 1px solid #E2E8F0;
      border-radius: 20px;
      overflow: hidden;
      box-shadow: 0 12px 36px -8px rgba(0, 0, 0, 0.07), 0 0 20px rgba(234, 179, 8, 0.05);
    }
    .chat-header {
      padding: 12px 16px;
      background: #F8FAFC;
      border-bottom: 1px solid #E2E8F0;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .chat-header-title {
      font-size: 13px;
      font-weight: 800;
      color: #0F172A;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .chat-lock-tag {
      font-size: 11px;
      background: rgba(234, 179, 8, 0.12);
      color: #854D0E;
      border: 1px solid rgba(234, 179, 8, 0.35);
      padding: 2px 8px;
      border-radius: 12px;
      font-weight: 700;
    }

    /* Messages Thread */
    .messages-box {
      flex: 1;
      padding: 16px;
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      gap: 12px;
      min-height: 200px;
      max-height: 380px;
      background: #FAFAFA;
    }
    .empty-state {
      margin: auto;
      text-align: center;
      color: #64748B;
      padding: 20px;
    }
    .empty-icon {
      font-size: 40px;
      margin-bottom: 8px;
      color: #EAB308;
    }
    .message-item {
      display: flex;
      flex-direction: column;
      max-width: 82%;
      animation: fadeIn 0.25s ease-out;
    }
    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(6px); }
      to { opacity: 1; transform: translateY(0); }
    }
    .message-item.me {
      align-self: flex-start;
    }
    .message-item.owner {
      align-self: flex-end;
    }
    .message-bubble {
      padding: 10px 14px;
      border-radius: 16px;
      font-size: 13px;
      line-height: 1.5;
      position: relative;
    }
    .message-item.me .message-bubble {
      background: linear-gradient(135deg, #FACC15 0%, #EAB308 100%);
      color: #1E1B4B;
      font-weight: 700;
      border-bottom-right-radius: 4px;
      box-shadow: 0 2px 8px rgba(234, 179, 8, 0.25);
    }
    .message-item.owner .message-bubble {
      background: #F1F5F9;
      color: #0F172A;
      border: 1px solid #E2E8F0;
      border-bottom-left-radius: 4px;
      box-shadow: 0 2px 6px rgba(0, 0, 0, 0.04);
    }
    .message-info {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 10px;
      margin-top: 3px;
      color: #64748B;
    }
    .message-item.me .message-info {
      justify-content: flex-start;
    }
    .message-item.owner .message-info {
      justify-content: flex-end;
    }
    .owner-badge {
      color: #CA8A04;
      font-weight: 700;
    }

    /* Quick Messages Panel */
    .quick-panel {
      padding: 14px;
      background: #FFFFFF;
      border-top: 1px solid #E2E8F0;
    }
    .quick-title {
      font-size: 12px;
      font-weight: 800;
      color: #0F172A;
      margin-bottom: 10px;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .quick-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 8px;
    }
    .btn-quick {
      background: #F8FAFC;
      border: 1.5px solid #E2E8F0;
      color: #1E293B;
      padding: 10px 12px;
      border-radius: 12px;
      font-size: 12px;
      font-weight: 700;
      text-align: right;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 6px;
      transition: all 0.2s ease;
      line-height: 1.3;
    }
    .btn-quick:hover:not(:disabled) {
      background: #FEF3C7;
      border-color: #F59E0B;
      color: #92400E;
      transform: translateY(-1px);
    }
    .btn-quick:active:not(:disabled) {
      transform: scale(0.98);
    }
    .btn-quick:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
    .btn-quick-icon {
      font-size: 16px;
      flex-shrink: 0;
    }
    .btn-quick.selected {
      background: #FEF08A !important;
      border-color: #EAB308 !important;
      color: #713F12 !important;
      box-shadow: 0 0 16px rgba(234, 179, 8, 0.35) !important;
      outline: 2px solid #EAB308;
    }

    /* Camera Capture Box */
    .camera-card {
      margin-top: 14px;
      margin-bottom: 12px;
      background: #FFFFFF;
      border: 2px dashed rgba(234, 179, 8, 0.55);
      border-radius: 16px;
      padding: 16px;
      text-align: center;
      transition: all 0.2s ease;
      box-shadow: 0 4px 18px rgba(234, 179, 8, 0.08);
    }
    .camera-card.has-photo {
      border-style: solid;
      border-color: #10B981;
      background: #F0FDF4;
    }
    .camera-icon-wrapper {
      font-size: 32px;
      margin-bottom: 6px;
    }
    .camera-prompt-title {
      font-size: 13.5px;
      font-weight: 800;
      color: #0F172A;
      margin-bottom: 4px;
    }
    .camera-prompt-desc {
      font-size: 11.5px;
      color: #64748B;
      margin-bottom: 12px;
      line-height: 1.4;
    }
    .btn-camera-trigger {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      background: linear-gradient(135deg, #FEF08A 0%, #FDE047 100%);
      border: 1.5px solid #EAB308;
      color: #713F12;
      padding: 10px 18px;
      border-radius: 12px;
      font-weight: 800;
      font-size: 12.5px;
      cursor: pointer;
      width: 100%;
      max-width: 260px;
      transition: all 0.2s ease;
      box-shadow: 0 4px 14px rgba(234, 179, 8, 0.2);
    }
    .btn-camera-trigger:hover {
      background: linear-gradient(135deg, #FDE047 0%, #FACC15 100%);
      transform: translateY(-1px);
    }
    .camera-preview-box {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 10px;
    }
    .camera-preview-box img {
      width: 100%;
      max-width: 280px;
      height: 170px;
      object-fit: cover;
      border-radius: 12px;
      border: 1px solid #CBD5E1;
    }
    .camera-preview-overlay {
      display: flex;
      align-items: center;
      justify-content: space-between;
      width: 100%;
      max-width: 280px;
      gap: 8px;
    }
    .preview-badge {
      font-size: 11px;
      font-weight: 800;
      color: #059669;
      background: rgba(16, 185, 129, 0.12);
      border: 1px solid rgba(16, 185, 129, 0.3);
      padding: 4px 8px;
      border-radius: 8px;
      display: inline-flex;
      align-items: center;
      gap: 4px;
    }
    .btn-retake {
      background: rgba(239, 68, 68, 0.1);
      border: 1px solid rgba(239, 68, 68, 0.3);
      color: #DC2626;
      font-size: 11.5px;
      font-weight: 700;
      padding: 5px 10px;
      border-radius: 8px;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 4px;
    }

    /* Rear Camera Viewfinder Modal */
    .rear-camera-modal {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      z-index: 99999;
      display: flex;
      align-items: center;
      justify-content: center;
      background: rgba(0, 0, 0, 0.88);
      backdrop-filter: blur(10px);
      padding: 16px;
    }
    .rear-camera-overlay {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
    }
    .rear-camera-dialog {
      position: relative;
      width: 100%;
      max-width: 440px;
      background: #FFFFFF;
      border: 1px solid #CBD5E1;
      border-radius: 24px;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      box-shadow: 0 20px 50px rgba(0, 0, 0, 0.4);
      animation: modalFadeIn 0.25s ease;
    }
    @keyframes modalFadeIn {
      from { opacity: 0; transform: scale(0.95); }
      to { opacity: 1; transform: scale(1); }
    }
    .rear-camera-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 14px 18px;
      background: #F8FAFC;
      border-bottom: 1px solid #E2E8F0;
      z-index: 2;
    }
    .rear-camera-badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      background: rgba(16, 185, 129, 0.12);
      border: 1px solid rgba(16, 185, 129, 0.3);
      color: #059669;
      padding: 5px 10px;
      border-radius: 20px;
      font-size: 12px;
      font-weight: 800;
    }
    .rear-camera-close-btn {
      background: #E2E8F0;
      border: none;
      color: #334155;
      width: 32px;
      height: 32px;
      border-radius: 50%;
      font-size: 16px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: background 0.2s;
    }
    .rear-camera-close-btn:hover {
      background: #FEE2E2;
      color: #DC2626;
    }
    .rear-camera-viewport {
      position: relative;
      width: 100%;
      height: 380px;
      background: #000;
      overflow: hidden;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .rear-camera-viewport video {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    .camera-viewfinder-grid {
      position: absolute;
      top: 24px;
      left: 24px;
      right: 24px;
      bottom: 24px;
      pointer-events: none;
    }
    .corner-tl, .corner-tr, .corner-bl, .corner-br {
      position: absolute;
      width: 24px;
      height: 24px;
      border-color: #FACC15;
      border-style: solid;
    }
    .corner-tl { top: 0; left: 0; border-width: 3px 0 0 3px; border-top-left-radius: 8px; }
    .corner-tr { top: 0; right: 0; border-width: 3px 3px 0 0; border-top-right-radius: 8px; }
    .corner-bl { bottom: 0; left: 0; border-width: 0 0 3px 3px; border-bottom-left-radius: 8px; }
    .corner-br { bottom: 0; right: 0; border-width: 0 3px 3px 0; border-bottom-right-radius: 8px; }
    .rear-camera-tip {
      position: absolute;
      bottom: 16px;
      background: rgba(0, 0, 0, 0.65);
      backdrop-filter: blur(4px);
      color: #fff;
      font-size: 11.5px;
      font-weight: 600;
      padding: 6px 14px;
      border-radius: 20px;
      border: 1px solid rgba(255, 255, 255, 0.15);
      pointer-events: none;
    }
    .rear-camera-footer {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 16px;
      background: #F8FAFC;
      border-top: 1px solid #E2E8F0;
      gap: 8px;
    }
    .btn-shutter-capture {
      width: 68px;
      height: 68px;
      border-radius: 50%;
      background: transparent;
      border: 4px solid #CBD5E1;
      padding: 4px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: transform 0.15s ease;
    }
    .btn-shutter-capture:hover {
      transform: scale(1.05);
      border-color: #EAB308;
    }
    .btn-shutter-capture:active {
      transform: scale(0.92);
    }
    .shutter-inner {
      width: 100%;
      height: 100%;
      border-radius: 50%;
      background: linear-gradient(135deg, #FACC15 0%, #EAB308 100%);
    }
    .rear-camera-footer-note {
      font-size: 11px;
      color: #64748B;
      font-weight: 600;
    }

    /* Big Submit Report Button */
    .btn-submit-report {
      width: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
      background: linear-gradient(135deg, #FACC15 0%, #EAB308 100%);
      color: #0F172A;
      font-size: 14px;
      font-weight: 900;
      padding: 13px 20px;
      border-radius: 14px;
      border: none;
      cursor: pointer;
      box-shadow: 0 4px 16px rgba(234, 179, 8, 0.35);
      transition: all 0.25s ease;
      margin-top: 10px;
    }
    .btn-submit-report:hover:not(:disabled) {
      transform: translateY(-2px);
      box-shadow: 0 8px 24px rgba(234, 179, 8, 0.5);
    }
    .btn-submit-report:disabled {
      background: #E2E8F0;
      color: #94A3B8;
      border: 1px solid #CBD5E1;
      box-shadow: none;
      cursor: not-allowed;
      transform: none;
    }

    /* Status Banners */
    .status-banner {
      padding: 12px 14px;
      border-radius: 14px;
      margin: 12px 14px;
      display: flex;
      align-items: center;
      gap: 10px;
      font-size: 12.5px;
      font-weight: 700;
      line-height: 1.4;
      animation: fadeIn 0.3s ease;
    }
    .status-banner.pending {
      background: rgba(245, 158, 11, 0.12);
      border: 1px solid rgba(245, 158, 11, 0.35);
      color: #B45309;
    }
    .status-banner.active {
      background: rgba(34, 197, 94, 0.12);
      border: 1px solid rgba(34, 197, 94, 0.35);
      color: #15803D;
    }
    .status-banner.ignored {
      background: rgba(245, 158, 11, 0.14);
      border: 1px solid rgba(245, 158, 11, 0.4);
      color: #B45309;
    }
    .status-banner.blocked {
      background: rgba(239, 68, 68, 0.12);
      border: 1px solid rgba(239, 68, 68, 0.35);
      color: #B91C1C;
    }
    .status-banner.closed {
      background: rgba(100, 116, 139, 0.12);
      border: 1px solid rgba(100, 116, 139, 0.3);
      color: #475569;
    }

    /* Live Reply Bar */
    .live-reply-bar {
      display: flex;
      gap: 8px;
      padding: 12px 14px;
      background: #FFFFFF;
      border-top: 1px solid #E2E8F0;
    }
    .live-reply-input {
      flex: 1;
      background: #F8FAFC;
      border: 1.5px solid #CBD5E1;
      border-radius: 12px;
      padding: 10px 14px;
      color: #0F172A;
      font-size: 13px;
      outline: none;
      user-select: text;
      -webkit-user-select: text;
    }
    .live-reply-input:focus {
      border-color: #EAB308;
      background: #FFFFFF;
      box-shadow: 0 0 0 3px rgba(234, 179, 8, 0.15);
    }
    .btn-send-reply {
      background: linear-gradient(135deg, #FACC15 0%, #EAB308 100%);
      color: #0F172A;
      border: none;
      padding: 0 18px;
      border-radius: 12px;
      font-weight: 800;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 6px;
      box-shadow: 0 4px 12px rgba(234, 179, 8, 0.25);
    }
    .view-once-bubble {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      background: #F1F5F9;
      border: 1px solid #CBD5E1;
      padding: 6px 12px;
      border-radius: 10px;
      font-size: 11.5px;
      font-weight: 800;
      color: #B45309;
      margin-top: 6px;
    }

    /* Anti-Spam Badges & Limits */
    .quota-badge {
      font-size: 11px;
      font-weight: 700;
      color: #334155;
      background: #F1F5F9;
      border: 1px solid #E2E8F0;
      padding: 3px 8px;
      border-radius: 10px;
      margin-right: auto;
    }
    .quota-badge b {
      color: #CA8A04;
    }
    .cooldown-badge {
      font-size: 11px;
      font-weight: 700;
      color: #B45309;
      background: #FEF3C7;
      border: 1px solid #FCD34D;
      padding: 3px 8px;
      border-radius: 10px;
      animation: pulse 1s infinite;
    }
    .limit-reached-banner {
      margin-bottom: 14px;
      padding: 16px 18px;
      border-radius: 14px;
      background: #FFFBEB;
      border: 1px solid #FCD34D;
      text-align: center;
      line-height: 1.5;
      animation: fadeIn 0.3s ease;
    }
    .limit-reached-title {
      color: #DC2626;
      font-size: 13.5px;
      font-weight: 800;
      margin-bottom: 6px;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
    }
    .limit-reached-text {
      color: #475569;
      font-size: 12px;
      margin-bottom: 12px;
    }
    .btn-download-app {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      background: linear-gradient(135deg, #FACC15 0%, #EAB308 100%);
      color: #0F172A;
      font-weight: 800;
      font-size: 12.5px;
      padding: 9px 20px;
      border-radius: 10px;
      text-decoration: none;
      box-shadow: 0 4px 14px rgba(234, 179, 8, 0.35);
      transition: all 0.2s ease;
    }
    .btn-download-app:hover {
      transform: translateY(-2px);
      box-shadow: 0 6px 18px rgba(234, 179, 8, 0.5);
    }
    .toast-popup {
      position: fixed;
      top: 60px;
      left: 50%;
      transform: translateX(-50%);
      background: #FFFFFF;
      border: 1.5px solid #EAB308;
      color: #0F172A;
      padding: 10px 20px;
      border-radius: 14px;
      font-size: 12.5px;
      font-weight: 700;
      box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1), 0 0 15px rgba(234, 179, 8, 0.2);
      z-index: 9999;
      display: flex;
      align-items: center;
      gap: 8px;
      animation: toastIn 0.3s ease forwards;
    }
    @keyframes toastIn {
      from { opacity: 0; transform: translate(-50%, -10px); }
      to { opacity: 1; transform: translate(-50%, 0); }
    }

    /* Locked input banner */
    .input-locked-banner {
      margin-top: 10px;
      padding: 8px 12px;
      border-radius: 10px;
      background: #FEF9C3;
      border: 1px dashed rgba(234, 179, 8, 0.5);
      font-size: 11px;
      color: #854D0E;
      text-align: center;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
    }

    /* Footer */
    .footer {
      text-align: center;
      padding: 16px;
      font-size: 11px;
      color: #64748B;
    }
    .footer a {
      color: #CA8A04;
      text-decoration: none;
      font-weight: 700;
    }

    /* Anti-Inspect Shield Overlay */
    .inspect-shield-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      z-index: 99999999;
      background: rgba(248, 250, 252, 0.98);
      backdrop-filter: blur(25px);
      -webkit-backdrop-filter: blur(25px);
      display: none;
      align-items: center;
      justify-content: center;
      padding: 24px;
      text-align: center;
    }
    .inspect-shield-box {
      background: #FFFFFF;
      border: 1.5px solid #E2E8F0;
      border-radius: 26px;
      padding: 36px 26px;
      max-width: 440px;
      width: 100%;
      box-shadow: 0 25px 60px rgba(0, 0, 0, 0.1), 0 0 35px rgba(234, 179, 8, 0.2);
      animation: modalFadeIn 0.3s ease;
    }
  </style>
  <link rel="icon" type="image/png" href="/rakna_applogo.png">
  <link rel="apple-touch-icon" href="/rakna_applogo.png">
</head>
<body>

  <!-- Anti-Inspect Security Shield -->
  <div id="inspectShieldOverlay" class="inspect-shield-overlay">
    <div class="inspect-shield-box">
      <div style="font-size: 52px; margin-bottom: 14px;">🛡️</div>
      <h3 style="font-size: 19px; font-weight: 900; color: #0F172A; margin-bottom: 10px;">أدوات الفحص والمطورين غير مسموح بها</h3>
      <p style="font-size: 13.5px; color: #64748B; line-height: 1.7; margin-bottom: 20px;">
        تم حظر أدوات التفتيش والـ <strong>DevTools / Inspect</strong> لحماية أمان المحادثة وخصوصية مالك المركبة.<br>
        يرجى تصفح الرابط عبر متصفح هاتفك المحمول مباشرة دون تشغيل أدوات الفحص.
      </p>
      <div style="display: inline-block; padding: 8px 18px; background: #FEF3C7; border: 1.5px solid #F59E0B; border-radius: 14px; color: #92400E; font-size: 12.5px; font-weight: 800;">
        ركنة • حماية فورية وخصوصية مشددة
      </div>
    </div>
  </div>

  <!-- Sticky Top Smart App Link Banner -->
  <header class="app-banner">
    <div class="app-banner-left">
      <div class="app-logo-badge">
        <img src="/rakna_applogo.png" alt="ركنة" />
      </div>
      <div class="app-banner-text">
        <h4>تطبيق ركنة مثبت على هاتفك؟</h4>
        <p>افتح المحادثة والتنبيهات المباشرة فوراً داخل التطبيق</p>
      </div>
    </div>
    <button type="button" class="btn-download" id="btnOpenInApp" onclick="openInRaknaApp()" style="border:none; cursor:pointer;">
      <span>فتح في التطبيق</span>
      <span>🚀</span>
    </button>
  </header>

  <main class="container">
    ${pageState === 'NOT_FOUND' ? `
      <!-- SCENARIO 1a: Tag not found in system -->
      <div class="state-card not-found">
        <span class="state-icon"></span>
        <div class="state-tag-pill">${cleanTag}</div>
        <h2 class="state-title">ملصق غير معرّف</h2>
        <p class="state-body">
          لا يوجد ملصق ركنة مسجّل بهذا الرمز في نظامنا.<br>
          إذا اشتريت المنتج حديثاً، تأكد من صحة المسح أو تواصل مع الدعم.
        </p>
        <a href="https://rakna.tech" class="state-cta"> موقع ركنة</a>
      </div>

    ` : pageState === 'NOT_ACTIVATED' ? `
      <!-- SCENARIO 1b: Tag exists but owner hasn't activated it yet -->
      <div class="state-card not-activated">
        <span class="state-icon"></span>
        <div class="state-tag-pill">${cleanTag}</div>
        <h2 class="state-title">هذا الملصق غير مفعّل بعد</h2>
        <p class="state-body">
          الملصق موجود في النظام ولكن المالك لم يقم بتفعيله بعد.<br><br>
          <b>إذا كنت المالك:</b> افتح تطبيق ركنة وادخل كود التفعيل المرفق في الكرت داخل العلبة.
        </p>
        <a href="https://rakna.tech" class="state-cta"> تحميل تطبيق ركنة للتفعيل</a>
      </div>

    ` : pageState === 'PAUSED' ? `
      <!-- SCENARIO 1c: Tag is paused by owner -->
      <div class="state-card paused">
        <span class="state-icon">⏸</span>
        <div class="state-tag-pill">${cleanTag}</div>
        <h2 class="state-title">الملصق متوقف مؤقتاً</h2>
        <p class="state-body">
          أوقف صاحب السيارة تشغيل هذا الملصق مؤقتاً.<br>
          لا يمكن إرسال أي تنبيه في الوقت الحالي.<br><br>
          <b>إذا كانت هناك حالة طارئة</b> يُرجى التواصل مع إدارة المبنى أو الجهات المختصة.
        </p>
        <a href="https://rakna.tech" class="state-cta"> الرئيسية</a>
      </div>

    ` : `
      <!-- Protected Vehicle Card -->
      <section class="car-card">
        <div class="car-header">
          <div class="car-title">
            <span></span>
            <span>${carInfo?.displayTitle || 'سيارة مسجلة'}</span>
          </div>
          <div class="status-pill">
            <span class="status-dot"></span>
            <span>متصل بنظام ركنة</span>
          </div>
        </div>
        <div class="car-meta">
          <span class="meta-tag">الماركة: <b>${carInfo?.brand || '-'}</b></span>
          <span class="meta-tag">الموديل: <b>${carInfo?.model || '-'}</b></span>
          <span class="meta-tag">اللون: <b>${carInfo?.colorName || '-'}</b></span>
        </div>
        <div class="zero-knowledge-notice">
          <span></span>
          <span>خصوصية تامة: لا يتم كشف اسم أو رقم هاتف أي من الطرفين نهائياً.</span>
        </div>
      </section>

      <!-- Anonymous Quick Chat Area -->
      <section class="chat-section">
        <div class="chat-header">
          <div class="chat-header-title">
            <span></span>
            <span>محادثة وتنبيه فوري مباشر</span>
          </div>
          <div class="chat-lock-tag" id="chatHeaderTag">
             توثيق صورة بالكاميرا
          </div>
        </div>

        <!-- Messages Box -->
        <div class="messages-box" id="messagesBox">
          <div class="empty-state" id="emptyState">
            <div class="empty-icon"></div>
            <h5 style="color: #FFF; font-size: 14px; margin-bottom: 4px;">اختر سبب التواصل والتقط صورة بالكاميرا</h5>
            <p style="font-size: 12px;">سيتم إشعار صاحب السيارة فوراً وتأكيد البلاغ مع حفظ خصوصيتك.</p>
          </div>
        </div>

        <!-- Status Banner Area -->
        <div id="statusBannerBox" style="display: none;"></div>

        <!-- Compose Panel (Shown before chat is submitted) -->
        <div class="quick-panel" id="composePanel">
          <div class="quick-title">
            <span>1</span>
            <span>اختر سبب التواصل:</span>
            <div id="quotaBadge" class="quota-badge" style="display:none;"></div>
            <div id="cooldownBadge" class="cooldown-badge" style="display:none;">يرجى الانتظار قليلاً...</div>
          </div>

          <div id="limitReachedBanner" class="limit-reached-banner" style="display:none;">
            <div class="limit-reached-title">
              <span></span>
              <span>استنفدت الحد اليومي (5 رسائل سريعة)</span>
            </div>
            <div class="limit-reached-text">
              لقد أرسلت الحد الأقصى المسموح به اليوم عبر المتصفح. إذا أردت المزيد من التواصل المباشر مع أصحاب السيارات والمتابعة، حمّل تطبيق <strong>ركنة Rakna</strong> الآن مجاناً!
            </div>
            <a href="https://rakna.tech" target="_blank" class="btn-download-app">
              <span>📲</span>
              <span>تحميل تطبيق ركنة للمزيد</span>
            </a>
          </div>

          <div class="quick-grid" id="quickGrid">
            ${activeList
          .map(
            (item: any, idx: number) => `
              <button 
                type="button" 
                class="btn-quick" 
                data-title="${item.title}" 
                data-text="${item.text || item.title}"
                onclick="selectQuickReason(this)"
              >
                <span class="btn-quick-icon">${['', '', '', '', '', '', '', ''][idx % 8]}</span>
                <span>${item.title}</span>
              </button>
            `
          )
          .join('')}
          </div>

          <!-- Camera Section (Rear Camera Only - Mandatory) -->
          <div class="camera-card" id="cameraCard">
            <input type="file" id="cameraFileInput" accept="image/*" capture="environment" style="display:none;" onchange="onCameraPhotoTaken(event)">
            
            <div id="cameraPrompt">
              <div class="camera-icon-wrapper"></div>
              <div class="camera-prompt-title">2 التقاط صورة بالكاميرا الخلفية فقط (إلزامي للتوثيق)</div>
              <div class="camera-prompt-desc">يجب التقاط صورة حية للمركبة بالكاميرا الخلفية لمنع البلاغات الكاذبة ولحماية الخصوصية ومصداقية البلاغ.</div>
              <button type="button" class="btn-camera-trigger" onclick="triggerRearCamera()">
                <span></span>
                <span>تشغيل الكاميرا الخلفية والتقاط الصورة</span>
              </button>
            </div>

            <div id="cameraPreviewBox" class="camera-preview-box" style="display:none;">
              <img id="photoPreviewImg" src="" alt="صورة الكاميرا الخلفية">
              <div class="camera-preview-overlay">
                <span class="preview-badge"> ملتقطة بالكاميرا الخلفية</span>
                <button type="button" class="btn-retake" onclick="triggerRearCamera()">
                  <span></span>
                  <span>إعادة الالتقاط بالكاميرا الخلفية</span>
                </button>
              </div>
            </div>
          </div>

          <!-- Live Rear Camera Viewfinder Modal -->
          <div id="rearCameraModal" class="rear-camera-modal" style="display:none;">
            <div class="rear-camera-overlay" onclick="closeRearCameraModal()"></div>
            <div class="rear-camera-dialog">
              <div class="rear-camera-header">
                <div class="rear-camera-badge">
                  <span></span>
                  <span>الكاميرا الخلفية فقط</span>
                </div>
                <button type="button" class="rear-camera-close-btn" onclick="closeRearCameraModal()">✕</button>
              </div>
              <div class="rear-camera-viewport">
                <video id="liveRearVideo" playsinline autoplay muted></video>
                <div class="camera-viewfinder-grid">
                  <div class="corner-tl"></div>
                  <div class="corner-tr"></div>
                  <div class="corner-bl"></div>
                  <div class="corner-br"></div>
                </div>
                <div class="rear-camera-tip">وجه الكاميرا الخلفية نحو السيارة أو العائق</div>
              </div>
              <div class="rear-camera-footer">
                <button type="button" class="btn-shutter-capture" onclick="captureRearCameraPhoto()" aria-label="التقاط">
                  <div class="shutter-inner"></div>
                </button>
                <div class="rear-camera-footer-note">انقر على الزر لالتقاط الصورة بالكاميرا الخلفية</div>
              </div>
            </div>
          </div>

          <!-- Submit Button -->
          <button type="button" id="btnSubmitReport" class="btn-submit-report" disabled onclick="submitReportWithPhoto()">
            <span></span>
            <span id="submitReportText">يرجى اختيار السبب والتقاط صورة بالكاميرا</span>
          </button>

          <div class="input-locked-banner">
            <span></span>
            <span>صورة توثيقية لمكان السيارة بخصوصية تامة 100%.</span>
          </div>
        </div>

        <!-- Live Chat Input Bar (Shown ONLY when chat status is ACTIVE) -->
        <div id="activeChatInputBar" class="live-reply-bar" style="display:none;">
          <input type="text" id="liveMessageInput" class="live-reply-input" placeholder="اكتب ردك لصاحب السيارة..." onkeydown="if(event.key==='Enter') sendLiveReply()">
          <button type="button" id="btnSendReply" class="btn-send-reply" onclick="sendLiveReply()">
            <span>إرسال</span>
            <span>➤</span>
          </button>
        </div>
      </section>
      `}
  </main>

  <footer class="footer">
    <p>نظام ركنة الذكي لحماية خصوصية السيارات © ${new Date().getFullYear()}</p>
  </footer>

  <script>
    // 1. Smart App Handoff & Deep Linking
    const TAG_CODE = "${cleanTag}";

    function openInRaknaApp() {
      const clean = encodeURIComponent(TAG_CODE.replace(/^#/, ''));
      const isAndroid = /Android/i.test(navigator.userAgent);
      const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);

      if (isAndroid) {
        // Use S.browser_fallback_url so Android Chrome NEVER redirects to Google Play when the app is not installed
        const fallbackUrl = new URL(window.location.href);
        fallbackUrl.searchParams.set('app_not_installed', '1');
        window.location.href =
          'intent://t/' + clean +
          '#Intent;scheme=rakna;package=com.example.rakna_app;S.browser_fallback_url=' +
          encodeURIComponent(fallbackUrl.toString()) +
          ';end';
      } else if (isIOS) {
        window.location.href = 'rakna://t/' + clean;
        setTimeout(() => {
          if (!document.hidden) {
            showToast('التطبيق غير مثبت على هاتفك، يمكنك التواصل مع صاحب السيارة مباشرة من هنا.');
          }
        }, 1200);
      } else {
        window.location.href = 'rakna://t/' + clean;
      }
    }

    // Do NOT auto-redirect to intent:// on page load so users without the app stay on web without going to Google Play.
    // If redirected back via S.browser_fallback_url, clean the URL and notify the user.
    (function handleAppFallbackReturn() {
      try {
        const params = new URLSearchParams(window.location.search);
        if (params.get('app_not_installed') === '1') {
          params.delete('app_not_installed');
          const cleanSearch = params.toString();
          const cleanUrl = window.location.pathname + (cleanSearch ? '?' + cleanSearch : '') + window.location.hash;
          window.history.replaceState({}, '', cleanUrl);
          window.addEventListener('DOMContentLoaded', () => {
            showToast('التطبيق غير مثبت على هاتفك، يمكنك المتابعة والتواصل مباشرة من المتصفح.');
          });
        }
      } catch (e) {}
    })();

    // 2. Chat Session & Anti-Spam State
    let sessionToken = localStorage.getItem('rakna_stranger_token') || null;
    let currentChatId = localStorage.getItem('rakna_chat_' + TAG_CODE) || null;
    let chatStatus = localStorage.getItem('rakna_status_' + TAG_CODE) || null;
    let selectedReasonText = '';
    let capturedPhotoBase64 = null;
    let isSubmitting = false;
    let isSendingLive = false;
    let pollTimer = null;
    let cooldownTimer = null;
    let inCooldown = false;
    let remainingQuota = 999999;
    const knownMessageIds = new Set();

    // DOM Elements
    const messagesBox = document.getElementById('messagesBox');
    const emptyState = document.getElementById('emptyState');
    const quotaBadge = document.getElementById('quotaBadge');
    const remainingCount = document.getElementById('remainingCount');
    const cooldownBadge = document.getElementById('cooldownBadge');
    const countdownSec = document.getElementById('countdownSec');
    const limitReachedBanner = document.getElementById('limitReachedBanner');

    // Toast Notification System
    function showToast(text, isError = false) {
      const old = document.querySelector('.toast-popup');
      if (old) old.remove();

      const toast = document.createElement('div');
      toast.className = 'toast-popup';
      if (isError) {
        toast.style.borderColor = '#EF4444';
        toast.innerHTML = '<span></span><span>' + escapeHtml(text) + '</span>';
      } else {
        toast.innerHTML = '<span></span><span>' + escapeHtml(text) + '</span>';
      }
      document.body.appendChild(toast);
      setTimeout(() => { if (toast.parentNode) toast.parentNode.removeChild(toast); }, 4000);
    }

    // Status Banner Management
    function renderStatusBanner(status) {
      const box = document.getElementById('statusBannerBox');
      const activeBar = document.getElementById('activeChatInputBar');
      if (!box) return;
      box.style.display = 'block';

      if (status === 'PENDING_ACCEPT') {
        box.innerHTML = '<div class="status-banner pending">' +
          '<span style="font-size:20px;"></span>' +
          '<div>' +
            '<div style="font-weight:800; font-size:13px;">بانتظار رد صاحب السيارة...</div>' +
            '<div style="font-size:11.5px; opacity:0.9;">تم إرسال بلاغك وتوثيق الكاميرا بنجاح. سيتم فتح المحادثة فور قبول المالك.</div>' +
          '</div>' +
        '</div>';
        if (activeBar) activeBar.style.display = 'none';
      } else if (status === 'ACTIVE') {
        box.innerHTML = '<div class="status-banner active">' +
          '<span style="font-size:20px;"></span>' +
          '<div>' +
            '<div style="font-weight:800; font-size:13px;">المحادثة نشطة الآن مع صاحب السيارة</div>' +
            '<div style="font-size:11.5px; opacity:0.9;">يمكنك كتابة رسائل إضافية مباشرة لصاحب السيارة بالأسفل.</div>' +
          '</div>' +
        '</div>';
        if (activeBar) activeBar.style.display = 'flex';
      } else if (status === 'EXPIRED') {
        clearWebChatState();
        return;
      } else if (status === 'IGNORED') {
        box.innerHTML = '<div class="status-banner ignored">' +
          '<span style="font-size:22px;"></span>' +
          '<div style="flex:1;">' +
            '<div style="font-weight:800; font-size:13px; color:#FBBF24;">صاحب السيارة مشغول حالياً</div>' +
            '<div style="font-size:11.5px; opacity:0.9; margin-top:2px;">اعتذر صاحب السيارة عن عدم إمكانية الرد في الوقت الحالي.</div>' +
          '</div>' +
        '</div>';
        if (activeBar) activeBar.style.display = 'none';
        hideCompose();
        if (pollTimer) clearInterval(pollTimer);
      } else if (status === 'BLOCKED') {
        box.innerHTML = '<div class="status-banner blocked">' +
          '<span style="font-size:20px;"></span>' +
          '<div>' +
            '<div style="font-weight:800; font-size:13px;">تم حظر وإغلاق هذه المحادثة</div>' +
            '<div style="font-size:11.5px; opacity:0.9;">قام الطرف الآخر بحظر المحادثة وإحالتها للإدارة والرقابة.</div>' +
          '</div>' +
        '</div>';
        if (activeBar) activeBar.style.display = 'none';
        hideCompose();
        if (pollTimer) clearInterval(pollTimer);
      } else if (status === 'CLOSED') {
        box.innerHTML = '<div class="status-banner closed">' +
          '<span style="font-size:20px;"></span>' +
          '<div>' +
            '<div style="font-weight:800; font-size:13px;">تم إغلاق المحادثة</div>' +
            '<div style="font-size:11.5px; opacity:0.9;">تم إنهاء وإغلاق هذا التواصل بنجاح.</div>' +
          '</div>' +
        '</div>';
        if (activeBar) activeBar.style.display = 'none';
        hideCompose();
        if (pollTimer) clearInterval(pollTimer);
      }
    }

    function hideCompose() {
      const panel = document.getElementById('composePanel');
      if (panel) panel.style.display = 'none';
    }

    // Step 1: Select Quick Reason
    function selectQuickReason(button) {
      if (isSubmitting || inCooldown) return;
      document.querySelectorAll('.btn-quick').forEach(b => b.classList.remove('selected'));
      button.classList.add('selected');
      selectedReasonText = button.getAttribute('data-text') || button.getAttribute('data-title');
      checkCanSubmit();
    }

    // Step 2: Rear Camera Only Photo Capture (WebRTC Live Viewfinder + Environment Capture Fallback)
    let rearCameraStream = null;

    async function triggerRearCamera() {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        try {
          // Attempt exact rear camera constraint first, fallback to ideal
          let stream;
          try {
            stream = await navigator.mediaDevices.getUserMedia({
              video: {
                facingMode: { exact: 'environment' },
                width: { ideal: 1280 },
                height: { ideal: 720 }
              },
              audio: false
            });
          } catch (e1) {
            stream = await navigator.mediaDevices.getUserMedia({
              video: {
                facingMode: { ideal: 'environment' },
                width: { ideal: 1280 },
                height: { ideal: 720 }
              },
              audio: false
            });
          }

          rearCameraStream = stream;
          const video = document.getElementById('liveRearVideo');
          if (video) {
            video.srcObject = stream;
            await video.play();
          }
          const modal = document.getElementById('rearCameraModal');
          if (modal) modal.style.display = 'flex';
          return;
        } catch (err) {
          console.warn('getUserMedia rear camera failed or not permitted, falling back to input capture="environment"', err);
        }
      }

      // Fallback: invoke file input with capture="environment"
      const fileInput = document.getElementById('cameraFileInput');
      if (fileInput) fileInput.click();
    }

    function closeRearCameraModal() {
      if (rearCameraStream) {
        rearCameraStream.getTracks().forEach(track => track.stop());
        rearCameraStream = null;
      }
      const video = document.getElementById('liveRearVideo');
      if (video) video.srcObject = null;
      const modal = document.getElementById('rearCameraModal');
      if (modal) modal.style.display = 'none';
    }

    function captureRearCameraPhoto() {
      const video = document.getElementById('liveRearVideo');
      if (!video) return;

      const canvas = document.createElement('canvas');
      const vw = video.videoWidth || 640;
      const vh = video.videoHeight || 480;

      const MAX_DIM = 1000;
      let w = vw;
      let h = vh;
      if (w > MAX_DIM || h > MAX_DIM) {
        if (w > h) {
          h = Math.round((h * MAX_DIM) / w);
          w = MAX_DIM;
        } else {
          w = Math.round((w * MAX_DIM) / h);
          h = MAX_DIM;
        }
      }

      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(video, 0, 0, w, h);
      capturedPhotoBase64 = canvas.toDataURL('image/jpeg', 0.82);

      closeRearCameraModal();

      const previewImg = document.getElementById('photoPreviewImg');
      if (previewImg) previewImg.src = capturedPhotoBase64;
      const promptBox = document.getElementById('cameraPrompt');
      if (promptBox) promptBox.style.display = 'none';
      const previewBox = document.getElementById('cameraPreviewBox');
      if (previewBox) previewBox.style.display = 'flex';
      const card = document.getElementById('cameraCard');
      if (card) card.classList.add('has-photo');

      checkCanSubmit();
      showToast('تم التقاط الصورة بالكاميرا الخلفية بنجاح ');
    }

    // Fallback: Camera Photo Capture (Camera only via capture="environment")
    function onCameraPhotoTaken(event) {
      const file = event.target.files && event.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = function(e) {
        const img = new Image();
        img.onload = function() {
          const canvas = document.createElement('canvas');
          let w = img.width;
          let h = img.height;
          const MAX_DIM = 1000;
          if (w > MAX_DIM || h > MAX_DIM) {
            if (w > h) {
              h = Math.round((h * MAX_DIM) / w);
              w = MAX_DIM;
            } else {
              w = Math.round((w * MAX_DIM) / h);
              h = MAX_DIM;
            }
          }
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, w, h);
          capturedPhotoBase64 = canvas.toDataURL('image/jpeg', 0.78);

          const previewImg = document.getElementById('photoPreviewImg');
          if (previewImg) previewImg.src = capturedPhotoBase64;
          const promptBox = document.getElementById('cameraPrompt');
          if (promptBox) promptBox.style.display = 'none';
          const previewBox = document.getElementById('cameraPreviewBox');
          if (previewBox) previewBox.style.display = 'flex';
          const card = document.getElementById('cameraCard');
          if (card) card.classList.add('has-photo');

          checkCanSubmit();
          showToast('تم التقاط الصورة بالكاميرا الخلفية بنجاح ');
        };
        img.src = e.target.result;
      };
      reader.readAsDataURL(file);
    }

    // Form Validator
    function checkCanSubmit() {
      const btn = document.getElementById('btnSubmitReport');
      const txt = document.getElementById('submitReportText');
      if (!btn || !txt) return;

      if (!selectedReasonText && !capturedPhotoBase64) {
        btn.disabled = true;
        txt.innerText = 'يرجى اختيار سبب التواصل والتقاط صورة بالكاميرا';
      } else if (!selectedReasonText) {
        btn.disabled = true;
        txt.innerText = 'يرجى اختيار سبب التواصل من الخيارات أعلاه';
      } else if (!capturedPhotoBase64) {
        btn.disabled = true;
        txt.innerText = 'يرجى التقاط صورة بالكاميرا أولاً لتفعيل الإرسال ';
      } else {
        btn.disabled = false;
        txt.innerText = ' إرسال التنبيه وصورة الكاميرا لصاحب السيارة';
      }
    }

    // Step 3: Submit Report with Photo
    async function submitReportWithPhoto() {
      if (isSubmitting || !selectedReasonText || !capturedPhotoBase64) return;
      isSubmitting = true;
      const btn = document.getElementById('btnSubmitReport');
      const txt = document.getElementById('submitReportText');
      if (btn) btn.disabled = true;
      if (txt) txt.innerText = 'جاري إرسال البلاغ والصورة...';

      try {
        if (!sessionToken) {
          const initRes = await fetch('/api/v1/reporter/session/init', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ tagCode: TAG_CODE })
          });
          const initData = await initRes.json();
          if (initData.success && initData.sessionToken) {
            sessionToken = initData.sessionToken;
            localStorage.setItem('rakna_stranger_token', sessionToken);
          }
        }

        const res = await fetch('/api/v1/reporter/chats', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tagCode: TAG_CODE,
            contactReason: 'OTHER',
            initialMessage: selectedReasonText,
            sessionToken: sessionToken,
            imageUrl: capturedPhotoBase64,
            isViewOnce: false
          })
        });
        const data = await res.json();

        if (res.status === 403 || data.isBlocked || data.isIgnored) {
          if (data.isBlocked) {
            localStorage.setItem('rakna_status_' + TAG_CODE, 'BLOCKED');
            renderStatusBanner('BLOCKED');
          } else {
            localStorage.setItem('rakna_status_' + TAG_CODE, 'IGNORED');
            renderStatusBanner('IGNORED');
          }
          hideCompose();
          showToast(data.message, true);
          return;
        }

        if (data.success && data.chat) {
          currentChatId = data.chat.id;
          chatStatus = data.chat.status || 'PENDING_ACCEPT';
          localStorage.setItem('rakna_chat_' + TAG_CODE, currentChatId);
          localStorage.setItem('rakna_status_' + TAG_CODE, chatStatus);

          appendMessage(selectedReasonText, 'me', new Date().toISOString(), null, true);
          hideCompose();
          renderStatusBanner(chatStatus);
          startPolling();
          showToast('تم إرسال بلاغك وتوثيق الكاميرا بنجاح لصاحب السيارة ⏳');
        } else {
          showToast(data.message || 'تعذر إرسال البلاغ', true);
          if (btn) btn.disabled = false;
          if (txt) txt.innerText = ' إرسال التنبيه وصورة الكاميرا لصاحب السيارة';
        }
      } catch (err) {
        showToast('حدث خطأ في الاتصال بالخادم. يرجى المحاولة ثانية.', true);
        if (btn) btn.disabled = false;
        if (txt) txt.innerText = ' إرسال التنبيه وصورة الكاميرا لصاحب السيارة';
      } finally {
        isSubmitting = false;
      }
    }

    // Step 4: Send Live Reply (When ACTIVE)
    async function sendLiveReply() {
      const input = document.getElementById('liveMessageInput');
      const text = input ? input.value.trim() : '';
      if (!text || isSendingLive || !currentChatId || !sessionToken) return;

      isSendingLive = true;
      input.value = '';
      appendMessage(text, 'me', new Date().toISOString(), null);

      try {
        const res = await fetch('/api/v1/reporter/chats/' + currentChatId + '/messages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            content: text,
            sessionToken: sessionToken
          })
        });
        const data = await res.json();

        if (res.status === 403 || data.isBlocked || data.isIgnored) {
          if (data.isBlocked) {
            localStorage.setItem('rakna_status_' + TAG_CODE, 'BLOCKED');
            renderStatusBanner('BLOCKED');
          } else {
            localStorage.setItem('rakna_status_' + TAG_CODE, 'IGNORED');
            renderStatusBanner('IGNORED');
          }
          showToast(data.message, true);
        } else if (!data.success) {
          showToast(data.message || 'تعذر إرسال الرسالة', true);
        } else {
          pollMessages();
        }
      } catch (err) {
        showToast('حدث خطأ في الاتصال بالخادم', true);
      } finally {
        isSendingLive = false;
      }
    }

    function appendMessage(text, sender, timeStr, msgId, hasViewOnce = false) {
      if (msgId && knownMessageIds.has(msgId)) return;
      if (msgId) knownMessageIds.add(msgId);

      const cleanText = (text || '').trim();
      const existing = messagesBox.querySelectorAll('.message-item');
      if (existing.length > 0) {
        const lastItem = existing[existing.length - 1];
        const isSameSender = lastItem.classList.contains(sender === 'me' ? 'me' : 'owner');
        const bubble = lastItem.querySelector('.message-bubble');
        if (isSameSender && bubble && bubble.innerText.trim() === cleanText && !hasViewOnce) {
          if (msgId) knownMessageIds.add(msgId);
          return;
        }
      }

      if (emptyState) {
        emptyState.style.display = 'none';
      }

      const item = document.createElement('div');
      item.className = 'message-item ' + (sender === 'me' ? 'me' : (sender === 'system' ? 'system' : 'owner'));
      const senderLabel = sender === 'me' ? 'أنت (المُبلّغ)' : (sender === 'system' ? 'النظام' : 'صاحب المركبة');

      const time = timeStr ? new Date(timeStr).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }) : '';
      let photoBadgeHtml = '';
      if (hasViewOnce) {
        photoBadgeHtml = '<div class="view-once-bubble"><span></span><span>صورة توثيقية مرفقة</span></div>';
      }

      item.innerHTML =
        '<div class="message-bubble">' + escapeHtml(text) + photoBadgeHtml + '</div>' +
        '<div class="message-info">' +
          '<span class="' + (sender === 'owner' ? 'owner-badge' : '') + '">' + senderLabel + '</span>' +
          '<span>•</span>' +
          '<span>' + time + '</span>' +
        '</div>';

      messagesBox.appendChild(item);
      messagesBox.scrollTop = messagesBox.scrollHeight;
    }

    function escapeHtml(string) {
      const div = document.createElement('div');
      div.innerText = string || '';
      return div.innerHTML;
    }

    // Step 5: Live Polling for Owner Responses
    async function pollMessages() {
      if (!currentChatId || !sessionToken) return;
      try {
        const res = await fetch('/api/v1/reporter/chats/' + currentChatId + '/messages?sessionToken=' + encodeURIComponent(sessionToken));
        
        if (res.status === 403 || res.status === 404) {
          const data = await res.json().catch(() => ({}));
          if (data.isExpired) {
            clearWebChatState();
            return;
          }
          if (data.isBlocked) {
            localStorage.setItem('rakna_status_' + TAG_CODE, 'BLOCKED');
            renderStatusBanner('BLOCKED');
          } else if (data.isIgnored) {
            localStorage.setItem('rakna_status_' + TAG_CODE, 'IGNORED');
            renderStatusBanner('IGNORED');
          }
          return;
        }

        const data = await res.json();
        if (data.success) {
          if (data.isExpired || (data.chat && data.chat.status === 'EXPIRED')) {
            clearWebChatState();
            return;
          }
          if (data.chat && data.chat.status) {
            chatStatus = data.chat.status;
            localStorage.setItem('rakna_status_' + TAG_CODE, chatStatus);
            renderStatusBanner(chatStatus);
          }
          if (Array.isArray(data.messages)) {
            data.messages.forEach(msg => {
              const isMe = msg.senderType === 'REPORTER';
              const sType = isMe ? 'me' : (msg.senderType === 'SYSTEM' ? 'system' : 'owner');
              appendMessage(msg.content, sType, msg.createdAt, msg.id, msg.isViewOnce);
            });
          }
        }
      } catch (e) {
        // silent fail on network jitter
      }
    }

    function clearWebChatState() {
      if (pollTimer) {
        clearInterval(pollTimer);
        pollTimer = null;
      }
      localStorage.removeItem('rakna_status_' + TAG_CODE);
      localStorage.removeItem('rakna_chat_' + TAG_CODE);
      localStorage.removeItem('rakna_ignored_until_' + TAG_CODE);
      chatStatus = null;
      currentChatId = null;
      capturedPhotoBase64 = null;
      selectedReasonText = '';

      const activeBar = document.getElementById('activeChatInputBar');
      if (activeBar) activeBar.style.display = 'none';

      const box = document.getElementById('statusBannerBox');
      if (box) {
        box.innerHTML = '';
        box.style.display = 'none';
      }

      if (messagesBox) {
        messagesBox.querySelectorAll('.message-item').forEach(el => el.remove());
        if (emptyState) emptyState.style.display = 'block';
      }

      const panel = document.getElementById('composePanel');
      if (panel) panel.style.display = 'block';
      const promptBox = document.getElementById('cameraPrompt');
      if (promptBox) promptBox.style.display = 'flex';
      const previewBox = document.getElementById('cameraPreviewBox');
      if (previewBox) previewBox.style.display = 'none';
      const card = document.getElementById('cameraCard');
      if (card) card.classList.remove('has-photo');
      document.querySelectorAll('.btn-quick').forEach(b => b.classList.remove('selected'));
      checkCanSubmit();
    }

    function resetIgnoredState() {
      clearWebChatState();
      localStorage.removeItem('rakna_chat_' + TAG_CODE);
      localStorage.removeItem('rakna_ignored_until_' + TAG_CODE);
      chatStatus = null;
      currentChatId = null;
      capturedPhotoBase64 = null;
      selectedReasonText = '';

      const box = document.getElementById('statusBannerBox');
      if (box) {
        box.innerHTML = '<div class="status-banner active" style="background:rgba(16,185,129,0.15); border-color:rgba(16,185,129,0.4);">' +
          '<span style="font-size:20px;"></span>' +
          '<div style="flex:1;">' +
            '<div style="font-weight:800; font-size:13px; color:#10B981;">انتهت فترة الانتظار (3 دقائق)</div>' +
            '<div style="font-size:11.5px; opacity:0.9;">يمكنك الآن اختيار سبب البلاغ والتقاط صورة بالكاميرا الخلفية وإرسال تنبيه جديد.</div>' +
          '</div>' +
        '</div>';
      }

      const panel = document.getElementById('composePanel');
      if (panel) panel.style.display = 'block';
      const promptBox = document.getElementById('cameraPrompt');
      if (promptBox) promptBox.style.display = 'flex';
      const previewBox = document.getElementById('cameraPreviewBox');
      if (previewBox) previewBox.style.display = 'none';
      const card = document.getElementById('cameraCard');
      if (card) card.classList.remove('has-photo');
      document.querySelectorAll('.btn-quick').forEach(b => b.classList.remove('selected'));
      checkCanSubmit();
      showToast('يمكنك الآن إرسال تنبيه جديد لصاحب السيارة ');
    }

    function startPolling() {
      if (pollTimer) clearInterval(pollTimer);
      pollTimer = setInterval(pollMessages, 2500);
      pollMessages();
    }

    // Startup Execution Check
    if (chatStatus === 'EXPIRED') {
      clearWebChatState();
    } else {
      const storedIgnoredUntil = Number(localStorage.getItem('rakna_ignored_until_' + TAG_CODE));
      if (chatStatus === 'IGNORED' && storedIgnoredUntil && Date.now() >= storedIgnoredUntil) {
        localStorage.removeItem('rakna_status_' + TAG_CODE);
        localStorage.removeItem('rakna_chat_' + TAG_CODE);
        localStorage.removeItem('rakna_ignored_until_' + TAG_CODE);
        chatStatus = null;
        currentChatId = null;
      }

      if (chatStatus === 'IGNORED' || chatStatus === 'BLOCKED') {
        hideCompose();
        renderStatusBanner(chatStatus);
      } else if (currentChatId && sessionToken) {
        hideCompose();
        renderStatusBanner(chatStatus || 'PENDING_ACCEPT');
        startPolling();
      }
    }

    // ════════════════════════════════════════════════════════════════════════
    // 🛡️ ANTI-INSPECT & DEVTOOLS INTEGRITY GUARD
    // ════════════════════════════════════════════════════════════════════════
    (function initSecurityGuard() {
      var isTriggered = false;

      function triggerInspectBlock(reason) {
        if (isTriggered) return;
        isTriggered = true;
        try {
          var overlay = document.getElementById('inspectShieldOverlay');
          if (overlay) {
            overlay.style.display = 'flex';
          }
          // Clear active form and disable inputs
          var replyInput = document.getElementById('liveReplyInput');
          if (replyInput) replyInput.disabled = true;
          var submitBtn = document.getElementById('btnSubmitReport');
          if (submitBtn) submitBtn.disabled = true;
        } catch (e) {}
      }

      // 1. Block Context Menu (Right Click)
      document.addEventListener('contextmenu', function(e) {
        e.preventDefault();
        return false;
      }, true);

      // 2. Block Inspect Keyboard Shortcuts
      document.addEventListener('keydown', function(e) {
        var k = (e.key || '').toLowerCase();
        var code = e.keyCode || e.which;

        // F12
        if (k === 'f12' || code === 123) {
          e.preventDefault();
          e.stopPropagation();
          triggerInspectBlock('F12');
          return false;
        }

        // Ctrl+Shift+I / J / C (Windows/Linux) or Cmd+Opt+I / J / C (Mac)
        if ((e.ctrlKey && e.shiftKey) || (e.metaKey && e.altKey)) {
          if (k === 'i' || k === 'j' || k === 'c' || code === 73 || code === 74 || code === 67) {
            e.preventDefault();
            e.stopPropagation();
            triggerInspectBlock('Shortcut');
            return false;
          }
        }

        // Ctrl+U or Cmd+U (View Source)
        if ((e.ctrlKey || e.metaKey) && (k === 'u' || code === 85)) {
          e.preventDefault();
          e.stopPropagation();
          triggerInspectBlock('ViewSource');
          return false;
        }

        // Ctrl+S or Cmd+S (Save)
        if ((e.ctrlKey || e.metaKey) && (k === 's' || code === 83)) {
          e.preventDefault();
          e.stopPropagation();
          return false;
        }
      }, true);

      // 3. Client-Side Desktop Emulation & Spoofing Guard
      // When a user opens DevTools on desktop (Windows / Mac) and selects mobile device mode (e.g. iPhone 16),
      // navigator.platform and userAgentData still expose Windows/Mac desktop environment!
      function checkDesktopSpoofing() {
        try {
          var p = (navigator.platform || '').toLowerCase();
          var uad = navigator.userAgentData;
          var uadPlatform = (uad && uad.platform ? uad.platform : '').toLowerCase();

          var isWin = p.indexOf('win') !== -1 || uadPlatform.indexOf('win') !== -1;
          var isMac = (p.indexOf('macintel') !== -1 && navigator.maxTouchPoints <= 1) || uadPlatform.indexOf('mac') !== -1;
          var isLinuxDesktop = p.indexOf('linux') !== -1 && !/android/i.test(navigator.userAgent);

          // Check if device uses fine mouse pointer with hover
          var hasMouseHover = window.matchMedia && window.matchMedia('(hover: hover) and (pointer: fine)').matches;

          if ((isWin || isMac || isLinuxDesktop) && hasMouseHover) {
            // PC browser spoofing mobile via DevTools Device Toolbar
            window.location.href = window.location.pathname + '?guard=desktop';
          }
        } catch (e) {}
      }
      checkDesktopSpoofing();

      // 4. Docked DevTools Window Metrics Detection
      function checkDevToolsDimensions() {
        try {
          var widthDiff = window.outerWidth - window.innerWidth;
          var heightDiff = window.outerHeight - window.innerHeight;
          // Docked DevTools creates a substantial outer/inner discrepancy
          if (widthDiff > 160 || heightDiff > 160) {
            triggerInspectBlock('DevTools Dimension');
          }
        } catch (e) {}
      }
      window.addEventListener('resize', checkDevToolsDimensions);
      setTimeout(checkDevToolsDimensions, 1000);

      // 5. Anti-Debugging timing detector
      setInterval(function() {
        var start = performance.now();
        debugger;
        var end = performance.now();
        if (end - start > 100) {
          triggerInspectBlock('Debugger');
        }
      }, 1000);
    })();
  </script>
</body>
</html>`;

      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader(
        'Content-Security-Policy',
        "default-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; script-src-attr 'unsafe-inline'; style-src 'self' https: 'unsafe-inline'; img-src * data: blob:; font-src * data:; connect-src *;"
      );
      res.send(html);
    } catch (error) {
      console.error('Error rendering web chat page:', error);
      res.status(500).send('تعذر تحميل صفحة ركنة');
    }
  }

  private static buildDesktopGuardHtml(pageUrl: string, qrCodeDataUrl: string): string {
    return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>ركنة - هذه الخاصية تعمل فقط من خلال الهاتف</title>
  <link rel="icon" type="image/png" href="/rakna_applogo.png">
  <link rel="apple-touch-icon" href="/rakna_applogo.png">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&display=swap" rel="stylesheet">
  <style>
    :root {
      --primary: #EAB308;
      --primary-light: #FEF08A;
      --primary-dark: #CA8A04;
      --bg-page: #F8FAFC;
      --card-bg: #FFFFFF;
      --card-border: #E2E8F0;
      --text-main: #0F172A;
      --text-muted: #64748B;
    }
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
      font-family: 'Cairo', system-ui, -apple-system, sans-serif;
    }
    body {
      background-color: var(--bg-page);
      background-image: 
        radial-gradient(circle at 50% 15%, rgba(250, 204, 21, 0.22) 0%, transparent 60%),
        radial-gradient(circle at 10% 90%, rgba(241, 245, 249, 0.8) 0%, transparent 50%),
        radial-gradient(circle at 90% 90%, rgba(234, 179, 8, 0.12) 0%, transparent 50%);
      color: var(--text-main);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 30px 20px;
      user-select: none;
      -webkit-user-select: none;
    }
    .guard-card {
      background: #FFFFFF;
      border: 1px solid #E2E8F0;
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
      border-radius: 28px;
      max-width: 580px;
      width: 100%;
      padding: 40px 32px;
      text-align: center;
      box-shadow: 0 25px 60px rgba(0, 0, 0, 0.08), 0 0 40px rgba(234, 179, 8, 0.15);
      animation: fadeIn 0.6s cubic-bezier(0.16, 1, 0.3, 1);
    }
    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(20px) scale(0.97); }
      to { opacity: 1; transform: translateY(0) scale(1); }
    }
    .app-logo {
      width: 82px;
      height: 82px;
      border-radius: 22px;
      margin: 0 auto 20px;
      box-shadow: 0 8px 30px rgba(234, 179, 8, 0.35);
      border: 2px solid rgba(234, 179, 8, 0.45);
      background: #FFFFFF;
      display: block;
      object-fit: cover;
    }
    .device-badge {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 6px 16px;
      border-radius: 20px;
      background: rgba(239, 68, 68, 0.10);
      border: 1px solid rgba(239, 68, 68, 0.25);
      color: #DC2626;
      font-size: 13px;
      font-weight: 700;
      margin-bottom: 18px;
    }
    .guard-title {
      font-size: 24px;
      font-weight: 900;
      color: #0F172A;
      line-height: 1.35;
      margin-bottom: 12px;
      letter-spacing: -0.3px;
    }
    .guard-title span {
      color: #CA8A04;
    }
    .guard-desc {
      font-size: 14.5px;
      line-height: 1.7;
      color: #64748B;
      margin-bottom: 26px;
    }
    .qr-container {
      background: #F8FAFC;
      border: 1.5px dashed rgba(234, 179, 8, 0.45);
      border-radius: 22px;
      padding: 24px 20px;
      margin-bottom: 24px;
      display: flex;
      flex-direction: column;
      align-items: center;
      box-shadow: 0 4px 18px rgba(234, 179, 8, 0.06);
    }
    .qr-box {
      width: 190px;
      height: 190px;
      background: #FFFFFF;
      border-radius: 16px;
      padding: 10px;
      box-shadow: 0 8px 25px rgba(0, 0, 0, 0.08);
      border: 1px solid #E2E8F0;
      display: flex;
      align-items: center;
      justify-content: center;
      margin-bottom: 14px;
    }
    .qr-box img {
      width: 100%;
      height: 100%;
      display: block;
      border-radius: 8px;
    }
    .qr-hint {
      font-size: 13px;
      font-weight: 700;
      color: #854D0E;
    }
    .platforms-row {
      display: flex;
      justify-content: center;
      gap: 12px;
      flex-wrap: wrap;
      margin-bottom: 20px;
    }
    .platform-pill {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 6px 14px;
      border-radius: 12px;
      background: #F1F5F9;
      border: 1px solid #E2E8F0;
      font-size: 12px;
      font-weight: 700;
      color: #334155;
    }
    .copy-box {
      display: flex;
      align-items: center;
      gap: 8px;
      background: #F1F5F9;
      border: 1px solid #CBD5E1;
      border-radius: 14px;
      padding: 8px 12px;
      direction: ltr;
    }
    .copy-box input {
      flex: 1;
      background: transparent;
      border: none;
      color: #0F172A;
      font-size: 12px;
      font-family: monospace;
      outline: none;
      user-select: text;
      -webkit-user-select: text;
    }
    .copy-btn {
      background: linear-gradient(135deg, #FACC15 0%, #EAB308 100%);
      color: #0F172A;
      border: none;
      padding: 8px 16px;
      border-radius: 10px;
      font-weight: 800;
      font-size: 12px;
      cursor: pointer;
      font-family: 'Cairo', sans-serif;
      transition: all 0.2s;
      box-shadow: 0 4px 12px rgba(234, 179, 8, 0.3);
    }
    .copy-btn:hover {
      transform: translateY(-1px);
      box-shadow: 0 6px 16px rgba(234, 179, 8, 0.45);
    }
    .footer-note {
      font-size: 11.5px;
      color: #64748B;
      margin-top: 20px;
    }
  </style>
</head>
<body>
  <div class="guard-card">
    <img src="/rakna_applogo.png" alt="ركنة - Rakna" class="app-logo" />
    <div class="device-badge">
      <span>🚫</span>
      <span>خاصية غير مدعومة على أجهزة الكمبيوتر</span>
    </div>
    <h1 class="guard-title">هذه الخاصية تعمل فقط من خلال <span>الهاتف المحمول</span></h1>
    <p class="guard-desc">
      عذراً، نظام وتطبيق <strong>"ركنة"</strong> مصمم للتواصل المباشر والتوثيق الآمن عبر <strong>الهواتف الذكية والأجهزة اللوحية فقط</strong> (Android و iOS).<br>
      لحماية خصوصية صاحب السيارة ومنع الرسائل المزيفة، تم قصر الخدمة على الهواتف المحمولة.
    </p>

    <div class="qr-container">
      <div class="qr-box">
        ${qrCodeDataUrl ? `<img src="${qrCodeDataUrl}" alt="امسح الرمز بهاتفك" />` : ''}
      </div>
      <div class="qr-hint">📷 افتح كاميرا هاتفك وامسح الرمز للمتابعة فوراً</div>
    </div>

    <div class="platforms-row">
      <div class="platform-pill">📱 هواتف وتابلت أندرويد (Android)</div>
      <div class="platform-pill">🍏 هواتف آيفون وآيباد (iOS)</div>
    </div>

    <div class="copy-box">
      <input type="text" value="${pageUrl}" id="pageUrlInput" readonly />
      <button class="copy-btn" onclick="copyLink()">نسخ الرابط</button>
    </div>

    <p class="footer-note">منظومة ركنة الذكية لحل أزمة الركنات وحماية المركبات • بخصوصية 100%</p>
  </div>

  <script>
    function copyLink() {
      var input = document.getElementById('pageUrlInput');
      input.select();
      input.setSelectionRange(0, 99999);
      navigator.clipboard.writeText(input.value).then(function() {
        alert('تم نسخ الرابط! يمكنك إرساله لهاتفك عبر واتساب أو تيليجرام لفتحه.');
      }).catch(function() {
        alert('يمكنك تحديد الرابط ونسخه يدوياً.');
      });
    }

    // Context menu and key shortcut protection on desktop guard
    document.addEventListener('contextmenu', function(e) {
      e.preventDefault();
      return false;
    });
    document.addEventListener('keydown', function(e) {
      var k = (e.key || '').toLowerCase();
      var code = e.keyCode || e.which;
      if (k === 'f12' || code === 123) { e.preventDefault(); return false; }
      if ((e.ctrlKey && e.shiftKey) || (e.metaKey && e.altKey)) {
        if (k === 'i' || k === 'j' || k === 'c' || code === 73 || code === 74 || code === 67) { e.preventDefault(); return false; }
      }
      if ((e.ctrlKey || e.metaKey) && (k === 'u' || code === 85)) { e.preventDefault(); return false; }
    });

    // iPadOS Safari touch detection fallback
    (function() {
      var ua = navigator.userAgent || '';
      var isTouchMac = /Macintosh/i.test(ua) && navigator.maxTouchPoints > 1;
      if (isTouchMac && window.location.search.indexOf('force_mobile=1') === -1) {
        var sep = window.location.search ? '&' : '?';
        window.location.href = window.location.href + sep + 'force_mobile=1';
      }
    })();
  </script>
</body>
</html>`;
  }
}
