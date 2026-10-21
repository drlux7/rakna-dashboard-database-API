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

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  const loadAllData = async () => {
    if (!token) return;
    setIsLoading(true);
    try {
      const [statsRes, tagsRes, ordersRes, usersRes, waRes] = await Promise.all([
        api.getStats().catch(() => null),
        api.listTags().catch(() => null),
        api.listOrders().catch(() => null),
        api.listUsers().catch(() => null),
        api.getWhatsAppOutbox().catch(() => null),
      ]);

      if (statsRes && statsRes.stats) setStats(statsRes.stats);
      if (tagsRes && tagsRes.tags) setTags(tagsRes.tags);
      if (ordersRes && ordersRes.orders) setOrders(ordersRes.orders);
      if (usersRes && usersRes.users) setUsersList(usersRes.users);
      if (waRes && waRes.messages) {
        setWhatsappMessages(waRes.messages);
        if (waRes.stats) setWhatsappStats(waRes.stats);
      }
    } catch (err) {
      console.error('Data load error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (token) {
      loadAllData();
    }
  }, [token]);

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
                    <span>رسائل صادرة ومسجلة في النظام</span>
                  </div>
                </div>

                <div className="kpi-card">
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 600 }}>تم فتحها / إرسالها للواتساب</span>
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
                    <span>تم فتح المحادثة وتأكيد الإرسال</span>
                  </div>
                </div>

                <div className="kpi-card">
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 600 }}>قيد الانتظار (جاهزة للنقر)</span>
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
                    {whatsappMessages.filter((m) => m.status === 'QUEUED').length}
                  </div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                    <span>رسائل جديدة بانتظار فتح الواتساب</span>
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
                      يتم رصد كل طلب كود تحقق (OTP) يتم في التطبيق هنا لحظياً. اضغط على "فتح في واتساب" لإرسال الكود للعميل مجاناً بدون اشتراكات مدفوعة.
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
                      عندما يقوم أي مستخدم بإدخال رقم هاتفه في التطبيق أو طلب كود تحقق، ستظهر الرسالة هنا مباشرة برابط فتح المحادثة الجاهز.
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
                          <th>الحالة</th>
                          <th>معاينة الرسالة</th>
                          <th>الإجراء السريع</th>
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
                                  تم الفتح / الإرسال
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
                                  onClick={() => handleOpenWhatsApp(msg)}
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '6px',
                                    background: '#25D366',
                                    color: '#000',
                                    fontWeight: 800,
                                    border: 'none',
                                    padding: '8px 14px',
                                    borderRadius: '8px',
                                    cursor: 'pointer',
                                    fontSize: '0.82rem',
                                    boxShadow: '0 2px 8px rgba(37, 211, 102, 0.3)',
                                    transition: 'all 0.15s ease',
                                  }}
                                  onMouseOver={(e) => (e.currentTarget.style.transform = 'translateY(-1px)')}
                                  onMouseOut={(e) => (e.currentTarget.style.transform = 'translateY(0)')}
                                >
                                  <ExternalLink size={15} />
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
        </div>
      </main>
    </div>
  );
}
