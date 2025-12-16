<div align="center" style="display:flex;align-items:center;justify-content:center;">
<img src="public/logo.png" width="80px" alt="cashbook" />
<h1>Cashbook</h1>
</div>

<p align="center">
  <!-- <img alt="release" src="https://img.shields.io/github/v/release/silencezhoudev/cashbook-eh" /> -->
  <img alt="stars" src="https://img.shields.io/github/stars/silencezhoudev/cashbook-eh" />
  <img alt="forks" src="https://img.shields.io/github/forks/silencezhoudev/cashbook-eh" />
</p>
<p align="center">
  <!-- <img alt="issues-open" src="https://img.shields.io/github/issues/silencezhoudev/cashbook-eh?color=important" /> -->
  <!-- <img alt="issues-close" src="https://img.shields.io/github/issues-closed/silencezhoudev/cashbook-eh?color=green" /> -->
  <img alt="license" src="https://img.shields.io/badge/license-MIT-yellow.svg" />
  <a href="https://hub.docker.com/repository/docker/silencezhoudev/cashbook">
    <img alt="Docker Pulls" src="https://img.shields.io/docker/pulls/silencezhoudev/cashbook.svg" />
  </a>
</p>

## Overview

This project is a customized fork of the original [dingdangdog/cashbook](https://github.com/dingdangdog/cashbook).
I previously used Wacai (随手记) for personal bookkeeping, but for **data security** and **custom feature** needs, I built a second development on top of cashbook, focusing on **asset management overview** and other core features.
All charts and analysis views have been rebuilt to better fit my personal use cases.

> **Language**
>
> - English: current file `README.md`
> - 中文: see `README-zh_CN.md`

## Deployment

#### Prerequisites

- Docker and Docker Compose are installed

#### Quick Start

1. **Configure environment variables**

Copy `.env.example` in the project root to `.env`, then update values as needed:

```bash
cp .env.example .env
# Edit .env and change database password and other configs
```

⚠️ **Important**: In production, you **must** change all default passwords!

2. **Start services**

Enter the `docker` directory and start via Docker Compose:

```bash
cd docker
docker-compose up -d
```

3. **Access the app**

**For first-time use, you need to create an account:**

1. Open the admin panel: http://localhost:9090/admin
2. Log in with the default admin account:
   - Username: `admin`
   - Password: `admin`
3. Create a new user account in the admin panel
4. Use the new account to log in to the frontend at http://localhost:9090 for bookkeeping

⚠️ **Security Note**: In production, you **must** change the default admin password!

#### Notes

- **NUXT_DATA_PATH**: Path where the app stores uploaded files (such as receipt images).
  In the Docker container it defaults to `/app/data`, which is mapped via volumes to `docker/data` on the host.
- **Database data**: Stored under `docker/db`
- **Application data**: Stored under `docker/data`

#### Common commands

```bash
# View logs
docker-compose logs -f main

# Stop services
docker-compose down

# Stop and remove data volumes (⚠️ this will delete ALL data)
docker-compose down -v
```

## Screenshots

<details>
<summary>📸 Click to expand all screenshots (with test data)</summary>

<div align="center" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; margin-top: 20px;">
  <div>
    <h4>1. Calendar</h4>
    <img src="public/screenshots/1.日历.jpg" alt="Calendar" style="width: 100%; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);" />
  </div>
  <div>
    <h4>2. Accounts</h4>
    <img src="public/screenshots/2.账户.jpg" alt="Accounts" style="width: 100%; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);" />
  </div>
  <div>
    <h4>3. Asset Analysis</h4>
    <img src="public/screenshots/3.资产分析.jpg" alt="Asset Analysis" style="width: 100%; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);" />
  </div>
  <div>
    <h4>4. Income & Expense Analysis</h4>
    <img src="public/screenshots/4.收支分析.jpg" alt="Income & Expense Analysis" style="width: 100%; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);" />
  </div>
  <div>
    <h4>5. Statement Import</h4>
    <img src="public/screenshots/5.流水导入.jpg" alt="Statement Import" style="width: 100%; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);" />
  </div>
  <div>
    <h4>6. Statement Aggregation</h4>
    <img src="public/screenshots/6.流水收拢.jpg" alt="Statement Aggregation" style="width: 100%; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1);" />
  </div>
</div>
</details>

## Major Feature Additions

### Enhanced Asset Management ⭐ **Core Enhancement**

- [X] Introduced the concept of **Included-in-Total-Assets**
- [X] Monthly asset accumulation chart enhancements:
  - [X] Account filter switch (all accounts / only those included in total assets)
  - [X] Annual growth amount display
  - [X] Optimized calculation logic (distinguishing income/expense, transfer, lending/borrowing)
- [X] Multi-book asset statistics (support aggregating multiple books)

### Account Management ⭐ **Core New Feature**

- [X] Dedicated account management page
- [X] Account overview, list, operations, and details
- [X] Transfers between accounts
- [X] Account balance calibration
- [X] View account transaction history
- [X] **Fully independent from books** (accounts are user-level global resources)

### Other Enhancements

- [X] Data analysis page
  - [X] Support for multi-book mode
  - [X] Enhanced monthly asset accumulation chart
  - [X] Multi-book monthly asset accumulation chart
  - [X] Income/expense bar chart for the selected month
  - [X] Secondary expense category pie chart
  - [X] Single-level category books automatically treated as first-level categories
  - [X] Annual growth amount display
  - [X] Improved chart interaction experience
- [X] Transaction (flow) management page
  - [X] Support for lending/borrowing and transfer type transactions
  - [X] Import from Wacai (随手记)
  - [X] Enhanced batch and filtering features
- [X] Calendar page
  - [X] Multi-book calendar support
  - [X] Enhanced income/expense statistics
  - [X] Monthly transaction details
- [X] Enhanced data import
  - [X] Support importing Wacai (随手记) Excel files
  - [X] Stronger validation when importing book data
  - [X] Conflict detection for imported data

## TODO / Planned Features

- [X] Introduce AI for automatic bill categorization (local AI quality was not good; now using a rule engine instead)
- [ ] More dimensions for asset analysis
- [ ] Support for more import formats
- [ ] Better frontend interaction for lending/borrowing features
- [ ] Performance optimizations for multi-book features
- [ ] Batch operations for account management

### Book Dependency Summary

| Page / Feature        | Depends on Book?       | Notes                                                                 |
| --------------------- | ---------------------- | ---------------------------------------------------------------------- |
| Account Management    | ❌ **No**              | Accounts are user-level global resources                               |
| Unified Transfer Mgmt | ⚠️ **Partially**       | Transfer records are linked to books, but the page is account-centric  |
| Transaction Mgmt      | ✅ **Yes**             | All transactions must be linked to a book                              |
| Data Analysis         | ❌ **No**              | Single-level books are auto-upgraded to first-level expense categories |
| Calendar              | ✅ **Yes**             | Supports both single-book and multi-book modes                         |
| Budget Mgmt           | ✅ **Yes**             | Budgets are linked to books                                            |
| Receivable Mgmt       | ✅ **Yes**             | Receivables are linked to books                                        |
| Type Mgmt             | ✅ **Yes**             | Type configuration is linked to books                                  |
| Book Mgmt             | ✅ **Yes**             | The book management page itself                                        |

## Version Info

- **Upstream project version**: 4.3.7
- **Current version**: eh-1.4.1

> The version number is centralized in the root `app.version` file (or can be overridden via the `APP_VERSION` environment variable).
> Docker builds, Swagger, Nuxt runtime, etc. all read the version from there — you only need to update it in one place.

**Important**: If you deploy this app to the public internet, please make sure to change all relevant environment variables!!!
(e.g. admin credentials, database password, etc.)

**Last updated**: 2025-12-16  
**Based on**: [dingdangdog/cashbook v4.3.7](https://github.com/dingdangdog/cashbook)
