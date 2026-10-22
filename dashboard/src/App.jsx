import React, { useState, useEffect } from 'react';
import {
  LayoutDashboard,
  QrCode,
  Printer,
  Package,
  Car,
  Users,
  LogOut,
  RefreshCw,
  CheckCircle2,
  Clock,
  Truck,
  ShieldCheck,
  Search,
  Filter,
  PlusCircle,
  ExternalLink,
  ChevronRight,
  TrendingUp,
  AlertCircle,
  Eye,
  Radio,
  Download,
  Lock,
  Layers,
  MessageSquare,
  Send,
  Copy,
  Smartphone,
  Settings,
  Key,
  Globe,
  Zap,
  Check,
  AlertTriangle,
  Play,
  HelpCircle,
  Edit3,
  RotateCcw,
  Sparkles,
  Headphones,
  ShieldAlert,
  Flag,
  X,
  Ban,
  MessageCircle,
  CheckCheck,
} from 'lucide-react';
import { api } from './services/api';

export default function App() {
  const [admin, setAdmin] = useState(api.admin);
  const [token, setToken] = useState(api.token);
  const [currentTab, setCurrentTab] = useState('overview');

  // Login form state
  const [loginEmail, setLoginEmail] = useState('admin@rakna.app');
  const [loginPassword, setLoginPassword] = useState('Admin@123456');
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState('');

  // Data states
  const [stats, setStats] = useState(null);
  const [tags, setTags] = useState([]);
  const [orders, setOrders] = useState([]);
  const [usersList, setUsersList] = useState([]);
  const [whatsappMessages, setWhatsappMessages] = useState([]);
  const [whatsappStats, setWhatsappStats] = useState({ total: 0, sent: 0, queued: 0 });
  const [customPhone, setCustomPhone] = useState('+20');
  const [customText, setCustomText] = useState('');
  const [customSending, setCustomSending] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);

  // Filters
  const [tagFilter, setTagFilter] = useState('ALL');
  const [tagSearch, setTagSearch] = useState('');
  const [orderFilter, setOrderFilter] = useState('ALL');
  const [govFilter, setGovFilter] = useState('ALL');

  // Generator form
  const [genQuantity, setGenQuantity] = useState(10);
  const [genType, setGenType] = useState('TRUNK_BADGE');
  const [genBatch, setGenBatch] = useState('BATCH-2026-Q1');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedTags, setGeneratedTags] = useState([]);

  const [waConfig, setWaConfig] = useState({
    provider: 'GREEN_API',
    isAutoSendEnabled: true,
    greenApiIdInstance: '',
    greenApiToken: '',
    greenApiHost: 'https://api.green-api.com',
    metaToken: '',
    metaPhoneNumberId: '',
    ultraMsgInstanceId: '',
    ultraMsgToken: '',
    customEndpoint: '',
    customAuthHeader: '',
    otpTemplate:
      '🚗 *ركنة | كود التحقق*\n\nكود التحقق لتسجيل الدخول إلى حسابك هو: *{code}*\n\n⏱️ الكود صالح لمدة 10 دقائق.\n🔒 لا تشارك هذا الرمز مع أي شخص لحماية حسابك وسياراتك.\n\n_شكراً لاستخدامك ركنة (Rakna)_',
  });
  const DEFAULT_OTP_TEMPLATE =
    '🚗 *ركنة | كود التحقق*\n\nكود التحقق لتسجيل الدخول إلى حسابك هو: *{code}*\n\n⏱️ الكود صالح لمدة 10 دقائق.\n🔒 لا تشارك هذا الرمز مع أي شخص لحماية حسابك وسياراتك.\n\n_شكراً لاستخدامك ركنة (Rakna)_';
  const [otpTemplate, setOtpTemplate] = useState(DEFAULT_OTP_TEMPLATE);
  const [isSavingTemplate, setIsSavingTemplate] = useState(false);
  const [isSavingWaConfig, setIsSavingWaConfig] = useState(false);
  const [testOtpPhone, setTestOtpPhone] = useState('+2010');
  const [isTestingWa, setIsTestingWa] = useState(false);
  const [testFeedback, setTestFeedback] = useState(null);

  // Green-API QR Code & Pairing State
  const [qrImage, setQrImage] = useState(null);
  const [qrType, setQrType] = useState(null);
  const [instanceState, setInstanceState] = useState('notAuthorized');
  const [isLoadingQr, setIsLoadingQr] = useState(false);

  // Customer Support State
  const [supportThreads, setSupportThreads] = useState([]);
  const [selectedSupportUserId, setSelectedSupportUserId] = useState(null);
  const [selectedSupportTicket, setSelectedSupportTicket] = useState(null);
  const [supportFilter, setSupportFilter] = useState('ALL'); // 'ALL' | 'OPEN' | 'CLOSED'
  const [isClosingThread, setIsClosingThread] = useState(false);
  const [supportMessages, setSupportMessages] = useState([]);
  const [selectedSupportUser, setSelectedSupportUser] = useState(null);
  const [supportReplyText, setSupportReplyText] = useState('');
  const [isSendingReply, setIsSendingReply] = useState(false);
  const [isLoadingSupportMsgs, setIsLoadingSupportMsgs] = useState(false);
  const [supportSearch, setSupportSearch] = useState('');

  // Abuse Reports & Moderation State
  const [abuseReports, setAbuseReports] = useState([]);
  const [abuseFilter, setAbuseFilter] = useState('ALL');
  const [activeReportDetails, setActiveReportDetails] = useState(null);
  const [isLoadingReportDetails, setIsLoadingReportDetails] = useState(false);
  const [isActingReport, setIsActingReport] = useState(false);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const loadAllData = async () => {
    if (!token) return;
    setIsLoading(true);
    try {
      const [statsRes, tagsRes, ordersRes, usersRes, waRes, waConfRes, supportRes, abuseRes] = await Promise.all([
        api.getStats().catch(() => null),
        api.listTags().catch(() => null),
        api.listOrders().catch(() => null),
        api.listUsers().catch(() => null),
        api.getWhatsAppOutbox().catch(() => null),
        api.getWhatsAppConfig().catch(() => null),
        api.getSupportThreads().catch(() => null),
        api.getAbuseReports('ALL').catch(() => null),
      ]);

      if (statsRes && statsRes.stats) setStats(statsRes.stats);
      if (tagsRes && tagsRes.tags) setTags(tagsRes.tags);
      if (ordersRes && ordersRes.orders) setOrders(ordersRes.orders);
      if (usersRes && usersRes.users) setUsersList(usersRes.users);
      if (waRes && waRes.messages) {
        setWhatsappMessages(waRes.messages);
        if (waRes.stats) setWhatsappStats(waRes.stats);
      }
      if (waConfRes && waConfRes.config) {
        setWaConfig((prev) => ({ ...prev, ...waConfRes.config }));
        if (waConfRes.config.otpTemplate) {
          setOtpTemplate(waConfRes.config.otpTemplate);
        }
      }
      if (supportRes && supportRes.threads) {
        setSupportThreads(supportRes.threads);
        if (!selectedSupportUserId && supportRes.threads.length > 0) {
          setSelectedSupportUserId(supportRes.threads[0].userId);
          loadSupportMessages(supportRes.threads[0].userId, true);
        }
      }
      if (abuseRes && abuseRes.reports) {
        setAbuseReports(abuseRes.reports);
      }
    } catch (err) {
      console.error('Data load error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const loadQrAndState = async () => {
    setIsLoadingQr(true);
    try {
      const res = await api.getWhatsAppQrCode();
      if (res && res.qrData) {
        setQrType(res.qrData.type);
        if (res.qrData.type === 'qrCode' && res.qrData.message) {
          setQrImage(`data:image/png;base64,${res.qrData.message}`);
        } else if (res.qrData.type === 'alreadyLogged') {
          setInstanceState('authorized');
          setQrImage(null);
        }
      }
      if (res && res.state) {
        setInstanceState(res.state.stateInstance);
      }
    } catch (err) {
      console.error('QR Load error:', err);
    } finally {
      setIsLoadingQr(false);
    }
  };

  useEffect(() => {
    if (token) {
      loadAllData();
    }
  }, [token]);

  useEffect(() => {
    let interval;
    if (token && currentTab === 'whatsapp' && waConfig.provider === 'GREEN_API') {
      loadQrAndState();
      interval = setInterval(async () => {
        try {
          const res = await api.getWhatsAppState();
          if (res && res.state) {
            setInstanceState(res.state.stateInstance);
            if (res.state.stateInstance === 'authorized') {
              setQrImage(null);
            }
          }
        } catch (_) {}
      }, 4500);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [token, currentTab, waConfig.provider]);

  useEffect(() => {
    let interval;
    if (token && currentTab === 'support') {
      loadSupportThreads(true);
      if (selectedSupportUserId) {
        loadSupportMessages(selectedSupportUserId, true);
      }
      interval = setInterval(() => {
        loadSupportThreads(true);
        if (selectedSupportUserId) {
          loadSupportMessages(selectedSupportUserId, true);
        }
      }, 3500);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [token, currentTab, selectedSupportUserId]);

  useEffect(() => {
    if (token && currentTab === 'abuse') {
      loadAbuseReports();
    }
  }, [token, currentTab, abuseFilter]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginLoading(true);
    setLoginError('');
    try {
      const res = await api.login(loginEmail, loginPassword);
      if (res.success) {
        setToken(res.token);
        setAdmin(res.admin);
        showToast('تم تسجيل الدخول بنجاح كمدير للنظام ✨');
      }
    } catch (err) {
      setLoginError(err.message || 'بيانات الدخول غير صحيحة');
    } finally {
      setLoginLoading(false);
    }
  };

  const handleLogout = () => {
    api.logout();
    setToken(null);
    setAdmin(null);
  };

  const handleGenerateBatch = async (e) => {
    e.preventDefault();
    setIsGenerating(true);
    try {
      const res = await api.generateTagsBatch(Number(genQuantity), genType, genBatch);
      if (res.success) {
        setGeneratedTags(res.tags);
        showToast(`تم بنجاح توليد ${res.count} ملصق ذكي وجاهز للطباعة! 🎉`);
        loadAllData();
      }
    } catch (err) {
      alert(err.message || 'تعذر توليد الدفعة');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleUpdateOrderStatus = async (orderId, newStatus) => {
    try {
      const res = await api.updateOrderStatus(orderId, newStatus);
      if (res.success) {
        showToast('تم تحديث حالة الشحن بنجاح 🚚');
        setOrders((prev) =>
          prev.map((o) => (o.id === orderId ? { ...o, status: newStatus } : o))
        );
      }
    } catch (err) {
      alert(err.message || 'تعذر تحديث الطلب');
    }
  };

  const handleToggleUserBlock = async (userId) => {
    try {
      const res = await api.toggleUserBlock(userId);
      if (res.success) {
        showToast(res.message);
        loadAllData();
      }
    } catch (err) {
      alert(err.message || 'تعذر تعديل حالة المستخدم');
    }
  };

  // ------------------- LOGIN VIEW -------------------
  if (!token) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
        <div className="glass-panel gold-glow-border fade-in" style={{ width: '100%', maxWidth: '440px', padding: '36px' }}>
          <div style={{ textAlign: 'center', marginBottom: '28px' }}>
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '64px',
              height: '64px',
              borderRadius: '20px',
              background: 'linear-gradient(135deg, rgba(245, 190, 24, 0.2) 0%, rgba(245, 190, 24, 0.05) 100%)',
              border: '1px solid rgba(245, 190, 24, 0.3)',
              marginBottom: '16px',
            }}>
              <Car size={34} color="#f5be18" />
            </div>
            <h1 style={{ fontSize: '1.8rem', fontWeight: 900, color: '#f3f4f6', letterSpacing: '-0.5px' }}>
              ركنة <span style={{ color: '#f5be18' }}>Rakna</span>
            </h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '6px' }}>
              بوابة الإدارة المركزية والإنتاج الذكي للـ Tags
            </p>
          </div>

          {loginError && (
            <div style={{
              background: 'rgba(239, 68, 68, 0.12)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              borderRadius: '10px',
              padding: '12px',
              marginBottom: '20px',
              color: '#f87171',
              fontSize: '0.85rem',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}>
              <AlertCircle size={18} />
              <span>{loginError}</span>
            </div>
          )}

          <form onSubmit={handleLogin}>
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '6px' }}>
                البريد الإلكتروني للإدارة
              </label>
              <input
                type="email"
                required
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                style={{
                  width: '100%',
                  padding: '12px 14px',
                  background: 'var(--bg-input)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: '10px',
                  color: '#fff',
                  fontFamily: 'var(--font-arabic)',
                  outline: 'none',
                  fontSize: '0.95rem',
                }}
              />
            </div>

            <div style={{ marginBottom: '24px' }}>
              <label style={{ display: 'block', fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '6px' }}>
                كلمة المرور
              </label>
              <input
                type="password"
                required
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                style={{
                  width: '100%',
                  padding: '12px 14px',
                  background: 'var(--bg-input)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: '10px',
                  color: '#fff',
                  fontFamily: 'var(--font-arabic)',
                  outline: 'none',
                  fontSize: '0.95rem',
                }}
              />
            </div>

            <button
              type="submit"
              disabled={loginLoading}
              className="btn-gold"
              style={{ width: '100%', padding: '13px', fontSize: '1rem' }}
            >
              {loginLoading ? 'جاري التحقق...' : 'تسجيل الدخول إلى النظام'}
            </button>
          </form>

          <div style={{ marginTop: '24px', paddingTop: '16px', borderTop: '1px solid var(--border-subtle)', textAlign: 'center' }}>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              🔒 بيئة مشفرة بنظام Zero-Knowledge مع تدقيق الصلاحيات RBAC
            </span>
          </div>
        </div>
      </div>
    );
  }

  // Filtered Tags
  const filteredTags = tags.filter((t) => {
    const matchesFilter =
      tagFilter === 'ALL' ||
      (tagFilter === 'ACTIVE' && t.status === 'ACTIVE') ||
      (tagFilter === 'UNASSIGNED' && t.status === 'UNASSIGNED') ||
      (tagFilter === 'PAUSED' && t.status === 'PAUSED') ||
      (tagFilter === 'IN_STOCK' && t.status === 'IN_STOCK');
    const matchesSearch =
      !tagSearch ||
      t.tagCode.toLowerCase().includes(tagSearch.toLowerCase()) ||
      (t.car && `${t.car.brand} ${t.car.model}`.toLowerCase().includes(tagSearch.toLowerCase()));
    return matchesFilter && matchesSearch;
  });

  // Filtered Orders
  const filteredOrders = orders.filter((o) => {
    const matchesStatus = orderFilter === 'ALL' || o.status === orderFilter;
    const matchesGov = govFilter === 'ALL' || o.governorate === govFilter;
    return matchesStatus && matchesGov;
  });

  // Egyptian Governorates list
  const egyptianGovernorates = [
    'القاهرة',
    'الجيزة',
    'الإسكندرية',
    'الدقهلية',
    'البحر الأحمر',
    'البحيرة',
    'الفيوم',
    'الغربية',
    'الإسماعيلية',
    'المنوفية',
    'المنيا',
    'القليوبية',
    'الوادي الجديد',
    'السويس',
    'أسوان',
    'أسيوط',
    'بني سويف',
    'بورسعيد',
    'دمياط',
    'الشرقية',
    'جنوب سيناء',
    'كفر الشيخ',
    'مطروح',
    'الأقصر',
    'قنا',
    'شمال سيناء',
    'سوهـاج',
  ];

  const handleOpenWhatsApp = (msg) => {
    window.open(msg.whatsappWebUrl || msg.whatsappUrl, '_blank');
    api.markWhatsAppSent(msg.id).then(() => {
      setWhatsappMessages((prev) =>
        prev.map((m) => (m.id === msg.id ? { ...m, status: 'SENT', sentAt: new Date().toISOString() } : m))
      );
      setWhatsappStats((prev) => ({
        ...prev,
        sent: prev.sent + 1,
        queued: Math.max(0, prev.queued - 1),
      }));
      showToast('تم فتح محادثة الواتساب وتحديث الحالة إلى مُرسل ✅');
    }).catch(() => {});
  };

  const handleCopyCode = (code) => {
    navigator.clipboard.writeText(code);
    showToast(`تم نسخ الكود: ${code} 📋`);
  };

  const handleSendCustomWhatsApp = async (e) => {
    e.preventDefault();
    if (!customPhone || !customText) {
      showToast('يرجى إدخال رقم الهاتف ونص الرسالة');
      return;
    }
    setCustomSending(true);
    try {
      const res = await api.sendCustomWhatsApp(customPhone, customText);
      if (res.whatsappWebUrl || res.whatsappUrl) {
        window.open(res.whatsappWebUrl || res.whatsappUrl, '_blank');
        showToast('تم فتح واتساب لإرسال الرسالة بنجاح 🚀');
        setCustomText('');
      }
    } catch (err) {
      showToast(err.message || 'تعذر إرسال رسالة الواتساب');
    } finally {
      setCustomSending(false);
    }
  };

  const handleSaveWaConfig = async (e) => {
    e.preventDefault();
    setIsSavingWaConfig(true);
    try {
      const res = await api.updateWhatsAppConfig(waConfig);
      if (res.success) {
        showToast(res.message || 'تم حفظ وتفعيل إعدادات الواتساب بنجاح ⚡');
        if (res.config) setWaConfig(res.config);
        loadAllData();
      }
    } catch (err) {
      showToast(err.message || 'تعذر حفظ إعدادات الواتساب');
    } finally {
      setIsSavingWaConfig(false);
    }
  };

  const handleSaveOtpTemplate = async (e) => {
    if (e) e.preventDefault();
    if (!otpTemplate.includes('{code}')) {
      alert('تنبيه: يجب أن يحتوي نص الرسالة على المتغير {code} ليتم استبداله تلقائياً بكود التحقق!');
      return;
    }
    setIsSavingTemplate(true);
    try {
      const res = await api.updateWhatsAppConfig({ ...waConfig, otpTemplate });
      if (res.success) {
        setWaConfig((prev) => ({ ...prev, otpTemplate }));
        showToast('تم حفظ نموذج رسالة الـ OTP بنجاح! 💾✨');
      }
    } catch (err) {
      showToast(err.message || 'تعذر حفظ نص الرسالة');
    } finally {
      setIsSavingTemplate(false);
    }
  };

  const handleResetOtpTemplate = () => {
    if (window.confirm('هل تريد استعادة نموذج رسالة الـ OTP الافتراضي؟')) {
      setOtpTemplate(DEFAULT_OTP_TEMPLATE);
      showToast('تمت استعادة النموذج الافتراضي ↩️');
    }
  };

  const handleInsertCodeTag = () => {
    if (!otpTemplate.includes('{code}')) {
      setOtpTemplate((prev) => prev.trim() + ' {code}');
      showToast('تمت إضافة المتغير {code} بنجاح ✅');
    } else {
      showToast('المتغير {code} مدمج بالفعل في الرسالة ℹ️');
    }
  };

  const handleTestWhatsApp = async (e) => {
    e.preventDefault();
    if (!testOtpPhone || testOtpPhone.length < 8) {
      showToast('يرجى إدخال رقم هاتف صحيح مسبوقاً بكود الدولة');
      return;
    }
    setIsTestingWa(true);
    setTestFeedback(null);
    try {
      const res = await api.testWhatsAppGateway(testOtpPhone);
      setTestFeedback(res);
      if (res.success) {
        showToast('تم إرسال كود الـ OTP التجريبي بنجاح عبر الواتساب! 🚀');
      } else {
        showToast(res.message || 'تعذر إرسال رسالة الاختبار');
      }
      loadAllData();
    } catch (err) {
      setTestFeedback({ success: false, message: err.message });
      showToast(err.message || 'خطأ أثناء اختبار الاتصال');
    } finally {
      setIsTestingWa(false);
    }
  };

  const handleResendWhatsApp = async (msgId) => {
    try {
      const res = await api.resendWhatsApp(msgId);
      if (res.success) {
        showToast('تمت إعادة إرسال الرسالة بنجاح ⚡');
        loadAllData();
      }
    } catch (err) {
      showToast(err.message || 'تعذر إعادة الإرسال');
    }
  };

  const handleLogoutInstance = async () => {
    if (!window.confirm('هل تريد فصل الرقم الحالي ومسح كود QR جديد لربط رقم هاتف آخر؟')) return;
    try {
      await api.logoutWhatsApp();
      showToast('تم تسجيل الخروج بنجاح. جاري طلب رمز QR جديد...');
      setQrImage(null);
      setInstanceState('notAuthorized');
      setTimeout(loadQrAndState, 2000);
    } catch (err) {
      showToast(err.message || 'تعذر تسجيل الخروج');
    }
  };

  const handleRebootInstance = async () => {
    try {
      await api.rebootWhatsApp();
      showToast('جاري إعادة تشغيل النسخة لتحديث الاتصال...');
      setTimeout(loadQrAndState, 3000);
    } catch (err) {
      showToast(err.message || 'تعذر إعادة التشغيل');
    }
  };

  // Support Handlers
  const loadSupportThreads = async (silent = false) => {
    if (!token) return;
    if (!silent) setIsLoadingSupportMsgs(true);
    try {
      const res = await api.getSupportThreads();
      if (res && res.threads) {
        setSupportThreads(res.threads);
        if (!selectedSupportTicket && !selectedSupportUserId && res.threads.length > 0) {
          setSelectedSupportTicket(res.threads[0]);
          setSelectedSupportUserId(res.threads[0].userId);
          loadSupportMessages(res.threads[0].ticketId || res.threads[0].userId, silent);
        } else if (selectedSupportTicket) {
          const updated = res.threads.find(t => t.ticketId === selectedSupportTicket.ticketId);
          if (updated) setSelectedSupportTicket(updated);
        }
      }
    } catch (e) {
      console.error('Error loading support threads:', e);
    } finally {
      if (!silent) setIsLoadingSupportMsgs(false);
    }
  };

  const loadSupportMessages = async (threadId, silent = false) => {
    if (!token || !threadId) return;
    try {
      const res = await api.getSupportThreadMessages(threadId);
      if (res && res.success) {
        setSupportMessages(res.messages || []);
        setSelectedSupportUser(res.user);
        if (res.ticket) {
          setSelectedSupportTicket(prev => prev ? { ...prev, ...res.ticket } : res.ticket);
        }
      }
    } catch (e) {
      console.error('Error loading support messages:', e);
    }
  };

  const handleSelectSupportThread = (thread) => {
    setSelectedSupportTicket(thread);
    setSelectedSupportUserId(thread.userId);
    loadSupportMessages(thread.ticketId || thread.userId);
  };

  const handleCloseSupportThread = async () => {
    const targetId = selectedSupportTicket?.ticketId || selectedSupportUserId;
    if (!targetId) return;

    const isConfirmed = window.confirm(
      'هل أنت متأكد من رغبتك في إغلاق هذه المحادثة؟\n\n' +
      '• ستظل المحادثة محفوظة ومؤرشفة في الداشبورد للرجوع إليها في أي وقت.\n' +
      '• لن يتمكن أحد من الكتابة أو إرسال ردود جديدة في هذه المحادثة نهائياً.\n' +
      '• ستتم إزالة المحادثة من شاشة العميل في التطبيق، وعندما يضغط العميل على "تواصل مع الدعم" مرة أخرى سيفتح محادثة جديدة نظيفة.'
    );
    if (!isConfirmed) return;

    setIsClosingThread(true);
    try {
      const res = await api.closeSupportThread(targetId);
      if (res && res.success) {
        showToast('تم إغلاق المحادثة بنجاح وأرشفتها 🔒');
        setSelectedSupportTicket(prev => prev ? { ...prev, ticketStatus: 'CLOSED', status: 'CLOSED' } : null);
        await loadSupportMessages(targetId, true);
        await loadSupportThreads(true);
      }
    } catch (err) {
      showToast(err.message || 'تعذر إغلاق المحادثة');
    } finally {
      setIsClosingThread(false);
    }
  };

  const handleSendSupportReply = async (e) => {
    if (e) e.preventDefault();
    if (!supportReplyText.trim() || (!selectedSupportTicket && !selectedSupportUserId)) return;

    if (selectedSupportTicket && (selectedSupportTicket.ticketStatus === 'CLOSED' || selectedSupportTicket.status === 'CLOSED')) {
      showToast('⚠️ لا يمكن الإرسال، هذه المحادثة مغلقة ومؤرشفة!');
      return;
    }

    setIsSendingReply(true);
    try {
      const targetId = selectedSupportTicket?.ticketId || selectedSupportUserId;
      const res = await api.replySupportThread(targetId, supportReplyText.trim());
      if (res && res.success) {
        setSupportReplyText('');
        showToast('تم إرسال الرد للعميل وإشعاره بنجاح! 💬✨');
        loadSupportMessages(targetId, true);
        loadSupportThreads(true);
      }
    } catch (err) {
      showToast(err.message || 'تعذر إرسال الرد');
    } finally {
      setIsSendingReply(false);
    }
  };

  // Abuse Reports Handlers
  const loadAbuseReports = async () => {
    if (!token) return;
    try {
      const res = await api.getAbuseReports(abuseFilter);
      if (res && res.reports) {
        setAbuseReports(res.reports);
      }
    } catch (e) {
      console.error('Error loading abuse reports:', e);
    }
  };

  const handleOpenReportDetails = async (reportId) => {
    setIsLoadingReportDetails(true);
    try {
      const res = await api.getReportMessages(reportId);
      if (res && res.success) {
        setActiveReportDetails(res);
      }
    } catch (err) {
      showToast(err.message || 'تعذر جلب تفاصيل المحادثة');
    } finally {
      setIsLoadingReportDetails(false);
    }
  };

  const handleTakeReportAction = async (reportId, action, notes) => {
    setIsActingReport(true);
    try {
      const res = await api.takeReportAction(reportId, action, notes);
      if (res && res.success) {
        showToast(res.message);
        setActiveReportDetails(null);
        loadAbuseReports();
        loadAllData();
      }
    } catch (err) {
      showToast(err.message || 'تعذر تنفيذ الإجراء');
    } finally {
      setIsActingReport(false);
    }
  };

  const totalUnreadSupport = supportThreads.reduce((acc, t) => acc + (t.unreadCount || 0), 0);
  const pendingAbuseCount = abuseReports.filter((r) => r.status === 'PENDING').length;

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg-primary)' }}>
      {/* Toast Notification */}
      {toastMessage && (
        <div style={{
          position: 'fixed',
          top: '24px',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 9999,
          background: 'rgba(20, 27, 39, 0.95)',
          border: '1px solid var(--gold-primary)',
          color: '#fff',
          padding: '12px 24px',
          borderRadius: '12px',
          boxShadow: 'var(--shadow-gold)',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          fontWeight: 600,
        }} className="fade-in">
          <CheckCircle2 color="#f5be18" size={20} />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* ──────────────── SIDEBAR ──────────────── */}
      <aside className="no-print" style={{
        width: '260px',
        background: 'var(--bg-surface)',
        borderLeft: '1px solid var(--border-subtle)',
        display: 'flex',
        flexDirection: 'column',
        padding: '24px 16px',
        position: 'sticky',
        top: 0,
        height: '100vh',
      }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '0 8px', marginBottom: '32px' }}>
          <div style={{
            width: '42px',
            height: '42px',
            borderRadius: '12px',
            background: 'linear-gradient(135deg, #f5be18 0%, #d49a08 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 14px rgba(245, 190, 24, 0.3)',
          }}>
            <Car size={24} color="#000" />
          </div>
          <div>
            <div style={{ fontWeight: 800, fontSize: '1.2rem', color: '#fff' }}>ركنة Rakna</div>
            <div style={{ fontSize: '0.72rem', color: 'var(--gold-primary)', fontWeight: 600 }}>لوحة الإدارة المركزية</div>
          </div>
        </div>

        {/* Navigation Links */}
        <nav style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: 1 }}>
          <button
            onClick={() => setCurrentTab('overview')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: '11px 14px',
              borderRadius: '10px',
              border: 'none',
              background: currentTab === 'overview' ? 'rgba(245, 190, 24, 0.15)' : 'transparent',
              color: currentTab === 'overview' ? 'var(--gold-primary)' : 'var(--text-secondary)',
              fontWeight: 700,
              fontSize: '0.92rem',
              cursor: 'pointer',
              textAlign: 'right',
              transition: 'all 0.18s ease',
            }}
          >
            <LayoutDashboard size={20} />
            <span>لوحة المؤشرات</span>
          </button>

          <button
            onClick={() => setCurrentTab('generator')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: '11px 14px',
              borderRadius: '10px',
              border: 'none',
              background: currentTab === 'generator' ? 'rgba(245, 190, 24, 0.15)' : 'transparent',
              color: currentTab === 'generator' ? 'var(--gold-primary)' : 'var(--text-secondary)',
              fontWeight: 700,
              fontSize: '0.92rem',
              cursor: 'pointer',
              textAlign: 'right',
              transition: 'all 0.18s ease',
            }}
          >
            <QrCode size={20} />
            <span>مولّد الـ Tags والطباعة</span>
          </button>

          <button
            onClick={() => setCurrentTab('orders')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: '11px 14px',
              borderRadius: '10px',
              border: 'none',
              background: currentTab === 'orders' ? 'rgba(245, 190, 24, 0.15)' : 'transparent',
              color: currentTab === 'orders' ? 'var(--gold-primary)' : 'var(--text-secondary)',
              fontWeight: 700,
              fontSize: '0.92rem',
              cursor: 'pointer',
              textAlign: 'right',
              transition: 'all 0.18s ease',
            }}
          >
            <Package size={20} />
            <span>الطلبات والشحن (COD)</span>
          </button>

          <button
            onClick={() => setCurrentTab('tags')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: '11px 14px',
              borderRadius: '10px',
              border: 'none',
              background: currentTab === 'tags' ? 'rgba(245, 190, 24, 0.15)' : 'transparent',
              color: currentTab === 'tags' ? 'var(--gold-primary)' : 'var(--text-secondary)',
              fontWeight: 700,
              fontSize: '0.92rem',
              cursor: 'pointer',
              textAlign: 'right',
              transition: 'all 0.18s ease',
            }}
          >
            <Layers size={20} />
            <span>دليل الملصقات النشطة</span>
          </button>

          <button
            onClick={() => setCurrentTab('users')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: '11px 14px',
              borderRadius: '10px',
              border: 'none',
              background: currentTab === 'users' ? 'rgba(245, 190, 24, 0.15)' : 'transparent',
              color: currentTab === 'users' ? 'var(--gold-primary)' : 'var(--text-secondary)',
              fontWeight: 700,
              fontSize: '0.92rem',
              cursor: 'pointer',
              textAlign: 'right',
              transition: 'all 0.18s ease',
            }}
          >
            <Users size={20} />
            <span>المستخدمين والمركبات</span>
          </button>

          <button
            onClick={() => setCurrentTab('whatsapp')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: '11px 14px',
              borderRadius: '10px',
              border: 'none',
              background: currentTab === 'whatsapp' ? 'rgba(37, 211, 102, 0.15)' : 'transparent',
              color: currentTab === 'whatsapp' ? '#25D366' : 'var(--text-secondary)',
              fontWeight: 700,
              fontSize: '0.92rem',
              cursor: 'pointer',
              textAlign: 'right',
              transition: 'all 0.18s ease',
            }}
          >
            <MessageSquare size={20} color={currentTab === 'whatsapp' ? '#25D366' : 'currentColor'} />
            <span>بوابة الواتساب والـ OTP</span>
            {whatsappMessages.length > 0 && (
              <span style={{
                marginRight: 'auto',
                background: '#25D366',
                color: '#000',
                fontSize: '0.72rem',
                fontWeight: 800,
                padding: '2px 8px',
                borderRadius: '12px',
              }}>
                {whatsappMessages.length}
              </span>
            )}
          </button>

          <button
            onClick={() => {
              setCurrentTab('support');
              loadSupportThreads();
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: '11px 14px',
              borderRadius: '10px',
              border: 'none',
              background: currentTab === 'support' ? 'rgba(56, 189, 248, 0.15)' : 'transparent',
              color: currentTab === 'support' ? '#38bdf8' : 'var(--text-secondary)',
              fontWeight: 700,
              fontSize: '0.92rem',
              cursor: 'pointer',
              textAlign: 'right',
              transition: 'all 0.18s ease',
            }}
          >
            <Headphones size={20} color={currentTab === 'support' ? '#38bdf8' : 'currentColor'} />
            <span>خدمة العملاء والدعم الفني</span>
            {totalUnreadSupport > 0 && (
              <span style={{
                marginRight: 'auto',
                background: '#38bdf8',
                color: '#000',
                fontSize: '0.72rem',
                fontWeight: 800,
                padding: '2px 8px',
                borderRadius: '12px',
              }}>
                {totalUnreadSupport} جديد
              </span>
            )}
          </button>

          <button
            onClick={() => {
              setCurrentTab('abuse');
              loadAbuseReports();
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              padding: '11px 14px',
              borderRadius: '10px',
              border: 'none',
              background: currentTab === 'abuse' ? 'rgba(239, 68, 68, 0.15)' : 'transparent',
              color: currentTab === 'abuse' ? '#f87171' : 'var(--text-secondary)',
              fontWeight: 700,
              fontSize: '0.92rem',
              cursor: 'pointer',
              textAlign: 'right',
              transition: 'all 0.18s ease',
            }}
          >
            <ShieldAlert size={20} color={currentTab === 'abuse' ? '#f87171' : 'currentColor'} />
            <span>بلاغات المحادثات والرقابة</span>
            {pendingAbuseCount > 0 && (
              <span style={{
                marginRight: 'auto',
                background: '#ef4444',
                color: '#fff',
                fontSize: '0.72rem',
                fontWeight: 800,
                padding: '2px 8px',
                borderRadius: '12px',
              }}>
                {pendingAbuseCount} بلاغ
              </span>
            )}
          </button>
        </nav>

        {/* Admin info & Logout */}
        <div style={{
          padding: '14px',
          background: 'var(--bg-card)',
          borderRadius: '12px',
          border: '1px solid var(--border-subtle)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <div>
            <div style={{ fontSize: '0.85rem', fontWeight: 700, color: '#fff' }}>{admin?.name || 'مدير النظام'}</div>
            <div style={{ fontSize: '0.72rem', color: '#10b981', display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span className="pulse-dot" style={{ background: '#10b981' }}></span>
              <span>SUPER_ADMIN</span>
            </div>
          </div>
          <button
            onClick={handleLogout}
            title="تسجيل الخروج"
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              padding: '6px',
            }}
          >
            <LogOut size={18} />
          </button>
        </div>
      </aside>

      {/* ──────────────── MAIN CONTENT AREA ──────────────── */}
      <main style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {/* Top Header */}
        <header className="no-print" style={{
          height: '70px',
          background: 'rgba(14, 19, 29, 0.85)',
          backdropFilter: 'blur(16px)',
          borderBottom: '1px solid var(--border-subtle)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 32px',
          position: 'sticky',
          top: 0,
          zIndex: 50,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#fff' }}>
              {currentTab === 'overview' && 'نظرة عامة على النظام'}
              {currentTab === 'generator' && 'توليد دفعات ملصقات الـ Tags والطباعة للمطابع'}
              {currentTab === 'orders' && 'سجل طلبات المتجر والشحن بالمحافظات المصرية'}
              {currentTab === 'tags' && 'سجل وفهرس ملصقات الـ Tags'}
              {currentTab === 'users' && 'سجل المستخدمين ومالكي المركبات'}
              {currentTab === 'whatsapp' && 'بوابة الواتساب وصندوق صادر رسائل الـ OTP اللحظية'}
            </h2>
            <span className="badge badge-active">
              <span className="pulse-dot" style={{ background: '#10b981' }}></span>
              الخادم المحلي متصل (Port 5000)
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button
              onClick={loadAllData}
              disabled={isLoading}
              className="btn-ghost"
              style={{ fontSize: '0.85rem' }}
            >
              <RefreshCw size={16} className={isLoading ? 'spin-icon' : ''} />
              <span>تحديث البيانات</span>
            </button>
          </div>
        </header>

        {/* Page Content Body */}
        <div style={{ padding: '32px', flex: 1 }}>
          {/* ════════════════ TAB 1: OVERVIEW ════════════════ */}
          {currentTab === 'overview' && (
            <div className="fade-in">
              {/* 4 KPI Hero Cards */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                gap: '20px',
                marginBottom: '32px',
              }}>
                {/* Cars Card */}
                <div className="glass-panel" style={{ padding: '24px', borderTop: '3px solid #38bdf8' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 600 }}>إجمالي السيارات</div>
                      <div style={{ fontSize: '2.1rem', fontWeight: 900, color: '#fff', marginTop: '6px' }} className="number-latin">
                        {stats?.cars.total ?? 0}
                      </div>
                      <div style={{ fontSize: '0.78rem', color: '#38bdf8', marginTop: '4px' }}>
                        {stats?.cars.active ?? 0} سيارة مفعلة بـ Tag
                      </div>
                    </div>
                    <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'rgba(56, 189, 248, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Car size={26} color="#38bdf8" />
                    </div>
                  </div>
                </div>

                {/* Tags Card */}
                <div className="glass-panel" style={{ padding: '24px', borderTop: '3px solid var(--gold-primary)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 600 }}>ملصقات الـ Tags النشطة</div>
                      <div style={{ fontSize: '2.1rem', fontWeight: 900, color: 'var(--gold-primary)', marginTop: '6px' }} className="number-latin">
                        {stats?.tags.active ?? 0}
                      </div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                        من إجمالي {stats?.tags.total ?? 0} ملصق مولّد
                      </div>
                    </div>
                    <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'rgba(245, 190, 24, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <QrCode size={26} color="#f5be18" />
                    </div>
                  </div>
                </div>

                {/* Store Revenue Card */}
                <div className="glass-panel" style={{ padding: '24px', borderTop: '3px solid #10b981' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 600 }}>إيرادات المتجر (ج.م)</div>
                      <div style={{ fontSize: '2.1rem', fontWeight: 900, color: '#34d399', marginTop: '6px' }} className="number-latin">
                        {stats?.orders.totalRevenue ? `${stats.orders.totalRevenue} EGP` : '0 EGP'}
                      </div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                        {stats?.orders.total ?? 0} طلبات شحن COD
                      </div>
                    </div>
                    <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'rgba(16, 185, 129, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <TrendingUp size={26} color="#10b981" />
                    </div>
                  </div>
                </div>

                {/* Scans & Security Card */}
                <div className="glass-panel" style={{ padding: '24px', borderTop: '3px solid #f59e0b' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <div>
                      <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 600 }}>معدل المسح والحماية</div>
                      <div style={{ fontSize: '2.1rem', fontWeight: 900, color: '#fbbf24', marginTop: '6px' }} className="number-latin">
                        {stats?.scans.total ?? 0}
                      </div>
                      <div style={{ fontSize: '0.78rem', color: '#10b981', marginTop: '4px' }}>
                        🛡️ Zero-Knowledge آمن بنسبة 100%
                      </div>
                    </div>
                    <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'rgba(245, 158, 11, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <ShieldCheck size={26} color="#f59e0b" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Quick Actions & Shortcut Banner */}
              <div className="glass-panel gold-glow-border" style={{
                padding: '24px',
                marginBottom: '32px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '16px',
              }}>
                <div>
                  <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#fff' }}>توليد دفعة جديدة من ملصقات الـ Tags الذكية</h3>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', marginTop: '4px' }}>
                    يمكنك توليد حتى 100 ملصق فورياً بتشفير عالي ورموز QR متجهة جاهزة للطباعة بالمطابع.
                  </p>
                </div>
                <button
                  onClick={() => setCurrentTab('generator')}
                  className="btn-gold"
                  style={{ padding: '12px 24px', fontSize: '0.95rem' }}
                >
                  <PlusCircle size={18} />
                  <span>بدء توليد دفعة جديدة</span>
                </button>
              </div>

              {/* Recent Orders Overview */}
              <div className="glass-panel" style={{ padding: '24px', marginBottom: '32px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: '#fff' }}>أحدث طلبات المتجر للتوصيل (COD)</h3>
                  <button onClick={() => setCurrentTab('orders')} className="btn-ghost" style={{ fontSize: '0.8rem' }}>
                    <span>عرض كافة الطلبات</span>
                    <ChevronRight size={16} />
                  </button>
                </div>

                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-secondary)', fontSize: '0.82rem' }}>
                        <th style={{ padding: '12px' }}>رقم الطلب</th>
                        <th style={{ padding: '12px' }}>اسم المستلم</th>
                        <th style={{ padding: '12px' }}>المحافظة</th>
                        <th style={{ padding: '12px' }}>المبلغ</th>
                        <th style={{ padding: '12px' }}>طريقة الدفع</th>
                        <th style={{ padding: '12px' }}>الحالة</th>
                        <th style={{ padding: '12px' }}>الإجراء</th>
                      </tr>
                    </thead>
                    <tbody>
                      {orders.slice(0, 5).map((order) => (
                        <tr key={order.id} style={{ borderBottom: '1px solid var(--border-subtle)', fontSize: '0.88rem' }}>
                          <td style={{ padding: '14px 12px' }} className="tag-code">{order.orderNumber}</td>
                          <td style={{ padding: '14px 12px', fontWeight: 600 }}>{order.recipientName}</td>
                          <td style={{ padding: '14px 12px' }}>{order.governorate}</td>
                          <td style={{ padding: '14px 12px', fontWeight: 700, color: 'var(--gold-primary)' }} className="number-latin">
                            {order.totalPrice} ج.م
                          </td>
                          <td style={{ padding: '14px 12px' }}>
                            <span style={{ fontSize: '0.78rem', background: 'rgba(255,255,255,0.06)', padding: '3px 8px', borderRadius: '6px' }}>
                              الدفع عند الاستلام
                            </span>
                          </td>
                          <td style={{ padding: '14px 12px' }}>
                            {order.status === 'SHIPPED' && <span className="badge badge-instock">جاري الشحن 🚚</span>}
                            {order.status === 'PENDING' && <span className="badge badge-paused">قيد المراجعة ⏳</span>}
                            {order.status === 'DELIVERED' && <span className="badge badge-active">تم التسليم ✅</span>}
                          </td>
                          <td style={{ padding: '14px 12px' }}>
                            <select
                              value={order.status}
                              onChange={(e) => handleUpdateOrderStatus(order.id, e.target.value)}
                              style={{
                                background: 'var(--bg-input)',
                                color: '#fff',
                                border: '1px solid var(--border-subtle)',
                                padding: '6px 10px',
                                borderRadius: '8px',
                                fontFamily: 'var(--font-arabic)',
                                fontSize: '0.8rem',
                              }}
                            >
                              <option value="PENDING">قيد المراجعة</option>
                              <option value="PROCESSING">جاري التجهيز</option>
                              <option value="SHIPPED">تم الشحن</option>
                              <option value="DELIVERED">تم التسليم</option>
                              <option value="CANCELLED">إلغاء الطلب</option>
                            </select>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ════════════════ TAB 2: BATCH TAG GENERATOR ════════════════ */}
          {currentTab === 'generator' && (
            <div className="fade-in">
              <div className="glass-panel" style={{ padding: '28px', marginBottom: '32px' }}>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#fff', marginBottom: '8px' }}>
                  توليد دفعة جديدة وطباعة الـ QR Codes للمطابع
                </h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '24px' }}>
                  يتم توليد الأكواد المشفرة مسبقاً وتخزينها في قاعدة البيانات مع مفاتيح NFC السرية لضمان عدم التزييف وسرعة الربط مع السيارات.
                </p>

                <form onSubmit={handleGenerateBatch} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px', alignItems: 'end' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                      نوع الملصق (Tag Type)
                    </label>
                    <select
                      value={genType}
                      onChange={(e) => setGenType(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '12px',
                        background: 'var(--bg-input)',
                        color: '#fff',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: '10px',
                        fontFamily: 'var(--font-arabic)',
                      }}
                    >
                      <option value="TRUNK_BADGE">ملصق شنطة السيارة المدرع (Trunk Badge)</option>
                      <option value="NANO_GLASS">ملصق الزجاج الشفاف (Nano Glass Tag)</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                      الكمية المطلوبة
                    </label>
                    <select
                      value={genQuantity}
                      onChange={(e) => setGenQuantity(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '12px',
                        background: 'var(--bg-input)',
                        color: '#fff',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: '10px',
                        fontFamily: 'var(--font-arabic)',
                      }}
                    >
                      <option value={5}>5 ملصقات تجريبية</option>
                      <option value={10}>10 ملصقات</option>
                      <option value={25}>25 ملصق</option>
                      <option value={50}>50 ملصق (شيت مطبعة كامل)</option>
                      <option value={100}>100 ملصق</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                      رقم دفعة الإنتاج (Batch No.)
                    </label>
                    <input
                      type="text"
                      required
                      value={genBatch}
                      onChange={(e) => setGenBatch(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '12px',
                        background: 'var(--bg-input)',
                        color: '#fff',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: '10px',
                        fontFamily: 'var(--font-mono)',
                        direction: 'ltr',
                      }}
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={isGenerating}
                    className="btn-gold"
                    style={{ height: '48px', fontSize: '0.95rem' }}
                  >
                    <QrCode size={18} />
                    <span>{isGenerating ? 'جاري التوليد...' : 'توليد الرموز المشفرة الآن'}</span>
                  </button>
                </form>
              </div>

              {/* Generated Result Preview & Print Action */}
              {generatedTags.length > 0 && (
                <div className="glass-panel" style={{ padding: '28px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
                    <div>
                      <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#fff' }}>
                        الدفعة المولدة حديثاً: {genBatch} ({generatedTags.length} ملصق)
                      </h3>
                      <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                        رموز QR عالية الدقة المتجهة جاهزة للتصدير والطباعة.
                      </p>
                    </div>

                    <div style={{ display: 'flex', gap: '10px' }}>
                      <button
                        onClick={() => window.print()}
                        className="btn-gold"
                        style={{ fontSize: '0.88rem' }}
                      >
                        <Printer size={16} />
                        <span>طباعة بطاقات الـ QR (Print Sheet)</span>
                      </button>
                    </div>
                  </div>

                  {/* QR Grid Cards */}
                  <div className="print-sheet" style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))',
                    gap: '20px',
                  }}>
                    {generatedTags.map((t) => (
                      <div
                        key={t.id}
                        className="print-tag-card"
                        style={{
                          background: 'var(--bg-card)',
                          border: '1px solid rgba(245, 190, 24, 0.25)',
                          borderRadius: '14px',
                          padding: '20px',
                          textAlign: 'center',
                          boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
                        }}
                      >
                        <div style={{ fontSize: '0.72rem', color: 'var(--gold-primary)', fontWeight: 800, letterSpacing: '1px', marginBottom: '8px' }}>
                          RAKNA VERITAG™
                        </div>

                        {/* Render SVG QR */}
                        <div
                          style={{
                            background: '#fff',
                            padding: '12px',
                            borderRadius: '10px',
                            display: 'inline-block',
                            marginBottom: '12px',
                          }}
                          dangerouslySetInnerHTML={{ __html: t.qrCodeSvg }}
                        />

                        <div style={{ fontWeight: 800, fontSize: '1.1rem', color: '#fff' }} className="tag-code">
                          {t.tagCode}
                        </div>

                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                          {t.tagType === 'TRUNK_BADGE' ? 'ملصق شنطة مدرع' : 'ملصق زجاج نانو'}
                        </div>

                        <div style={{
                          fontSize: '0.65rem',
                          color: '#6b7280',
                          fontFamily: 'var(--font-mono)',
                          marginTop: '8px',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}>
                          NFC: {t.secretToken?.substring(0, 16)}...
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ════════════════ TAB 3: ORDERS & LOGISTICS ════════════════ */}
          {currentTab === 'orders' && (
            <div className="fade-in">
              <div className="glass-panel" style={{ padding: '24px', marginBottom: '24px' }}>
                <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                    {['ALL', 'PENDING', 'PROCESSING', 'SHIPPED', 'DELIVERED'].map((st) => (
                      <button
                        key={st}
                        onClick={() => setOrderFilter(st)}
                        style={{
                          background: orderFilter === st ? 'var(--gold-primary)' : 'rgba(255,255,255,0.05)',
                          color: orderFilter === st ? '#000' : 'var(--text-secondary)',
                          border: 'none',
                          padding: '8px 16px',
                          borderRadius: '8px',
                          fontWeight: 700,
                          fontSize: '0.85rem',
                          cursor: 'pointer',
                        }}
                      >
                        {st === 'ALL' && 'كافة الطلبات'}
                        {st === 'PENDING' && 'قيد المراجعة'}
                        {st === 'PROCESSING' && 'جاري التجهيز'}
                        {st === 'SHIPPED' && 'تم الشحن'}
                        {st === 'DELIVERED' && 'تم التسليم'}
                      </button>
                    ))}
                  </div>

                  <div>
                    <select
                      value={govFilter}
                      onChange={(e) => setGovFilter(e.target.value)}
                      style={{
                        background: 'var(--bg-input)',
                        color: '#fff',
                        border: '1px solid var(--border-subtle)',
                        padding: '8px 14px',
                        borderRadius: '8px',
                        fontFamily: 'var(--font-arabic)',
                        fontSize: '0.85rem',
                      }}
                    >
                      <option value="ALL">كل المحافظات المصرية</option>
                      {egyptianGovernorates.map((gov) => (
                        <option key={gov} value={gov}>{gov}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Orders Table */}
              <div className="glass-panel" style={{ padding: '24px' }}>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-secondary)', fontSize: '0.82rem' }}>
                        <th style={{ padding: '12px' }}>رقم الطلب</th>
                        <th style={{ padding: '12px' }}>العميل والهاتف</th>
                        <th style={{ padding: '12px' }}>المحافظة والعنوان</th>
                        <th style={{ padding: '12px' }}>إجمالي الفاتورة</th>
                        <th style={{ padding: '12px' }}>طريقة الدفع</th>
                        <th style={{ padding: '12px' }}>حالة الشحن</th>
                        <th style={{ padding: '12px' }}>تحديث الحالة</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredOrders.length === 0 ? (
                        <tr>
                          <td colSpan="7" style={{ textAlign: 'center', padding: '36px', color: 'var(--text-muted)' }}>
                            لا توجد طلبات تطابق الفلاتر المحددة
                          </td>
                        </tr>
                      ) : (
                        filteredOrders.map((order) => (
                          <tr key={order.id} style={{ borderBottom: '1px solid var(--border-subtle)', fontSize: '0.88rem' }}>
                            <td style={{ padding: '16px 12px' }} className="tag-code">{order.orderNumber}</td>
                            <td style={{ padding: '16px 12px' }}>
                              <div style={{ fontWeight: 700, color: '#fff' }}>{order.recipientName}</div>
                              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }} className="number-latin">{order.phone}</div>
                            </td>
                            <td style={{ padding: '16px 12px' }}>
                              <div style={{ fontWeight: 600 }}>{order.governorate}</div>
                              <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>{order.addressDetails}</div>
                            </td>
                            <td style={{ padding: '16px 12px', fontWeight: 800, color: 'var(--gold-primary)' }} className="number-latin">
                              {order.totalPrice} EGP
                            </td>
                            <td style={{ padding: '16px 12px' }}>
                              <span style={{ fontSize: '0.78rem', background: 'rgba(255,255,255,0.06)', padding: '4px 8px', borderRadius: '6px' }}>
                                الدفع عند الاستلام
                              </span>
                            </td>
                            <td style={{ padding: '16px 12px' }}>
                              {order.status === 'SHIPPED' && <span className="badge badge-instock">جاري الشحن 🚚</span>}
                              {order.status === 'PENDING' && <span className="badge badge-paused">قيد المراجعة ⏳</span>}
                              {order.status === 'PROCESSING' && <span className="badge badge-paused">جاري التجهيز 📦</span>}
                              {order.status === 'DELIVERED' && <span className="badge badge-active">تم التسليم ✅</span>}
                              {order.status === 'CANCELLED' && <span className="badge badge-blocked">ملغي ❌</span>}
                            </td>
                            <td style={{ padding: '16px 12px' }}>
                              <select
                                value={order.status}
                                onChange={(e) => handleUpdateOrderStatus(order.id, e.target.value)}
                                style={{
                                  background: 'var(--bg-input)',
                                  color: '#fff',
                                  border: '1px solid var(--border-subtle)',
                                  padding: '6px 10px',
                                  borderRadius: '8px',
                                  fontFamily: 'var(--font-arabic)',
                                  fontSize: '0.8rem',
                                }}
                              >
                                <option value="PENDING">قيد المراجعة</option>
                                <option value="PROCESSING">جاري التجهيز</option>
                                <option value="SHIPPED">تم الشحن</option>
                                <option value="DELIVERED">تم التسليم</option>
                                <option value="CANCELLED">إلغاء الطلب</option>
                              </select>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ════════════════ TAB 4: TAGS DIRECTORY ════════════════ */}
          {currentTab === 'tags' && (
            <div className="fade-in">
              <div className="glass-panel" style={{ padding: '24px', marginBottom: '24px' }}>
                <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    {['ALL', 'ACTIVE', 'UNASSIGNED', 'PAUSED', 'IN_STOCK'].map((st) => (
                      <button
                        key={st}
                        onClick={() => setTagFilter(st)}
                        style={{
                          background: tagFilter === st ? 'var(--gold-primary)' : 'rgba(255,255,255,0.05)',
                          color: tagFilter === st ? '#000' : 'var(--text-secondary)',
                          border: 'none',
                          padding: '8px 16px',
                          borderRadius: '8px',
                          fontWeight: 700,
                          fontSize: '0.85rem',
                          cursor: 'pointer',
                        }}
                      >
                        {st === 'ALL' && 'كافة الملصقات'}
                        {st === 'ACTIVE' && 'نشط ومربوط بسيارة'}
                        {st === 'UNASSIGNED' && 'متاح بالمحفظة'}
                        {st === 'PAUSED' && 'متوقف مؤقتاً'}
                        {st === 'IN_STOCK' && 'بالمخزن (جديد)'}
                      </button>
                    ))}
                  </div>

                  <div style={{ position: 'relative', minWidth: '260px' }}>
                    <Search size={16} color="var(--text-muted)" style={{ position: 'absolute', right: '12px', top: '12px' }} />
                    <input
                      type="text"
                      placeholder="ابحث بكود الـ Tag أو موديل السيارة..."
                      value={tagSearch}
                      onChange={(e) => setTagSearch(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '10px 36px 10px 14px',
                        background: 'var(--bg-input)',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: '8px',
                        color: '#fff',
                        fontSize: '0.85rem',
                        fontFamily: 'var(--font-arabic)',
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* Tags Table */}
              <div className="glass-panel" style={{ padding: '24px' }}>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-secondary)', fontSize: '0.82rem' }}>
                        <th style={{ padding: '12px' }}>كود الـ Tag</th>
                        <th style={{ padding: '12px' }}>النوع والخامة</th>
                        <th style={{ padding: '12px' }}>حالة الملصق</th>
                        <th style={{ padding: '12px' }}>السيارة المربوطة</th>
                        <th style={{ padding: '12px' }}>المالك</th>
                        <th style={{ padding: '12px' }}>الدفعة</th>
                        <th style={{ padding: '12px' }}>سجل المسح</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredTags.map((t) => (
                        <tr key={t.id} style={{ borderBottom: '1px solid var(--border-subtle)', fontSize: '0.88rem' }}>
                          <td style={{ padding: '14px 12px' }} className="tag-code">{t.tagCode}</td>
                          <td style={{ padding: '14px 12px' }}>
                            {t.tagType === 'TRUNK_BADGE' ? 'ملصق شنطة مدرع' : 'ملصق زجاج نانو'}
                          </td>
                          <td style={{ padding: '14px 12px' }}>
                            {t.status === 'ACTIVE' && <span className="badge badge-active">نشط 🟢</span>}
                            {t.status === 'UNASSIGNED' && <span className="badge badge-instock">متاح للربط ⚪</span>}
                            {t.status === 'PAUSED' && <span className="badge badge-paused">متوقف ⏸️</span>}
                            {t.status === 'IN_STOCK' && <span className="badge badge-instock">بالمخزن 📦</span>}
                          </td>
                          <td style={{ padding: '14px 12px' }}>
                            {t.car ? (
                              <div>
                                <span style={{ fontWeight: 700, color: '#fff' }}>{t.car.brand} {t.car.model}</span>
                                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginRight: '6px' }}>({t.car.colorName})</span>
                              </div>
                            ) : (
                              <span style={{ color: 'var(--text-muted)' }}>غير مربوط</span>
                            )}
                          </td>
                          <td style={{ padding: '14px 12px' }}>
                            {t.user ? t.user.name : <span style={{ color: 'var(--text-muted)' }}>-</span>}
                          </td>
                          <td style={{ padding: '14px 12px' }} className="number-latin">
                            {t.batchNumber || '-'}
                          </td>
                          <td style={{ padding: '14px 12px' }} className="number-latin">
                            {t._count?.scanLogs ?? 0} مسح
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ════════════════ TAB 5: USERS & CARS ════════════════ */}
          {currentTab === 'users' && (
            <div className="fade-in">
              <div className="glass-panel" style={{ padding: '24px' }}>
                <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#fff', marginBottom: '20px' }}>
                  قائمة مالكي المركبات المسجلين ({usersList.length})
                </h3>

                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'right' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-secondary)', fontSize: '0.82rem' }}>
                        <th style={{ padding: '12px' }}>اسم المالك</th>
                        <th style={{ padding: '12px' }}>رقم الهاتف</th>
                        <th style={{ padding: '12px' }}>التحقق (OTP)</th>
                        <th style={{ padding: '12px' }}>السيارات</th>
                        <th style={{ padding: '12px' }}>الملصقات</th>
                        <th style={{ padding: '12px' }}>حالة الحساب</th>
                        <th style={{ padding: '12px' }}>إجراء الإدارة</th>
                      </tr>
                    </thead>
                    <tbody>
                      {usersList.map((user) => (
                        <tr key={user.id} style={{ borderBottom: '1px solid var(--border-subtle)', fontSize: '0.88rem' }}>
                          <td style={{ padding: '14px 12px', fontWeight: 700, color: '#fff' }}>{user.name}</td>
                          <td style={{ padding: '14px 12px' }} className="number-latin">{user.phone}</td>
                          <td style={{ padding: '14px 12px' }}>
                            {user.isVerified ? (
                              <span style={{ color: '#10b981', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.8rem' }}>
                                <CheckCircle2 size={16} /> تم التحقق
                              </span>
                            ) : (
                              <span style={{ color: 'var(--text-muted)' }}>غير مؤكد</span>
                            )}
                          </td>
                          <td style={{ padding: '14px 12px' }}>
                            {user.cars && user.cars.length > 0 ? (
                              <div>
                                {user.cars.map((c) => (
                                  <div key={c.id} style={{ fontSize: '0.8rem' }}>
                                    🚗 {c.brand} {c.model} ({c.isActivated ? 'مفعلة' : 'غير مفعلة'})
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <span style={{ color: 'var(--text-muted)' }}>لا توجد سيارات</span>
                            )}
                          </td>
                          <td style={{ padding: '14px 12px' }} className="number-latin">
                            {user.tags?.length ?? 0} ملصق
                          </td>
                          <td style={{ padding: '14px 12px' }}>
                            {user.isBlocked ? (
                              <span className="badge badge-blocked">محظور 🚫</span>
                            ) : (
                              <span className="badge badge-active">نشط 🟢</span>
                            )}
                          </td>
                          <td style={{ padding: '14px 12px' }}>
                            <button
                              onClick={() => handleToggleUserBlock(user.id)}
                              style={{
                                background: user.isBlocked ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                                color: user.isBlocked ? '#34d399' : '#f87171',
                                border: '1px solid rgba(255,255,255,0.1)',
                                padding: '6px 12px',
                                borderRadius: '8px',
                                cursor: 'pointer',
                                fontSize: '0.8rem',
                                fontWeight: 700,
                              }}
                            >
                              {user.isBlocked ? 'فك الحظر' : 'حظر الحساب'}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════════════════
              TAB: WHATSAPP GATEWAY & LIVE OTP OUTBOX
              ═══════════════════════════════════════════════════════════════════ */}
          {currentTab === 'whatsapp' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              {/* WhatsApp QR Code Device Pairing Card */}
              <div className="kpi-card gold-glow-border fade-in" style={{
                padding: '28px',
                background: 'linear-gradient(135deg, rgba(20, 27, 39, 0.98) 0%, rgba(16, 24, 38, 0.98) 100%)',
                border: instanceState === 'authorized' ? '1px solid rgba(37, 211, 102, 0.4)' : '1px solid var(--border-gold)',
                boxShadow: instanceState === 'authorized' ? '0 8px 32px rgba(37, 211, 102, 0.15)' : 'var(--shadow-gold)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px', flexWrap: 'wrap', gap: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{
                      width: '44px',
                      height: '44px',
                      borderRadius: '12px',
                      background: instanceState === 'authorized' ? 'rgba(37, 211, 102, 0.2)' : 'rgba(245, 190, 24, 0.2)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}>
                      <QrCode color={instanceState === 'authorized' ? '#25D366' : 'var(--gold-primary)'} size={24} />
                    </div>
                    <div>
                      <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span>ربط رقم الواتساب عبر QR Code (WhatsApp Phone Pairing)</span>
                        {instanceState === 'authorized' ? (
                          <span style={{
                            background: '#25D366',
                            color: '#000',
                            fontSize: '0.72rem',
                            fontWeight: 800,
                            padding: '3px 8px',
                            borderRadius: '10px',
                          }}>
                            متصل ونشط 🟢
                          </span>
                        ) : (
                          <span style={{
                            background: 'rgba(239, 68, 68, 0.2)',
                            color: '#f87171',
                            fontSize: '0.72rem',
                            fontWeight: 800,
                            padding: '3px 8px',
                            borderRadius: '10px',
                          }}>
                            بانتظار المسح بالهاتف 📷
                          </span>
                        )}
                      </h3>
                      <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                        امسح الـ QR Code من تطبيق واتساب بهاتفك لربط الرقم الذي سيقوم بإرسال رسائل الـ OTP تلقائياً للعملاء.
                      </p>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <button
                      onClick={loadQrAndState}
                      disabled={isLoadingQr}
                      className="btn-ghost"
                      style={{ fontSize: '0.82rem', gap: '6px' }}
                    >
                      <RefreshCw size={14} className={isLoadingQr ? 'animate-spin' : ''} />
                      <span>{isLoadingQr ? 'جاري التحميل...' : 'تحديث الـ QR'}</span>
                    </button>
                    {instanceState === 'authorized' && (
                      <button
                        onClick={handleLogoutInstance}
                        style={{
                          background: 'rgba(239, 68, 68, 0.15)',
                          color: '#f87171',
                          border: '1px solid rgba(239, 68, 68, 0.3)',
                          padding: '7px 14px',
                          borderRadius: '8px',
                          cursor: 'pointer',
                          fontSize: '0.82rem',
                          fontWeight: 700,
                        }}
                      >
                        فصل الرقم وربط رقم آخر
                      </button>
                    )}
                  </div>
                </div>

                {instanceState === 'authorized' ? (
                  <div style={{
                    padding: '24px',
                    borderRadius: '14px',
                    background: 'rgba(37, 211, 102, 0.08)',
                    border: '1px solid rgba(37, 211, 102, 0.25)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '18px',
                    flexWrap: 'wrap',
                  }}>
                    <div style={{
                      width: '60px',
                      height: '60px',
                      borderRadius: '50%',
                      background: 'rgba(37, 211, 102, 0.2)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}>
                      <CheckCircle2 color="#25D366" size={32} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ color: '#fff', fontWeight: 800, fontSize: '1.1rem' }}>
                        تم ربط وتوثيق رقم الواتساب بنجاح! 🚀
                      </div>
                      <p style={{ color: '#a7f3d0', fontSize: '0.85rem', margin: '4px 0 0', lineHeight: 1.5 }}>
                        النسخة متصلة ومصرح لها بالإرسال. عند قيام أي مستخدم بطلب كود OTP في تطبيق الهاتف، سيتم إرساله تلقائياً من رقمك المسجل هنا.
                      </p>
                      <div style={{ display: 'flex', gap: '16px', marginTop: '10px', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                        <span>معرّف النسخة: <strong style={{ color: 'var(--gold-primary)' }}>{waConfig.greenApiIdInstance}</strong></span>
                        <span>الحالة: <strong style={{ color: '#25D366' }}>Active / Authorized</strong></span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'auto 1fr',
                    gap: '24px',
                    alignItems: 'center',
                    background: 'rgba(0,0,0,0.3)',
                    padding: '20px',
                    borderRadius: '16px',
                    border: '1px solid var(--border-subtle)',
                  }}>
                    {/* QR Code Container */}
                    <div style={{
                      width: '240px',
                      height: '240px',
                      background: '#fff',
                      padding: '12px',
                      borderRadius: '16px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
                      position: 'relative',
                    }}>
                      {isLoadingQr ? (
                        <div style={{ textAlign: 'center', color: '#000' }}>
                          <RefreshCw size={28} className="animate-spin" color="#000" style={{ margin: '0 auto 8px' }} />
                          <div style={{ fontSize: '0.8rem', fontWeight: 700 }}>جاري استخراج الـ QR...</div>
                        </div>
                      ) : qrImage ? (
                        <img
                          src={qrImage}
                          alt="WhatsApp QR Code"
                          style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }}
                        />
                      ) : (
                        <div style={{ textAlign: 'center', color: '#000' }}>
                          <QrCode size={40} color="#000" style={{ margin: '0 auto 8px', opacity: 0.5 }} />
                          <button
                            onClick={loadQrAndState}
                            style={{
                              background: '#25D366',
                              color: '#000',
                              border: 'none',
                              padding: '6px 14px',
                              borderRadius: '8px',
                              fontWeight: 800,
                              cursor: 'pointer',
                              fontSize: '0.8rem',
                            }}
                          >
                            عرض رمز الـ QR
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Step-by-Step Instructions */}
                    <div>
                      <div style={{ color: 'var(--gold-primary)', fontWeight: 800, fontSize: '1rem', marginBottom: '12px' }}>
                        خطوات مسح الـ QR وتوثيق الرقم:
                      </div>
                      <ol style={{
                        paddingRight: '20px',
                        margin: 0,
                        color: 'var(--text-secondary)',
                        fontSize: '0.88rem',
                        lineHeight: 1.8,
                      }}>
                        <li>افتح تطبيق <strong>واتساب</strong> على هاتفك المحمول.</li>
                        <li>اضغط على <strong>القائمة (⋮)</strong> في أندرويد أو <strong>الإعدادات</strong> في آيفون.</li>
                        <li>اختر <strong>الأجهزة المرتبطة (Linked Devices)</strong>.</li>
                        <li>اضغط على <strong>ربط جهاز (Link a Device)</strong> ووجّه كاميرا الهاتف نحو الـ QR المقابل.</li>
                        <li>سيتم التعرف على الرقم وتحديث حالته إلى <strong>متصل 🟢</strong> تلقائياً في ثوانٍ!</li>
                      </ol>

                      <div style={{
                        marginTop: '16px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        background: 'rgba(245, 190, 24, 0.08)',
                        padding: '10px 14px',
                        borderRadius: '10px',
                        border: '1px solid rgba(245, 190, 24, 0.2)',
                        fontSize: '0.8rem',
                        color: 'var(--gold-primary)',
                      }}>
                        <Clock size={16} />
                        <span>يتجدد رمز الـ QR تلقائياً كل دقيقة لضمان الأمان.</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* ═══════════════════════════════════════════════════════════════
                  BOX: OTP MESSAGE TEMPLATE CUSTOMIZATION & LIVE PREVIEW
                  ═══════════════════════════════════════════════════════════════ */}
              <div className="kpi-card gold-glow-border fade-in" style={{
                padding: '28px',
                background: 'linear-gradient(135deg, rgba(20, 27, 39, 0.98) 0%, rgba(16, 24, 38, 0.98) 100%)',
              }}>
                {/* Header */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{
                      width: '44px',
                      height: '44px',
                      borderRadius: '12px',
                      background: 'rgba(245, 190, 24, 0.15)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}>
                      <Edit3 color="var(--gold-primary)" size={24} />
                    </div>
                    <div>
                      <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span>صندوق تعديل رسالة الواتساب مع كود الـ OTP</span>
                        <span style={{
                          background: 'rgba(245, 190, 24, 0.2)',
                          color: 'var(--gold-primary)',
                          fontSize: '0.72rem',
                          fontWeight: 800,
                          padding: '3px 8px',
                          borderRadius: '10px',
                          border: '1px solid rgba(245, 190, 24, 0.3)',
                        }}>
                          تخصيص مباشر ✍️
                        </span>
                      </h3>
                      <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                        عدّل النص الذي يصل للعملاء على واتساب عند تسجيل الدخول أو طلب رمز التحقق في تطبيق ركنة.
                      </p>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <button
                      type="button"
                      onClick={handleResetOtpTemplate}
                      className="btn-ghost"
                      style={{ fontSize: '0.82rem', gap: '6px' }}
                      title="استعادة النص المقترح الافتراضي"
                    >
                      <RotateCcw size={14} />
                      <span>الافتراضي</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleSaveOtpTemplate}
                      disabled={isSavingTemplate}
                      style={{
                        background: 'linear-gradient(135deg, #f5be18 0%, #e5aa09 100%)',
                        color: '#000',
                        fontWeight: 800,
                        border: 'none',
                        padding: '9px 18px',
                        borderRadius: '10px',
                        cursor: 'pointer',
                        fontSize: '0.85rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        boxShadow: '0 2px 10px rgba(245, 190, 24, 0.35)',
                      }}
                    >
                      {isSavingTemplate ? (
                        <>
                          <RefreshCw size={14} className="animate-spin" />
                          <span>جاري الحفظ...</span>
                        </>
                      ) : (
                        <>
                          <Check size={16} />
                          <span>حفظ التعديلات</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Grid: Editor (Left) & WhatsApp Preview (Right) */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
                  gap: '24px',
                  alignItems: 'start',
                }}>
                  {/* Left: Textarea & Helper tags */}
                  <div>
                    {/* Variable insertion bar */}
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      marginBottom: '10px',
                      flexWrap: 'wrap',
                      gap: '8px',
                    }}>
                      <label style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
                        نص الرسالة (Message Body):
                      </label>
                      <button
                        type="button"
                        onClick={handleInsertCodeTag}
                        style={{
                          background: 'rgba(245, 190, 24, 0.12)',
                          color: 'var(--gold-primary)',
                          border: '1px solid rgba(245, 190, 24, 0.35)',
                          padding: '4px 10px',
                          borderRadius: '8px',
                          fontSize: '0.78rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '5px',
                        }}
                        title="إدراج متغير كود التحقق في الرسالة"
                      >
                        <Sparkles size={12} />
                        <span>إدراج رمز الكود: <strong>{'{code}'}</strong></span>
                      </button>
                    </div>

                    {/* Textarea */}
                    <div style={{ position: 'relative' }}>
                      <textarea
                        value={otpTemplate}
                        onChange={(e) => setOtpTemplate(e.target.value)}
                        rows={8}
                        className="admin-input"
                        style={{
                          width: '100%',
                          minHeight: '180px',
                          fontFamily: 'inherit',
                          fontSize: '0.92rem',
                          lineHeight: '1.7',
                          padding: '14px 16px',
                          borderRadius: '12px',
                          resize: 'vertical',
                          borderColor: !otpTemplate.includes('{code}') ? '#ef4444' : 'var(--border-subtle)',
                        }}
                        placeholder="اكتب نص الرسالة هنا، وتأكد من تضمين {code}..."
                      />
                    </div>

                    {/* Warning if {code} is missing */}
                    {!otpTemplate.includes('{code}') ? (
                      <div style={{
                        marginTop: '10px',
                        padding: '8px 12px',
                        background: 'rgba(239, 68, 68, 0.12)',
                        border: '1px solid rgba(239, 68, 68, 0.3)',
                        borderRadius: '8px',
                        color: '#f87171',
                        fontSize: '0.8rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                      }}>
                        <AlertTriangle size={16} />
                        <span>تحذير: الرسالة لا تحتوي على <strong>{'{code}'}</strong>! لن يصل كود التحقق للمستخدم بدون هذا المتغير.</span>
                      </div>
                    ) : (
                      <div style={{
                        marginTop: '10px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        fontSize: '0.78rem',
                        color: 'var(--text-muted)',
                      }}>
                        <span style={{ color: '#34d399', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <CheckCircle2 size={13} />
                          <span>المتغير <strong>{'{code}'}</strong> مدمج بشكل صحيح</span>
                        </span>
                        <span>{otpTemplate.length} حرف | {otpTemplate.split('\n').length} أسطر</span>
                      </div>
                    )}

                    {/* WhatsApp formatting tips */}
                    <div style={{
                      marginTop: '14px',
                      padding: '10px 14px',
                      background: 'rgba(255, 255, 255, 0.02)',
                      borderRadius: '10px',
                      border: '1px solid var(--border-subtle)',
                      fontSize: '0.76rem',
                      color: 'var(--text-secondary)',
                      lineHeight: '1.6',
                    }}>
                      <strong style={{ color: 'var(--gold-primary)' }}>💡 تلميحات تنسيق واتساب:</strong>
                      <span style={{ marginRight: '8px' }}>ضع <code>*نص*</code> لجعله <strong>عريضاً</strong></span>
                      <span style={{ marginRight: '8px' }}>• ضع <code>_نص_</code> لجعله <em>مائلاً</em></span>
                      <span style={{ marginRight: '8px' }}>• ضع <code>~نص~</code> لجعله <del>مشطوباً</del></span>
                    </div>
                  </div>

                  {/* Right: Realistic WhatsApp Chat Bubble Preview */}
                  <div>
                    <div style={{
                      fontSize: '0.85rem',
                      fontWeight: 700,
                      color: 'var(--text-secondary)',
                      marginBottom: '10px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Smartphone size={16} color="#25D366" />
                        <span>معاينة حية على واتساب (Live Preview)</span>
                      </span>
                      <span style={{ fontSize: '0.74rem', color: '#25D366' }}>شكل الرسالة في الهاتف</span>
                    </div>

                    {/* WhatsApp Device Container */}
                    <div style={{
                      background: '#0b141a',
                      borderRadius: '16px',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      overflow: 'hidden',
                      boxShadow: '0 12px 30px rgba(0, 0, 0, 0.6)',
                    }}>
                      {/* WhatsApp Chat Top Header */}
                      <div style={{
                        background: '#202c33',
                        padding: '10px 14px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div style={{
                            width: '36px',
                            height: '36px',
                            borderRadius: '50%',
                            background: 'linear-gradient(135deg, #f5be18, #d97706)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#000',
                            fontWeight: 900,
                            fontSize: '0.9rem',
                          }}>
                            🚗
                          </div>
                          <div>
                            <div style={{ color: '#e9edef', fontSize: '0.88rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '5px' }}>
                              <span>ركنة | Rakna OTP</span>
                              <CheckCircle2 size={13} color="#25D366" />
                            </div>
                            <div style={{ color: '#8696a0', fontSize: '0.72rem' }}>متصل الآن (Online)</div>
                          </div>
                        </div>
                        <div style={{ color: '#8696a0', fontSize: '0.72rem' }}>WhatsApp</div>
                      </div>

                      {/* WhatsApp Chat Body */}
                      <div style={{
                        padding: '16px',
                        minHeight: '200px',
                        background: 'radial-gradient(circle, rgba(17, 27, 33, 0.95) 0%, rgba(11, 20, 26, 0.98) 100%)',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'center',
                      }}>
                        {/* WhatsApp Message Bubble */}
                        <div style={{
                          alignSelf: 'flex-start',
                          maxWidth: '92%',
                          background: '#005c4b',
                          color: '#e9edef',
                          padding: '12px 14px 8px',
                          borderRadius: '12px 12px 12px 2px',
                          fontSize: '0.86rem',
                          lineHeight: '1.65',
                          whiteSpace: 'pre-wrap',
                          wordBreak: 'break-word',
                          boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
                          position: 'relative',
                        }}>
                          {otpTemplate ? (
                            otpTemplate.replace(/\{code\}/g, '489201')
                          ) : (
                            <span style={{ color: '#8696a0', fontStyle: 'italic' }}>اكتب نص الرسالة في الصندوق المقابل للمعاينة...</span>
                          )}

                          {/* WhatsApp Timestamp & ticks */}
                          <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'flex-end',
                            gap: '4px',
                            marginTop: '6px',
                            fontSize: '0.68rem',
                            color: '#8696a0',
                          }}>
                            <span>12:45 م</span>
                            <span style={{ color: '#53bdeb', fontWeight: 800 }}>✓✓</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Live Test Dispatcher Box */}
              <div className="kpi-card" style={{ padding: '24px', background: 'rgba(255, 190, 24, 0.03)', border: '1px dashed var(--border-gold)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px', flexWrap: 'wrap', gap: '10px' }}>
                  <h4 style={{ fontSize: '1.05rem', fontWeight: 800, color: '#fff', display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
                    <Zap color="#f5be18" size={20} />
                    <span>اختبار بوابة الواتساب الآن (Send Test OTP)</span>
                  </h4>
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                    المزود النشط: <strong style={{ color: '#25D366' }}>{waConfig.provider}</strong>
                  </span>
                </div>
                <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '16px' }}>
                  أدخل رقم هاتفك مسبوقاً بكود الدولة (مثل +201012345678) للتأكد من وصول كود التحقق لهاتفك فوراً عبر الـ API.
                </p>

                <form onSubmit={handleTestWhatsApp} style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                  <input
                    type="text"
                    value={testOtpPhone}
                    onChange={(e) => setTestOtpPhone(e.target.value)}
                    placeholder="+2010XXXXXXXX"
                    className="admin-input"
                    style={{ direction: 'ltr', textAlign: 'right', width: '220px' }}
                    required
                  />
                  <button
                    type="submit"
                    disabled={isTestingWa}
                    style={{
                      background: '#25D366',
                      color: '#000',
                      fontWeight: 800,
                      border: 'none',
                      padding: '11px 20px',
                      borderRadius: '10px',
                      cursor: 'pointer',
                      fontSize: '0.88rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      boxShadow: '0 2px 10px rgba(37, 211, 102, 0.3)',
                    }}
                  >
                    <Play size={16} />
                    <span>{isTestingWa ? 'جاري الإرسال...' : 'إرسال كود OTP تجريبي الآن'}</span>
                  </button>
                </form>

                {testFeedback && (
                  <div style={{
                    marginTop: '14px',
                    padding: '12px 16px',
                    borderRadius: '10px',
                    background: testFeedback.success ? 'rgba(37, 211, 102, 0.12)' : 'rgba(239, 68, 68, 0.12)',
                    border: `1px solid ${testFeedback.success ? 'rgba(37, 211, 102, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
                    color: testFeedback.success ? '#34d399' : '#f87171',
                    fontSize: '0.85rem',
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                  }}>
                    {testFeedback.success ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}
                    <span>{testFeedback.message}</span>
                  </div>
                )}
              </div>

              {/* WhatsApp KPIs */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                gap: '16px',
              }}>
                <div className="kpi-card">
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 600 }}>إجمالي طلبات كود الـ OTP</span>
                    <div style={{
                      width: '40px',
                      height: '40px',
                      borderRadius: '10px',
                      background: 'rgba(37, 211, 102, 0.15)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}>
                      <MessageSquare color="#25D366" size={20} />
                    </div>
                  </div>
                  <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#fff', marginTop: '8px' }}>
                    {whatsappMessages.length}
                  </div>
                  <div style={{ fontSize: '0.78rem', color: '#10b981', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '4px' }}>
                    <span>رسائل مسجلة في النظام</span>
                  </div>
                </div>

                <div className="kpi-card">
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 600 }}>أُرسلت بنجاح عبر API</span>
                    <div style={{
                      width: '40px',
                      height: '40px',
                      borderRadius: '10px',
                      background: 'rgba(16, 185, 129, 0.15)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}>
                      <CheckCircle2 color="#10b981" size={20} />
                    </div>
                  </div>
                  <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#10b981', marginTop: '8px' }}>
                    {whatsappMessages.filter((m) => m.status === 'SENT').length}
                  </div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                    <span>تم تسليمها للعميل تلقائياً</span>
                  </div>
                </div>

                <div className="kpi-card">
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 600 }}>قيد الانتظار / اليدوي</span>
                    <div style={{
                      width: '40px',
                      height: '40px',
                      borderRadius: '10px',
                      background: 'rgba(245, 190, 24, 0.15)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}>
                      <Clock color="#f5be18" size={20} />
                    </div>
                  </div>
                  <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#f5be18', marginTop: '8px' }}>
                    {whatsappMessages.filter((m) => m.status === 'QUEUED' || m.status === 'SIMULATED').length}
                  </div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                    <span>متاح إرسالها أو فتحها بـ WhatsApp Web</span>
                  </div>
                </div>
              </div>

              {/* Main Section: Live Outbox Table */}
              <div className="kpi-card" style={{ padding: '24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
                  <div>
                    <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#25D366' }}></span>
                      صندوق صادر رسائل الواتساب (WhatsApp Live Outbox)
                    </h3>
                    <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                      سجل لحظي لكل طلب OTP تم عبر التطبيق مع كود التحقق وحالة الإرسال وزر الإرسال الفوري.
                    </p>
                  </div>
                  <button onClick={loadAllData} className="btn-ghost" style={{ fontSize: '0.82rem', gap: '6px' }}>
                    <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
                    <span>تحديث حي</span>
                  </button>
                </div>

                {whatsappMessages.length === 0 ? (
                  <div style={{
                    padding: '48px 24px',
                    textAlign: 'center',
                    background: 'rgba(255,255,255,0.02)',
                    borderRadius: '14px',
                    border: '1px dashed var(--border-subtle)',
                  }}>
                    <MessageSquare size={44} color="#25D366" style={{ margin: '0 auto 14px', opacity: 0.6 }} />
                    <div style={{ color: '#fff', fontWeight: 700, fontSize: '1.05rem' }}>لا توجد رسائل واتساب صادرة حتى الآن</div>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginTop: '6px', maxWidth: '420px', margin: '6px auto 0' }}>
                      عندما يقوم أي مستخدم بإدخال رقم هاتفه في التطبيق أو طلب كود تحقق، ستظهر الرسالة هنا مباشرة.
                    </p>
                  </div>
                ) : (
                  <div style={{ overflowX: 'auto' }}>
                    <table className="admin-table" style={{ width: '100%' }}>
                      <thead>
                        <tr>
                          <th>رقم الهاتف</th>
                          <th>كود التحقق (OTP)</th>
                          <th>وقت الطلب</th>
                          <th>الحالة / المزود</th>
                          <th>معاينة الرسالة</th>
                          <th>الإجراءات السريعة</th>
                        </tr>
                      </thead>
                      <tbody>
                        {whatsappMessages.map((msg) => (
                          <tr key={msg.id}>
                            <td style={{ fontWeight: 800, color: '#fff', direction: 'ltr', textAlign: 'right' }}>
                              {msg.phone}
                            </td>
                            <td>
                              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
                                <span style={{
                                  background: 'rgba(245, 190, 24, 0.15)',
                                  color: 'var(--gold-primary)',
                                  padding: '4px 10px',
                                  borderRadius: '8px',
                                  fontFamily: 'monospace',
                                  fontWeight: 800,
                                  fontSize: '1.1rem',
                                  letterSpacing: '2px',
                                  border: '1px solid rgba(245, 190, 24, 0.3)',
                                }}>
                                  {msg.code}
                                </span>
                                <button
                                  onClick={() => handleCopyCode(msg.code)}
                                  title="نسخ الكود"
                                  style={{
                                    background: 'transparent',
                                    border: 'none',
                                    color: 'var(--text-secondary)',
                                    cursor: 'pointer',
                                    padding: '4px',
                                  }}
                                >
                                  <Copy size={16} />
                                </button>
                              </div>
                            </td>
                            <td style={{ color: 'var(--text-secondary)', fontSize: '0.82rem' }}>
                              {new Date(msg.createdAt).toLocaleTimeString('ar-EG', {
                                hour: '2-digit',
                                minute: '2-digit',
                                second: '2-digit',
                              })}
                            </td>
                            <td>
                              {msg.status === 'SENT' ? (
                                <span className="badge badge-active" style={{ background: 'rgba(16, 185, 129, 0.2)', color: '#34d399' }}>
                                  أُرسل بنجاح ({msg.providerUsed || 'API'})
                                </span>
                              ) : msg.status === 'FAILED' ? (
                                <span
                                  className="badge"
                                  title={msg.errorMessage}
                                  style={{ background: 'rgba(239, 68, 68, 0.2)', color: '#f87171', cursor: 'help' }}
                                >
                                  فشل الإرسال ⚠️
                                </span>
                              ) : (
                                <span className="badge badge-pending" style={{ background: 'rgba(245, 190, 24, 0.2)', color: '#f5be18' }}>
                                  بانتظار الإرسال
                                </span>
                              )}
                            </td>
                            <td style={{ maxWidth: '280px', color: 'var(--text-muted)', fontSize: '0.78rem' }}>
                              <div style={{
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                              }}>
                                {msg.message}
                              </div>
                            </td>
                            <td>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <button
                                  onClick={() => handleResendWhatsApp(msg.id)}
                                  title="إعادة إرسال عبر الـ API"
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '4px',
                                    background: 'rgba(245, 190, 24, 0.15)',
                                    color: 'var(--gold-primary)',
                                    fontWeight: 700,
                                    border: '1px solid rgba(245, 190, 24, 0.3)',
                                    padding: '7px 12px',
                                    borderRadius: '8px',
                                    cursor: 'pointer',
                                    fontSize: '0.78rem',
                                  }}
                                >
                                  <RefreshCw size={13} />
                                  <span>إعادة عبر API</span>
                                </button>

                                <button
                                  onClick={() => handleOpenWhatsApp(msg)}
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                    background: '#25D366',
                                    color: '#000',
                                    fontWeight: 800,
                                    border: 'none',
                                    padding: '7px 13px',
                                    borderRadius: '8px',
                                    cursor: 'pointer',
                                    fontSize: '0.8rem',
                                    boxShadow: '0 2px 8px rgba(37, 211, 102, 0.25)',
                                  }}
                                >
                                  <ExternalLink size={14} />
                                  <span>فتح في واتساب</span>
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Direct Custom WhatsApp Sender Form */}
              <div className="kpi-card" style={{ padding: '24px' }}>
                <h3 style={{ fontSize: '1.15rem', fontWeight: 800, color: '#fff', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                  <Send color="var(--gold-primary)" size={20} />
                  إرسال رسالة واتساب مخصصة لأي رقم (Direct Dispatcher)
                </h3>
                <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '18px' }}>
                  يمكنك مراسلة أي عميل أو صاحب سيارة فوراً عبر رابط واتساب مشفر بدون حفظ الرقم في جهات اتصالك.
                </p>

                <form onSubmit={handleSendCustomWhatsApp} style={{ display: 'grid', gridTemplateColumns: '1fr 2fr auto', gap: '14px', alignItems: 'flex-end' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.82rem', color: 'var(--text-secondary)', fontWeight: 600, marginBottom: '6px' }}>
                      رقم الهاتف (+20)
                    </label>
                    <input
                      type="text"
                      value={customPhone}
                      onChange={(e) => setCustomPhone(e.target.value)}
                      placeholder="+201012345678"
                      className="admin-input"
                      style={{ direction: 'ltr', textAlign: 'right' }}
                      required
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.82rem', color: 'var(--text-secondary)', fontWeight: 600, marginBottom: '6px' }}>
                      نص الرسالة
                    </label>
                    <input
                      type="text"
                      value={customText}
                      onChange={(e) => setCustomText(e.target.value)}
                      placeholder="مرحباً، تنبيه بخصوص سيارتك في ركنة..."
                      className="admin-input"
                      required
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={customSending}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      background: 'var(--gold-primary)',
                      color: '#000',
                      fontWeight: 800,
                      border: 'none',
                      padding: '12px 20px',
                      borderRadius: '10px',
                      cursor: 'pointer',
                      fontSize: '0.88rem',
                      height: '42px',
                    }}
                  >
                    <Send size={16} />
                    <span>إرسال واتساب</span>
                  </button>
                </form>
              </div>
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════════════════
              TAB: LIVE CUSTOMER SUPPORT CHAT (خدمة العملاء والدعم الفني)
              ═══════════════════════════════════════════════════════════════════ */}
          {currentTab === 'support' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* Header Card */}
              <div className="kpi-card gold-glow-border fade-in" style={{ padding: '24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{
                      width: '44px',
                      height: '44px',
                      borderRadius: '12px',
                      background: 'rgba(56, 189, 248, 0.15)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}>
                      <Headphones color="#38bdf8" size={24} />
                    </div>
                    <div>
                      <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#fff', margin: 0 }}>
                        مركز محادثات خدمة العملاء والدعم الفني المباشر
                      </h3>
                      <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginTop: '2px', margin: 0 }}>
                        تواصل لحظي حي مع مستخدمي تطبيق ركنة عند ضغطهم على زر "تواصل مع الدعم".
                      </p>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <button
                      onClick={() => loadSupportThreads()}
                      className="btn-ghost"
                      style={{ fontSize: '0.82rem', gap: '6px' }}
                    >
                      <RefreshCw size={14} className={isLoadingSupportMsgs ? 'animate-spin' : ''} />
                      <span>تحديث فوري</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Two-Pane Support Desk */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: '320px 1fr',
                gap: '20px',
                minHeight: '620px',
                alignItems: 'stretch',
              }}>
                {/* Right Pane: Users / Conversations List */}
                <div className="kpi-card" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div style={{ position: 'relative' }}>
                    <Search size={16} style={{ position: 'absolute', right: '12px', top: '12px', color: 'var(--text-muted)' }} />
                    <input
                      type="text"
                      value={supportSearch}
                      onChange={(e) => setSupportSearch(e.target.value)}
                      placeholder="بحث بالاسم أو الهاتف..."
                      className="admin-input"
                      style={{ paddingRight: '36px', fontSize: '0.82rem' }}
                    />
                  </div>

                  {/* Filter Tabs: All, Open, Closed */}
                  <div style={{ display: 'flex', gap: '6px', background: 'rgba(255,255,255,0.03)', padding: '4px', borderRadius: '10px' }}>
                    {[
                      { id: 'ALL', label: 'الكل', count: supportThreads.length },
                      { id: 'OPEN', label: 'النشطة 🟢', count: supportThreads.filter(t => t.ticketStatus !== 'CLOSED').length },
                      { id: 'CLOSED', label: 'المغلقة 🔒', count: supportThreads.filter(t => t.ticketStatus === 'CLOSED').length },
                    ].map((tab) => (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => setSupportFilter(tab.id)}
                        style={{
                          flex: 1,
                          padding: '6px 4px',
                          borderRadius: '8px',
                          border: 'none',
                          fontSize: '0.74rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                          background: supportFilter === tab.id ? 'rgba(56, 189, 248, 0.2)' : 'transparent',
                          color: supportFilter === tab.id ? '#38bdf8' : 'var(--text-muted)',
                          transition: 'all 0.15s ease',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {tab.label} ({tab.count})
                      </button>
                    ))}
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', overflowY: 'auto', maxHeight: '500px' }}>
                    {supportThreads
                      .filter(t => {
                        const matchesSearch = !supportSearch || t.phone.includes(supportSearch) || (t.userName && t.userName.includes(supportSearch));
                        const matchesFilter =
                          supportFilter === 'ALL' ||
                          (supportFilter === 'OPEN' && t.ticketStatus !== 'CLOSED') ||
                          (supportFilter === 'CLOSED' && t.ticketStatus === 'CLOSED');
                        return matchesSearch && matchesFilter;
                      }).length === 0 ? (
                      <div style={{ padding: '30px 10px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                        لا توجد محادثات تطابق هذا التصفية
                      </div>
                    ) : (
                      supportThreads
                        .filter(t => {
                          const matchesSearch = !supportSearch || t.phone.includes(supportSearch) || (t.userName && t.userName.includes(supportSearch));
                          const matchesFilter =
                            supportFilter === 'ALL' ||
                            (supportFilter === 'OPEN' && t.ticketStatus !== 'CLOSED') ||
                            (supportFilter === 'CLOSED' && t.ticketStatus === 'CLOSED');
                          return matchesSearch && matchesFilter;
                        })
                        .map((thread) => {
                          const isSelected = selectedSupportTicket
                            ? (selectedSupportTicket.ticketId === thread.ticketId)
                            : (selectedSupportUserId === thread.userId);
                          const isThreadClosed = thread.ticketStatus === 'CLOSED';

                          return (
                            <div
                              key={thread.ticketId || thread.userId}
                              onClick={() => handleSelectSupportThread(thread)}
                              style={{
                                padding: '12px 14px',
                                borderRadius: '12px',
                                background: isSelected ? 'rgba(56, 189, 248, 0.12)' : 'rgba(255, 255, 255, 0.02)',
                                border: isSelected ? '1px solid rgba(56, 189, 248, 0.4)' : '1px solid var(--border-subtle)',
                                cursor: 'pointer',
                                transition: 'all 0.15s ease',
                                opacity: isThreadClosed && !isSelected ? 0.75 : 1,
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                                <span style={{ fontWeight: 800, fontSize: '0.88rem', color: isSelected ? '#38bdf8' : '#fff' }}>
                                  {thread.userName || 'مستخدم ركنة'}
                                </span>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                  {isThreadClosed ? (
                                    <span style={{
                                      fontSize: '0.64rem',
                                      color: '#f87171',
                                      background: 'rgba(239, 68, 68, 0.15)',
                                      border: '1px solid rgba(239, 68, 68, 0.3)',
                                      padding: '1px 6px',
                                      borderRadius: '6px',
                                      fontWeight: 800,
                                    }}>
                                      🔒 مغلقة
                                    </span>
                                  ) : (
                                    <span style={{
                                      fontSize: '0.64rem',
                                      color: '#34d399',
                                      background: 'rgba(16, 185, 129, 0.15)',
                                      border: '1px solid rgba(16, 185, 129, 0.3)',
                                      padding: '1px 6px',
                                      borderRadius: '6px',
                                      fontWeight: 800,
                                    }}>
                                      🟢 نشطة
                                    </span>
                                  )}
                                  {thread.unreadCount > 0 && (
                                    <span style={{
                                      background: '#38bdf8',
                                      color: '#000',
                                      fontSize: '0.68rem',
                                      fontWeight: 900,
                                      padding: '2px 6px',
                                      borderRadius: '10px',
                                    }}>
                                      {thread.unreadCount} جديد
                                    </span>
                                  )}
                                </div>
                              </div>
                              <div style={{ fontSize: '0.78rem', color: 'var(--gold-primary)', direction: 'ltr', textAlign: 'right', fontWeight: 600 }}>
                                {thread.phone}
                              </div>
                              <div style={{
                                fontSize: '0.75rem',
                                color: 'var(--text-secondary)',
                                marginTop: '4px',
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                              }}>
                                {thread.lastMessage}
                              </div>
                              <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '4px', textAlign: 'left' }}>
                                {new Date(thread.lastMessageTime).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
                              </div>
                            </div>
                          );
                        })
                    )}
                  </div>
                </div>

                {/* Left Pane: Active Chat Conversation */}
                <div className="kpi-card" style={{ padding: '0', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                  {selectedSupportUser ? (
                    <>
                      {/* Chat Header Bar */}
                      {(() => {
                        const isClosed = selectedSupportTicket?.ticketStatus === 'CLOSED' || selectedSupportTicket?.status === 'CLOSED';
                        return (
                          <div style={{
                            padding: '16px 20px',
                            background: 'rgba(255, 255, 255, 0.03)',
                            borderBottom: '1px solid var(--border-subtle)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            flexWrap: 'wrap',
                            gap: '10px',
                          }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                              <div style={{
                                width: '40px',
                                height: '40px',
                                borderRadius: '50%',
                                background: isClosed
                                  ? 'linear-gradient(135deg, #64748b, #475569)'
                                  : 'linear-gradient(135deg, #38bdf8, #0284c7)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontWeight: 900,
                                color: isClosed ? '#fff' : '#000',
                              }}>
                                {selectedSupportUser.name ? selectedSupportUser.name.charAt(0) : 'U'}
                              </div>
                              <div>
                                <div style={{ fontWeight: 800, fontSize: '1rem', color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  <span>{selectedSupportUser.name || 'مستخدم ركنة'}</span>
                                  {isClosed ? (
                                    <span style={{
                                      fontSize: '0.72rem',
                                      color: '#f87171',
                                      background: 'rgba(239, 68, 68, 0.15)',
                                      border: '1px solid rgba(239, 68, 68, 0.3)',
                                      padding: '2px 8px',
                                      borderRadius: '10px',
                                      fontWeight: 800,
                                    }}>
                                      🔒 محادثة مغلقة ومؤرشفة
                                    </span>
                                  ) : (
                                    <span style={{ fontSize: '0.72rem', color: '#10b981', fontWeight: 700 }}>🟢 متصل بالتطبيق</span>
                                  )}
                                </div>
                                <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', direction: 'ltr', textAlign: 'right' }}>
                                  {selectedSupportUser.phone} {selectedSupportUser.cars && selectedSupportUser.cars.length > 0 && `• ${selectedSupportUser.cars.map(c => `${c.brand} ${c.model}`).join(', ')}`}
                                </div>
                              </div>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              {/* زر إغلاق المحادثة المطلوب من المستخدم */}
                              {!isClosed ? (
                                <button
                                  type="button"
                                  onClick={handleCloseSupportThread}
                                  disabled={isClosingThread}
                                  style={{
                                    background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.2) 0%, rgba(185, 28, 28, 0.3) 100%)',
                                    color: '#fca5a5',
                                    border: '1px solid rgba(239, 68, 68, 0.45)',
                                    padding: '7px 14px',
                                    borderRadius: '8px',
                                    cursor: 'pointer',
                                    fontSize: '0.78rem',
                                    fontWeight: 800,
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                    transition: 'all 0.2s',
                                    boxShadow: '0 2px 8px rgba(239, 68, 68, 0.2)',
                                  }}
                                  title="إغلاق وأرشفة هذه المحادثة (تُمسح من شاشة التطبيق ويتمكن العميل من فتح محادثة جديدة لاحقاً)"
                                >
                                  <Lock size={14} />
                                  <span>{isClosingThread ? 'جاري الإغلاق...' : 'إغلاق المحادثة 🔒'}</span>
                                </button>
                              ) : (
                                <div style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '6px',
                                  color: '#fca5a5',
                                  fontSize: '0.76rem',
                                  background: 'rgba(239, 68, 68, 0.1)',
                                  border: '1px solid rgba(239, 68, 68, 0.25)',
                                  padding: '6px 12px',
                                  borderRadius: '8px',
                                  fontWeight: 700,
                                }}>
                                  <Lock size={13} />
                                  <span>مغلقة بواسطة {selectedSupportTicket?.closedBy || 'الدعم'}</span>
                                </div>
                              )}

                              <button
                                onClick={() => window.open(`https://wa.me/${selectedSupportUser.phone.replace(/\D/g, '')}`, '_blank')}
                                className="btn-ghost"
                                style={{ fontSize: '0.78rem', gap: '6px', color: '#25D366' }}
                                title="فتح محادثة واتساب خارجية"
                              >
                                <MessageSquare size={14} />
                                <span>محادثة واتساب</span>
                              </button>
                              <button
                                onClick={() => handleToggleUserBlock(selectedSupportUser.id)}
                                style={{
                                  background: selectedSupportUser.isBlocked ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                                  color: selectedSupportUser.isBlocked ? '#34d399' : '#f87171',
                                  border: '1px solid rgba(255,255,255,0.1)',
                                  padding: '6px 12px',
                                  borderRadius: '8px',
                                  cursor: 'pointer',
                                  fontSize: '0.78rem',
                                  fontWeight: 700,
                                }}
                              >
                                {selectedSupportUser.isBlocked ? 'فك الحظر' : 'حظر الحساب'}
                              </button>
                            </div>
                          </div>
                        );
                      })()}

                      {/* Messages Flow Area */}
                      <div style={{
                        flex: 1,
                        padding: '20px',
                        overflowY: 'auto',
                        maxHeight: '420px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '12px',
                        background: 'radial-gradient(circle, rgba(14, 19, 29, 0.95) 0%, rgba(7, 9, 14, 0.98) 100%)',
                      }}>
                        {supportMessages.length === 0 ? (
                          <div style={{ textAlign: 'center', color: 'var(--text-muted)', margin: 'auto' }}>
                            لا توجد رسائل سابقة في هذه المحادثة
                          </div>
                        ) : (
                          supportMessages.map((msg) => {
                            const isSupport = msg.senderType === 'SUPPORT';
                            return (
                              <div
                                key={msg.id}
                                style={{
                                  alignSelf: isSupport ? 'flex-start' : 'flex-end',
                                  maxWidth: '75%',
                                  background: isSupport
                                    ? 'linear-gradient(135deg, rgba(56, 189, 248, 0.18) 0%, rgba(2, 132, 199, 0.18) 100%)'
                                    : 'rgba(255, 255, 255, 0.08)',
                                  border: isSupport ? '1px solid rgba(56, 189, 248, 0.35)' : '1px solid rgba(255, 255, 255, 0.1)',
                                  color: '#fff',
                                  padding: '10px 14px',
                                  borderRadius: isSupport ? '14px 14px 14px 2px' : '14px 14px 2px 14px',
                                  fontSize: '0.88rem',
                                  lineHeight: 1.6,
                                  boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
                                }}
                              >
                                <div style={{
                                  fontSize: '0.7rem',
                                  fontWeight: 800,
                                  color: isSupport ? '#38bdf8' : 'var(--gold-primary)',
                                  marginBottom: '4px',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                }}>
                                  {isSupport ? '🎧 فريق الدعم الفني (ركنة)' : '👤 العميل'}
                                </div>
                                <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                                  {msg.content}
                                </div>
                                <div style={{
                                  fontSize: '0.65rem',
                                  color: 'var(--text-muted)',
                                  textAlign: 'left',
                                  marginTop: '4px',
                                }}>
                                  {new Date(msg.createdAt).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>

                      {/* Bottom Reply Area: Locked Banner when closed, or Reply Form when open */}
                      {(selectedSupportTicket?.ticketStatus === 'CLOSED' || selectedSupportTicket?.status === 'CLOSED') ? (
                        <div style={{
                          padding: '18px 24px',
                          background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.08) 0%, rgba(15, 23, 42, 0.85) 100%)',
                          borderTop: '1px solid rgba(239, 68, 68, 0.25)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: '16px',
                        }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                            <div style={{
                              width: '40px',
                              height: '40px',
                              borderRadius: '10px',
                              background: 'rgba(239, 68, 68, 0.18)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              border: '1px solid rgba(239, 68, 68, 0.3)',
                              flexShrink: 0,
                            }}>
                              <Lock size={20} color="#f87171" />
                            </div>
                            <div>
                              <div style={{ fontWeight: 800, color: '#fca5a5', fontSize: '0.9rem' }}>
                                هذه المحادثة مغلقة ومؤرشفة للقراءة فقط 🔒
                              </div>
                              <div style={{ color: 'var(--text-muted)', fontSize: '0.78rem', marginTop: '3px', lineHeight: 1.5 }}>
                                تم إغلاق هذه المحادثة وحفظها في الأرشيف ولا يمكن لأي طرف الكتابة فيها مجدداً. تم مسحها تلقائياً من شاشة تطبيق العميل، وعندما يضغط العميل على "تواصل مع الدعم" مرة أخرى سيفتح محادثة جديدة نظيفة.
                              </div>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <>
                          {/* Quick Canned Replies */}
                          <div style={{
                            padding: '8px 16px',
                            background: 'rgba(0,0,0,0.2)',
                            borderTop: '1px solid var(--border-subtle)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            overflowX: 'auto',
                          }}>
                            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>ردود سريعة:</span>
                            {[
                              'أهلاً بك يا فندم 👋 كيف يمكننا مساعدتك اليوم؟',
                              'مدة توصيل الملصق من 24 إلى 48 ساعة كحد أقصى مع المندوب 🚚',
                              'الملصق مصنوع بمواد نانو كربونية مقاومة للماء والحرارة 100% 🛡️',
                              'تم حل المشكلة وتحديث بيانات سيارتك بنجاح ✨',
                            ].map((canned, idx) => (
                              <button
                                key={idx}
                                type="button"
                                onClick={() => setSupportReplyText(canned)}
                                style={{
                                  background: 'rgba(255,255,255,0.05)',
                                  border: '1px solid var(--border-subtle)',
                                  color: 'var(--text-secondary)',
                                  padding: '3px 10px',
                                  borderRadius: '12px',
                                  fontSize: '0.72rem',
                                  cursor: 'pointer',
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                {canned.substring(0, 32)}...
                              </button>
                            ))}
                          </div>

                          {/* Reply Input Bar */}
                          <form
                            onSubmit={handleSendSupportReply}
                            style={{
                              padding: '12px 16px',
                              background: 'rgba(255, 255, 255, 0.02)',
                              borderTop: '1px solid var(--border-subtle)',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '12px',
                            }}
                          >
                            <input
                              type="text"
                              value={supportReplyText}
                              onChange={(e) => setSupportReplyText(e.target.value)}
                              placeholder="اكتب ردك للعميل هنا واضغط Enter للإرسال الفوري..."
                              className="admin-input"
                              style={{ flex: 1, padding: '12px 14px', fontSize: '0.88rem' }}
                              required
                            />
                            <button
                              type="submit"
                              disabled={isSendingReply || !supportReplyText.trim()}
                              style={{
                                background: 'linear-gradient(135deg, #38bdf8 0%, #0284c7 100%)',
                                color: '#000',
                                fontWeight: 800,
                                border: 'none',
                                padding: '11px 22px',
                                borderRadius: '10px',
                                cursor: 'pointer',
                                fontSize: '0.88rem',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '8px',
                                boxShadow: '0 2px 10px rgba(56, 189, 248, 0.3)',
                              }}
                            >
                              {isSendingReply ? (
                                <>
                                  <RefreshCw size={16} className="animate-spin" />
                                  <span>جاري الإرسال...</span>
                                </>
                              ) : (
                                <>
                                  <Send size={16} />
                                  <span>إرسال الرد</span>
                                </>
                              )}
                            </button>
                          </form>
                        </>
                      )}
                    </>
                  ) : (
                    <div style={{ margin: 'auto', textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
                      <Headphones size={48} color="#38bdf8" style={{ margin: '0 auto 16px', opacity: 0.5 }} />
                      <div style={{ color: '#fff', fontSize: '1.1rem', fontWeight: 800 }}>اختر عميلاً من القائمة لبدء المحادثة</div>
                      <p style={{ fontSize: '0.82rem', marginTop: '6px' }}>
                        ستظهر جميع رسائل الدعم الفني الواردة من مستخدمي التطبيق هنا فوراً.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════════════════
              TAB: ABUSE REPORTS & CHAT MODERATION (بلاغات المحادثات والرقابة)
              ═══════════════════════════════════════════════════════════════════ */}
          {currentTab === 'abuse' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* Header Card */}
              <div className="kpi-card gold-glow-border fade-in" style={{ padding: '24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{
                      width: '44px',
                      height: '44px',
                      borderRadius: '12px',
                      background: 'rgba(239, 68, 68, 0.15)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}>
                      <ShieldAlert color="#ef4444" size={24} />
                    </div>
                    <div>
                      <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#fff', margin: 0 }}>
                        سجل بلاغات المحادثات والرقابة الأخلاقية (Chat Abuse Moderation)
                      </h3>
                      <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginTop: '2px', margin: 0 }}>
                        فحص وتدقيق المحادثات المبلّغ عنها لوجود ألفاظ خارجة، صور غير لائقة، أو تعدي للحدود والخصوصية.
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={loadAbuseReports}
                    className="btn-ghost"
                    style={{ fontSize: '0.82rem', gap: '6px' }}
                  >
                    <RefreshCw size={14} />
                    <span>تحديث البلاغات</span>
                  </button>
                </div>
              </div>

              {/* KPIs Row */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px' }}>
                <div className="kpi-card">
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>إجمالي البلاغات المسجلة</div>
                  <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#fff', marginTop: '6px' }}>{abuseReports.length}</div>
                </div>
                <div className="kpi-card" style={{ borderColor: 'rgba(239, 68, 68, 0.4)' }}>
                  <div style={{ fontSize: '0.8rem', color: '#f87171', fontWeight: 600 }}>بانتظار المراجعة الفورية 🚨</div>
                  <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#ef4444', marginTop: '6px' }}>{pendingAbuseCount}</div>
                </div>
                <div className="kpi-card">
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>بلاغات ألفاظ خارجة 🤬</div>
                  <div style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--gold-primary)', marginTop: '6px' }}>
                    {abuseReports.filter(r => r.reason === 'PROFANITY').length}
                  </div>
                </div>
                <div className="kpi-card">
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>بلاغات صور غير لائقة 🚫</div>
                  <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#38bdf8', marginTop: '6px' }}>
                    {abuseReports.filter(r => r.reason === 'INAPPROPRIATE_IMAGE').length}
                  </div>
                </div>
              </div>

              {/* Filter Tabs */}
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {[
                  { id: 'ALL', label: 'جميع البلاغات' },
                  { id: 'PENDING', label: 'قيد المراجعة 🚨' },
                  { id: 'RESOLVED', label: 'تم اتخاذ إجراء 🔒' },
                  { id: 'DISMISSED', label: 'تم التجاهل ✓' },
                ].map((f) => (
                  <button
                    key={f.id}
                    onClick={() => setAbuseFilter(f.id)}
                    style={{
                      padding: '8px 16px',
                      borderRadius: '10px',
                      border: '1px solid var(--border-subtle)',
                      background: abuseFilter === f.id ? 'var(--gold-primary)' : 'rgba(255,255,255,0.03)',
                      color: abuseFilter === f.id ? '#000' : 'var(--text-secondary)',
                      fontWeight: 700,
                      cursor: 'pointer',
                      fontSize: '0.82rem',
                    }}
                  >
                    {f.label}
                  </button>
                ))}
              </div>

              {/* Reports Table */}
              <div className="kpi-card" style={{ padding: '20px' }}>
                {abuseReports.length === 0 ? (
                  <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
                    <ShieldCheck size={44} color="#10b981" style={{ margin: '0 auto 12px' }} />
                    <div style={{ color: '#fff', fontWeight: 700, fontSize: '1rem' }}>لا توجد بلاغات مسجلة في هذا التصنيف</div>
                    <p style={{ fontSize: '0.82rem', marginTop: '4px' }}>جميع المحادثات بين العملاء تتبع إرشادات الأمان والخصوصية.</p>
                  </div>
                ) : (
                  <div style={{ overflowX: 'auto' }}>
                    <table className="admin-table" style={{ width: '100%' }}>
                      <thead>
                        <tr>
                          <th>المركبة والـ Tag</th>
                          <th>مقدّم البلاغ</th>
                          <th>نوع المخالفة</th>
                          <th>تفاصيل الشكوى</th>
                          <th>الوقت</th>
                          <th>الحالة</th>
                          <th>الإجراء</th>
                        </tr>
                      </thead>
                      <tbody>
                        {abuseReports
                          .filter(r => abuseFilter === 'ALL' || r.status === abuseFilter)
                          .map((rep) => {
                            let reasonBadge = { text: 'تعدي للحدود', bg: 'rgba(245, 158, 11, 0.15)', color: '#fbbf24' };
                            if (rep.reason === 'PROFANITY') {
                              reasonBadge = { text: 'ألفاظ خارجة 🤬', bg: 'rgba(239, 68, 68, 0.15)', color: '#f87171' };
                            } else if (rep.reason === 'INAPPROPRIATE_IMAGE') {
                              reasonBadge = { text: 'صورة غير لائقة 🚫', bg: 'rgba(168, 85, 247, 0.15)', color: '#c084fc' };
                            } else if (rep.reason === 'HARASSMENT') {
                              reasonBadge = { text: 'مضايقة وتهديد ⚠️', bg: 'rgba(239, 68, 68, 0.15)', color: '#f87171' };
                            }

                            return (
                              <tr key={rep.id}>
                                <td>
                                  <div style={{ fontWeight: 800, color: '#fff' }}>{rep.carInfo.brand} {rep.carInfo.model}</div>
                                  <div style={{ fontSize: '0.75rem', color: 'var(--gold-primary)' }}>{rep.carInfo.tagCode}</div>
                                </td>
                                <td>
                                  <span style={{ fontSize: '0.8rem', fontWeight: 600, color: rep.reporterType === 'OWNER' ? 'var(--gold-primary)' : '#38bdf8' }}>
                                    {rep.reporterType === 'OWNER' ? 'صاحب السيارة' : 'مُبلّغ مجهول (ماسح الـ Tag)'}
                                  </span>
                                </td>
                                <td>
                                  <span style={{
                                    background: reasonBadge.bg,
                                    color: reasonBadge.color,
                                    padding: '4px 8px',
                                    borderRadius: '8px',
                                    fontSize: '0.75rem',
                                    fontWeight: 800,
                                    display: 'inline-flex',
                                  }}>
                                    {reasonBadge.text}
                                  </span>
                                </td>
                                <td style={{ maxWidth: '240px', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                                  {rep.details || 'بدون تفاصيل إضافية'}
                                </td>
                                <td style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                                  {new Date(rep.createdAt).toLocaleDateString('ar-EG')} {new Date(rep.createdAt).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
                                </td>
                                <td>
                                  {rep.status === 'PENDING' && (
                                    <span style={{ background: 'rgba(239, 68, 68, 0.2)', color: '#f87171', padding: '3px 8px', borderRadius: '8px', fontSize: '0.72rem', fontWeight: 800 }}>
                                      قيد المراجعة 🚨
                                    </span>
                                  )}
                                  {rep.status === 'RESOLVED' && (
                                    <span style={{ background: 'rgba(16, 185, 129, 0.2)', color: '#34d399', padding: '3px 8px', borderRadius: '8px', fontSize: '0.72rem', fontWeight: 800 }}>
                                      تم اتخاذ إجراء 🔒
                                    </span>
                                  )}
                                  {rep.status === 'DISMISSED' && (
                                    <span style={{ background: 'rgba(255, 255, 255, 0.08)', color: 'var(--text-muted)', padding: '3px 8px', borderRadius: '8px', fontSize: '0.72rem', fontWeight: 800 }}>
                                      تم التجاهل ✓
                                    </span>
                                  )}
                                </td>
                                <td>
                                  <button
                                    onClick={() => handleOpenReportDetails(rep.id)}
                                    style={{
                                      background: 'linear-gradient(135deg, #f5be18 0%, #e5aa09 100%)',
                                      color: '#000',
                                      fontWeight: 800,
                                      border: 'none',
                                      padding: '7px 14px',
                                      borderRadius: '8px',
                                      cursor: 'pointer',
                                      fontSize: '0.8rem',
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '6px',
                                    }}
                                  >
                                    <Eye size={14} />
                                    <span>فحص المحادثة والصور</span>
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ═══════════════════════════════════════════════════════════════════
              MODAL: REPORTED CHAT AUDIT & ACTION
              ═══════════════════════════════════════════════════════════════════ */}
          {activeReportDetails && (
            <div style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(0, 0, 0, 0.85)',
              backdropFilter: 'blur(8px)',
              zIndex: 9999,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '20px',
            }}>
              <div className="glass-panel gold-glow-border fade-in" style={{
                width: '100%',
                maxWidth: '740px',
                maxHeight: '90vh',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
                borderRadius: '18px',
              }}>
                {/* Modal Header */}
                <div style={{
                  padding: '18px 24px',
                  background: 'rgba(239, 68, 68, 0.1)',
                  borderBottom: '1px solid rgba(239, 68, 68, 0.3)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <ShieldAlert size={24} color="#ef4444" />
                    <div>
                      <div style={{ fontWeight: 800, fontSize: '1.1rem', color: '#fff' }}>
                        تدقيق وفحص محادثة مبلّغ عنها (Chat Abuse Audit)
                      </div>
                      <div style={{ fontSize: '0.78rem', color: '#f87171' }}>
                        السبب: {activeReportDetails.report.reason} • مقدم البلاغ: {activeReportDetails.report.reporterType === 'OWNER' ? 'صاحب السيارة' : 'ماسح الملصق المجهول'}
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => setActiveReportDetails(null)}
                    style={{ background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer' }}
                  >
                    <X size={22} />
                  </button>
                </div>

                {/* Complaint Info & Car details */}
                <div style={{
                  padding: '14px 24px',
                  background: 'rgba(255,255,255,0.02)',
                  borderBottom: '1px solid var(--border-subtle)',
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                  gap: '12px',
                  fontSize: '0.82rem',
                }}>
                  <div>
                    <span style={{ color: 'var(--text-muted)' }}>السيارة: </span>
                    <strong style={{ color: '#fff' }}>{activeReportDetails.car.brand} {activeReportDetails.car.model} ({activeReportDetails.car.plateNumber || 'بدون لوحة'})</strong>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-muted)' }}>مالك السيارة: </span>
                    <strong style={{ color: 'var(--gold-primary)' }}>{activeReportDetails.owner.name} ({activeReportDetails.owner.phone})</strong>
                  </div>
                  <div style={{ gridColumn: '1 / -1', color: 'var(--text-secondary)' }}>
                    <span style={{ color: 'var(--text-muted)' }}>نص الشكوى المقدمة: </span>
                    <em>"{activeReportDetails.report.details || 'لا توجد ملاحظات إضافية'}"</em>
                  </div>
                </div>

                {/* Chat Messages Scroll */}
                <div style={{
                  flex: 1,
                  padding: '20px 24px',
                  overflowY: 'auto',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                  background: '#090d14',
                }}>
                  <div style={{ textAlign: 'center', fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '8px' }}>
                    ── سجل المحادثة الكامل المتبادل بين الطرفين ──
                  </div>

                  {activeReportDetails.messages.map((msg) => {
                    const isReporter = msg.senderType === 'REPORTER';
                    return (
                      <div
                        key={msg.id}
                        style={{
                          alignSelf: isReporter ? 'flex-end' : 'flex-start',
                          maxWidth: '80%',
                          background: isReporter ? 'rgba(56, 189, 248, 0.12)' : 'rgba(245, 190, 24, 0.12)',
                          border: isReporter ? '1px solid rgba(56, 189, 248, 0.3)' : '1px solid rgba(245, 190, 24, 0.3)',
                          borderRadius: '12px',
                          padding: '10px 14px',
                          color: '#fff',
                        }}
                      >
                        <div style={{
                          fontSize: '0.72rem',
                          fontWeight: 800,
                          color: isReporter ? '#38bdf8' : 'var(--gold-primary)',
                          marginBottom: '4px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                        }}>
                          <span>{isReporter ? 'ماسح الـ Tag المجهول' : 'صاحب المركبة'}</span>
                          <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>
                            {new Date(msg.createdAt).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <div style={{ fontSize: '0.88rem', lineHeight: 1.6 }}>{msg.content}</div>
                        {msg.imageUrl && (
                          <div style={{ marginTop: '8px' }}>
                            <img
                              src={msg.imageUrl}
                              alt="Attached photo"
                              style={{ maxWidth: '100%', maxHeight: '200px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.2)' }}
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Action Buttons Footer */}
                <div style={{
                  padding: '16px 24px',
                  background: 'rgba(20, 27, 39, 0.95)',
                  borderTop: '1px solid var(--border-subtle)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: '10px',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <button
                      type="button"
                      disabled={isActingReport}
                      onClick={() => handleTakeReportAction(activeReportDetails.report.id, 'BLOCK_USER')}
                      style={{
                        background: 'rgba(239, 68, 68, 0.2)',
                        color: '#f87171',
                        border: '1px solid #ef4444',
                        padding: '9px 16px',
                        borderRadius: '10px',
                        fontWeight: 800,
                        cursor: 'pointer',
                        fontSize: '0.82rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                      }}
                    >
                      <Ban size={16} />
                      <span>حظر المستخدم وإنهاء المحادثة</span>
                    </button>

                    <button
                      type="button"
                      disabled={isActingReport}
                      onClick={() => handleTakeReportAction(activeReportDetails.report.id, 'TERMINATE_CHAT')}
                      style={{
                        background: 'rgba(245, 158, 11, 0.15)',
                        color: '#fbbf24',
                        border: '1px solid rgba(245, 158, 11, 0.4)',
                        padding: '9px 16px',
                        borderRadius: '10px',
                        fontWeight: 800,
                        cursor: 'pointer',
                        fontSize: '0.82rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                      }}
                    >
                      <Lock size={16} />
                      <span>إغلاق المحادثة المسيئة</span>
                    </button>

                    <button
                      type="button"
                      disabled={isActingReport}
                      onClick={() => handleTakeReportAction(activeReportDetails.report.id, 'DISMISS')}
                      style={{
                        background: 'rgba(255, 255, 255, 0.05)',
                        color: 'var(--text-secondary)',
                        border: '1px solid var(--border-subtle)',
                        padding: '9px 16px',
                        borderRadius: '10px',
                        fontWeight: 700,
                        cursor: 'pointer',
                        fontSize: '0.82rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                      }}
                    >
                      <Check size={16} />
                      <span>تجاهل البلاغ (سليم)</span>
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => setActiveReportDetails(null)}
                    className="btn-ghost"
                    style={{ fontSize: '0.82rem' }}
                  >
                    إغلاق المعاينة
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
