# 📊 Quant Developer Evaluation Assignment --- GEMSCAP

## 🚀 Overview

This project is a **real-time analytical web app** developed for the
**Quant Developer Evaluation Assignment** by **GEMSCAP**.
It demonstrates an **end-to-end system** from **real-time Binance tick
data ingestion** to **quantitative analytics**, **alerting**, and
**interactive visualization**.

The system simulates a **quant research environment**, allowing traders
and researchers to visualize, analyze, and monitor statistical
relationships between crypto pairs in real time.

------------------------------------------------------------------------

## 🧠 Core Features Implemented

### ⚙️ Backend (Node.js + Express)

-   **WebSocket Integration:** Ingests real-time tick data from Binance
    (symbol, timestamp, price, quantity).
-   **Data Sampling:** Data can be resampled for timeframes (1s, 1m, 5m)
    as per requirement.
-   **Analytics Engine:**
    -   Computes **Price Statistics** (mean, variance, rolling stats)
    -   **Spread & Z-Score Calculation**
    -   **OLS Regression** for hedge ratio estimation
    -   **ADF Test (Stationarity Check)**
    -   **Rolling Correlation**
-   **Alert Service:** Users can define custom alerts (e.g.,
    `z-score > 2`) through REST API endpoints.
-   **Data Export:** Processed data and analytics can be downloaded as
    CSV/JSON.

### 🖥️ Frontend (HTML + JS )

-   Real-time charts displaying:
    -   **Price Movements** of symbol pairs (X/Y)
    -   **Spread & Z-Score Trends**
    -   **Correlation Plots**
-   Interactive controls for:
    -   Symbol selection
    -   Timeframe selection (1s, 1m, 5m)
    -   Rolling window size
    -   Regression and ADF test triggers
-   Supports zoom, hover, and pan interactions.

### 🔔 Alert Management

Users can create, view, and delete alerts: - Example alert: "Z-score >
2" - Alerts trigger when real-time data satisfies the condition.

### 📦 Data Export

-   Allows downloading analytics and processed data in CSV format.

------------------------------------------------------------------------

## 🧩 System Architecture

### 🧱 Components

1.  **Frontend (HTML + JS )** --- Visualization and user
    interaction.
2.  **Backend (Express.js)** --- Data routing, API endpoints, and alert
    service.
3.  **Alert Service (Node class)** --- Handles all alert logic,
    validation, and triggers.
4.  **Binance WebSocket Handler** --- Real-time tick ingestion and
    analytics computation.

### 📈 Flow Diagram

1.  Binance WebSocket → Ingestion
2.  Data Processing → Sampling & Analytics
3.  Alert Engine → Monitors threshold conditions
4.  API → Exposes data and alerts to Frontend
5.  Frontend Dashboard → Visualization and Control

------------------------------------------------------------------------

## 🧮 Key Files Description

  ------------------------------------------------------------------------------
  File                         Description
  ---------------------------- -------------------------------------------------
  `server.js`                  Initializes Express server and WebSocket
                               connection

  `routes/alertRoutes.js`      REST routes for managing alerts

  `services/alertService.js`   Core alert logic, creation, validation,
                               triggering

  `public/index.html`          Frontend dashboard with Chart.js visualizations

  `public/script.js`           Handles WebSocket and chart updates
  ------------------------------------------------------------------------------

------------------------------------------------------------------------

## 🧰 Tech Stack

  -----------------------------------------------------------------------
  Layer                    Technology
  ------------------------ ----------------------------------------------
  **Backend**              Node.js, Express.js

  **Frontend**             HTML, CSS, JavaScript

  **Data Source**          Binance WebSocket

  **Analytics**            Statistical computations using JavaScript Math
                           libraries
  -----------------------------------------------------------------------

------------------------------------------------------------------------

## 🧪 Setup Instructions

### 🔧 Prerequisites

-   Node.js (v18+)
-   npm or yarn

### ⚙️ Installation Steps

``` bash
git clone https://github.com/asoleshubham0125/Shubham_Asole_EC22B1036.git
cd Shubham_Asole_EC22B1036
npm install
node server.js
```

Then open `http://localhost:3000` in your browser.

------------------------------------------------------------------------

## 📊 Example APIs

### ➕ Add Alert

``` bash
POST /api/alerts
{
  "symbolX": "BTCUSDT",
  "symbolY": "ETHUSDT",
  "metric": "zscore",
  "operator": "gt",
  "threshold": 2,
  "message": "Z-score exceeds threshold"
}
```

### 🗑️ Delete Alert

``` bash
DELETE /api/alerts/1
```

### 📋 Get All Alerts

``` bash
GET /api/alerts
```

------------------------------------------------------------------------

## 🧠 ChatGPT Usage Transparency

ChatGPT was used to assist in: - Structuring project architecture
- Structuring the project architecture
- Building a simple and responsive frontend layout
- Understanding and resolving backend and integration errors

Prompts included requests like: - 
- Help design a minimal frontend layout for analytics visualization
- Debug and resolve common Node.js and MongoDB errors
------------------------------------------------------------------------

## 🏁 Outcome & Reflection

This project demonstrates an **end-to-end quantitative analytics
pipeline** capable of: - Handling **live data ingestion** - Running
**real-time statistical computations** - Managing **custom user
alerts** - Presenting **intuitive interactive visualizations**

It satisfies **all key deliverables** in the assignment:
✅ Backend Data Pipeline\
✅ Frontend Visualization\
✅ Live Analytics Updates\
✅ Custom Alerts\
✅ Export Options\
✅ Clear Documentation & Architecture\

------------------------------------------------------------------------

**Author:** Shubham Asole\
**Role:** Quant Developer Assignment Submission --- GEMSCAP Global\
**Date:** November 2025
