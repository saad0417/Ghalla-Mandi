# Ghalla Mandi Management System - Full Build Roadmap

MERN stack: MongoDB (Atlas), Express, React, Node.

**How to use this file**
- Work top to bottom. Each phase builds on the one before it.
- Tick a box only when that piece is tested and working, not when the code is written.
- Install the "Markdown All in One" extension, put your cursor on a line and press
  `Alt+C` to tick a box. Or type the `x` yourself.
- Preview the file with `Ctrl+Shift+V`.

**The one rule for every phase**
Build the model, then the controller, then the route, then test it in Postman.
Only then move on. A half-finished phase will quietly break the next one.

---

# PART A - BACKEND

---

## Phase 0 - Project Setup

### Tasks
- [ ] `.env` file with `PORT`, `MONGODB_URI`, `JWT_SECRET`, `JWT_EXPIRY`
- [ ] `.gitignore` includes `node_modules`, `.env`
- [ ] Database connection file (`db/index.js`), connects to Atlas, logs success or failure
- [ ] `app.js` with express, `express.json()`, cors, cookie-parser
- [ ] `index.js` starts server only after the database connects
- [ ] Create `utils/ApiError.js` and `utils/ApiResponse.js`
- [ ] Create `utils/asyncHandler.js` (wraps async controllers so you stop writing try/catch)
- [ ] Global error handler middleware in `app.js`
- [ ] Test: start the server, hit a `/api/v1/health` route, get a JSON response

### Why this first
Every controller you write after this depends on these four utils. Build them once,
use them 50 times.

### Folder structure you should end up with
```
src/
  config/
  db/
  models/
  controllers/
  routes/
  middlewares/
  utils/
  app.js
  index.js
```

---

## Phase 1 - Simple Masters (Bank and Product)

**Goal:** get your CRUD pattern right on something that cannot go wrong.

### Bank
- [ ] `Bank` model: bankName (unique), shortName, branchName, branchCode, isActive, createdBy
- [ ] Create bank
- [ ] List banks (with search by name)
- [ ] Get single bank
- [ ] Update bank
- [ ] Soft delete (set `isActive: false`, never actually delete)
- [ ] Test all 5 in Postman

### Product
- [ ] `Product` model: productName (unique), unitOfMeasurement (enum), kgPerUnit, isActive, createdBy
- [ ] Same 5 endpoints
- [ ] Test in Postman

### Enum to use
`unitOfMeasurement`: MAUND, KG, BAG_40KG, BAG_50KG, BAG_100KG, QUINTAL, TON, PIECE

### Why these first
No references to other collections. Nothing to go wrong. Once this pattern works,
you copy it for everything else in the project.

### What you learn here
Mongoose schemas, enums, unique indexes, controller structure, consistent API responses,
Postman testing.

---

## Phase 2 - Authentication

**Goal:** know who is logged in, and block everyone else.

### Tasks
- [ ] `User` model: name, email (unique), passwordHash, phone, role (enum), isActive,
      refreshToken, lastLoginAt
- [ ] Hash password with bcrypt in a `pre('save')` hook (only when password changed)
- [ ] Method on the schema: `isPasswordCorrect()`
- [ ] Methods: `generateAccessToken()`, `generateRefreshToken()`
- [ ] Login endpoint, returns access token + sets refresh token cookie
- [ ] Logout endpoint
- [ ] Refresh token endpoint
- [ ] `verifyJWT` middleware
- [ ] Apply `verifyJWT` to the Bank and Product routes from Phase 1
- [ ] Test: hitting a protected route without a token must return 401

### No public register endpoint
There is no sign-up in this system. Nobody creates their own account.

- The first user (the Aarti, role SUPER_ADMIN) is created once by a seed script
- Everyone else is created from inside the app by the Aarti, in User Management
- That create-user endpoint sits behind `verifyJWT` and a role check

A public register route on a business ledger would let anyone create an account and
read the Aarti's financial data. Do not add one "just for testing" either, because
it will still be there on the day you deploy.

### User Management (build this in the same phase)
- [ ] Seed script that creates the first SUPER_ADMIN user
- [ ] Create user endpoint (protected, SUPER_ADMIN or AARTI only)
- [ ] List users
- [ ] Update user (name, phone, role, isActive)
- [ ] Deactivate user (never delete, their `createdBy` records must survive)
- [ ] Admin resets a user's password
- [ ] User changes own password (must supply the current one)

### Roles enum
SUPER_ADMIN, AARTI, MANAGER, ACCOUNTANT, DATA_ENTRY

### Linking an employee to a customer record
An employee can also trade as a customer. Create the Customer record first, set
`isEmployee: true` on it, then point `user.customer` at that customer `_id`.
Do not type his details into both places.

### Skip for now
The `permissions` array. Just store `role`. Fine-grained permissions come in Phase 10.

### Note
You did the login and JWT part in vidtube. Reuse that pattern, just leave out the
register route.

---

## Phase 3 - Customers

**Goal:** the people the Aarti trades with.

### Tasks
- [ ] `Customer` model with all fields:
  - customerCode (auto, unique), name, fatherName
  - cnicNumber (unique + sparse), cnicFrontImage, cnicBackImage
  - phoneNumbers (array of strings), address
  - customerType enum: SELLER, BUYER, BOTH
  - isEmployee (boolean)
  - openingBalance, openingBalanceDate, currentBalance
  - securityCheques (embedded array)
  - guarantor (embedded object)
  - creditLimit, isActive, createdBy, updatedBy
- [ ] `Counter` model + a `generateCode()` util for CUST-0001, CUST-0002...
- [ ] Create customer. On create, set `currentBalance = openingBalance`
- [ ] List customers with search (name, CNIC, phone, code) and pagination
- [ ] Get single customer
- [ ] Update customer
- [ ] Deactivate customer (never delete)
- [ ] Test in Postman

### Important detail
`cnicNumber` must be `{ unique: true, sparse: true }`. Sparse means customers without a
CNIC can still be saved. Without sparse, the second customer with no CNIC will fail
because `null` counts as a duplicate.

### Skip for now
Real image uploads. Store a placeholder string like `"pending"`. Uploads come in Phase 10.

### Code generation, how it works
Never use `Customer.countDocuments() + 1`. Two people creating a customer at the same
moment would get the same code. Use the counters collection:
```js
const c = await Counter.findOneAndUpdate(
  { _id: 'customer' },
  { $inc: { sequence: 1 } },
  { new: true, upsert: true }
);
```

---

## Phase 4 - Receipts and Ledger (THE CORE)

**Goal:** record a crop purchase or sale and have the customer's balance come out right.

This is the heart of the system. Everything else depends on it. Go slowly here.

### Understand the business logic first

**INWARD** = customer brings crop to the Aarti to sell.
The Aarti owes the customer money. Commission is **deducted** from what he pays out.
```
netAmount = itemsSubtotal - commissionAmount - customerCharges
direction = PAYABLE  (Aarti owes customer)
```

**OUTWARD** = Aarti sells crop to a buyer.
The buyer owes the Aarti money. Commission is **added** to what he collects.
```
netAmount = itemsSubtotal + commissionAmount + customerCharges
direction = RECEIVABLE  (customer owes Aarti)
```

Get this backwards and every number in the system will be wrong.

### Tasks
- [ ] `InventoryMovement` model (receipt)
  - receiptNumber (auto, unique), customer, movementType enum, date, vehicleNumber, notes
  - items array: product, productName, unitOfMeasurement, quantity, ratePerUnit, lineTotal
  - charges array: chargeType enum, label, amount, borneBy enum
  - itemsSubtotal, commissionType enum, commissionValue, commissionAmount
  - chargesTotal, netAmount, direction enum
  - amountSettled, amountRemaining
  - status enum (DRAFT / POSTED / CANCELLED)
  - paymentStatus enum (UNPAID / PARTIAL / SETTLED)
- [ ] `LedgerEntry` model
  - customer, date, entryType enum, sourceType enum, sourceId
  - debit, credit, runningBalance, narration
  - isReversed, reversalOf, createdBy
- [ ] Create receipt controller, in this order:
  1. Validate the customer exists and is active
  2. For each item: `lineTotal = quantity * ratePerUnit`
  3. `itemsSubtotal` = sum of all lineTotals
  4. Calculate `commissionAmount` based on commissionType
  5. `chargesTotal` = sum of charges where `borneBy = CUSTOMER`
  6. Calculate `netAmount` and `direction` using the rules above
  7. Set `amountSettled = 0`, `amountRemaining = netAmount`, `paymentStatus = UNPAID`
  8. Save the receipt
  9. Write a LedgerEntry row
  10. Update `customer.currentBalance`
- [ ] List receipts with filters (customer, date range, movementType, paymentStatus)
- [ ] Get single receipt (populated with customer and product names)
- [ ] Cancel receipt (status = CANCELLED, write a reversing ledger entry, fix the balance)
- [ ] Customer ledger endpoint: all entries for one customer sorted by date, with
      running balance
- [ ] Add index: `ledgerEntrySchema.index({ customer: 1, date: 1 })`
- [ ] Add index: `inventoryMovementSchema.index({ customer: 1, date: -1 })`

### Commission types
- PERCENTAGE: `commissionAmount = itemsSubtotal * commissionValue / 100`
- FIXED_PER_UNIT: `commissionAmount = totalQuantity * commissionValue`
- FIXED_PER_RECEIPT: `commissionAmount = commissionValue`

### Charge types
LABOUR, BARDANA, TOLAI, MARKET_FEE, TRANSPORT, OTHER

### Stop and test properly here
- Create an INWARD receipt. Do the maths on paper. Compare.
- Create an OUTWARD receipt for the same customer. Check the balance moved the other way.
- Create a third. Check the running balance in the ledger is correct across all three.
- Cancel one. Check the balance went back to what it was.

If the balance is wrong at this stage, stop and fix it. Do not build Phase 5 on top of
broken maths.

### The rule you must never break
**Never change a balance without writing a ledger row in the same action.**
Break this once and your numbers will drift, and you will have no way to trace why.

---

## Phase 5 - Payments

**Goal:** record money coming in and going out, and settle receipts with it.

### Tasks
- [ ] `Payment` model
  - voucherNumber (auto, unique), customer
  - direction enum: RECEIVED (money in) / PAID (money out)
  - purpose enum: RECEIPT_SETTLEMENT, LOAN_DISBURSEMENT, LOAN_REPAYMENT, ON_ACCOUNT, ADVANCE
  - date, totalAmount
  - breakdowns array (how the money moved)
  - allocations array (what the money is settling)
  - unallocatedAmount, status enum, notes
- [ ] Validation: sum of `breakdowns` must equal `totalAmount`
- [ ] Validation: sum of `allocations` must not exceed `totalAmount`
- [ ] Create payment controller:
  1. Validate the two sums above
  2. Save the payment
  3. For each allocation, update that receipt's `amountSettled`, `amountRemaining`
     and `paymentStatus`
  4. Write a LedgerEntry row
  5. Update `customer.currentBalance`
- [ ] List payments with filters
- [ ] Get single payment
- [ ] Cancel payment (reverse the allocations, reverse the ledger, fix the balance)
- [ ] Add index: `paymentSchema.index({ customer: 1, date: -1 })`

### Breakdown fields
```
method enum: CASH / CHEQUE / BANK_TRANSFER
amount, date
if CHEQUE:        bank, chequeNumber, chequeDate, accountHolderName, image
if BANK_TRANSFER: bank, transactionId, accountHolderName, image
if CASH:          nothing extra
clearanceStatus enum: NOT_APPLICABLE / PENDING / CLEARED / BOUNCED
```

### Allocation fields
```
targetType enum: INVENTORY_MOVEMENT / LOAN / OPENING_BALANCE
inventoryMovement (ref, nullable)
loan (ref, nullable)
amount
```

### Why allocations is an array
One payment of 100,000 can settle receipt A for 60,000 and receipt B for 40,000.
A single receipt reference cannot express that. Do not simplify this, you will have to
rewrite it.

### Why breakdowns is an array
The customer pays 50,000 cash plus a cheque of 150,000 in one go. That is one payment,
two breakdowns.

---

## Phase 6 - Loans

**Goal:** track money lent to a customer and repaid over time.

### Tasks
- [ ] `Loan` model: loanNumber (auto), customer, loanDate, principalAmount,
      repaidAmount, remainingAmount, expectedSettlementProduct, dueDate,
      status enum, disbursementPayment, notes
- [ ] Give loan: creates a Loan + a Payment (direction PAID) + a LedgerEntry
- [ ] Repay loan by cash/cheque: a Payment (direction RECEIVED) allocated to the loan
- [ ] On every repayment: update `repaidAmount`, `remainingAmount` and `status`
- [ ] List loans with filters (customer, status)
- [ ] Add index: `loanSchema.index({ customer: 1, status: 1 })`

### Loan status enum
ACTIVE, PARTIALLY_REPAID, CLOSED, WRITTEN_OFF

### The hard part, do it last
**Repaying a loan from crop proceeds.** The customer brings wheat worth 200,000, and he
already owes 50,000 on a loan. Instead of paying him 200,000 and collecting 50,000 back,
the Aarti pays him 150,000 and marks the loan closed.

How to build it:
1. Create the INWARD receipt as normal (netAmount 200,000, direction PAYABLE)
2. Create one Payment, direction PAID, totalAmount 200,000
3. Two allocations on that payment:
   - 50,000 to the loan
   - 150,000 to... nothing, it goes out as cash to the customer
4. Breakdown shows 150,000 CASH going out
5. Ledger gets rows for both

Think about it carefully before writing it. This is where most people get confused.

---

## Phase 7 - Reports

**Goal:** the screens the Aarti will actually look at every day.

### Tasks
- [ ] Customer ledger: all entries for one customer, date filter, running balance,
      opening and closing balance for the period
- [ ] Customer balance list: every customer with current balance, sorted by amount owed
- [ ] Outstanding receipts: all receipts with paymentStatus UNPAID or PARTIAL
- [ ] Outstanding loans: all loans with status ACTIVE or PARTIALLY_REPAID
- [ ] Commission earned: total commission for a date range, grouped by month
- [ ] Daily summary: receipts in, receipts out, money in, money out, commission, for one day
- [ ] Stock summary: quantity purchased vs sold per product

### Build these with aggregation pipelines
This is where you learn MongoDB aggregation properly: `$match`, `$group`, `$lookup`,
`$sort`, `$project`.

---

## Phase 8 - Data Integrity

**Goal:** stop the system from producing numbers that do not add up.

### Tasks
- [ ] Decide how you store money and apply it everywhere:
      either round every result to 2 decimals with a helper, or store paisa as integers
- [ ] A `recalculateBalance(customerId)` utility that rebuilds the balance from ledger
      entries, so you can repair drift if it ever happens
- [ ] A reconciliation endpoint: compare `customer.currentBalance` against the sum of
      ledger entries, report any mismatch
- [ ] Wrap multi-step writes (receipt + ledger + balance) in a MongoDB transaction
      so a half-failure cannot leave the data inconsistent
- [ ] Validation layer on every create/update endpoint (express-validator or zod)
- [ ] Never hard delete anything that has been posted

### About transactions
Atlas runs as a replica set, so transactions work there. A plain local `mongod` does not
support them. If you ever run locally, start it as a single-node replica set.

```js
const session = await mongoose.startSession();
session.startTransaction();
try {
  // ...all your writes with { session }
  await session.commitTransaction();
} catch (e) {
  await session.abortTransaction();
  throw e;
} finally {
  session.endSession();
}
```

---

## Phase 9 - Seed Data and Testing

### Tasks
- [ ] A seed script that creates: 1 admin user, 3 banks, 5 products, 10 customers
- [ ] A second script that creates 30 realistic receipts and payments across those customers
- [ ] A Postman collection with every endpoint saved, organised by module
- [ ] Postman environment variables for base URL and token
- [ ] Manually verify: pick one customer, add up his receipts and payments on paper,
      compare with the ledger

### Why this matters
When you build the frontend you need data on screen. Clicking through Postman to create
30 records by hand every time you reset the database will waste hours.

---

## Phase 10 - Backend Polish

### Tasks
- [ ] Image uploads: Multer + Cloudinary for CNIC, cheques, transfer slips
- [ ] `permissions` array on User + a `checkPermission(permission)` middleware
- [ ] Cheque clearance: mark a cheque CLEARED or BOUNCED, and on bounce write a
      reversing ledger entry
- [ ] Pagination on every list endpoint (`mongoose-aggregate-paginate-v2`)
- [ ] Rate limiting on the login route
- [ ] Request logging (morgan or winston)
- [ ] Input sanitisation against injection

### Permissions enum
CUSTOMER_VIEW, CUSTOMER_MANAGE, PRODUCT_MANAGE, MOVEMENT_VIEW, MOVEMENT_MANAGE,
MOVEMENT_CANCEL, PAYMENT_VIEW, PAYMENT_MANAGE, LOAN_VIEW, LOAN_MANAGE, BANK_MANAGE,
REPORT_VIEW, USER_MANAGE

---

# PART B - FRONTEND (React)

Do not start this until the backend works end to end in Postman.

---

## Phase 11 - Frontend Setup

### Tasks
- [ ] Vite + React project
- [ ] Tailwind CSS
- [ ] React Router with a protected route wrapper
- [ ] Axios instance with base URL and token interceptor
- [ ] Redux Toolkit or Context for auth state
- [ ] Layout: sidebar, header, main content area
- [ ] Toast notifications (react-hot-toast)

---

## Phase 12 - Core Screens

### Tasks
- [ ] Login page
- [ ] Dashboard: today's totals, total receivable, total payable, outstanding loans
- [ ] Customer list: searchable table with balance column
- [ ] Add/edit customer form (react-hook-form)
- [ ] Customer detail page with ledger table

---

## Phase 13 - The Receipt Screen (hardest screen)

### Tasks
- [ ] Customer picker with search
- [ ] Movement type toggle (INWARD / OUTWARD)
- [ ] Dynamic item rows: add row, remove row, pick product, enter quantity and rate
- [ ] Live `lineTotal` per row as the user types
- [ ] Live subtotal, commission and net amount display
- [ ] Charges section
- [ ] Save and print

### Critical rule
The frontend calculates totals **only for display**. When you submit, send the raw items
and let the backend calculate everything again. Never save a total that came from the
browser.

---

## Phase 14 - Payments and Loans Screens

### Tasks
- [ ] Payment form with dynamic breakdown rows (cash / cheque / bank)
- [ ] Allocation section showing that customer's unpaid receipts with checkboxes
- [ ] Running display: allocated so far vs total, so the user cannot over-allocate
- [ ] Loan list and give-loan form
- [ ] Loan repayment form

---

## Phase 15 - Reports and Printing

### Tasks
- [ ] Customer ledger screen with date filter and print button
- [ ] Printable receipt layout (A5, clean, Urdu labels where it helps)
- [ ] Outstanding receipts report
- [ ] Outstanding loans report
- [ ] Commission report
- [ ] Export to Excel for the main reports

### Keep this in mind
The real Aarti has used a paper register for 30 years. The screen must be simple,
readable in Urdu, print a receipt he can hand to the customer, and never show a balance
he disagrees with. If he has to call you to understand a number, the software has failed.

---

# PART C - SHIPPING

---

## Phase 16 - Deployment

### Tasks
- [ ] Environment variables set properly for production
- [ ] Backend deployed (Render / Railway / a VPS)
- [ ] Frontend deployed (Vercel)
- [ ] CORS configured for the real frontend domain
- [ ] Atlas: IP access list, a database user with least privilege, backups enabled
- [ ] Automated daily backup
- [ ] Test the whole flow on the deployed version, not just locally

---

## Phase 17 - Before Showing It To A Real Aarti

- [ ] Create 50+ realistic records and check every report
- [ ] Have someone else use it without you explaining anything
- [ ] Check every number against a hand calculation
- [ ] Make sure nothing crashes on empty states (no customers, no receipts)
- [ ] Write a one-page user guide in simple Urdu or Roman Urdu

---

# RULES FOR THE WHOLE PROJECT

1. **All calculations happen in the backend controller.** The frontend only displays.

2. **Never hard delete a posted receipt or payment.** Cancel it and write a reversing
   ledger entry. The customer already holds a printed copy.

3. **Balance and ledger always move together.** One action, both updates, no exceptions.

4. **Store money consistently.** Plain JS numbers lose precision on percentage maths.
   Pick one approach and use it everywhere.

5. **Test each phase in Postman before building the next.**

6. **Commit after every working piece.** Small commits with clear messages.

---

# CAN I CHANGE THE MODELS LATER?

Mostly yes. MongoDB is flexible. Adding a new field is easy, old documents simply will
not have it.

**Easy to change later**
- Adding a field
- Adding a value to an enum
- Adding an index
- Renaming something you have not saved real data into yet

**Hard to change later**
- Relationship shape (what references what)
- Splitting one collection into two after real data exists
- Changing the meaning of a field you have already filled with data
- Changing how money is stored

So think carefully about structure, but do not freeze. Fixing something in week 3 is far
better than living with it for the life of the project.