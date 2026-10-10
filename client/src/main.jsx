import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { HeartHandshake, LayoutDashboard, Users, Building2, Wallet, Gift, ClipboardList, BarChart3, Bell, ShieldCheck, ScrollText, LogOut, Menu, Plus, Search, Pencil, Trash2, Check, ArrowRight, HandHeart, MapPin, Sparkles, Clock, Download, X, Eye, ArrowUpRight } from 'lucide-react';
import './style.css';
const API = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
const fmt = n => '₹' + Number(n || 0).toLocaleString('en-IN');
const date = d => d ? new Date(d).toLocaleDateString('en-IN') : '—';
const id = x => typeof x === 'object' ? x?._id : x;
const title = x => typeof x === 'object' ? (x?.name || x?.title || '—') : x || '—';
const categories = ['toys', 'beds', 'books', 'food', 'clothes', 'wheelchairs', 'blankets', 'school supplies', 'other'];
function App() {
  const [token, setToken] = useState(localStorage.getItem('gn-token') || '');
  const [user, setUser] = useState(JSON.parse(localStorage.getItem('gn-user') || 'null'));
  const [page, setPage] = useState('dashboard'), [data, setData] = useState({}), [stats, setStats] = useState({}), [modal, setModal] = useState(null), [error, setError] = useState(''), [notice, setNotice] = useState(''), [search, setSearch] = useState(''), [login, setLogin] = useState({ email: 'admin@givenest.demo', password: 'Demo@12345' }), [register, setRegister] = useState(false), [busy, setBusy] = useState(false), [menu, setMenu] = useState(false), [match, setMatch] = useState({ category: 'toys', city: 'Hyderabad' }), [matches, setMatches] = useState([]);
  const role = user?.role || 'donor';
  const call = async (path, options = {}) => {
    const res = await fetch(API + path, { ...options, headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token, ...options.headers } }); const out = await res.json().catch(() => ({})); if (res.status === 401 && !path.startsWith('/auth/')) {
      logout();
      throw Error('Session expired. Please sign in again.');
    } if (!res.ok)
      throw Error(out.error || 'Request failed'); return out;
  };
  const refresh = async () => {
    if (!token)
      return; try {
        const me = await call('/me');
        const fresh = { id: me._id, name: me.name, email: me.email, role: me.role, ngo: me.ngo };
        if (JSON.stringify(fresh) !== JSON.stringify(user)) {
          localStorage.setItem('gn-user', JSON.stringify(fresh));
          setUser(fresh);
        }
        const keys = ['ngos', 'donors', 'campaigns', 'wishlists', 'donations', 'notifications', ...(me.role === 'admin' ? ['users', 'audit'] : [])];
        const all = await Promise.all([...keys.map(k => call('/' + k)), call('/stats')]);
        setData(Object.fromEntries(keys.map((k, i) => [k, all[i]])));
        setStats(all.at(-1));
        setError('');
      }
    catch (e) {
      setError(e.message);
    }
  };
  useEffect(() => { refresh(); }, [token]);
  const message = (txt) => { setNotice(txt); setError(''); setTimeout(() => setNotice(''), 4500); };
  const signIn = async (e) => {
    e.preventDefault(); setBusy(true); try {
      const out = register ? await call('/auth/register', { method: 'POST', body: JSON.stringify(login) }) : await call('/auth/login', { method: 'POST', body: JSON.stringify(login) });
      if (register) {
        setRegister(false);
        message('Account created. Sign in to continue.');
      }
      else {
        localStorage.setItem('gn-token', out.token);
        localStorage.setItem('gn-user', JSON.stringify(out.user));
        setToken(out.token);
        setUser(out.user);
        setPage('dashboard');
      }
      setError('');
    }
      catch (e) {
        setError(e.message);
      }
      finally {
        setBusy(false);
      }
  };
  const logout = () => { localStorage.removeItem('gn-token'); localStorage.removeItem('gn-user'); setToken(''); setUser(null); setData({}); };
  const changePage = p => { setPage(p); setSearch(''); setError(''); setMenu(false); };
  const schema = { donors: [['name', 'text'], ['email', 'email'], ['phone', 'text']], ngos: [['name', 'text'], ['type', 'text'], ['city', 'text'], ['description', 'text'], ['categories', 'csv'], ['needs', 'csv']], campaigns: [['title', 'text'], ['purpose', 'text'], ['goal', 'number'], ['ngo', 'ngo'], ['status', 'status']], wishlists: [['ngo', 'ngo'], ['item', 'text'], ['category', 'category'], ['quantity', 'number'], ['urgency', 'urgency']], donations: [['donor', 'donor'], ['ngo', 'ngo'], ['kind', 'kind'], ['campaign', 'campaign'], ['amount', 'number'], ['item', 'text'], ['category', 'category'], ['quantity', 'number'], ['purpose', 'text']], users: [['name', 'text'], ['email', 'email'], ['password', 'password'], ['role', 'role'], ['ngo', 'ngo']] };
  const open = (type, record = null) => {
    const values = {}; (schema[type] || []).forEach(([k, kind]) => { const v = record?.[k]; values[k] = kind === 'csv' ? (v || []).join(', ') : kind === 'number' ? (v ?? '') : kind === 'password' ? '' : id(v) || ''; }); if (!record) {
      if (type === 'donations') {
        values.kind = 'item';
        values.quantity = 1;
        values.donor = role === 'donor' ? (data.donors || [])[0]?._id || '' : '';
      }
      if (type === 'campaigns')
        values.status = 'active';
      if (type === 'wishlists')
        values.urgency = 'normal';
      if (type === 'users')
        values.role = 'donor';
      if (role === 'ngo' && ['campaigns', 'wishlists'].includes(type))
        values.ngo = user.ngo;
    } setModal({ type, record, values });
  };
  const save = async (e) => {
    e.preventDefault(); setBusy(true); try {
      const { type, record, values } = modal;
      const body = { ...values };
      for (const [k, kind] of schema[type]) {
        if (kind === 'csv')
          body[k] = String(body[k] || '').split(',').map(x => x.trim().toLowerCase()).filter(Boolean);
        if (kind === 'number' && body[k] !== '')
          body[k] = Number(body[k]);
        if (body[k] === '')
          delete body[k];
      }
      if (type === 'donations') {
        if (body.kind === 'money') {
          delete body.item;
          delete body.category;
          delete body.quantity;
        }
        else
          delete body.amount;
      }
      if (type === 'users' && record) {
        await call('/users/' + record._id, { method: 'PATCH', body: JSON.stringify(body) });
      }
      else
        await call('/' + type + (record ? '/' + record._id : ''), { method: record ? 'PUT' : 'POST', body: JSON.stringify(body) });
      setModal(null);
      message('Saved successfully');
      await refresh();
    }
      catch (e) {
        setError(e.message);
      }
      finally {
        setBusy(false);
      }
  };
  const remove = async (type, record) => {
    if (!window.confirm('Delete this record?'))
      return; try {
        await call('/' + type + '/' + record._id, { method: 'DELETE' });
        message('Record deleted');
        await refresh();
      }
    catch (e) {
      setError(e.message);
    }
  };
  const updateStatus = async (d, status) => {
    try {
      await call('/donations/' + d._id + '/status', { method: 'PATCH', body: JSON.stringify({ status }) });
      message('Donation status updated');
      await refresh();
    }
    catch (e) {
      setError(e.message);
    }
  };
  const approve = async (n, status) => {
    try {
      await call('/ngos/' + n._id + '/approval', { method: 'PATCH', body: JSON.stringify({ status }) });
      message('NGO ' + status);
      await refresh();
    }
    catch (e) {
      setError(e.message);
    }
  };
  const runMatch = async () => {
    try {
      setMatches(await call('/match?' + new URLSearchParams(match)));
      setError('');
    }
    catch (e) {
      setError(e.message);
    }
  };
  const nav = [['dashboard', 'Overview', LayoutDashboard], ['ngos', 'NGO Directory', Building2], ['campaigns', 'Campaigns', HeartHandshake], ['wishlists', 'Urgent Needs', ClipboardList], ['donations', 'Donations', Gift], ['match', 'SmartMatch', Sparkles], ...(role === 'admin' ? [['donors', 'Donors', Users], ['users', 'Users & Roles', ShieldCheck], ['audit', 'Activity Logs', ScrollText]] : []), ['notifications', 'Notifications', Bell]];
  const canAdd = type => role === 'admin' || role === 'ngo' && (type !== 'ngos' || !user.ngo) && ['ngos', 'campaigns', 'wishlists'].includes(type) || role === 'donor' && type === 'donations';
  const canEdit = (type, r) => role === 'admin' || role === 'ngo' && ['ngos', 'campaigns', 'wishlists'].includes(type) && String(type === 'ngos' ? r._id : id(r.ngo)) === String(user.ngo);
  const cols = { ngos: [['name', 'NGO'], ['type', 'Type'], ['city', 'City'], ['categories', 'Categories'], ['status', 'Approval']], donors: [['name', 'Name'], ['email', 'Email'], ['phone', 'Phone']], campaigns: [['title', 'Campaign'], ['ngo', 'NGO'], ['goal', 'Goal'], ['status', 'Status']], wishlists: [['item', 'Item needed'], ['ngo', 'NGO'], ['category', 'Category'], ['quantity', 'Target'], ['urgency', 'Priority']], donations: [['donor', 'Donor'], ['ngo', 'NGO'], ['kind', 'Type'], ['value', 'Contribution'], ['status', 'Status'], ['date', 'Date']], users: [['name', 'Name'], ['email', 'Email'], ['role', 'Role'], ['ngo', 'NGO']], audit: [['actor', 'Actor'], ['action', 'Action'], ['entity', 'Entity'], ['createdAt', 'Time']] };
  const display = (r, k) => {
    if (k === 'value')
      return r.kind === 'money' ? fmt(r.amount) : `${r.quantity} × ${r.item || r.category}`; if (k === 'goal')
      return fmt(r.goal); if (k === 'quantity' && r.fulfilled !== undefined)
      return `${r.fulfilled} / ${r.quantity}`; if (k === 'categories')
      return (r.categories || []).join(', '); if (k === 'date' || k === 'createdAt')
      return date(r[k]); if (['ngo', 'donor', 'campaign', 'actor'].includes(k))
      return title(r[k]); if (['status', 'urgency', 'role'].includes(k))
      return <span className={'pill ' + String(r[k])}>{r[k]}</span>; return String(r[k] ?? '—');
  };
  const receipt = d => {
    const win = window.open('', '_blank'); if (!win) {
      setError('Allow popups to print receipt');
      return;
    } const safeText = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); win.document.write(`<html><head><title>GiveNest Donation Acknowledgement</title><style>body{font-family:Arial;padding:55px;max-width:680px;margin:auto;color:#173d34}h1{font-size:36px}p{line-height:1.8}hr{border:0;border-top:1px solid #ccc}</style></head><body><h1>GiveNest.</h1><h2>Donation Acknowledgement</h2><hr><p><b>Donation ID:</b> ${safeText(d._id)}<br><b>Donor:</b> ${safeText(title(d.donor))}<br><b>NGO:</b> ${safeText(title(d.ngo))}<br><b>Date:</b> ${safeText(date(d.date))}<br><b>Contribution:</b> ${safeText(d.kind === 'money' ? fmt(d.amount) : `${d.quantity} × ${d.item}`)}<br><b>Status:</b> ${safeText(d.status)}</p><p>Thank you for supporting a meaningful cause.</p><small>This acknowledgement confirms a recorded contribution and is not a tax certificate or payment receipt.</small><script>window.print()<\\/script></body></html>`); win.document.close();
  };
  if (!token)
    return <div className="auth-layout"><div className="auth-card"><div className="brand"><span className="logo"><HandHeart /></span> givenest<span className="accent">.</span></div><div className="eyebrow">WHERE GENEROSITY FINDS A HOME</div><h1>Every gift has a <em>destination.</em></h1><p className="muted">A smarter way to connect people, purpose and impact.</p><form onSubmit={signIn}><label>Email address<input type="email" required value={login.email} onChange={e => setLogin({ ...login, email: e.target.value })} /></label>{register && <label>Full name<input required value={login.name || ''} onChange={e => setLogin({ ...login, name: e.target.value })} /></label>}<label>Password<input type="password" minLength={register ? 8 : undefined} required value={login.password} onChange={e => setLogin({ ...login, password: e.target.value })} /></label>{error && <div className="error">{error}</div>}<button className="btn primary full" disabled={busy}>{busy ? 'Please wait...' : register ? 'Create donor account' : 'Sign in'} <ArrowRight size={18} /></button></form><button className="link" onClick={() => { setRegister(!register); setError(''); }}>{register ? 'Already have an account? Sign in' : 'New donor? Create an account'}</button><div className="demo"><b>Demo accounts · Password: Demo@12345</b><button onClick={() => setLogin({ email: 'admin@givenest.demo', password: 'Demo@12345' })}>Admin</button><button onClick={() => setLogin({ email: 'ngo@givenest.demo', password: 'Demo@12345' })}>NGO</button><button onClick={() => setLogin({ email: 'donor@givenest.demo', password: 'Demo@12345' })}>Donor</button></div></div><div className="auth-visual"><div className="visual-glow"></div><div className="visual-label">THE KINDNESS NETWORK</div><h2>Give with intention.<br /><i>Change with impact.</i></h2><p>From toys for children to comfort for elders — help the right resources reach the right people.</p><div className="visual-foot"><span>01 / Connect</span><span>02 / Contribute</span><span>03 / Transform</span></div></div></div>;
  const filtered = (data[page] || []).filter(r => JSON.stringify(r).toLowerCase().includes(search.toLowerCase()));
  return <div className="shell"><aside className={'sidebar ' + (menu ? 'shown' : '')}><div className="brand"><span className="logo"><HandHeart size={22} /></span> givenest<span className="accent">.</span></div><div className="nav-label">YOUR WORKSPACE</div><nav>{nav.map(([key, name, Icon]) => <button key={key} onClick={() => changePage(key)} className={'nav-item ' + (page === key ? 'selected' : '')}><Icon size={18} />{name}{key === 'notifications' && (data.notifications || []).filter(n => !n.read).length > 0 && <span className="count-dot" />}</button>)}</nav><div className="side-bottom"><div className="side-quote"><HeartHandshake size={24} /><b>Small acts. Big impact.</b><p>Help generosity find its way.</p></div><button className="nav-item" onClick={logout}><LogOut size={18} /> Sign out</button></div></aside><main className="main"><header className="topbar"><button className="mobile-toggle" onClick={() => setMenu(!menu)}><Menu /></button><div><div className="eyebrow">GIVENEST / {page.toUpperCase()}</div><h2>{nav.find(n => n[0] === page)?.[1] || 'Overview'}</h2></div><div className="profile"><div className="avatar">{user?.name?.slice(0, 1)}</div><div><b>{user?.name}</b><small>{role === 'ngo' ? 'NGO Manager' : role === 'admin' ? 'Administrator' : 'Donor'}</small></div></div></header><div className="content">{error && <div className="error dismiss">{error}<button onClick={() => setError('')}><X size={16} /></button></div>}{notice && <div className="success dismiss">{notice}<button onClick={() => setNotice('')}><X size={16} /></button></div>}

    {page === 'dashboard' && <><section className="hero"><div><div className="eyebrow">WELCOME TO YOUR IMPACT HUB</div><h1>Good things grow<br />when we <em>give together.</em></h1><p>Manage meaningful contributions and turn generosity into lasting change.</p><button className="btn light" onClick={() => changePage(role === 'donor' ? 'match' : 'donations')}>{role === 'donor' ? 'Find an NGO' : 'Manage donations'} <ArrowUpRight size={17} /></button></div><div className="hero-art"><HandHeart size={124} strokeWidth={1} /></div></section><div className="metrics">{[['Total received', fmt(stats.total), Wallet], ['Donation records', stats.donations || 0, Gift], ['NGO partners', stats.ngos || 0, Building2], ['Completed donations', stats.received || 0, Check]].map(([label, value, Icon]) => <div className="metric" key={label}><div className="metric-label">{label}<Icon size={19} /></div><strong>{value}</strong><small>Live from MongoDB</small></div>)}</div><div className="two-cols"><section className="panel"><div className="panel-title"><div><h3>Fundraising progress</h3><p>Campaigns making a difference</p></div><button className="link" onClick={() => changePage('campaigns')}>View all →</button></div>{!stats.progress?.length && <div className="empty">No campaigns available.</div>}{stats.progress?.slice(0, 5).map(c => <div className="progress-item" key={c._id}><div><b>{c.title}</b><span>{Math.min(100, Math.round(c.collected / c.goal * 100))}%</span></div><div className="track"><div style={{ width: Math.min(100, c.collected / c.goal * 100) + '%' }} /></div><small>{fmt(c.collected)} of {fmt(c.goal)}</small></div>)}</section><section className="panel"><div className="panel-title"><div><h3>Recent activity</h3><p>Latest donation records</p></div></div>{!stats.recent?.length && <div className="empty">No donations yet.</div>}{stats.recent?.map(d => <div className="recent" key={d._id}><div className="recent-icon"><Gift size={18} /></div><div><b>{title(d.donor)}</b><small>{title(d.ngo)} · {d.status}</small></div><strong>{d.kind === 'money' ? fmt(d.amount) : `${d.quantity} items`}</strong></div>)}</section></div></>}

    {page === 'match' && <><div className="section-intro"><div className="eyebrow"><Sparkles size={15} /> SMARTMATCH ENGINE</div><h1>Find the perfect home<br />for your generosity.</h1><p>Our transparent matching system considers accepted categories, active needs, city and NGO approval.</p></div><section className="panel match-panel"><div className="match-form"><label>Donation category<select value={match.category} onChange={e => setMatch({ ...match, category: e.target.value })}>{categories.map(x => <option key={x}>{x}</option>)}</select></label><label>Your city<input value={match.city} onChange={e => setMatch({ ...match, city: e.target.value })} placeholder="Hyderabad" /></label><button className="btn primary" onClick={runMatch}><Sparkles size={17} /> Find matches</button></div></section><div className="card-grid">{matches.map(n => <div className="ngo-card" key={n._id}><div className="card-head"><span className="card-icon"><Building2 /></span><span className="score">{n.score}% match</span></div><h3>{n.name}</h3><p><MapPin size={14} /> {n.city} · {n.type}</p><ul>{n.reasons.map((r, i) => <li key={i}><Check size={14} />{r}</li>)}</ul><button className="btn outline full" onClick={() => { open('donations'); setModal(m => ({ ...m, values: { ...m.values, ngo: n._id, category: match.category } })); }}>Offer donation <ArrowRight size={16} /></button></div>)}</div>{matches.length === 0 && <div className="empty">Choose a category and click Find matches to discover suitable NGOs.</div>}</>}

    {page === 'notifications' && <section className="panel"><div className="panel-title"><h3>Your notifications</h3></div>{!(data.notifications || []).length && <div className="empty">You're all caught up.</div>}{(data.notifications || []).map(n => <div className={'notification ' + (!n.read ? 'unread' : '')} key={n._id}><Bell size={19} /><div><b>{n.message}</b><small>{date(n.createdAt)}</small></div>{!n.read && <button className="btn outline" onClick={async () => { await call('/notifications/' + n._id + '/read', { method: 'PATCH' }); refresh(); }}>Mark read</button>}</div>)}</section>}

    {cols[page] && <><div className="list-intro"><div><h3>{page === 'wishlists' ? 'Needs that matter most' : page === 'ngos' ? 'Organizations creating change' : page === 'donations' ? 'Every contribution tells a story' : page === 'users' ? 'People and permissions' : page === 'audit' ? 'Platform activity' : 'Manage ' + page}</h3><p>Browse, manage and keep your records organized.</p></div>{canAdd(page) && <button className="btn primary" onClick={() => open(page)}><Plus size={18} /> Add {page === 'wishlists' ? 'need' : page.slice(0, -1)}</button>}</div><section className="panel table-panel"><div className="table-toolbar"><div className="search"><Search size={18} /><input placeholder={'Search ' + page + '...'} value={search} onChange={e => setSearch(e.target.value)} /></div><span className="records">{filtered.length} records</span></div><div className="table-scroll"><table><thead><tr>{cols[page].map(([k, label]) => <th key={k}>{label}</th>)}{page !== 'audit' && <th>Actions</th>}</tr></thead><tbody>{filtered.map(r => <tr key={r._id}>{cols[page].map(([k]) => <td key={k}>{display(r, k)}</td>)}{page !== 'audit' && <td><div className="actions">{canEdit(page, r) && <button title="Edit" onClick={() => open(page, r)}><Pencil size={16} /></button>}{canEdit(page, r) && <button title="Delete" onClick={() => remove(page, r)}><Trash2 size={16} /></button>}{page === 'ngos' && role === 'admin' && r.status !== 'approved' && <><button title="Approve" onClick={() => approve(r, 'approved')}><Check size={17} /></button>{r.status === 'pending' && <button title="Reject" onClick={() => approve(r, 'rejected')}><X size={17} /></button>}</>}{page === 'donations' && <><button title="View timeline" onClick={() => setModal({ type: 'timeline', record: r })}><Clock size={17} /></button>{r.status === 'received' && <button title="Print acknowledgement" onClick={() => receipt(r)}><Download size={17} /></button>}{(role === 'admin' || role === 'ngo' && String(id(r.ngo)) === String(user.ngo)) && ['offered', 'accepted', 'scheduled'].includes(r.status) && <select className="mini-select" value="" onChange={e => {
      if (e.target.value)
        updateStatus(r, e.target.value);
    }}><option value="">Update</option>{({ offered: ['accepted', 'declined'], accepted: ['scheduled', 'received', 'declined'], scheduled: ['received', 'declined'] }[r.status] || []).map(s => <option key={s}>{s}</option>)}</select>}</>}</div></td>}</tr>)}</tbody></table>{!filtered.length && <div className="empty">No records found.</div>}</div></section></>}

  </div></main>{modal && <div className="overlay" onMouseDown={e => {
    if (e.target === e.currentTarget)
      setModal(null);
  }}><div className="dialog"><div className="dialog-head"><div><div className="eyebrow">GIVENEST</div><h3>{modal.type === 'timeline' ? 'Donation journey' : (modal.record ? 'Edit ' : 'Create ') + modal.type.slice(0, -1)}</h3></div><button className="icon-button" onClick={() => { setModal(null); setError(''); }}><X /></button></div>{modal.type === 'timeline' ? <div className="timeline">{(modal.record.history || []).map((h, i) => <div className="timeline-step" key={i}><span><Check size={15} /></span><div><b>{h.status}</b><p>{date(h.at)} · {h.by}</p></div></div>)}</div> : <form onSubmit={save} className="dialog-form">{schema[modal.type]?.filter(([k]) => !(modal.type === 'users' && modal.record && ['email'].includes(k)) && !(modal.type === 'donations' && role === 'donor' && k === 'donor') && !(role === 'ngo' && ['campaigns', 'wishlists'].includes(modal.type) && k === 'ngo') && !(modal.type === 'donations' && modal.values.kind === 'item' && k === 'amount') && !(modal.type === 'donations' && modal.values.kind === 'money' && ['item', 'category', 'quantity'].includes(k))).map(([k, kind]) => <label key={k}>{k[0].toUpperCase() + k.slice(1)}{['ngo', 'donor', 'campaign', 'category', 'kind', 'status', 'urgency', 'role'].includes(kind) ? <select value={modal.values[k] || ''} onChange={e => setModal({ ...modal, values: { ...modal.values, [k]: e.target.value, ...(k === 'ngo' && modal.type === 'donations' ? { campaign: '' } : {}) } })} required={!['campaign', 'status'].includes(kind)}><option value="">Select {k}</option>{(kind === 'ngo' ? (data.ngos || []).filter(n => n.status === 'approved' || role === 'admin') : kind === 'donor' ? data.donors || [] : kind === 'campaign' ? (data.campaigns || []).filter(c => !modal.values.ngo || String(id(c.ngo)) === String(modal.values.ngo)) : kind === 'category' ? categories : kind === 'kind' ? ['money', 'item'] : kind === 'status' ? ['active', 'paused', 'completed'] : kind === 'urgency' ? ['normal', 'urgent'] : ['admin', 'ngo', 'donor']).map(x => <option key={typeof x === 'string' ? x : x._id} value={typeof x === 'string' ? x : x._id}>{typeof x === 'string' ? x : title(x)}</option>)}</select> : <input type={kind === 'number' ? 'number' : kind === 'email' ? 'email' : kind === 'password' ? 'password' : 'text'} min={kind === 'number' ? 0 : undefined} required={kind !== 'csv' && kind !== 'password' && !['phone', 'description', 'needs', 'purpose'].includes(k)} value={modal.values[k] ?? ''} onChange={e => setModal({ ...modal, values: { ...modal.values, [k]: e.target.value } })} placeholder={kind === 'csv' ? 'Comma-separated values' : k === 'password' && modal.record ? 'Leave blank to keep current password' : ''} />}</label>)}<div className="dialog-actions"><button type="button" className="btn outline" onClick={() => setModal(null)}>Cancel</button><button className="btn primary" disabled={busy}>{busy ? 'Saving...' : 'Save changes'}</button></div></form>}</div></div>}</div>;
}
createRoot(document.getElementById('root')).render(<App />);
