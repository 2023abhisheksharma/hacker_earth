# ClaimGuard — Card Benefit Activation Engine

> **Never miss an insurance or protection benefit you've already paid for.**

ClaimGuard is an automated entitlement engine designed to detect, pre-fill, and automate protection claims for bundled Indian credit and debit card benefits (Purchase Protection, Return Protection, Travel Delay Cover, Lost Baggage Insurance, Extended Warranty, Air Accident Cover).

---

## 🚀 Key Features

- **Automated Benefit Detection**: Real-time scoring engine that checks transaction alerts (SMS/Email) against an entitlement catalog of 5 major Indian banks (**HDFC**, **ICICI**, **Axis**, **SBI Card**, **Kotak**).
- **1-Click Pre-filled Claims**: Auto-generates benefit-specific claim form schemas pre-populated with transaction dates, amounts, card details, merchant names, and incident descriptions.
- **Live Form Automation**: Uses Playwright & Socket.IO to navigate claim forms, fill inputs character-by-character, and stream progress live in a separate browser tab.
- **Document Management**: Drag-and-drop support for invoices, receipts, ID proofs, and account statements.
- **Privacy-First & Secure**: 
  - **Zero Credential Storage**: Bank portal logins are performed directly by the user; passwords and PINs are never stored.
  - **Intentional Submission Stop**: Automation prepares the form but stops before final submission, keeping the cardholder in complete control.

---

## 🛠️ Tech Stack

- **Frontend**: Next.js 16 (App Router), React 19, Tailwind CSS, Radix UI / Shadcn UI, Zustand, Lucide Icons.
- **Backend / Database**: Next.js API Routes, Prisma ORM, SQLite.
- **Automation Service**: Node.js / Bun, Playwright (Chromium), Socket.IO server.
- **Demo Claim Portal**: Standalone HTTP server for real-time live-filling visual feedback.

---

## 📂 Project Structure

```text
├── src/
│   ├── app/                # Next.js App Router pages and API routes
│   ├── components/         # React components (Dashboard, Automation, Uploads, Auth)
│   ├── lib/
│   │   ├── benefits/       # Entitlement catalog & detection engine
│   │   ├── parser/         # SMS & Email statement parsers
│   │   ├── prefill.ts      # Claim form pre-fill engine
│   │   ├── storage.ts      # Local document storage
│   │   └── types.ts        # Shared TypeScript domain types
│   └── store/              # Zustand global application store
├── mini-services/
│   ├── playwright-service/ # Playwright automation service & Socket.IO (Port 3004)
│   └── mock-portal/        # Claim form demo service (Port 3005)
├── prisma/                 # Database schema definitions
└── db/                     # SQLite database file
```

---

## 🚦 Getting Started

### Prerequisites
- **Node.js**: v18.0.0 or higher
- **npm** or **bun**

### 1. Installation
Clone the repository and install dependencies:
```bash
npm install
```

### 2. Install Playwright Chromium Browser
```bash
npx playwright install chromium
```

### 3. Database Setup
Sync the SQLite database schema:
```bash
npx prisma db push
```

### 4. Start Services

Run the application services:

```bash
# 1. Start the Claim Form Demo (Port 3005)
npx tsx mini-services/mock-portal/index.ts

# 2. Start the Playwright Automation Service (Port 3004)
npx tsx mini-services/playwright-service/index.ts

# 3. Start the Next.js Web App (Port 3000)
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## ☁️ Deployment Guide

### Deploying to Render.com (Recommended Free Hosting)
1. Push your code to GitHub.
2. Create a new **Web Service** on [Render](https://render.com).
3. Connect your repository.
4. Set Build Command: `npm install && npx prisma db push && npm run build`
5. Set Start Command: `npm run start`

---

## 📄 License

MIT License. Built for unlocking credit card benefits efficiently.
