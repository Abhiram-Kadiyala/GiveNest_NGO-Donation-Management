require('dotenv').config();

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { models: { User, NGO, Donor, Campaign, Wishlist, Donation, Notification, Audit } } = require('./index');

(async () => {
  const MONGO_URI = process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/givenest';
  await mongoose.connect(MONGO_URI);

  // Check if database is already seeded
  if (await User.countDocuments()) {
    console.log('Database contains users; seed skipped to avoid overwriting data.');
    return;
  }

  // --- 1. Seed Users ---
  const password = await bcrypt.hash('Demo@12345', 10);

  const admin = await User.create({
    name: 'GiveNest Admin',
    email: 'admin@givenest.demo',
    password,
    role: 'admin'
  });

  const donor = await User.create({
    name: 'Aarav Sharma',
    email: 'donor@givenest.demo',
    password,
    role: 'donor'
  });

  const ngoUser = await User.create({
    name: 'Meera Rao',
    email: 'ngo@givenest.demo',
    password,
    role: 'ngo'
  });

  // --- 2. Seed NGOs ---
  const child = await NGO.create({
    name: 'Little Stars Children Home',
    type: 'Orphanage',
    city: 'Hyderabad',
    description: 'Supporting children with education, play and care.',
    categories: ['toys', 'books', 'clothes', 'school supplies'],
    needs: ['Toys', 'Books'],
    status: 'approved',
    manager: ngoUser._id
  });

  const elder = await NGO.create({
    name: 'Golden Years Care',
    type: 'Old Age Home',
    city: 'Hyderabad',
    description: 'Comfort, mobility and dignity for older adults.',
    categories: ['beds', 'blankets', 'wheelchairs', 'food'],
    needs: ['Beds', 'Blankets'],
    status: 'approved'
  });

  const shelter = await NGO.create({
    name: 'Hope Community Shelter',
    type: 'Community Shelter',
    city: 'Secunderabad',
    description: 'Providing basic essentials and emergency support.',
    categories: ['food', 'clothes', 'blankets', 'beds'],
    needs: ['Food', 'Clothes'],
    status: 'approved'
  });

  // Link NGO manager to NGO profile
  await User.findByIdAndUpdate(ngoUser.id, { ngo: child._id });

  // --- 3. Seed Donors ---
  const d = await Donor.create({
    name: donor.name,
    email: donor.email,
    phone: '9876543210',
    user: donor._id
  });

  await Donor.create({
    name: 'Ananya Patel',
    email: 'ananya@example.com',
    phone: '9000000000'
  });

  // --- 4. Seed Campaigns ---
  const campaign = await Campaign.create({
    title: 'Back to School',
    purpose: 'School kits and education for children',
    goal: 50000,
    ngo: child._id
  });

  await Campaign.create({
    title: 'Warm Nights',
    purpose: 'Beds and blankets for elderly residents',
    goal: 80000,
    ngo: elder._id
  });

  // --- 5. Seed Wishlists ---
  await Wishlist.insertMany([
    { ngo: child._id, item: 'Educational Toys', category: 'toys', quantity: 30, urgency: 'urgent' },
    { ngo: child._id, item: 'School Books', category: 'books', quantity: 100 },
    { ngo: elder._id, item: 'Single Beds', category: 'beds', quantity: 12, urgency: 'urgent' },
    { ngo: elder._id, item: 'Wheelchairs', category: 'wheelchairs', quantity: 4 },
    { ngo: shelter._id, item: 'Food Kits', category: 'food', quantity: 60, urgency: 'urgent' }
  ]);

  // --- 6. Seed Donations ---
  await Donation.create({
    donor: d._id,
    ngo: child._id,
    campaign: campaign._id,
    kind: 'money',
    amount: 2500,
    purpose: 'Education',
    status: 'received',
    history: [
      { status: 'offered', by: donor.name },
      { status: 'accepted', by: ngoUser.name },
      { status: 'received', by: ngoUser.name }
    ]
  });

  await Donation.create({
    donor: d._id,
    ngo: child._id,
    kind: 'item',
    item: 'Educational Toys',
    category: 'toys',
    quantity: 5,
    purpose: 'Play and learning',
    status: 'offered',
    history: [
      { status: 'offered', by: donor.name }
    ]
  });

  // --- 7. Seed Notifications ---
  await Notification.create({
    user: ngoUser._id,
    message: 'New toy donation is awaiting your review'
  });

  console.log('Demo data seeded. All demo passwords: Demo@12345');
})()
  .catch(e => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());