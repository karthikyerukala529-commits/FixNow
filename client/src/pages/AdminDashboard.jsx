import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { BarChart, Bar, XAxis, YAxis, PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts'
import {
  LogOut, Users, Wrench, ClipboardList, CheckCircle2, XCircle, IndianRupee, Wallet, ChevronDown, ShieldCheck,
  Search, LayoutDashboard, AlertCircle, Clock
} from 'lucide-react'
import { adminApi } from '../services/api.js'
import { useAdminAuth } from '../context/AdminAuthContext.jsx'

const PIE_COLORS = ['#FF6A3D', '#2F6FED', '#17A673', '#F59E0B', '#8B5CF6', '#EC4899', '#14B8A6', '#64748B']
const STATUS_TONE = {
  requested: 'bg-trust-50 text-trust', quote_sent: 'bg-amber-50 text-amber-700', quote_accepted: 'bg-okgreen-50 text-okgreen',
  technician_arriving: 'bg-trust-50 text-trust', arrived: 'bg-amber-50 text-amber-700', in_progress: 'bg-signal-50 text-signal',
  completed: 'bg-okgreen-50 text-okgreen', cancelled: 'bg-mist text-ink-400'
}
const TABS = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'technicians', label: 'Technicians', icon: Wrench },
  { id: 'customers', label: 'Customers', icon: Users },
  { id: 'bookings', label: 'Bookings', icon: ClipboardList }
]
const money = (n) => `₹${(n || 0).toLocaleString('en-IN')}`
const pretty = (s) => String(s || '').replace(/[-_]/g, ' ')

function Stat({ icon: Icon, label, value, tone, sub }) {
  return (
    <div className="bg-white rounded-2xl shadow-card p-4">
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-2 ${tone}`}><Icon size={16} /></div>
      <p className="text-2xl font-display font-bold text-ink leading-none">{value}</p>
      <p className="text-xs text-ink-400 mt-1.5">{label}</p>
      {sub && <p className="text-[10px] text-ink-400/80 mt-0.5">{sub}</p>}
    </div>
  )
}

function SearchBox({ value, onChange, placeholder }) {
  return (
    <div className="flex items-center gap-2 bg-white rounded-xl px-3.5 py-2.5 shadow-card flex-1">
      <Search size={15} className="text-ink-400" />
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="flex-1 outline-none text-sm bg-transparent" />
    </div>
  )
}

function TechnicianRow({ t, onAction }) {
  const [open, setOpen] = useState(false)
  const tone = t.approvalStatus === 'approved' ? 'bg-okgreen-50 text-okgreen' : t.approvalStatus === 'rejected' ? 'bg-signal-50 text-signal' : 'bg-amber-50 text-amber-700'
  return (
    <div className="p-4">
      <div className="flex items-center gap-3">
        <button onClick={() => setOpen(!open)} className="flex items-center gap-3 text-left flex-1 min-w-0">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-trust to-ink text-white text-xs font-semibold flex items-center justify-center shrink-0">{t.name.slice(0, 2).toUpperCase()}</div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-ink truncate">{t.name}</p>
            <p className="text-xs text-ink-400 truncate capitalize">{(t.categories || []).map(pretty).join(', ')} · ⭐ {t.rating || 'New'} · {t.experienceYears || 0} yrs</p>
          </div>
          <ChevronDown size={14} className={`text-ink-400 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>
        <span className={`text-[10px] font-semibold px-2.5 py-1 rounded-full capitalize ${tone}`}>{t.approvalStatus}</span>
      </div>
      {open && (
        <div className="mt-3 pl-[52px]">
          {t.bio && <p className="text-xs text-ink-400 italic mb-2">"{t.bio}"</p>}
          <p className="text-xs text-ink-400 mb-3">{t.completedJobs || 0} jobs · Wallet {money(t.walletBalance)} · {t.phone} · {t.isOnline ? 'Online' : 'Offline'}</p>
          <div className="flex gap-2">
            {t.approvalStatus !== 'approved' && <button onClick={() => onAction(t._id, 'approve')} className="text-xs font-semibold bg-okgreen text-white px-4 py-1.5 rounded-full">Approve</button>}
            {t.approvalStatus !== 'rejected' && <button onClick={() => onAction(t._id, 'reject')} className="text-xs font-semibold border border-signal text-signal px-4 py-1.5 rounded-full">Reject</button>}
          </div>
        </div>
      )}
    </div>
  )
}

export default function AdminDashboard() {
  const { admin, logout } = useAdminAuth()
  const navigate = useNavigate()
  const [tab, setTab] = useState('overview')
  const [data, setData] = useState(null)
  const [technicians, setTechnicians] = useState([])
  const [customers, setCustomers] = useState([])
  const [bookings, setBookings] = useState([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [techFilter, setTechFilter] = useState('all')

  function loadAll() {
    Promise.all([adminApi.get('/admin/dashboard'), adminApi.get('/admin/technicians'), adminApi.get('/admin/customers'), adminApi.get('/admin/bookings')])
      .then(([d, t, c, b]) => { setData(d.data); setTechnicians(t.data.technicians); setCustomers(c.data.customers); setBookings(b.data.bookings) })
      .finally(() => setLoading(false))
  }
  useEffect(() => { if (!admin) { navigate('/admin/login'); return } loadAll() }, [admin])
  useEffect(() => { setQ('') }, [tab])

  async function techAction(id, action) { await adminApi.patch(`/admin/technicians/${id}/${action}`); loadAll() }

  const ql = q.trim().toLowerCase()
  const techList = useMemo(() => technicians.filter((t) =>
    (techFilter === 'all' || t.approvalStatus === techFilter) &&
    (!ql || t.name.toLowerCase().includes(ql) || t.phone.includes(ql) || (t.categories || []).join(' ').includes(ql))), [technicians, techFilter, ql])
  const custList = useMemo(() => customers.filter((c) => !ql || (c.name || '').toLowerCase().includes(ql) || c.phone.includes(ql)), [customers, ql])
  const bookList = useMemo(() => bookings.filter((b) =>
    !ql || b.category.includes(ql) || (b.customer?.name || '').toLowerCase().includes(ql) || (b.technician?.name || '').toLowerCase().includes(ql) || b.status.includes(ql)), [bookings, ql])

  if (!admin) return null
  if (loading) return <div className="max-w-6xl mx-auto p-6"><div className="h-40 rounded-2xl skeleton" /></div>

  const { stats, statusBreakdown, categoryBreakdown } = data
  const statusData = statusBreakdown.filter((s) => s.count > 0).map((s) => ({ ...s, label: pretty(s.status) }))
  const catData = categoryBreakdown.slice(0, 8).map((c) => ({ name: pretty(c.category), value: c.count }))

  return (
    <div className="min-h-screen bg-mist pb-12">
      <div className="bg-gradient-to-br from-ink to-ink-700 text-white pt-7 pb-14 relative overflow-hidden">
        <div className="absolute -right-10 -top-10 w-48 h-48 rounded-full bg-signal/10 blur-3xl" />
        <div className="max-w-6xl mx-auto px-5 relative flex items-center justify-between">
          <div>
            <p className="text-[11px] text-ink-100 uppercase tracking-wide flex items-center gap-1"><ShieldCheck size={12} /> FixNow Admin</p>
            <h1 className="font-display text-2xl font-bold mt-1">Operations dashboard</h1>
          </div>
          <button onClick={() => { logout(); navigate('/admin/login') }} className="flex items-center gap-2 text-sm bg-white/10 px-3.5 py-2 rounded-full"><LogOut size={14} /> Log out</button>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-5 -mt-8 relative">
        <div className="bg-white rounded-2xl shadow-card p-1.5 flex gap-1 overflow-x-auto">
          {TABS.map((t) => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex-1 min-w-[110px] text-sm font-semibold py-2.5 rounded-xl flex items-center justify-center gap-1.5 ${tab === t.id ? 'bg-ink text-white' : 'text-ink-400'}`}>
              <t.icon size={14} /> {t.label}
              {t.id === 'technicians' && stats.pendingTechnicians > 0 && <span className="text-[10px] bg-signal text-white rounded-full px-1.5">{stats.pendingTechnicians}</span>}
            </button>
          ))}
        </div>

        {/* ---------------- OVERVIEW ---------------- */}
        {tab === 'overview' && (
          <div className="mt-5 space-y-5">
            {stats.pendingTechnicians > 0 && (
              <button onClick={() => { setTab('technicians'); setTechFilter('pending') }} className="w-full bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-center gap-3 text-left">
                <AlertCircle size={18} className="text-amber-700" />
                <p className="text-sm text-amber-900"><strong>{stats.pendingTechnicians}</strong> technician application{stats.pendingTechnicians > 1 ? 's' : ''} waiting for your approval →</p>
              </button>
            )}

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <Stat icon={IndianRupee} label="Platform revenue" value={money(stats.totalRevenue)} tone="bg-okgreen-50 text-okgreen" sub="15% commission on paid jobs" />
              <Stat icon={Wallet} label="Gross booking value" value={money(stats.grossBookingValue)} tone="bg-trust-50 text-trust" sub="Paid by customers" />
              <Stat icon={Clock} label="Awaiting payment" value={money(stats.pendingPayments)} tone="bg-amber-50 text-amber-600" sub="Completed, not yet paid" />
              <Stat icon={ClipboardList} label="Total bookings" value={stats.bookingCount} tone="bg-ink-100 text-ink" />
              <Stat icon={Users} label="Customers" value={stats.customerCount} tone="bg-trust-50 text-trust" />
              <Stat icon={Wrench} label="Technicians" value={stats.technicianCount} tone="bg-signal-50 text-signal" />
              <Stat icon={CheckCircle2} label="Completed" value={stats.completedCount} tone="bg-okgreen-50 text-okgreen" sub={`${stats.paidCount} paid`} />
              <Stat icon={XCircle} label="Cancelled" value={stats.cancelledCount} tone="bg-mist text-ink-400" />
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div className="bg-white rounded-2xl shadow-card p-4">
                <p className="font-display font-semibold text-sm text-ink mb-3">Bookings by status</p>
                <ResponsiveContainer width="100%" height={230}>
                  <BarChart data={statusData} margin={{ left: -20 }}>
                    <XAxis dataKey="label" tick={{ fontSize: 9, fill: '#3E4E77' }} axisLine={false} tickLine={false} interval={0} angle={-25} textAnchor="end" height={55} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: '#3E4E77' }} axisLine={false} tickLine={false} />
                    <Tooltip />
                    <Bar dataKey="count" fill="#2F6FED" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="bg-white rounded-2xl shadow-card p-4">
                <p className="font-display font-semibold text-sm text-ink mb-3">Most requested services</p>
                <div className="flex items-center gap-2">
                  <ResponsiveContainer width="50%" height={230}>
                    <PieChart>
                      <Pie data={catData} dataKey="value" nameKey="name" innerRadius={45} outerRadius={80} paddingAngle={2}>
                        {catData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="flex-1 space-y-1.5">
                    {catData.map((c, i) => (
                      <p key={c.name} className="text-xs text-ink flex items-center gap-2 capitalize">
                        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                        <span className="flex-1 truncate">{c.name}</span><strong>{c.value}</strong>
                      </p>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-card">
              <p className="font-display font-semibold text-sm text-ink p-4 pb-2">Recent bookings</p>
              <div className="divide-y divide-ink-100">
                {bookings.slice(0, 6).map((b) => (
                  <div key={b._id} className="px-4 py-3 flex items-center gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-ink capitalize truncate">{pretty(b.category)} <span className="text-ink-400 font-normal">· {b.customer?.name || 'Customer'}</span></p>
                      <p className="text-[11px] text-ink-400">{b.technician?.name || 'Unassigned'} · {new Date(b.createdAt).toLocaleDateString()}</p>
                    </div>
                    <span className="text-sm font-semibold text-ink">{b.fare?.total ? money(b.fare.total) : '—'}</span>
                    <span className={`text-[10px] font-semibold px-2.5 py-1 rounded-full capitalize ${STATUS_TONE[b.status]}`}>{pretty(b.status)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ---------------- TECHNICIANS ---------------- */}
        {tab === 'technicians' && (
          <div className="mt-5">
            <div className="flex flex-col md:flex-row gap-3">
              <SearchBox value={q} onChange={setQ} placeholder="Search by name, phone or service…" />
              <div className="flex gap-1.5">
                {['all', 'pending', 'approved', 'rejected'].map((f) => (
                  <button key={f} onClick={() => setTechFilter(f)} className={`text-xs font-semibold px-3.5 py-2 rounded-xl capitalize ${techFilter === f ? 'bg-ink text-white' : 'bg-white text-ink-400 shadow-card'}`}>{f}</button>
                ))}
              </div>
            </div>
            <p className="text-xs text-ink-400 mt-3 mb-2">{techList.length} technician{techList.length === 1 ? '' : 's'} — tap a row for their portfolio</p>
            <div className="bg-white rounded-2xl shadow-card divide-y divide-ink-100">
              {techList.length === 0 && <p className="text-sm text-ink-400 p-6 text-center">No technicians match.</p>}
              {techList.map((t) => <TechnicianRow key={t._id} t={t} onAction={techAction} />)}
            </div>
          </div>
        )}

        {/* ---------------- CUSTOMERS ---------------- */}
        {tab === 'customers' && (
          <div className="mt-5">
            <SearchBox value={q} onChange={setQ} placeholder="Search customers by name or phone…" />
            <p className="text-xs text-ink-400 mt-3 mb-2">{custList.length} customer{custList.length === 1 ? '' : 's'}</p>
            <div className="bg-white rounded-2xl shadow-card divide-y divide-ink-100">
              {custList.map((c) => (
                <div key={c._id} className="px-4 py-3 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-signal to-signal-700 text-white text-xs font-semibold flex items-center justify-center">{(c.name || '?').slice(0, 2).toUpperCase()}</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-ink truncate">{c.name}</p>
                    <p className="text-xs text-ink-400">{c.phone} · joined {new Date(c.createdAt).toLocaleDateString()}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-ink">{money(c.spent)}</p>
                    <p className="text-[11px] text-ink-400">{c.bookings} booking{c.bookings === 1 ? '' : 's'}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ---------------- BOOKINGS ---------------- */}
        {tab === 'bookings' && (
          <div className="mt-5">
            <SearchBox value={q} onChange={setQ} placeholder="Search by service, customer, technician or status…" />
            <p className="text-xs text-ink-400 mt-3 mb-2">{bookList.length} booking{bookList.length === 1 ? '' : 's'} (latest 150)</p>
            <div className="bg-white rounded-2xl shadow-card divide-y divide-ink-100">
              {bookList.map((b) => (
                <div key={b._id} className="px-4 py-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-ink capitalize">{pretty(b.category)}</p>
                    <div className="flex items-center gap-1.5">
                      {b.status === 'completed' && <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${b.paymentStatus === 'paid' ? 'bg-okgreen-50 text-okgreen' : 'bg-amber-50 text-amber-700'}`}>{b.paymentStatus === 'paid' ? 'paid' : 'unpaid'}</span>}
                      <span className={`text-[10px] font-semibold px-2.5 py-1 rounded-full capitalize ${STATUS_TONE[b.status]}`}>{pretty(b.status)}</span>
                    </div>
                  </div>
                  <p className="text-xs text-ink-400 mt-0.5">{b.customer?.name || '—'} → {b.technician?.name || 'Unassigned'} · {new Date(b.createdAt).toLocaleDateString()}</p>
                  {b.fare?.total > 0 && (
                    <p className="text-[11px] text-ink-400 mt-1">Customer paid {money(b.fare.total)} · technician {money(b.fare.technicianPayout)} · <span className="text-okgreen font-medium">platform {money(b.fare.platformCommission)}</span></p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
