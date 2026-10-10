require('dotenv').config();

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const app = express();

// --- CORS & Middleware Configuration ---
const origins = (process.env.CLIENT_ORIGIN || 'http://localhost:5173,http://127.0.0.1:5173')
  .split(',')
  .map(x => x.trim());

app.use(cors({
  origin: (o, cb) => cb(null, !o || origins.includes(o))
}));
app.use(express.json({ limit: '1mb' }));

// --- Schema Field Helpers ---
const id = { type: mongoose.Schema.Types.ObjectId };
const opts = { timestamps: true };

// --- Database Models ---
const User = mongoose.model('User', new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['admin', 'ngo', 'donor'], default: 'donor' },
  ngo: { ...id, ref: 'NGO' }
}, opts));

const NGO = mongoose.model('NGO', new mongoose.Schema({
  name: { type: String, required: true },
  type: { type: String, required: true },
  city: { type: String, required: true },
  description: String,
  categories: [String],
  needs: [String],
  status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
  manager: { ...id, ref: 'User' }
}, opts));

const Donor = mongoose.model('Donor', new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true },
  phone: String,
  user: { ...id, ref: 'User' }
}, opts));

const Campaign = mongoose.model('Campaign', new mongoose.Schema({
  title: { type: String, required: true },
  purpose: { type: String, required: true },
  goal: { type: Number, required: true, min: 1 },
  ngo: { ...id, ref: 'NGO', required: true },
  status: { type: String, enum: ['active', 'paused', 'completed'], default: 'active' }
}, opts));

const Wishlist = mongoose.model('Wishlist', new mongoose.Schema({
  ngo: { ...id, ref: 'NGO', required: true },
  item: { type: String, required: true },
  category: { type: String, required: true },
  quantity: { type: Number, required: true, min: 1 },
  fulfilled: { type: Number, default: 0, min: 0 },
  urgency: { type: String, enum: ['normal', 'urgent'], default: 'normal' }
}, opts));

const Donation = mongoose.model('Donation', new mongoose.Schema({
  donor: { ...id, ref: 'Donor', required: true },
  ngo: { ...id, ref: 'NGO', required: true },
  campaign: { ...id, ref: 'Campaign' },
  kind: { type: String, enum: ['money', 'item'], required: true },
  amount: { type: Number, min: 0, default: 0 },
  item: String,
  category: String,
  quantity: { type: Number, min: 1, default: 1 },
  purpose: String,
  date: { type: Date, default: Date.now },
  status: { type: String, enum: ['offered', 'accepted', 'scheduled', 'received', 'declined'], default: 'offered' },
  history: [{
    status: String,
    at: { type: Date, default: Date.now },
    by: String
  }]
}, opts));

const Notification = mongoose.model('Notification', new mongoose.Schema({
  user: { ...id, ref: 'User', required: true },
  message: String,
  read: { type: Boolean, default: false }
}, opts));

const Audit = mongoose.model('Audit', new mongoose.Schema({
  actor: { ...id, ref: 'User' },
  action: String,
  entity: String,
  record: String
}, opts));

// --- Utility Functions & Middlewares ---
const safe = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

const auth = safe(async (req, res, next) => {
  try {
    const token = (req.headers.authorization || '').replace(/^Bearer /, '');
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id).select('-password');
    
    if (!user) return res.status(401).json({ error: 'Account unavailable' });
    req.user = user;
    next();
  } catch (e) {
    res.status(401).json({ error: 'Please sign in again' });
  }
});

const roles = (...rs) => (req, res, next) => 
  rs.includes(req.user.role) 
    ? next() 
    : res.status(403).json({ error: 'Insufficient permissions' });

const ownNGO = (req, ngo) => 
  req.user.role === 'admin' || (req.user.role === 'ngo' && String(req.user.ngo) === String(ngo));

const audit = async (req, action, entity, record) => 
  Audit.create({ actor: req.user._id, action, entity, record: String(record) });

const notify = async (user, message) => {
  if (user) await Notification.create({ user, message });
};

const fields = (obj, keys) => 
  Object.fromEntries(keys.filter(k => obj[k] !== undefined).map(k => [k, obj[k]]));

const validId = v => mongoose.isValidObjectId(v);

// --- General Routes ---
app.get('/api/health', (req, res) => res.json({
  ok: true,
  database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected'
}));

// --- Authentication Routes ---
app.post('/api/auth/register', safe(async (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password || password.length < 8) {
    return res.status(400).json({ error: 'Name, email and password (8+ characters) required' });
  }

  if (await User.exists({ email: String(email).toLowerCase() })) {
    return res.status(409).json({ error: 'Email already registered' });
  }

  const u = await User.create({
    name,
    email,
    password: await bcrypt.hash(password, 10),
    role: 'donor'
  });

  await Donor.create({ name, email, user: u._id });
  res.status(201).json({ message: 'Registered successfully' });
}));

app.post('/api/auth/login', safe(async (req, res) => {
  const u = await User.findOne({ email: String(req.body.email || '').toLowerCase() });
  
  if (!u || !(await bcrypt.compare(String(req.body.password || ''), u.password))) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  res.json({
    token: jwt.sign({ id: u.id }, process.env.JWT_SECRET, { expiresIn: '8h' }),
    user: { id: u.id, name: u.name, email: u.email, role: u.role, ngo: u.ngo }
  });
}));

app.get('/api/me', auth, (req, res) => res.json(req.user));

// --- NGO Routes ---
app.get('/api/ngos', auth, safe(async (req, res) => {
  const filter = req.user.role === 'admin'
    ? {}
    : req.user.role === 'ngo'
      ? { $or: [{ status: 'approved' }, { _id: req.user.ngo }] }
      : { status: 'approved' };

  res.json(await NGO.find(filter).sort({ createdAt: -1 }).lean());
}));

app.post('/api/ngos', auth, roles('admin', 'ngo'), safe(async (req, res) => {
  if (req.user.role === 'ngo' && req.user.ngo) {
    return res.status(409).json({ error: 'You already manage an NGO' });
  }

  const data = fields(req.body, ['name', 'type', 'city', 'description', 'categories', 'needs']);

  if (req.user.role === 'ngo') {
    data.manager = req.user._id;
    data.status = 'pending';
  } else {
    data.status = req.body.status === 'approved' ? 'approved' : 'pending';
    if (validId(req.body.manager)) data.manager = req.body.manager;
  }

  const doc = await NGO.create(data);

  if (req.user.role === 'ngo') {
    req.user.ngo = doc._id;
    await req.user.save();
  }

  await audit(req, 'create', 'ngo', doc.id);
  res.status(201).json(doc);
}));

app.put('/api/ngos/:id', auth, roles('admin', 'ngo'), safe(async (req, res) => {
  const doc = await NGO.findById(req.params.id);
  if (!doc) return res.status(404).json({ error: 'NGO not found' });
  if (!ownNGO(req, doc.id)) return res.status(403).json({ error: 'Not your NGO' });

  Object.assign(doc, fields(req.body, ['name', 'type', 'city', 'description', 'categories', 'needs']));

  if (req.user.role === 'admin' && ['pending', 'approved', 'rejected'].includes(req.body.status)) {
    doc.status = req.body.status;
  }

  await doc.save();
  await audit(req, 'update', 'ngo', doc.id);
  res.json(doc);
}));

app.patch('/api/ngos/:id/approval', auth, roles('admin'), safe(async (req, res) => {
  if (!['approved', 'rejected', 'pending'].includes(req.body.status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }

  const ngo = await NGO.findByIdAndUpdate(
    req.params.id,
    { status: req.body.status },
    { new: true, runValidators: true }
  );

  if (!ngo) return res.status(404).json({ error: 'Not found' });

  await audit(req, 'approval ' + ngo.status, 'ngo', ngo.id);
  await notify(ngo.manager, `${ngo.name} application ${ngo.status}`);
  res.json(ngo);
}));

app.delete('/api/ngos/:id', auth, roles('admin'), safe(async (req, res) => {
  if (
    await Donation.exists({ ngo: req.params.id }) ||
    await Campaign.exists({ ngo: req.params.id }) ||
    await Wishlist.exists({ ngo: req.params.id })
  ) {
    return res.status(409).json({ error: 'Remove linked records before deleting NGO' });
  }

  await NGO.findByIdAndDelete(req.params.id);
  await User.updateMany({ ngo: req.params.id }, { $unset: { ngo: 1 } });
  await audit(req, 'delete', 'ngo', req.params.id);
  res.json({ ok: true });
}));

// --- Generic Dynamic CRUD Configurations ---
const configs = {
  donors: {
    Model: Donor,
    keys: ['name', 'email', 'phone'],
    scope: async req => req.user.role === 'donor'
      ? { user: req.user._id }
      : req.user.role === 'ngo'
        ? { _id: { $in: await Donation.distinct('donor', { ngo: req.user.ngo }) } }
        : {}
  },
  campaigns: {
    Model: Campaign,
    keys: ['title', 'purpose', 'goal', 'status', 'ngo'],
    scope: async req => req.user.role === 'ngo'
      ? { ngo: req.user.ngo }
      : req.user.role === 'donor'
        ? { ngo: { $in: await NGO.distinct('_id', { status: 'approved' }) } }
        : {}
  },
  wishlists: {
    Model: Wishlist,
    keys: ['ngo', 'item', 'category', 'quantity', 'urgency'],
    scope: async req => req.user.role === 'ngo'
      ? { ngo: req.user.ngo }
      : req.user.role === 'donor'
        ? { ngo: { $in: await NGO.distinct('_id', { status: 'approved' }) } }
        : {}
  },
  donations: {
    Model: Donation,
    keys: ['donor', 'ngo', 'campaign', 'kind', 'amount', 'item', 'category', 'quantity', 'purpose', 'date'],
    scope: async req => req.user.role === 'ngo'
      ? { ngo: req.user.ngo }
      : req.user.role === 'donor'
        ? { donor: { $in: (await Donor.find({ user: req.user._id }).select('_id')).map(d => d._id) } }
        : {}
  }
};

// --- Dynamic CRUD Handler Registration ---
for (const [route, cfg] of Object.entries(configs)) {
  const { Model, keys } = cfg;

  app.get('/api/' + route, auth, safe(async (req, res) => {
    const q = await cfg.scope(req);
    let query = Model.find(q).sort({ createdAt: -1 });

    if (route === 'donations') {
      query = query.populate('donor', 'name email user')
                   .populate('ngo', 'name city')
                   .populate('campaign', 'title');
    }
    if (route === 'campaigns' || route === 'wishlists') {
      query = query.populate('ngo', 'name');
    }

    res.json(await query.lean());
  }));

  app.post('/api/' + route, auth, safe(async (req, res) => {
    if (route === 'donors' && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin only' });
    }
    if (['campaigns', 'wishlists'].includes(route) && req.user.role === 'donor') {
      return res.status(403).json({ error: 'NGO or admin only' });
    }

    const data = fields(req.body, keys);

    if (['campaigns', 'wishlists'].includes(route) && req.user.role === 'ngo') {
      data.ngo = req.user.ngo;
    }

    if (route === 'donations') {
      if (req.user.role === 'donor') {
        const d = await Donor.findOne({ user: req.user._id });
        if (!d) return res.status(400).json({ error: 'Donor profile missing' });
        data.donor = d.id;
      }
      if (req.user.role === 'ngo') {
        return res.status(403).json({ error: 'NGO managers cannot submit donor records' });
      }
      if (!['money', 'item'].includes(data.kind)) {
        return res.status(400).json({ error: 'Select donation type' });
      }
      if (data.kind === 'money' && !(Number(data.amount) > 0)) {
        return res.status(400).json({ error: 'Amount must be positive' });
      }
      if (data.kind === 'item' && (!data.item || !(Number(data.quantity) > 0))) {
        return res.status(400).json({ error: 'Item and quantity required' });
      }
      if (data.campaign) {
        const campaign = await Campaign.findById(data.campaign);
        if (!campaign || String(campaign.ngo) !== String(data.ngo)) {
          return res.status(400).json({ error: 'Campaign must belong to selected NGO' });
        }
      }
      data.status = 'offered';
      data.history = [{ status: 'offered', by: req.user.name }];
    }

    if (!data.ngo && route !== 'donors') {
      return res.status(400).json({ error: 'NGO is required' });
    }

    if (route !== 'donors') {
      const ngo = await NGO.findById(data.ngo);
      if (!ngo || ngo.status !== 'approved') {
        return res.status(400).json({ error: 'NGO must be approved' });
      }
    }

    const doc = await Model.create(data);
    await audit(req, 'create', route, doc.id);

    if (route === 'donations') {
      const ngo = await NGO.findById(data.ngo);
      await notify(ngo.manager, `New ${data.kind} donation offered`);
    }

    res.status(201).json(doc);
  }));

  app.put('/api/' + route + '/:id', auth, safe(async (req, res) => {
    const doc = await Model.findById(req.params.id);
    if (!doc) return res.status(404).json({ error: 'Not found' });

    if (req.user.role !== 'admin') {
      if (
        route === 'donors' ||
        route === 'donations' ||
        req.user.role !== 'ngo' ||
        String(doc.ngo) !== String(req.user.ngo)
      ) {
        return res.status(403).json({ error: 'Not authorized' });
      }
    }

    if (route === 'donations' && doc.status !== 'offered') {
      return res.status(409).json({ error: 'Only offered donations can be edited' });
    }

    const data = fields(req.body, keys);

    if (route !== 'donors' && data.ngo && String(data.ngo) !== String(doc.ngo)) {
      return res.status(400).json({ error: 'NGO cannot be reassigned' });
    }

    if (route === 'donations' && data.campaign) {
      const campaign = await Campaign.findById(data.campaign);
      if (!campaign || String(campaign.ngo) !== String(doc.ngo)) {
        return res.status(400).json({ error: 'Campaign does not belong to NGO' });
      }
    }

    Object.assign(doc, data);
    await doc.save();
    await audit(req, 'update', route, doc.id);
    res.json(doc);
  }));

  app.delete('/api/' + route + '/:id', auth, roles('admin', 'ngo'), safe(async (req, res) => {
    const doc = await Model.findById(req.params.id);
    if (!doc) return res.status(404).json({ error: 'Not found' });

    if (
      req.user.role === 'ngo' &&
      (route === 'donors' || route === 'donations' || String(doc.ngo) !== String(req.user.ngo))
    ) {
      return res.status(403).json({ error: 'Not authorized' });
    }

    if (
      (route === 'donors' && await Donation.exists({ donor: doc.id })) ||
      (route === 'campaigns' && await Donation.exists({ campaign: doc.id }))
    ) {
      return res.status(409).json({ error: 'Linked donations exist; cannot delete' });
    }

    if (route === 'donations' && doc.status === 'received') {
      return res.status(409).json({ error: 'Received donations cannot be deleted' });
    }

    await doc.deleteOne();
    await audit(req, 'delete', route, doc.id);
    res.json({ ok: true });
  }));
}

// --- Specific Donation Transition Operations ---
const transitions = {
  offered: ['accepted', 'declined'],
  accepted: ['scheduled', 'received', 'declined'],
  scheduled: ['received', 'declined'],
  received: [],
  declined: []
};

app.patch('/api/donations/:id/status', auth, roles('admin', 'ngo'), safe(async (req, res) => {
  const d = await Donation.findById(req.params.id).populate('donor');
  if (!d) return res.status(404).json({ error: 'Not found' });
  if (!ownNGO(req, d.ngo)) return res.status(403).json({ error: 'Not your donation' });

  if (!transitions[d.status].includes(req.body.status)) {
    return res.status(400).json({ error: 'Invalid status transition' });
  }

  d.status = req.body.status;

  if (d.status === 'received' && d.kind === 'item') {
    const needs = await Wishlist.find({
      ngo: d.ngo,
      category: String(d.category || '').toLowerCase()
    });
    const open = needs.filter(w => w.fulfilled < w.quantity);
    const need = open.find(w => w.item.toLowerCase() === String(d.item || '').trim().toLowerCase()) || open[0];

    if (need) {
      need.fulfilled = Math.min(need.quantity, need.fulfilled + d.quantity);
      await need.save();
    }
  }

  d.history.push({ status: d.status, by: req.user.name });
  await d.save();
  await audit(req, 'status ' + d.status, 'donations', d.id);

  if (d.donor?.user) {
    await notify(d.donor.user, `Your donation is now ${d.status}`);
  }

  res.json(d);
}));

// --- NGO Matching Engine ---
app.get('/api/match', auth, safe(async (req, res) => {
  const category = String(req.query.category || '').trim().toLowerCase();
  const city = String(req.query.city || '').trim().toLowerCase();

  if (!category) return res.status(400).json({ error: 'Category required' });

  const ngos = await NGO.find({ status: 'approved' }).lean();
  const wish = await Wishlist.find({ ngo: { $in: ngos.map(n => n._id) } }).lean();

  const scored = ngos.map(n => {
    const cats = (n.categories || []).map(x => x.toLowerCase());
    const needs = wish.filter(w => String(w.ngo) === String(n._id) && w.fulfilled < w.quantity);
    const matching = needs.filter(w => w.category.toLowerCase() === category || w.item.toLowerCase().includes(category));
    const compatible = cats.includes(category);
    const local = !!city && n.city.toLowerCase() === city;
    const score = (compatible ? 45 : 0) + (matching.length ? 30 : 0) + (local ? 15 : 0) + 10;

    return {
      ...n,
      compatible,
      matchCount: matching.length,
      score,
      reasons: [
        compatible ? 'Accepts ' + category : 'Category not listed',
        matching.length ? `${matching.length} active matching need(s)` : 'No matching active wishlist',
        local ? 'Same city' : city ? 'Different city' : 'City not specified',
        'Approved NGO'
      ]
    };
  })
  .filter(n => n.compatible || n.matchCount > 0)
  .sort((a, b) => b.score - a.score);

  res.json(scored);
}));

// --- Statistics & Analytics ---
app.get('/api/stats', auth, safe(async (req, res) => {
  const scope = await configs.donations.scope(req);
  const [donations, donors, ngos, campaigns, wishlists] = await Promise.all([
    Donation.find(scope).populate('donor', 'name').populate('ngo', 'name').populate('campaign', 'title').lean(),
    Donor.countDocuments(
      req.user.role === 'donor' 
        ? { user: req.user._id } 
        : req.user.role === 'ngo' 
          ? await configs.donors.scope(req) 
          : {}
    ),
    NGO.countDocuments(
      req.user.role === 'ngo' 
        ? { _id: req.user.ngo } 
        : req.user.role === 'donor' 
          ? { status: 'approved' } 
          : {}
    ),
    Campaign.find(await configs.campaigns.scope(req)).lean(),
    Wishlist.find(await configs.wishlists.scope(req)).lean()
  ]);

  const money = donations.filter(d => d.kind === 'money' && d.status === 'received');
  const total = money.reduce((n, d) => n + d.amount, 0);

  const campaignMoney = await Donation.find({
    kind: 'money',
    status: 'received',
    campaign: { $ne: null }
  }).select('campaign amount').lean();

  const collectedBy = {};
  campaignMoney.forEach(d => {
    const k = String(d.campaign);
    collectedBy[k] = (collectedBy[k] || 0) + d.amount;
  });

  res.json({
    total,
    donors,
    ngos,
    campaigns: campaigns.length,
    donations: donations.length,
    received: donations.filter(d => d.status === 'received').length,
    pending: donations.filter(d => d.status === 'offered').length,
    urgent: wishlists.filter(w => w.urgency === 'urgent' && w.fulfilled < w.quantity).length,
    recent: donations.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 6),
    progress: campaigns.map(c => ({
      ...c,
      collected: collectedBy[String(c._id)] || 0
    }))
  });
}));

// --- Notifications ---
app.get('/api/notifications', auth, safe(async (req, res) => {
  res.json(await Notification.find({ user: req.user._id }).sort({ createdAt: -1 }).limit(60));
}));

app.patch('/api/notifications/:id/read', auth, safe(async (req, res) => {
  const n = await Notification.findOneAndUpdate(
    { _id: req.params.id, user: req.user._id },
    { read: true },
    { new: true }
  );
  if (!n) return res.status(404).json({ error: 'Not found' });
  res.json(n);
}));

// --- Admin Features ---
app.get('/api/audit', auth, roles('admin'), safe(async (req, res) => {
  res.json(await Audit.find().populate('actor', 'name role').sort({ createdAt: -1 }).limit(100));
}));

app.get('/api/users', auth, roles('admin'), safe(async (req, res) => {
  res.json(await User.find().select('-password').populate('ngo', 'name').lean());
}));

app.post('/api/users', auth, roles('admin'), safe(async (req, res) => {
  const { name, email, password, role, ngo } = req.body;

  if (!name || !email || !password || password.length < 8 || !['admin', 'donor', 'ngo'].includes(role)) {
    return res.status(400).json({ error: 'Valid name, email, role, password (8+) required' });
  }
  if (role === 'ngo' && !validId(ngo)) {
    return res.status(400).json({ error: 'Select NGO' });
  }

  const u = await User.create({
    name,
    email,
    password: await bcrypt.hash(password, 10),
    role,
    ngo: role === 'ngo' ? ngo : undefined
  });

  if (role === 'donor') await Donor.create({ name, email, user: u._id });
  if (role === 'ngo') await NGO.findByIdAndUpdate(ngo, { manager: u._id });

  await audit(req, 'create', 'users', u.id);
  res.status(201).json({ id: u.id });
}));

app.patch('/api/users/:id', auth, roles('admin'), safe(async (req, res) => {
  const u = await User.findById(req.params.id);
  if (!u) return res.status(404).json({ error: 'Not found' });

  if (String(u._id) === String(req.user._id) && req.body.role && req.body.role !== 'admin') {
    return res.status(400).json({ error: 'Cannot remove your own admin role' });
  }

  const upd = fields(req.body, ['name', 'role', 'ngo']);

  if (upd.role !== undefined && !['admin', 'donor', 'ngo'].includes(upd.role)) {
    return res.status(400).json({ error: 'Invalid role' });
  }

  const newRole = upd.role || u.role;

  if (newRole === 'ngo') {
    const target = upd.ngo || u.ngo;
    if (!validId(target)) return res.status(400).json({ error: 'NGO managers need an NGO' });
    upd.ngo = target;
  } else {
    upd.ngo = undefined;
    u.ngo = undefined;
  }

  Object.assign(u, upd);

  if (newRole === 'donor' && !(await Donor.exists({ user: u._id }))) {
    await Donor.create({ name: u.name, email: u.email, user: u._id });
  }

  if (newRole === 'ngo') {
    await NGO.findByIdAndUpdate(u.ngo, { manager: u._id });
  }

  if (req.body.password) {
    if (req.body.password.length < 8) return res.status(400).json({ error: 'Password too short' });
    u.password = await bcrypt.hash(req.body.password, 10);
  }

  await u.save();
  await audit(req, 'update', 'users', u.id);
  res.json({ ok: true });
}));

app.delete('/api/users/:id', auth, roles('admin'), safe(async (req, res) => {
  if (String(req.user._id) === req.params.id) {
    return res.status(400).json({ error: 'Cannot delete your own account' });
  }

  const u = await User.findById(req.params.id);
  if (!u) return res.status(404).json({ error: 'Not found' });

  if (await Donor.exists({ user: u.id }) || await NGO.exists({ manager: u.id })) {
    return res.status(409).json({ error: 'Account linked to donor or NGO; unlink first' });
  }

  await u.deleteOne();
  await audit(req, 'delete', 'users', req.params.id);
  res.json({ ok: true });
}));

// --- Global Error Handling Middleware ---
app.use((err, req, res, next) => {
  console.error(err);
  const status = err.type === 'entity.parse.failed' ||
    err.name === 'ValidationError' ||
    err.name === 'CastError' ||
    err.name === 'StrictModeError'
      ? 400
      : err.code === 11000
        ? 409
        : 500;

  const errorMessage = err.type === 'entity.parse.failed'
    ? 'Malformed JSON'
    : err.code === 11000
      ? 'Duplicate entry'
      : err.name === 'ValidationError' || err.name === 'CastError'
        ? err.message
        : 'Server error';

  res.status(status).json({ error: errorMessage });
});

// --- Server Initialization ---
if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 20) {
  console.error('Set a JWT_SECRET of at least 20 characters in server/.env');
  process.exit(1);
}

if (require.main === module) {
  const PORT = process.env.PORT || 5000;
  const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/givenest';

  mongoose.connect(MONGO_URI)
    .then(() => app.listen(PORT, () => console.log('GiveNest API ready on ' + PORT)))
    .catch(e => {
      console.error('MongoDB failed:', e.message);
      process.exit(1);
    });
}

module.exports = {
  app,
  models: { User, NGO, Donor, Campaign, Wishlist, Donation, Notification, Audit }
};