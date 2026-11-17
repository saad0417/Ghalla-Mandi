# Ghalla Mandi Management System

A full-stack business management application designed to digitize and streamline the operations of a traditional Ghalla Mandi (grain market).

## Overview

The Ghalla Mandi Management System aims to provide a centralized platform for managing business operations, including customer records, crop transactions, inventory, financial activities, and account management.

The application is being developed to reduce manual record-keeping, improve data accuracy, and make day-to-day business operations more organized and efficient.

## Technology Stack

**Backend**
- Node.js
- Express.js
- MongoDB
- Mongoose
- JSON Web Token (JWT)

**Frontend**
- React.js
- To be implemented

## Core Modules

- **Authentication & Authorization** – Secure authentication and role-based access control.
- **Customer Management** – Customer profiles and account management.
- **Product Management** – Crop and product information management.
- **Bank Management** – Bank record management.
- **Inventory Management** – Tracking incoming and outgoing inventory.
- **Transaction Management** – Recording and managing business transactions.
- **Loan Management** – Managing customer loans and outstanding amounts.
- **Payment Management** – Recording and tracking payments.
- **Ledger Management** – Maintaining financial records and transaction history.
- **Reports & Dashboard** – Business insights and financial summaries.

## Project Architecture

The application follows a separated frontend and backend architecture.

```text
Ghalla-Mandi-System/
│
├── backend/
│
├── frontend/       # Planned
│
└── README.md
```

## Development Progress

The project is currently under active development, with backend implementation in progress.

- [x] Initial project setup
- [x] Authentication and user management
- [x] Product management
- [x] Bank management
- [ ] Customer management
- [ ] Transaction and receipt management
- [ ] Inventory management
- [ ] Loan and payment management
- [ ] Ledger and reporting
- [ ] Frontend development
- [ ] Full-stack integration and testing

## Getting Started

### Prerequisites

- Node.js
- npm
- MongoDB

### Installation

1. Clone the repository:

```bash
git clone YOUR_REPOSITORY_URL
```

2. Navigate to the backend directory:

```bash
cd Ghalla-Mandi-System/backend
```

3. Install dependencies:

```bash
npm install
```

4. Configure the required environment variables in your local `.env` file.

5. Start the development server using the available development script:

```bash
npm run dev
```

## Security

- Sensitive configuration values are managed through environment variables.
- Credentials and private configuration files should not be committed to version control.
- Authentication and authorization are implemented to protect application resources.

## Project Status

This project is actively being developed. The backend is currently under implementation, followed by frontend development and full-stack integration.

## License

All rights reserved. This project is currently maintained as a private development project.