# Ghalla Mandi Management System

Build roadmap. MERN stack: MongoDB (Atlas), Express, React, Node.

---

## How to use this file

- Read **Part 0 (Before You Start)** once, now. Come back to it when stuck.
- Then work through the phases in order. Each one builds on the last.
- Tick a box only when that piece is **tested and working**, not when the code is written.
- Every phase ends with a **Done when** test. If it fails, do not move on.

### The sequential rule

**Never tick a box while an earlier unticked box sits above it.**

If you are tempted to skip one, that is a signal to stop and look at why. Usually it
means you are stuck on it and moving on feels easier. It is not. In this project almost
every step feeds the next one, so a skipped box becomes a bug three phases later that
takes a day to trace.

If a box genuinely does not apply to your build, do not leave it blank. Strike it
through and write why, so future you knows it was a decision and not an oversight:

```
- [x] ~~Cheque clearance status~~  (skipped: Aarti takes cash only)
```

Markdown cannot enforce this. It is a discipline, not a feature.

**Ticking boxes:** install "Markdown All in One", put your cursor on the line, press `Alt+C`.
Or type the `x` yourself. Split view with `Ctrl+K` then `V` gives you code on the left
(tickable) and preview on the right.

---

## Contents

**Part 0 - Before You Start**
- Project rules
- What each model tracks
- The core business logic
- Models and subdocuments
- How images are stored
- Design decisions and open questions

**Part 1 - Backend** (Phases 0 to 10)
**Part 2 - Frontend** (Phases 11 to 15)
**Part 3 - Shipping** (Phases 16 to 17)

---
---

# PART 0 - BEFORE YOU START

---

## Project rules

These apply to every phase. Breaking any of them causes bugs you will struggle to trace.

**1. All calculations happen in the backend controller.**
The frontend only displays. Never save a total that came from the browser.

**2. Never hard delete a posted receipt or payment.**
Cancel it and write a reversing ledger entry. The customer already holds a printed copy.

**3. Balance and ledger always move together.**
One action, both updates, no exceptions. Break this once and your numbers drift with no
way to find out why.

**4. Store money consistently.**
Plain JS numbers lose precision on percentage maths. Either round every result to 2
decimals with one shared helper, or store paisa as whole integers. Decide on day one.

**5. Test each phase in Postman before starting the next.**

**6. Commit after every working piece.** Small commits, clear messages.

---

## What each model tracks

| Model | What it holds |
|---|---|
| `users` | Who can log in. Name, email, hashed password, role. The `customer` field links an employee to his own customer record if he also trades. |
| `banks` | A lookup list, so cheques and transfers point at a bank record instead of storing the name as free text. |
| `products` | The crops. Name, unit of measurement, `kgPerUnit` for conversions. |
| `counters` | One row per code type. Holds the last number used for CUST-0001, RCP-0001, so two users can never get the same code. |
| `customers` | The people the Aarti trades with. Identity, CNIC, phones, guarantor, security cheques held, and `currentBalance`. |
| `inventoryMovements` | One receipt. Customer, crops, quantity, rate, commission, charges, and how much is still unsettled. |
| `loans` | Money lent to a customer. Principal, repaid so far, remaining. |
| `payments` | One money event. `breakdowns` = HOW the money moved. `allocations` = WHAT it settled. |
| `ledgerEntries` | The audit trail. One row per balance change. **This is the truth.** `currentBalance` is only a cached copy for speed. |

**Balance sign convention:** positive means the customer owes the Aarti.

---

## The core business logic

Get this wrong and every number in the system is wrong. Read it twice.

### INWARD - a customer brings crop to sell

The Aarti owes the customer money. Commission is **deducted** from what he pays out.

```
netAmount = itemsSubtotal - commissionAmount - customerCharges
direction = PAYABLE          (Aarti owes customer)
```

### OUTWARD - the Aarti sells crop to a buyer

The buyer owes the Aarti money. Commission is **added** to what he collects.

```
netAmount = itemsSubtotal + commissionAmount + customerCharges
direction = RECEIVABLE       (customer owes Aarti)
```

### Commission formulas

| Type | Formula |
|---|---|
| `PERCENTAGE` | `itemsSubtotal * commissionValue / 100` |
| `FIXED_PER_UNIT` | `totalQuantity * commissionValue` |
| `FIXED_PER_RECEIPT` | `commissionValue` |

### Charges

`chargesTotal` sums **only** the charges where `borneBy = CUSTOMER`.
Charges with `borneBy = AARTI` are the business's own cost. They never touch the
customer's bill, but they do reduce profit (see Phase 7).

---

## Models and subdocuments

### What a subdocument is

A model becomes a collection in MongoDB. A subdocument does not. It is a shape you
define, then nest inside a parent document. No collection of its own, no `_id`, never
queried directly.

When you finish, Atlas will show **9 collections, not 15**.

One customer document actually looks like this:

```js
{
  _id: "67a1...",
  name: "Ashraf Ali",
  currentBalance: 45000,
  securityCheques: [
    { chequeNumber: "000123", bank: "67b2...", amount: 500000, status: "HELD" },
    { chequeNumber: "000124", bank: "67b2...", amount: 300000, status: "HELD" }
  ],
  guarantor: {
    name: "Rafiq Ahmed",
    cnicNumber: "35202-7654321-9",
    phoneNumbers: ["03001234567"]
  }
}
```

The cheques and guarantor live **inside** the customer. There is no `securitycheques`
collection anywhere in the database.

### In Mongoose

```js
// a schema, NOT a model
const securityChequeSchema = new Schema({
  chequeNumber: { type: String, required: true },
  bank: { type: Schema.Types.ObjectId, ref: "Bank" },
  amount: { type: Number, required: true },
  status: {
    type: String,
    enum: ["HELD","RETURNED","DEPOSITED","CLEARED","BOUNCED"],
    default: "HELD"
  }
}, { _id: false });

// the model, which uses it
const customerSchema = new Schema({
  name: { type: String, required: true },
  securityCheques: [securityChequeSchema],
  guarantor: guarantorInfoSchema
}, { timestamps: true });

export const Customer = mongoose.model("Customer", customerSchema);
```

One `mongoose.model()` call. The subdocument schema never gets one.

### Embed or make a collection?

Embed it if the child is always fetched with its parent and never searched alone.
Make it a collection if it is shared between parents or needs independent querying.

That is why `banks` is a collection (many cheques point at the same bank) but
`SecurityCheque` is not (a cheque belongs to one customer and is never looked at
without him).

### Which subdocument belongs to which model

| Model file | Subdocuments defined inside it |
|---|---|
| `customer.model.js` | SecurityCheque, GuarantorInfo |
| `inventoryMovement.model.js` | MovementItem, MovementCharge |
| `payment.model.js` | PaymentBreakdown, PaymentAllocation |

The other six models have none.

**Rule:** define each subdocument schema at the top of its parent's file, with
`{ _id: false }`, and never export it. Then you never have to look this up while coding.
If a subdocument schema ends up alone in its own file, it should probably have been a
collection.

### File structure

```
models/
  user.model.js
  bank.model.js
  product.model.js
  counter.model.js
  customer.model.js             <- securityChequeSchema, guarantorInfoSchema
  inventoryMovement.model.js    <- movementItemSchema, movementChargeSchema
  loan.model.js
  payment.model.js              <- paymentBreakdownSchema, paymentAllocationSchema
  ledgerEntry.model.js
```

### Subdocument field reference

**`customer.model.js`**

```
securityCheques: [SecurityCheque]
  chequeNumber       String
  bank               ObjectId -> banks
  accountHolderName  String
  amount             Number
  chequeDate         Date      (nullable)
  image              String    (nullable)
  status             enum: HELD, RETURNED, DEPOSITED, CLEARED, BOUNCED
  notes              String    (nullable)

guarantor: GuarantorInfo
  customer           ObjectId -> customers  (nullable, if guarantor is also a customer)
  name               String
  cnicNumber         String    (nullable)
  phoneNumbers       [String]
  relation           String    (nullable)
```

**`inventoryMovement.model.js`**

```
items: [MovementItem]
  product            ObjectId -> products
  productName        String
  unitOfMeasurement  enum: MAUND, KG, BAG_40KG, BAG_50KG, BAG_100KG, QUINTAL, TON, PIECE
  quantity           Number
  ratePerUnit        Number
  lineTotal          Number
  qualityNote        String    (nullable)

charges: [MovementCharge]
  chargeType         enum: LABOUR, BARDANA, TOLAI, MARKET_FEE, TRANSPORT, OTHER
  label              String    (nullable)
  amount             Number
  borneBy            enum: CUSTOMER, AARTI
```

**`payment.model.js`**

```
breakdowns: [PaymentBreakdown]
  method             enum: CASH, CHEQUE, BANK_TRANSFER, ADJUSTMENT
  amount             Number
  date               Date
  bank               ObjectId -> banks  (nullable)
  chequeNumber       String    (nullable)
  chequeDate         Date      (nullable)
  accountHolderName  String    (nullable)
  transactionId      String    (nullable)
  image              String    (nullable)
  clearanceStatus    enum: NOT_APPLICABLE, PENDING, CLEARED, BOUNCED
  clearedAt          Date      (nullable)

allocations: [PaymentAllocation]
  targetType         enum: INVENTORY_MOVEMENT, LOAN, OPENING_BALANCE
  inventoryMovement  ObjectId -> inventoryMovements  (nullable)
  loan               ObjectId -> loans               (nullable)
  amount             Number
```

### Two field choices that look odd but are deliberate

**`productName` and `unitOfMeasurement` are copied into `MovementItem`.**
If a product is renamed two years from now, the old receipt must still print exactly
what the customer signed. Never resolve those from `products` when printing an old
receipt.

**`ADJUSTMENT` in the breakdown method enum.**
For money that did not physically move, used when a receipt is settled by cancelling a
loan instead of handing over cash. Without it, the loan-from-crop flow in Phase 6 cannot
be expressed.

---

## How images are stored

**Do not store images in MongoDB.** Not base64, not Buffer, not GridFS.

- A single document has a hard 16MB limit
- Base64 inflates a file by about 33%
- Every customer fetch would drag the images along and slow your list screens
- Atlas free tier is 512MB total, which a few hundred CNIC photos will eat

**Do this instead:** upload to Cloudinary, store only the returned URL string.

```js
cnicFrontImage: { type: String }   // "https://res.cloudinary.com/.../abc123.jpg"
```

The flow:
1. Multer catches the uploaded file on your server (temp folder)
2. Upload that file to Cloudinary
3. Cloudinary returns a `secure_url`
4. Save that string on the document
5. Delete the temp file from your server

Every image field in this project is a **String**: `cnicFrontImage`, `cnicBackImage`,
cheque images, transfer slips.

---

## Design decisions and open questions

### Already decided

| Decision | Reason |
|---|---|
| No lot tracing | The system does not track which farmer's wheat went to which buyer. Add an `inventoryAllocations` collection later only if the Aarti asks for it. |
| `runningBalance` is calculated on read, not stored | Storing it breaks the moment anyone enters a backdated receipt. |
| Commission settings live on the receipt, not cached on the customer | So the two can never disagree. |

### Open - decide before Phase 6

**Do these loans carry interest or a markup?**
The schema has no interest field. Mandi advances against future crop are often
interest-free, so this may be correct. But confirm it, because adding an interest field
after real loan records exist is painful.

### Can I change the models later?

Mostly yes. MongoDB is flexible. Adding a field is easy, old documents simply will not
have it.

| Easy to change | Hard to change |
|---|---|
| Adding a field | Relationship shape (what references what) |
| Adding a value to an enum | Splitting one collection into two after real data exists |
| Adding an index | Changing the meaning of a field you already filled |
| Renaming something with no real data in it | Changing how money is stored |

Think carefully about structure, but do not freeze. Fixing something in week 3 is far
better than living with it for the life of the project.

---
---

# PART 1 - BACKEND

---

## Phase 0 - Project Setup

**Goal:** the plumbing every later phase depends on.

### Tasks

- [x] `.env` with `PORT`, `MONGODB_URI`, `JWT_SECRET`, `JWT_EXPIRY`, `CORS_ORIGIN`
- [x] `.gitignore` includes `node_modules` and `.env`
- [x] `db/index.js` connects to Atlas, logs success or failure
- [x] `app.js` with express, `express.json()`, cors, cookie-parser
- [x] `index.js` starts the server **only after** the database connects
- [x] `utils/ApiError.js` and `utils/ApiResponse.js`
- [x] `utils/asyncHandler.js`
- [x] `middlewares/error.middleware.js`
- [x] A 404 catch-all before the error handler
- [x] `app.use(errorHandler)` in `app.js`, **after all routes**
- [x] A `/api/v1/health` route returning JSON
- [x] Env variable check in `index.js`, after `dotenv.config()`, before `connectDB()`

### The 404 catch-all

A wrong URL is not a thrown error, so it never reaches your error handler. Express
falls through to its own HTML 404 page. Add a catch-all second to last:

```js
app.use((req, res, next) => {
  next(new ApiError(404, `Route not found: ${req.originalUrl}`));
});

app.use(errorHandler);   // still last
```

Use `next(err)` here, not `throw`, because this is not inside a route handler.

### Env variable check

Without it, a missing `JWT_SECRET` fails on the first login in production, not on boot.

```js
const required = ["MONGODB_URI", "JWT_SECRET"];
if (process.env.NODE_ENV === "production") required.push("CORS_ORIGIN");

const missing = required.filter(k => !process.env[k]);
if (missing.length) throw new Error(`Missing env variables: ${missing.join(", ")}`);
```

Only list variables the app genuinely cannot run without. Anything with a `||` fallback
stays out. `CORS_ORIGIN` is optional in dev (your localhost fallbacks cover it) but
required in production.

### ApiError and errorHandler are two different files

- `utils/ApiError.js` is the error **class** you throw
- `middlewares/error.middleware.js` is the **handler** that catches it and sends JSON

The handler imports the class. Without the handler, a thrown ApiError still reaches the
browser as Express's default HTML page, and your React frontend cannot read it.

### Why the error handler goes last

Express runs middleware top to bottom and only moves **forward**. When a route throws,
Express looks ahead for an error handler. If yours sits above the routes, there is
nothing ahead of the error, so Express falls back to its own HTML page and your handler
never runs at all.

The handler must take exactly four arguments `(err, req, res, next)`. Express identifies
error handlers by argument count. Drop `next` and it is treated as normal middleware.

### Async errors need asyncHandler

Express 4 does not catch errors thrown inside an `async` controller. The request just
hangs forever. Wrap every async controller in `asyncHandler` or your error handler will
never see those errors.

```js
const asyncHandler = (requestHandler) => (req, res, next) => {
  Promise.resolve(requestHandler(req, res, next)).catch(next);
};
```

### Check your CORS config

A fallback that allows every origin makes the allowlist pointless. For a financial
ledger, gate it on the environment:

```js
if (!origin) return callback(null, true);
if (allowedOrigins.includes(origin)) return callback(null, true);
if (process.env.NODE_ENV !== "production") return callback(null, true);
return callback(new Error("Not allowed by CORS"));
```

### Folder structure

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

### Done when

- [x] `GET /api/v1/health` returns JSON
- [x] A temporary route throwing `new ApiError(400, "test")` returns **JSON**, not
      Express's HTML page. Delete the route afterwards.

---

## Phase 1 - Banks and Products

**Goal:** get your CRUD pattern right on something that cannot go wrong.

### Index reference for the whole project

Add each of these in the phase that creates that model, not all at once. Listed here so
you can see the full picture before writing your first schema.

| Model | Index | Where to write it | Why |
|---|---|---|---|
| `users` | `email` unique | inline | login lookup + no duplicate accounts |
| `banks` | `{ bankName: 1, branchCode: 1 }` unique | `.index()` | one record per bank branch |
| `products` | `{ productName: 1, unitOfMeasurement: 1 }` unique | `.index()` | same crop allowed in two units |
| `customers` | `customerCode` unique | inline | auto-generated, must not repeat |
| `customers` | `cnicNumber` unique + sparse | inline | optional, but unique when present |
| `customers` | `{ name: 1 }` | `.index()` | customer search |
| `inventoryMovements` | `receiptNumber` unique | inline | auto-generated |
| `inventoryMovements` | `{ customer: 1, date: -1 }` | `.index()` | customer receipt history, newest first |
| `inventoryMovements` | `{ paymentStatus: 1 }` | `.index()` | outstanding receipts report |
| `loans` | `loanNumber` unique | inline | auto-generated |
| `loans` | `{ customer: 1, status: 1 }` | `.index()` | outstanding loans per customer |
| `payments` | `voucherNumber` unique | inline | auto-generated |
| `payments` | `{ customer: 1, date: -1 }` | `.index()` | payment history, newest first |
| `ledgerEntries` | `{ customer: 1, date: 1 }` | `.index()` | the ledger screen, oldest first |

### How to write them

**Inline** works for a single field:

```js
email: { type: String, unique: true }
cnicNumber: { type: String, unique: true, sparse: true }
name: { type: String, index: true }
```

**`.index()`** is required for two or more fields, and takes options as a second
argument:

```js
schema.index({ fieldA: 1, fieldB: -1 });
schema.index({ fieldA: 1, fieldB: 1 }, { unique: true });
```

### Three things to understand

**`unique` IS an index.** MongoDB has no separate constraint mechanism. Writing
`unique: true` creates a unique index, which is why the check is fast and why you get
the lookup speed for free.

**`sparse` skips documents where the field is missing or null.** Without it, the second
customer with no CNIC is rejected as a duplicate of the first `null`. Only needed when a
field is both optional and unique.

**Field order in a compound index is a phone book.** `{ bankName: 1, branchCode: 1 }` is
sorted by bankName, then branchCode. You can look up by bankName alone, or by both, but
never by branchCode alone, the same way you cannot use a phone book to find someone by
first name.

Put the field you match exactly first, then the field you sort or range on. `1` is
ascending, `-1` descending, and the direction should match your `.sort()`.

### Tasks

**Bank**
- [x] `Bank` model: bankName (required), shortName, branchName, branchCode (required),
      isActive, createdBy
- [x] `bankSchema.index({ bankName: 1, branchCode: 1 }, { unique: true })`
- [x] Controllers: `createBank`, `getBanks`, `getBankById`, `updateBank`, `deactivateBank`
- [x] Routes wired up
- [x] Tested in Postman

**Product**
- [ ] `Product` model: productName (required), unitOfMeasurement (enum),
      kgPerUnit (nullable), isActive, createdBy
- [ ] `productSchema.index({ productName: 1, unitOfMeasurement: 1 }, { unique: true })`
- [ ] Controllers: `createProduct`, `getProducts`, `getProductById`, `updateProduct`,
      `deactivateProduct`
- [ ] Routes wired up
- [ ] Tested in Postman

### Why bankName is not unique on its own

A bank has many branches. `banks` is a list of bank **branches**, so "HBL, Gulberg" and
"HBL, Model Town" are two separate records. Unique on `bankName` alone would block the
second one.

The compound index makes the **pair** unique instead. Both fields must be required, or
two records with the same bank and no branchCode will still collide.

### Why productName is not unique on its own

If wheat is sold both by maund and by 50kg bag, you need two product records named
"Wheat". The compound index with `unitOfMeasurement` allows that while still rejecting a
true duplicate.

### Enum

`unitOfMeasurement`: MAUND, KG, BAG_40KG, BAG_50KG, BAG_100KG, QUINTAL, TON, PIECE

`kgPerUnit` is nullable because it means nothing when the unit is PIECE.

### Why start here

No references to other collections, nothing to go wrong. Once this pattern works, you
copy it for everything else in the project. This phase teaches you Mongoose schemas,
enums, indexes, controller structure, consistent API responses and Postman.

### Done when

- [ ] All ten endpoints tested in Postman
- [ ] "HBL / Gulberg" and "HBL / Model Town" can both be saved
- [ ] A second "HBL / Gulberg" is rejected **by the database**, not just your code
- [ ] "Wheat / MAUND" and "Wheat / BAG_50KG" can both be saved

---

## Phase 2 - Authentication and User Management

**Goal:** know who is logged in, block everyone else.

### Tasks

**Auth**
- [ ] `User` model: name, email (unique), passwordHash, phone, role (enum),
      permissions (enum array), isActive, refreshToken, lastLoginAt, customer (nullable)
- [ ] Hash password with bcrypt in a `pre('save')` hook, **only when password changed**
- [ ] Schema method `isPasswordCorrect()`
- [ ] Schema methods `generateAccessToken()`, `generateRefreshToken()`
- [ ] Login, returns access token and sets a refresh token cookie
- [ ] Logout
- [ ] Refresh token
- [ ] `verifyJWT` middleware
- [ ] Apply `verifyJWT` to the Phase 1 routes

**User management**
- [ ] Seed script creating the first SUPER_ADMIN
- [ ] Create user (protected, SUPER_ADMIN or AARTI only)
- [ ] List users
- [ ] Update user (name, phone, role, isActive)
- [ ] Deactivate user (never delete, their `createdBy` records must survive)
- [ ] Admin resets a user's password
- [ ] User changes own password (must supply the current one)

### There is no public register endpoint

Nobody creates their own account.

- The first user (the Aarti, SUPER_ADMIN) comes from a seed script
- Everyone else is created from inside the app by the Aarti
- That endpoint sits behind `verifyJWT` plus a role check

A public register route on a business ledger lets anyone create an account and read the
Aarti's financial data. Do not add one "just for testing" either, because it will still
be there on the day you deploy.

### Roles

SUPER_ADMIN, AARTI, MANAGER, ACCOUNTANT, DATA_ENTRY

### Linking an employee who also trades

Create the Customer record first, set `isEmployee: true` on it, then point
`user.customer` at that customer `_id`. Do not type his details into both places.

### Skip for now

Enforcing the `permissions` array. Define it in the model as an enum array so the data
shape is right, but check `role` only. The `checkPermission` middleware comes in Phase 10.

### Done when

- [ ] A protected route without a token returns 401
- [ ] Login returns a token you can use on the Phase 1 routes
- [ ] No route anywhere creates a user without authentication

---

## Phase 3 - Customers

**Goal:** the people the Aarti trades with.

### Tasks

- [ ] Define `securityChequeSchema` and `guarantorInfoSchema` at the top of
      `customer.model.js` with `{ _id: false }`, do not export them
- [ ] `Customer` model:
  - customerCode (auto, unique), name, fatherName
  - cnicNumber (unique + sparse), cnicFrontImage, cnicBackImage
  - phoneNumbers (array), address
  - customerType enum: SELLER, BUYER, BOTH
  - isEmployee
  - openingBalance, openingBalanceDate, currentBalance
  - securityCheques (array of SecurityCheque), guarantor (GuarantorInfo)
  - creditLimit, isActive, createdBy, updatedBy
- [ ] `Counter` model and a `generateCode()` util for CUST-0001, CUST-0002...
- [ ] Create customer, setting `currentBalance = openingBalance`
- [ ] List with search (name, CNIC, phone, code) and pagination
- [ ] Get one
- [ ] Update
- [ ] Deactivate (never delete)

### cnicNumber needs sparse, not just unique

```js
cnicNumber: { type: String, unique: true, sparse: true }
```

Without `sparse`, the **second** customer with no CNIC fails, because `null` counts as a
duplicate of `null`.

### Never generate codes with countDocuments

Two people creating a customer at the same moment would get the same code. Use the
counters collection:

```js
const c = await Counter.findOneAndUpdate(
  { _id: 'customer' },
  { $inc: { sequence: 1 } },
  { new: true, upsert: true }
);
```

### Skip for now

Real image uploads. Store a placeholder string like `"pending"`. Uploads come in Phase 10.

### Done when

- [ ] Two customers with no CNIC can both be saved
- [ ] Codes increment correctly and never repeat
- [ ] Search finds a customer by partial name and by phone

---

## Phase 4 - Receipts and Ledger

**This is the core of the system. Everything else depends on it. Go slowly.**

**Goal:** record a crop purchase or sale and have the customer's balance come out right.

Re-read "The core business logic" in Part 0 before starting.

### Tasks

- [ ] Define `movementItemSchema` and `movementChargeSchema` at the top of
      `inventoryMovement.model.js`
- [ ] `InventoryMovement` model:
  - receiptNumber (auto, unique), customer, movementType enum, date, vehicleNumber, notes
  - items (array of MovementItem), charges (array of MovementCharge)
  - itemsSubtotal, commissionType enum, commissionValue, commissionAmount
  - chargesTotal, netAmount, direction enum
  - amountSettled, amountRemaining
  - status enum: DRAFT, POSTED, CANCELLED
  - paymentStatus enum: UNPAID, PARTIAL, SETTLED
- [ ] `LedgerEntry` model:
  - customer, date, entryType enum, sourceType enum, sourceId
  - debit, credit, narration
  - isReversed, reversalOf, createdBy
- [ ] Create receipt controller (order below)
- [ ] List receipts with filters (customer, date range, movementType, paymentStatus)
- [ ] Get one, populated with customer and product names
- [ ] Cancel receipt: status CANCELLED, reversing ledger entry, fix the balance
- [ ] Customer ledger endpoint
- [ ] Index: `ledgerEntrySchema.index({ customer: 1, date: 1 })`
- [ ] Index: `inventoryMovementSchema.index({ customer: 1, date: -1 })`

### Create receipt, exact order

1. Validate the customer exists and is active
2. For each item: `lineTotal = quantity * ratePerUnit`
3. `itemsSubtotal` = sum of all lineTotals
4. Calculate `commissionAmount` from `commissionType`
5. `chargesTotal` = sum of charges where `borneBy = CUSTOMER` **only**
6. Calculate `netAmount` and `direction` using the INWARD/OUTWARD rules
7. Set `amountSettled = 0`, `amountRemaining = netAmount`, `paymentStatus = UNPAID`
8. Save the receipt
9. Write a LedgerEntry row
10. Update `customer.currentBalance`

Steps 8, 9 and 10 belong together. Never do one without the others.

### Running balance is calculated, not stored

Do not put a `runningBalance` field on LedgerEntry. If anyone enters a backdated
receipt, every stored value after it silently becomes wrong.

Calculate it when you read the ledger: start from the opening balance and add each
debit and credit as you walk the sorted list.

### Done when

- [ ] An INWARD receipt matches your hand calculation
- [ ] An OUTWARD receipt for the same customer moves the balance the other way
- [ ] A third receipt leaves the running balance correct across all three
- [ ] Cancelling one puts the balance back exactly where it was

**If the balance is wrong here, stop and fix it. Do not build Phase 5 on broken maths.**

---

## Phase 5 - Payments

**Goal:** record money in and out, and settle receipts with it.

### Tasks

- [ ] Define `paymentBreakdownSchema` and `paymentAllocationSchema` at the top of
      `payment.model.js`
- [ ] `Payment` model:
  - voucherNumber (auto, unique), customer
  - direction enum: RECEIVED (money in), PAID (money out)
  - purpose enum: RECEIPT_SETTLEMENT, LOAN_DISBURSEMENT, LOAN_REPAYMENT, ON_ACCOUNT, ADVANCE
  - date, totalAmount
  - breakdowns (array of PaymentBreakdown)
  - allocations (array of PaymentAllocation)
  - unallocatedAmount, status enum, notes
  - `linkedPayment` (ref to another payment, nullable) - used in Phase 6
- [ ] Create payment controller (order below)
- [ ] List payments with filters
- [ ] Get one
- [ ] Cancel payment: reverse allocations, reverse ledger, fix balance
- [ ] Index: `paymentSchema.index({ customer: 1, date: -1 })`

### Create payment, exact order

1. Validate the two sum rules below
2. Save the payment
3. For each allocation, update that receipt's `amountSettled`, `amountRemaining`
   and `paymentStatus`
4. Write a LedgerEntry row
5. Update `customer.currentBalance`

### The two validation rules are different

| Rule | Why |
|---|---|
| `breakdowns` must sum to **exactly** `totalAmount` | Every rupee came from somewhere |
| `allocations` must sum to **at most** `totalAmount` | The remainder sits in `unallocatedAmount` as an advance |

### Why both are arrays

**`allocations`** - one payment of 100,000 can settle receipt A for 60,000 and receipt B
for 40,000. A single receipt reference cannot express that.

**`breakdowns`** - the customer pays 50,000 cash plus a 150,000 cheque in one go. One
payment, two breakdowns.

Do not simplify either to a single value. You will have to rewrite it.

### Done when

- [ ] A payment settling two receipts updates both correctly
- [ ] A payment with mismatched breakdowns is rejected
- [ ] An overpayment leaves the correct `unallocatedAmount`
- [ ] Cancelling a payment restores both the receipts and the balance

---

## Phase 6 - Loans

**Goal:** track money lent to a customer and repaid over time.

### Decide before you start

**Do these loans carry interest or a markup?** The schema has no interest field.
Confirm this with whoever knows the real business. Adding one after real loan records
exist is painful.

### Tasks

- [ ] `Loan` model: loanNumber (auto), customer, loanDate, principalAmount,
      repaidAmount, remainingAmount, expectedSettlementProduct, dueDate,
      status enum, disbursementPayment, notes
- [ ] Give loan: creates a Loan, a Payment (direction PAID) and a LedgerEntry
- [ ] Repay by cash or cheque: a Payment (direction RECEIVED) allocated to the loan
- [ ] Every repayment updates `repaidAmount`, `remainingAmount` and `status`
- [ ] List loans with filters (customer, status)
- [ ] Settle-from-crop flow (below)
- [ ] Index: `loanSchema.index({ customer: 1, status: 1 })`

### Status enum

ACTIVE, PARTIALLY_REPAID, CLOSED, WRITTEN_OFF

### The hard part - repaying a loan from crop proceeds

A customer brings wheat worth 200,000 and already owes 50,000 on a loan. Instead of
handing him 200,000 then collecting 50,000 back, the Aarti pays him 150,000 and closes
the loan.

**This is two payments, not one.** A single payment cannot satisfy both validation rules.

```
Receipt     INWARD, netAmount 200,000, direction PAYABLE

Payment A   direction PAID      totalAmount 200,000
  breakdowns:   CASH 150,000 + ADJUSTMENT 50,000     -> sums to 200,000  ✓
  allocations:  receipt 200,000                       -> receipt settled

Payment B   direction RECEIVED  totalAmount 50,000
  breakdowns:   ADJUSTMENT 50,000                     -> sums to 50,000   ✓
  allocations:  loan 50,000                           -> loan reduced
```

Cash that actually left the drawer: 150,000. The two ADJUSTMENT lines cancel each other
out. Both payments pass validation. The ledger stays balanced.

This is why `ADJUSTMENT` exists in the breakdown method enum.

- [ ] Set `linkedPayment` on both payments, pointing at each other
- [ ] Cancelling either one must cancel both

Without `linkedPayment`, nothing in the data says these two belong together, and
cancelling one would leave the loan reduced but the receipt unsettled.

### Done when

- [ ] Giving a loan increases what the customer owes
- [ ] A cash repayment reduces `remainingAmount` and eventually sets status CLOSED
- [ ] The settle-from-crop flow leaves the receipt settled, the loan closed, and the
      balance showing only the 150,000 that actually changed hands

---

## Phase 7 - Reports

**Goal:** the screens the Aarti looks at every day.

### Tasks

- [ ] Customer ledger: entries for one customer, date filter, running balance,
      opening and closing balance for the period
- [ ] Customer balance list: every customer, sorted by amount owed
- [ ] Outstanding receipts: paymentStatus UNPAID or PARTIAL
- [ ] Outstanding loans: status ACTIVE or PARTIALLY_REPAID
- [ ] Commission earned: date range, grouped by month
- [ ] Aarti's own expenses: sum of charges where `borneBy = AARTI`, same range
- [ ] Net profit: commission minus those expenses
- [ ] Daily summary: receipts in and out, money in and out, commission, for one day
- [ ] Stock summary: quantity purchased vs sold per product

### Why the expense report matters

Charges with `borneBy: AARTI` are correctly kept off the customer's bill. But if no
report sums them, your commission figure overstates what the business actually earned.
**Commission is revenue, not profit.**

### Build these with aggregation

This is where you learn `$match`, `$group`, `$lookup`, `$sort` and `$project` properly.

### Done when

- [ ] Every report matches a hand calculation on a small dataset
- [ ] Net profit is visibly lower than commission earned when AARTI charges exist

---

## Phase 8 - Data Integrity

**Goal:** stop the system producing numbers that do not add up.

### Tasks

- [ ] Apply your money-storage decision (rule 4) everywhere
- [ ] `recalculateBalance(customerId)` utility rebuilding the balance from ledger entries
- [ ] Reconciliation endpoint comparing `currentBalance` against the ledger sum
- [ ] Wrap multi-step writes (receipt + ledger + balance) in a transaction
- [ ] Validation layer on every create and update endpoint (express-validator or zod)
- [ ] Audit the codebase: confirm nothing posted can be hard deleted

### Transactions

Atlas runs as a replica set, so transactions work there. A plain local `mongod` does
not support them. If you ever run locally, start it as a single-node replica set.

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

### Done when

- [ ] Reconciliation reports zero mismatches across all customers
- [ ] Killing the server mid-receipt leaves no half-written data

---

## Phase 9 - Seed Data and Testing

**Goal:** realistic data to build the frontend against.

### Tasks

- [ ] Seed script: 1 admin user, 3 banks, 5 products, 10 customers
- [ ] Second script: 30 realistic receipts and payments across those customers
- [ ] Postman collection with every endpoint, organised by module
- [ ] Postman environment variables for base URL and token
- [ ] Pick one customer, add up his receipts and payments on paper, compare to the ledger

### Why bother

When you start the frontend you need data on screen. Clicking through Postman to create
30 records by hand every time you reset the database will waste hours.

### Done when

- [ ] One command resets and repopulates the whole database
- [ ] The hand calculation matches the ledger exactly

---

## Phase 10 - Backend Polish

**Goal:** everything deferred from earlier phases.

### Tasks

- [ ] Image uploads: Multer and Cloudinary for CNIC, cheques, transfer slips
- [ ] Signed or authenticated Cloudinary delivery
- [ ] `checkPermission(permission)` middleware, enforcing the permissions array
- [ ] Cheque clearance: mark CLEARED or BOUNCED, writing a reversing ledger entry on bounce
- [ ] Pagination on every list endpoint (`mongoose-aggregate-paginate-v2`)
- [ ] Rate limiting on login
- [ ] Request logging (morgan or winston)
- [ ] Input sanitisation against injection

### Private images

CNIC photos and cheque images are private legal documents, not public photos.
Cloudinary's default upload is readable by anyone holding the URL. Use signed URLs or
authenticated delivery so a leaked link does not expose someone's CNIC.

### Permissions enum

CUSTOMER_VIEW, CUSTOMER_MANAGE, PRODUCT_MANAGE, MOVEMENT_VIEW, MOVEMENT_MANAGE,
MOVEMENT_CANCEL, PAYMENT_VIEW, PAYMENT_MANAGE, LOAN_VIEW, LOAN_MANAGE, BANK_MANAGE,
REPORT_VIEW, USER_MANAGE

### Done when

- [ ] A DATA_ENTRY user cannot cancel a receipt
- [ ] A bounced cheque correctly reverses the customer's balance

---
---

# PART 2 - FRONTEND (React)

**Do not start until the backend works end to end in Postman.**

---

## Phase 11 - Frontend Setup

### Tasks

- [ ] Vite and React project
- [ ] Tailwind CSS
- [ ] React Router with a protected route wrapper
- [ ] Axios instance with base URL and token interceptor
- [ ] Redux Toolkit or Context for auth state
- [ ] Layout: sidebar, header, main content
- [ ] Toast notifications (react-hot-toast)

### Done when

- [ ] Hitting a protected route while logged out redirects to login

---

## Phase 12 - Core Screens

### Tasks

- [ ] Login page
- [ ] Dashboard: today's totals, total receivable, total payable, outstanding loans
- [ ] Customer list: searchable table with a balance column
- [ ] Add and edit customer form (react-hook-form)
- [ ] Customer detail page with ledger table
- [ ] User management: create employee, assign role, deactivate

### Done when

- [ ] You can log in, create a customer and see him in the list without touching Postman

---

## Phase 13 - The Receipt Screen

**The hardest screen in the project. Budget real time for it.**

### Tasks

- [ ] Customer picker with search
- [ ] Movement type toggle (INWARD / OUTWARD)
- [ ] Dynamic item rows: add, remove, pick product, enter quantity and rate
- [ ] Live `lineTotal` per row as the user types
- [ ] Live subtotal, commission and net amount
- [ ] Charges section with the `borneBy` toggle
- [ ] Save and print

### The rule for this screen

The frontend calculates totals **only for display**. On submit, send the raw items and
let the backend calculate everything again. Never save a total that came from the browser.

### Done when

- [ ] Typing a quantity updates the net amount instantly
- [ ] The saved receipt's totals match what was on screen
- [ ] Switching INWARD to OUTWARD flips the commission direction visibly

---

## Phase 14 - Payments and Loans Screens

### Tasks

- [ ] Payment form with dynamic breakdown rows (cash, cheque, bank, adjustment)
- [ ] Live check that breakdowns sum to the total, blocking save if they do not
- [ ] Allocation section listing that customer's unpaid receipts
- [ ] Running display of allocated vs total, so the user cannot over-allocate
- [ ] Loan list and give-loan form
- [ ] Loan repayment form
- [ ] Settle-from-crop flow, creating the two linked payments from Phase 6

### Done when

- [ ] A payment settling two receipts can be entered entirely from the UI
- [ ] The settle-from-crop flow works without the user understanding it is two payments

---

## Phase 15 - Reports and Printing

### Tasks

- [ ] Customer ledger screen with date filter and print button
- [ ] Printable receipt layout (A5, clean, Urdu labels where they help)
- [ ] Outstanding receipts report
- [ ] Outstanding loans report
- [ ] Commission and profit report
- [ ] Export to Excel for the main reports

### Who this is for

The real Aarti has used a paper register for 30 years. The screen must be simple,
readable in Urdu, print a receipt he can hand to the customer, and never show a balance
he disagrees with. **If he has to call you to understand a number, the software has
failed.**

### Done when

- [ ] A printed receipt is legible and complete on A5 paper
- [ ] Someone unfamiliar with the project can read a customer ledger unaided

---
---

# PART 3 - SHIPPING

---

## Phase 16 - Deployment

### Tasks

- [ ] Production environment variables set
- [ ] `NODE_ENV=production` so stack traces stop leaking
- [ ] Backend deployed (Render, Railway or a VPS)
- [ ] Frontend deployed (Vercel)
- [ ] CORS locked to the real frontend domain
- [ ] Atlas: IP access list, a database user with least privilege, backups enabled
- [ ] Automated daily backup
- [ ] Test the whole flow on the deployed version, not just locally

### Done when

- [ ] An error response in production contains no stack trace or file paths
- [ ] A request from an unknown origin is rejected

---

## Phase 17 - Before Showing a Real Aarti

### Tasks

- [ ] Create 50 or more realistic records and check every report
- [ ] Have someone else use it with no explanation from you
- [ ] Check every number against a hand calculation
- [ ] Confirm nothing crashes on empty states (no customers, no receipts)
- [ ] Write a one-page user guide in simple Urdu or Roman Urdu

### Done when

- [ ] Someone who has never seen the app can record a receipt without asking you how