# 📊 Quant Developer Evaluation Assignment --- GEMSCAP

## 🚀 Overview

This project is a **real-time analytical web app** developed for the **Quant Developer Evaluation Assignment** by **GEMSCAP**.
It demonstrates an **end-to-end system** from **data ingestion** (live and file-based) to **quantitative analytics**, **alerting**, and **interactive visualization**.

The system is built with a **Python/Starlette backend** and a **vanilla HTML/CSS/Plotly.js frontend**, simulating a quant research environment. It allows users to analyze statistical relationships between asset pairs by computing hedge ratios, spreads, Z-scores, and stationarity tests from aggregated time-series data.

---

## 🧠 Core Features Implemented

### ⚙️ Backend (Python + Starlette + MongoDB)

* **REST API & WebSocket Endpoints:** Built with the high-performance **Starlette** ASGI framework to handle analytics requests, file uploads, and alert management.
* **Data Ingestion:**
    * **Live Collection:** A WebSocket-based service (stubbed in the UI) to start/stop live data collection.
    * **File Upload:** Accepts and processes historical tick data from **NDJSON** files.
* **Data Storage:** Uses **MongoDB** (via `pymongo`) to store and query tick data and analytics results.
* **Time-Series Aggregation (`dataprocessing.py`):** Dynamically aggregates raw tick data into **OHLC bars** for any given timeframe (1s, 1m, 5m).
* **Analytics Engine (`anylistic.py`):**
    * Computes **OLS Regression** (pure Python) to find the **Hedge Ratio** and **R²**.
    * Calculates the pair's **Spread** and **Rolling Z-Score**.
    * Runs a simplified **ADF Test** for spread stationarity.
    * Calculates **Rolling Correlation**.
* **Alert Service (`alret.py`):** A lightweight, in-memory service for creating and checking Z-Score based alerts.
* **Data Export:** Provides an endpoint to download computed analytics as a **CSV file**.

### 🖥️ Frontend (HTML + CSS + Plotly.js)

* **Dynamic Dashboard:** A clean, dark-themed UI built with semantic HTML and modern CSS.
* **Interactive Visualizations (Plotly.js):**
    * **Price Comparison:** Plots the resampled close prices of Symbol X and Symbol Y.
    * **Spread & Z-Score:** Visualizes the calculated spread and its Z-score over time.
    * **Rolling Correlation:** Shows the rolling correlation between the two assets.
* **Data Controls:**
    * Start/Stop live data collection.
    * Upload NDJSON data files.
* **Analytics Controls:**
    * Select Symbol X and Symbol Y.
    * Choose timeframe (1s, 1m, 5m) and rolling window size.
    * Trigger analytics computation, ADF test, and CSV export.
* **Alert Management:**
    * UI for creating Z-Score threshold alerts (e.g., `Z-Score > 2.0`).
    * Displays a list of active alerts.

---

## 🧩 System Architecture

### 🧱 Components

1.  **Frontend (HTML/CSS + Plotly.js)**: The user's interface for controlling the system and viewing analytics. (Client-side logic is referenced in `index.html` via `<script>` tags).
2.  **Backend (Python + Starlette)**: Serves the frontend and provides API/WebSocket endpoints for all data operations.
3.  **Database (MongoDB)**: Persists raw tick data uploaded or collected.
4.  **Data Processor (`dataprocessing.py`)**: A Python module for aggregating tick data into OHLC bars.
5.  **Analytics Engine (`anylistic.py`)**: A pure-Python module for all statistical calculations.
6.  **Alert Service (`alret.py`)**: An in-memory Python class for managing alert definitions.

### 📈 Flow Diagram

1.  **Data Input:** User either **uploads an NDJSON file** or **starts live collection**.
2.  **Storage:** Data is sent to the **Starlette backend** and saved in **MongoDB**.
3.  **Analytics Request:** User selects symbols (X, Y), timeframe, and window, then clicks "Compute."
4.  **Backend Processing:**
    * The backend queries **MongoDB** for raw ticks for Symbol X and Y.
    * `dataprocessing.py` aggregates the ticks into aligned OHLC bars (e.g., 1-minute).
    * `anylistic.py` runs all calculations (Hedge Ratio, Spread, Z-Score) on the aggregated bars.
5.  **Response:** The backend sends the computed analytics (stats + chart data) as JSON to the frontend.
6.  **Visualization:** Client-side JavaScript (referenced in `index.html`) passes the data to **Plotly.js**, which renders the interactive charts.
7.  **Alerts:** `alret.py` checks the latest Z-score against user-defined rules.

---

## 🧮 Key Files Description

| File | Description |
| :--- | :--- |
| `pybackend/server.py` | (Assumed) Main Starlette application file. Defines API routes and WebSocket endpoints. |
| `pybackend/anylistic.py` | **Core analytics engine.** Contains all pure-Python math for OLS, spread, Z-score, correlation, and ADF test. |
| `pybackend/dataprocessing.py` | Handles time-series aggregation. Converts tick lists into OHLC bars (1s, 1m, 5m). |
| `pybackend/alret.py` | In-memory store (`AlertsStore`) for creating, removing, and checking Z-score alerts. |
| `pybackend/db.py` | Manages the **MongoDB** connection and provides a `get_db()` helper. |
| `index.html` | The main dashboard UI, including all controls, stats boxes, and Plotly chart containers. |
| `style.css` | All custom styling for the dark-mode dashboard UI. |
| `requirements.txt` | Lists all Python dependencies (`starlette`, `uvicorn`, `pymongo`). |
| `run_backend` | Example script for setting environment variables and running the Uvicorn server. |

---

## 🧰 Tech Stack

| Layer | Technology |
| :--- | :--- |
| **Backend** | Python, Starlette (ASGI), Uvicorn |
| **Frontend** | HTML, CSS, JavaScript |
| **Visualization** | Plotly.js |
| **Database** | MongoDB |
| **Data Source** | NDJSON File Upload, Live WebSocket (planned) |
| **Analytics** | Pure Python (no external math/stats libraries) |

---

## 🧪 Setup Instructions

### 🔧 Prerequisites

* Python (v3.8+)
* MongoDB (running locally or on a server)
* `pip` for package management

### ⚙️ Installation Steps

1.  Clone the repository:
    ```bash
    git clone [https://github.com/yourusername/gemscap-assignment.git](https://github.com/yourusername/gemscap-assignment.git)
    cd gemscap-assignment
    ```

2.  Install Python dependencies:
    ```bash
    python -m pip install -r requirements.txt
    ```

3.  Set environment variables for the database. (Make sure MongoDB is running!)
    *(Use `set` on Windows CMD)*
    ```bash
    export MONGODB_DB='gemscap'
    export MONGODB_URI='mongodb://localhost:27017'
    ```

4.  Run the backend server using Uvicorn:
    ```bash
    python -m uvicorn pybackend.server:app --host 0.0.0.0 --port 8080
    ```

5.  Open your browser and navigate to:
    **`http://localhost:8080`**

---

## 📊 Example APIs

*(Inferred from the application structure)*

### Compute Analytics

```bash
POST /api/analyze
{
  "symbolX": "BTCUSDT",
  "symbolY": "ETHUSDT",
  "timeframe": "1m",
  "window": 30
}
``` 

### ➕ Add Alert
``` bash
POST /api/alerts
{
  "symbolX": "BTCUSDT",
  "symbolY": "ETHUSDT",
  "threshold": 2.0,
  "operator": "gt"
}
```

### 📋 Get All Alerts
``` bash
GET /api/alerts
```
### Run ADF Test
``` bash
POST /api/adf
{
  "symbolX": "BTCUSDT",
  "symbolY": "ETHUSDT",
  "timeframe": "1m",
  "window": 30
}
```

------------------------------------------------------------------------

## 💡 Analytics Implemented

### 📈 Core Formulas

- **Spread**  
  \[
  \text{Spread} = \text{Price(Y)} - \text{HedgeRatio} \times \text{Price(X)}
  \]  
  Represents the deviation between the two correlated assets.

- **OLS Regression**  
  \[
  \text{HedgeRatio} = \text{slope from linear fit of Y over X}
  \]  
  Ordinary Least Squares (OLS) regression is used to estimate the hedge ratio between asset pairs.

- **Z-Score**  
  \[
  Z = \frac{\text{Spread} - \text{RollingMean(Spread)}}{\text{RollingStdDev(Spread)}}
  \]  
  Indicates how far the current spread deviates from its rolling mean in standard deviation units.

- **Rolling Correlation**  
  \[
  \rho = \text{PearsonCorrelation}(X, Y) \text{ over a moving window}
  \]  
  Measures the short-term correlation strength between the two assets.

- **ADF Test (Augmented Dickey-Fuller)**  
  A simplified test for **stationarity**, used to determine whether the spread is **mean-reverting** — a key property for statistical arbitrage strategies.

------------------------------------------------------------------------

## 🧠 ChatGPT Usage Transparency

ChatGPT was used to assist in:
- Explaining backend implementation doubts and handling issues during development  
- Drafting and refining frontend structure and layout ideas  

Prompts included requests like:
- “Explain how to connect backend with MongoDB using Python”  
- “Help design a simple HTML/CSS dashboard for analytics visualization”   

------------------------------------------------------------------------

## 🏁 Outcome & Reflection
This project demonstrates an end-to-end quantitative analytics pipeline capable of:
- Handling file-based and live data ingestion
- Running real-time statistical computations
- Managing custom user alerts
- Presenting intuitive interactive visualizations

------------------------------------------------------------------------

### 🎥 Project Demo

[Watch the full demo (MP4 file)](./assets/demo.mp4)

------------------------------------------------------------------------

**Author:** Shubham Asole\
**Role:** Quant Developer Assignment Submission --- GEMSCAP GLOBAL\
**Date:** November 2025