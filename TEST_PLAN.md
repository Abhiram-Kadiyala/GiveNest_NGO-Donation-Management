# GiveNest acceptance test checklist

- [ ] `npm install` completes in server and client
- [ ] `npm run seed` inserts accounts and NGO records into MongoDB
- [ ] `/api/health` returns `{ok:true,database:'connected'}`
- [ ] Admin, NGO and Donor accounts can log in
- [ ] Donor cannot access admin endpoints (HTTP 403)
- [ ] NGO cannot edit a different NGO's campaign (HTTP 403)
- [ ] NGO cannot approve NGO applications (HTTP 403)
- [ ] Donor creates item donation; manager sees it
- [ ] Manager accepts, schedules, receives; timeline records each change
- [ ] Donor sees a notification and can print acknowledgement
- [ ] SmartMatch returns approved NGOs and category-specific explanations
- [ ] Campaign totals only include received money donations
- [ ] Admin can add/edit/delete eligible donor, campaign and wishlist records
- [ ] Admin can approve or reject pending NGOs
- [ ] Audit log reflects creation, updates, deletion and approvals
- [ ] Layout works on mobile width and desktop
