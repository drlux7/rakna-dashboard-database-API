import { Request, Response } from 'express';
import { prisma } from '../config/prisma';

export class WebChatController {
  /**
   * Render the public stranger web chat page for a tag
   * GET /t/:tagCode
   */
  static async renderTagPage(req: Request, res: Response): Promise<void> {
    try {
      const rawTag = (req.params.tagCode as string) || '';
      const cleanTag = rawTag.startsWith('#') ? rawTag : `#${rawTag}`;

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
      --primary: #D4AF37;
      --primary-light: #F3E5AB;
      --primary-dark: #AA820A;
      --bg-dark: #0B0F19;
      --card-bg: rgba(22, 30, 49, 0.75);
      --card-border: rgba(212, 175, 55, 0.2);
      --text-main: #F8FAFC;
      --text-muted: #94A3B8;
      --bubble-user: #D4AF37;
      --bubble-owner: #1E293B;
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
      background-color: var(--bg-dark);
      background-image: 
        radial-gradient(circle at 50% 0%, rgba(212, 175, 55, 0.15) 0%, transparent 50%),
        radial-gradient(circle at 100% 100%, rgba(30, 41, 59, 0.4) 0%, transparent 40%);
      color: var(--text-main);
      min-height: 100vh;
      display: flex;
      flex-direction: column;
    }

    /* Top Sticky App Download Banner */
    .app-banner {
      position: sticky;
      top: 0;
      z-index: 100;
      background: rgba(15, 23, 42, 0.92);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      border-bottom: 1px solid rgba(212, 175, 55, 0.25);
      padding: 10px 16px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4);
    }
    .app-banner-left {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .app-logo-badge {
      width: 40px;
      height: 40px;
      border-radius: 10px;
      background: linear-gradient(135deg, #D4AF37 0%, #8A6D1C 100%);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 20px;
      box-shadow: 0 2px 8px rgba(212, 175, 55, 0.3);
    }
    .app-banner-text h4 {
      font-size: 14px;
      font-weight: 700;
      color: #FFF;
      line-height: 1.2;
    }
    .app-banner-text p {
      font-size: 11px;
      color: var(--primary-light);
      margin-top: 2px;
    }
    .btn-download {
      background: linear-gradient(135deg, var(--primary) 0%, var(--primary-dark) 100%);
      color: #0B0F19;
      font-size: 12px;
      font-weight: 800;
      padding: 8px 16px;
      border-radius: 20px;
      text-decoration: none;
      display: flex;
      align-items: center;
      gap: 6px;
      box-shadow: 0 4px 12px rgba(212, 175, 55, 0.35);
      transition: all 0.2s ease;
      white-space: nowrap;
    }
    .btn-download:hover {
      transform: translateY(-1px);
      box-shadow: 0 6px 16px rgba(212, 175, 55, 0.5);
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
      background: var(--card-bg);
      border: 1px solid var(--card-border);
      border-radius: 16px;
      padding: 16px;
      margin-bottom: 16px;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
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
      background: linear-gradient(90deg, var(--primary) 0%, #F59E0B 100%);
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
      background: rgba(16, 185, 129, 0.15);
      color: #34D399;
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
      color: #FFF;
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
      background: rgba(255, 255, 255, 0.06);
      border: 1px solid rgba(255, 255, 255, 0.1);
      padding: 4px 10px;
      border-radius: 8px;
      color: var(--text-muted);
    }
    .meta-tag b {
      color: #FFF;
    }
    .zero-knowledge-notice {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 11px;
      color: var(--text-muted);
      margin-top: 10px;
      padding-top: 10px;
      border-top: 1px dashed rgba(255, 255, 255, 0.08);
    }

    /* Inactive / Error State Cards */
    .state-card {
      text-align: center;
      padding: 48px 24px 40px;
      background: var(--card-bg);
      border: 1px solid var(--card-border);
      border-radius: 20px;
      margin: 48px auto;
      max-width: 440px;
      position: relative;
      overflow: hidden;
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
      color: #FFF;
      margin-bottom: 10px;
      line-height: 1.3;
    }
    .state-body {
      font-size: 13px;
      color: var(--text-muted);
      line-height: 1.7;
      max-width: 340px;
      margin: 0 auto 24px;
    }
    .state-body b { color: #CBD5E1; }
    .state-cta {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      background: linear-gradient(135deg, var(--primary) 0%, var(--primary-dark) 100%);
      color: #0B0F19;
      font-size: 13px;
      font-weight: 800;
      padding: 12px 24px;
      border-radius: 24px;
      text-decoration: none;
      box-shadow: 0 4px 16px rgba(212, 175, 55, 0.35);
      transition: all 0.2s ease;
    }
    .state-cta:hover { transform: translateY(-2px); box-shadow: 0 6px 20px rgba(212,175,55,0.5); }
    .state-tag-pill {
      display: inline-block;
      margin-bottom: 16px;
      background: rgba(255,255,255,0.06);
      border: 1px solid rgba(255,255,255,0.12);
      padding: 4px 14px;
      border-radius: 20px;
      font-size: 13px;
      color: var(--text-muted);
      font-weight: 700;
      letter-spacing: 0.5px;
    }

    /* Chat Section */
    .chat-section {
      flex: 1;
      display: flex;
      flex-direction: column;
      background: var(--card-bg);
      border: 1px solid var(--card-border);
      border-radius: 20px;
      overflow: hidden;
      box-shadow: 0 10px 40px rgba(0, 0, 0, 0.4);
    }
    .chat-header {
      padding: 12px 16px;
      background: rgba(15, 23, 42, 0.6);
      border-bottom: 1px solid rgba(212, 175, 55, 0.15);
      display: flex;
      align-items: center;
      justify-content: space-between;
    }
    .chat-header-title {
      font-size: 13px;
      font-weight: 700;
      color: var(--primary-light);
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .chat-lock-tag {
      font-size: 11px;
      background: rgba(212, 175, 55, 0.15);
      color: var(--primary);
      border: 1px solid rgba(212, 175, 55, 0.3);
      padding: 2px 8px;
      border-radius: 12px;
      font-weight: 600;
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
    }
    .empty-state {
      margin: auto;
      text-align: center;
      color: var(--text-muted);
      padding: 20px;
    }
    .empty-icon {
      font-size: 40px;
      margin-bottom: 8px;
      color: var(--primary);
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
      background: linear-gradient(135deg, #D4AF37 0%, #C49726 100%);
      color: #0B0F19;
      font-weight: 600;
      border-bottom-right-radius: 4px;
    }
    .message-item.owner .message-bubble {
      background: #1E293B;
      color: #F8FAFC;
      border: 1px solid rgba(212, 175, 55, 0.25);
      border-bottom-left-radius: 4px;
    }
    .message-info {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 10px;
      margin-top: 3px;
      color: var(--text-muted);
    }
    .message-item.me .message-info {
      justify-content: flex-start;
    }
    .message-item.owner .message-info {
      justify-content: flex-end;
    }
    .owner-badge {
      color: var(--primary);
      font-weight: 700;
    }

    /* Quick Messages Panel */
    .quick-panel {
      padding: 14px;
      background: rgba(15, 23, 42, 0.85);
      border-top: 1px solid rgba(212, 175, 55, 0.15);
    }
    .quick-title {
      font-size: 12px;
      font-weight: 700;
      color: var(--primary-light);
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
      background: rgba(30, 41, 59, 0.8);
      border: 1px solid rgba(212, 175, 55, 0.25);
      color: #F1F5F9;
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
      background: rgba(212, 175, 55, 0.18);
      border-color: var(--primary);
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

    /* Anti-Spam Badges & Limits */
    .quota-badge {
      font-size: 11px;
      font-weight: 700;
      color: #F1F5F9;
      background: rgba(255, 255, 255, 0.08);
      border: 1px solid rgba(255, 255, 255, 0.15);
      padding: 3px 8px;
      border-radius: 10px;
      margin-right: auto;
    }
    .quota-badge b {
      color: var(--primary);
    }
    .cooldown-badge {
      font-size: 11px;
      font-weight: 700;
      color: #F59E0B;
      background: rgba(245, 158, 11, 0.15);
      border: 1px solid rgba(245, 158, 11, 0.35);
      padding: 3px 8px;
      border-radius: 10px;
      animation: pulse 1s infinite;
    }
    .limit-reached-banner {
      margin-bottom: 10px;
      padding: 10px 14px;
      border-radius: 12px;
      background: rgba(239, 68, 68, 0.15);
      border: 1px solid rgba(239, 68, 68, 0.4);
      color: #FCA5A5;
      font-size: 12px;
      font-weight: 700;
      text-align: center;
      line-height: 1.4;
    }
    .toast-popup {
      position: fixed;
      top: 60px;
      left: 50%;
      transform: translateX(-50%);
      background: rgba(15, 23, 42, 0.95);
      border: 1px solid var(--primary);
      color: #FFF;
      padding: 10px 20px;
      border-radius: 14px;
      font-size: 12.5px;
      font-weight: 700;
      box-shadow: 0 10px 25px rgba(0,0,0,0.5);
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
      background: rgba(212, 175, 55, 0.08);
      border: 1px dashed rgba(212, 175, 55, 0.3);
      font-size: 11px;
      color: var(--primary-light);
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
      color: var(--text-muted);
    }
    .footer a {
      color: var(--primary);
      text-decoration: none;
      font-weight: 700;
    }
  </style>
</head>
<body>

  <!-- Sticky Top App Download Banner -->
  <header class="app-banner">
    <div class="app-banner-left">
      <div class="app-logo-badge">🚗</div>
      <div class="app-banner-text">
        <h4>تطبيق ركنة RAKNA</h4>
        <p>حمّل التطبيق لتجربة تنبيهات وإشعارات أسرع</p>
      </div>
    </div>
    <a href="https://rakna.app/download" target="_blank" class="btn-download" id="downloadAppBtn">
      <span>تحميل التطبيق</span>
      <span>⬇️</span>
    </a>
  </header>

  <main class="container">
    ${ pageState === 'NOT_FOUND' ? `
      <!-- SCENARIO 1a: Tag not found in system -->
      <div class="state-card not-found">
        <span class="state-icon">❓</span>
        <div class="state-tag-pill">${cleanTag}</div>
        <h2 class="state-title">ملصق غير معرّف</h2>
        <p class="state-body">
          لا يوجد ملصق ركنة مسجّل بهذا الرمز في نظامنا.<br>
          إذا اشتريت المنتج حديثاً، تأكد من صحة المسح أو تواصل مع الدعم.
        </p>
        <a href="https://rakna.app" class="state-cta">🌐 موقع ركنة</a>
      </div>

    ` : pageState === 'NOT_ACTIVATED' ? `
      <!-- SCENARIO 1b: Tag exists but owner hasn't activated it yet -->
      <div class="state-card not-activated">
        <span class="state-icon">⏳</span>
        <div class="state-tag-pill">${cleanTag}</div>
        <h2 class="state-title">هذا الملصق غير مفعّل بعد</h2>
        <p class="state-body">
          الملصق موجود في النظام ولكن المالك لم يقم بتفعيله بعد.<br><br>
          <b>إذا كنت المالك:</b> افتح تطبيق ركنة وادخل كود التفعيل المرفق في الكرت داخل العلبة.
        </p>
        <a href="https://rakna.app/download" class="state-cta">📲 تحميل تطبيق ركنة للتفعيل</a>
      </div>

    ` : pageState === 'PAUSED' ? `
      <!-- SCENARIO 1c: Tag is paused by owner -->
      <div class="state-card paused">
        <span class="state-icon">⏸️</span>
        <div class="state-tag-pill">${cleanTag}</div>
        <h2 class="state-title">الملصق متوقف مؤقتاً</h2>
        <p class="state-body">
          أوقف صاحب السيارة تشغيل هذا الملصق مؤقتاً.<br>
          لا يمكن إرسال أي تنبيه في الوقت الحالي.<br><br>
          <b>إذا كانت هناك حالة طارئة</b> يُرجى التواصل مع إدارة المبنى أو الجهات المختصة.
        </p>
        <a href="https://rakna.app" class="state-cta">🏠 الرئيسية</a>
      </div>

    ` : `
      <!-- Protected Vehicle Card -->
      <section class="car-card">
        <div class="car-header">
          <div class="car-title">
            <span>🚗</span>
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
          <span>🛡️</span>
          <span>خصوصية تامة: لا يتم كشف اسم أو رقم هاتف أي من الطرفين نهائياً.</span>
        </div>
      </section>

      <!-- Anonymous Quick Chat Area -->
      <section class="chat-section">
        <div class="chat-header">
          <div class="chat-header-title">
            <span>💬</span>
            <span>محادثة فورية مباشرة</span>
          </div>
          <div class="chat-lock-tag">
            🔒 الرسائل السريعة المعتمدة فقط
          </div>
        </div>

        <!-- Messages Box -->
        <div class="messages-box" id="messagesBox">
          <div class="empty-state" id="emptyState">
            <div class="empty-icon">⚡</div>
            <h5 style="color: #FFF; font-size: 14px; margin-bottom: 4px;">اختر رسالة سريعة من الأسفل</h5>
            <p style="font-size: 12px;">سيتم إشعار صاحب السيارة فوراً على هاتفه برسالتك.</p>
          </div>
        </div>

        <!-- Quick Canned Messages Buttons -->
        <div class="quick-panel">
          <div class="quick-title">
            <span>⚡</span>
            <span>اضغط لإرسال تنبيه فوري لصاحب السيارة:</span>
            <div id="quotaBadge" class="quota-badge">المتبقي: <b id="remainingCount">5</b> رسائل</div>
            <div id="cooldownBadge" class="cooldown-badge" style="display:none;">⏳ انتظر <b id="countdownSec">15</b>ث</div>
          </div>

          <div id="limitReachedBanner" class="limit-reached-banner" style="display:none;">
            ⚠️ وصلت للحد الأقصى (5 رسائل) • يرجى انتظار رد صاحب السيارة للمتابعة.
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
                onclick="sendQuickMessage(this)"
              >
                <span class="btn-quick-icon">${['🚗', '🪟', '💡', '⚠️', '⏳', '🙏', '🚨', '📢'][idx % 8]}</span>
                <span>${item.title}</span>
              </button>
            `
              )
              .join('')}
          </div>

          <div class="input-locked-banner">
            <span>🔒</span>
            <span>الكتابة الحرة مقفلة لحمايتك وحماية خصوصية صاحب السيارة.</span>
          </div>
        </div>
      </section>
      `}
  </main>

  <footer class="footer">
    <p>نظام ركنة الذكي لحماية خصوصية السيارات © ${new Date().getFullYear()}</p>
  </footer>

  <script>
    // 1. Safe Deep Link Attempt ONLY on mobile devices
    const TAG_CODE = "${cleanTag}";
    (function tryDeepLink() {
      try {
        const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
        if (isMobile) {
          const appUrl = "rakna://tag/" + encodeURIComponent(TAG_CODE.replace('#', ''));
          const iframe = document.createElement('iframe');
          iframe.style.display = 'none';
          iframe.src = appUrl;
          document.body.appendChild(iframe);
          setTimeout(() => { if (iframe.parentNode) iframe.parentNode.removeChild(iframe); }, 1000);
        }
      } catch (e) {
        // App not installed, continue in browser silently
      }
    })();

    // 2. Chat Session & Anti-Spam State
    let sessionToken = localStorage.getItem('rakna_stranger_token') || null;
    let currentChatId = localStorage.getItem('rakna_chat_' + TAG_CODE) || null;
    let isSending = false;
    let pollTimer = null;
    let cooldownTimer = null;
    let remainingQuota = 5;
    let inCooldown = false;
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
        toast.innerHTML = '<span>⚠️</span><span>' + escapeHtml(text) + '</span>';
      } else {
        toast.innerHTML = '<span>✅</span><span>' + escapeHtml(text) + '</span>';
      }
      document.body.appendChild(toast);
      setTimeout(() => { if (toast.parentNode) toast.parentNode.removeChild(toast); }, 4000);
    }

    // Anti-Spam Quota Manager
    function updateQuota(count) {
      remainingQuota = Math.max(0, count);
      if (remainingCount) {
        remainingCount.innerText = remainingQuota;
      }
      if (remainingQuota <= 0) {
        if (limitReachedBanner) limitReachedBanner.style.display = 'block';
        disableButtons(true);
      } else {
        if (limitReachedBanner) limitReachedBanner.style.display = 'none';
        if (!inCooldown && !isSending) {
          disableButtons(false);
        }
      }
    }

    // Anti-Spam Cooldown Timer
    function startCooldown(seconds = 15) {
      if (cooldownTimer) clearInterval(cooldownTimer);
      inCooldown = true;
      disableButtons(true);

      let currentSec = seconds;
      if (cooldownBadge && countdownSec) {
        cooldownBadge.style.display = 'inline-flex';
        countdownSec.innerText = currentSec;
      }

      cooldownTimer = setInterval(() => {
        currentSec--;
        if (countdownSec) countdownSec.innerText = currentSec;

        if (currentSec <= 0) {
          clearInterval(cooldownTimer);
          cooldownTimer = null;
          inCooldown = false;
          if (cooldownBadge) cooldownBadge.style.display = 'none';
          if (remainingQuota > 0 && !isSending) {
            disableButtons(false);
          }
        }
      }, 1000);
    }

    // 3. Send Quick Message with Anti-Spam Protection
    async function sendQuickMessage(button) {
      if (isSending || inCooldown || remainingQuota <= 0) return;
      const text = button.getAttribute('data-text');
      const title = button.getAttribute('data-title');
      if (!text) return;

      isSending = true;
      disableButtons(true);
      const originalHtml = button.innerHTML;
      button.innerHTML = '<span class="btn-quick-icon">⏳</span><span>جاري الإرسال...</span>';

      try {
        // Ensure session token
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

        // Helper to create a new chat
        async function createNewChat() {
          const res = await fetch('/api/v1/reporter/chats', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              tagCode: TAG_CODE,
              contactReason: 'OTHER',
              initialMessage: text,
              sessionToken: sessionToken
            })
          });
          const data = await res.json();
          if (data.success && data.chat) {
            currentChatId = data.chat.id;
            localStorage.setItem('rakna_chat_' + TAG_CODE, currentChatId);
            appendMessage(text, 'me', new Date().toISOString());
            startPolling();
            if (data.remainingMessages !== undefined) updateQuota(data.remainingMessages);
            startCooldown(data.cooldownSeconds || 15);
            showToast('تم إرسال تنبيهك لصاحب السيارة بنجاح');
            return true;
          } else {
            showToast(data.message || 'تعذر إرسال التنبيه لصاحب السيارة', true);
            if (data.retryAfter) startCooldown(data.retryAfter);
            if (data.limitReached) updateQuota(0);
            return false;
          }
        }

        // If no existing chat, create new
        if (!currentChatId) {
          await createNewChat();
        } else {
          // Send message to existing chat
          const sendRes = await fetch('/api/v1/reporter/chats/' + currentChatId + '/messages', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              content: text,
              sessionToken: sessionToken
            })
          });
          const sendData = await sendRes.json();
          if (sendData.success) {
            appendMessage(text, 'me', new Date().toISOString());
            if (sendData.remainingMessages !== undefined) updateQuota(sendData.remainingMessages);
            startCooldown(sendData.cooldownSeconds || 15);
            showToast('تم إرسال الرسالة بنجاح');
          } else if (sendRes.status === 429) {
            showToast(sendData.message || 'يرجى الانتظار قليلاً قبل إرسال رسالة أخرى', true);
            if (sendData.retryAfter) startCooldown(sendData.retryAfter);
            if (sendData.limitReached) updateQuota(0);
          } else {
            // Existing chat failed or expired -> clear and recreate automatically
            localStorage.removeItem('rakna_chat_' + TAG_CODE);
            currentChatId = null;
            await createNewChat();
          }
        }
      } catch (err) {
        console.error('Error sending message:', err);
        showToast('حدث خطأ في الاتصال بالخادم. يرجى المحاولة ثانية.', true);
      } finally {
        button.innerHTML = originalHtml;
        isSending = false;
        if (!inCooldown && remainingQuota > 0) {
          disableButtons(false);
        }
      }
    }

    function disableButtons(disabled) {
      const btns = document.querySelectorAll('.btn-quick');
      btns.forEach(b => b.disabled = disabled);
    }

    function appendMessage(text, sender, timeStr, msgId) {
      if (msgId && knownMessageIds.has(msgId)) return;
      if (msgId) knownMessageIds.add(msgId);

      if (emptyState) {
        emptyState.style.display = 'none';
      }

      const item = document.createElement('div');
      item.className = 'message-item ' + (sender === 'me' ? 'me' : 'owner');
      const senderLabel = sender === 'me' ? 'أنت (المُبلّغ)' : 'صاحب المركبة';

      const time = timeStr ? new Date(timeStr).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }) : '';
      item.innerHTML =
        '<div class="message-bubble">' + escapeHtml(text) + '</div>' +
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
      div.innerText = string;
      return div.innerHTML;
    }

    // 4. Live Polling for Owner Replies
    async function pollMessages() {
      if (!currentChatId || !sessionToken) return;
      try {
        const res = await fetch('/api/v1/reporter/chats/' + currentChatId + '/messages?sessionToken=' + encodeURIComponent(sessionToken));
        if (res.status === 404) {
          localStorage.removeItem('rakna_chat_' + TAG_CODE);
          currentChatId = null;
          if (pollTimer) clearInterval(pollTimer);
          return;
        }
        const data = await res.json();
        if (data.success && Array.isArray(data.messages)) {
          data.messages.forEach(msg => {
            const isMe = msg.senderType === 'REPORTER';
            appendMessage(msg.content, isMe ? 'me' : 'owner', msg.createdAt, msg.id);
          });
          if (data.remainingMessages !== undefined) {
            updateQuota(data.remainingMessages);
          }
        }
      } catch (e) {
        // silent fail on poll error
      }
    }

    function startPolling() {
      if (pollTimer) clearInterval(pollTimer);
      pollTimer = setInterval(pollMessages, 3000);
      pollMessages();
    }

    // If chat was already opened previously in this browser session
    if (currentChatId && sessionToken) {
      startPolling();
    }
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
}
