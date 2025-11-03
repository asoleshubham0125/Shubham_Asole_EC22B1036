// Global state
let currentAnalytics = null;
let wsConnection = null;
let binanceSockets = [];
let collectedData = [];
let collectionRunning = false;

// Initialize WebSocket connection
function initWebSocket() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}`;
    
    wsConnection = new WebSocket(wsUrl);
    
    wsConnection.onopen = () => {
        console.log('WebSocket connected');
        showNotification('Connected to live data stream');
    };
    
    wsConnection.onmessage = (event) => {
        try {
            const data = JSON.parse(event.data);
            if (data.type === 'analytics') {
                updateDashboard(data.payload);
            } else if (data.type === 'alert') {
                showNotification(`🚨 Alert: ${data.message}`);
            }
        } catch (error) {
            console.error('WebSocket message error:', error);
        }
    };
    
    wsConnection.onerror = (error) => {
        console.error('WebSocket error:', error);
    };
    
    wsConnection.onclose = () => {
        console.log('WebSocket disconnected');
        setTimeout(initWebSocket, 3000); // Reconnect after 3 seconds
    };
}

// File upload handler
document.getElementById('uploadBtn').addEventListener('click', async () => {
    const fileInput = document.getElementById('fileInput');
    const file = fileInput.files[0];
    
    if (!file) {
        showNotification('Please select a file first', 'error');
        return;
    }
    
    const formData = new FormData();
    formData.append('file', file);
    
    try {
        const response = await fetch('/api/upload/upload', {
            method: 'POST',
            body: formData
        });
        
        const result = await response.json();
        
        if (response.ok) {
            document.getElementById('uploadStatus').innerHTML = `
                <div style="color: #10b981;">
                    ✓ Uploaded ${result.count} ticks<br>
                    Symbols: ${result.symbols.join(', ')}
                </div>
            `;
            showNotification('Data uploaded successfully!');
            fileInput.value = '';
        } else {
            showNotification('Upload failed: ' + result.error, 'error');
        }
    } catch (error) {
        showNotification('Upload error: ' + error.message, 'error');
    }
});

// Analyze button handler
document.getElementById('analyzeBtn').addEventListener('click', async () => {
    const symbolX = document.getElementById('symbolX').value.toUpperCase();
    const symbolY = document.getElementById('symbolY').value.toUpperCase();
    const timeframe = document.getElementById('timeframe').value;
    const window = document.getElementById('window').value;
    
    if (!symbolX || !symbolY) {
        showNotification('Please enter both symbols', 'error');
        return;
    }
    
    document.getElementById('analyzeBtn').disabled = true;
    document.getElementById('analyzeBtn').textContent = 'Analyzing...';
    
    try {
        const response = await fetch(
            `/api/analytics/analyze?symbolX=${symbolX}&symbolY=${symbolY}&timeframe=${timeframe}&window=${window}`
        );
        
        const result = await response.json();
        
        if (response.ok) {
            currentAnalytics = result;
            updateDashboard(result);
            showNotification('Analytics computed successfully!');
        } else {
            showNotification('Analysis failed: ' + result.error, 'error');
        }
    } catch (error) {
        showNotification('Analysis error: ' + error.message, 'error');
    } finally {
        document.getElementById('analyzeBtn').disabled = false;
        document.getElementById('analyzeBtn').textContent = 'Compute Analytics';
    }
});

// Export CSV button
document.getElementById('exportBtn').addEventListener('click', async () => {
    const symbolX = document.getElementById('symbolX').value.toUpperCase();
    const symbolY = document.getElementById('symbolY').value.toUpperCase();
    const timeframe = document.getElementById('timeframe').value;
    
    try {
        const response = await fetch(
            `/api/analytics/export?symbolX=${symbolX}&symbolY=${symbolY}&timeframe=${timeframe}`
        );
        
        if (response.ok) {
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `analytics_${symbolX}_${symbolY}.csv`;
            a.click();
            showNotification('CSV downloaded!');
        } else {
            showNotification('Export failed', 'error');
        }
    } catch (error) {
        showNotification('Export error: ' + error.message, 'error');
    }
});

// ADF Test button
document.getElementById('adfBtn').addEventListener('click', async () => {
    const symbolX = document.getElementById('symbolX').value.toUpperCase();
    const symbolY = document.getElementById('symbolY').value.toUpperCase();
    const timeframe = document.getElementById('timeframe').value;
    
    try {
        const response = await fetch('/api/analytics/adf-test', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ symbolX, symbolY, timeframe })
        });
        
        const result = await response.json();
        
        if (response.ok) {
            alert(`ADF Test Results:\n\n` +
                  `ADF Statistic: ${result.adfResult.adf.toFixed(4)}\n` +
                  `P-Value: ${result.adfResult.pValue.toFixed(4)}\n` +
                  `Stationary: ${result.adfResult.stationary ? 'Yes' : 'No'}\n` +
                  `Message: ${result.adfResult.message}\n\n` +
                  `Hedge Ratio: ${result.hedgeRatio.toFixed(4)}`);
        } else {
            showNotification('ADF test failed: ' + result.error, 'error');
        }
    } catch (error) {
        showNotification('ADF test error: ' + error.message, 'error');
    }
});

// Create alert button
document.getElementById('createAlertBtn').addEventListener('click', async () => {
    const symbolX = document.getElementById('symbolX').value.toUpperCase();
    const symbolY = document.getElementById('symbolY').value.toUpperCase();
    const threshold = parseFloat(document.getElementById('alertThreshold').value);
    const operator = document.getElementById('alertOperator').value;
    
    try {
        const response = await fetch('/api/alerts/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                symbolX,
                symbolY,
                metric: 'zscore',
                operator,
                threshold,
                message: `Z-Score ${operator} ${threshold}`
            })
        });
        
        const result = await response.json();
        
        if (response.ok) {
            showNotification('Alert created!');
            loadAlerts();
        } else {
            showNotification('Failed to create alert: ' + result.error, 'error');
        }
    } catch (error) {
        showNotification('Create alert error: ' + error.message, 'error');
    }
});

// Load alerts
async function loadAlerts() {
    try {
        const response = await fetch('/api/alerts/');
        const alerts = await response.json();
        
        const alertsList = document.getElementById('alertsList');
        
        if (alerts.length === 0) {
            alertsList.innerHTML = '<div style="color: #9ca3af; text-align: center;">No alerts configured</div>';
            return;
        }
        
        alertsList.innerHTML = alerts.map(alert => `
            <div class="alert-item">
                <strong>${alert.symbolX}/${alert.symbolY}</strong><br>
                Z-Score ${alert.operator} ${alert.threshold}<br>
                <button class="danger small-button" onclick="deleteAlert(${alert.id})">Delete</button>
            </div>
        `).join('');
    } catch (error) {
        console.error('Load alerts error:', error);
    }
}

// Delete alert
async function deleteAlert(id) {
    try {
        const response = await fetch(`/api/alerts/${id}`, { method: 'DELETE' });
        if (response.ok) {
            showNotification('Alert deleted');
            loadAlerts();
        }
    } catch (error) {
        showNotification('Delete alert error: ' + error.message, 'error');
    }
}

// Update dashboard with analytics data
function updateDashboard(data) {
    if (!data.analytics) return;
    
    const analytics = data.analytics;
    
    // Update stats
    document.getElementById('hedgeRatio').textContent = analytics.hedgeRatio.toFixed(4);
    document.getElementById('r2').textContent = analytics.hedgeR2.toFixed(4);
    document.getElementById('spreadMean').textContent = analytics.spread[analytics.spread.length - 1].spread.toFixed(2);
    document.getElementById('currentZScore').textContent = analytics.spread[analytics.spread.length - 1].zScore.toFixed(2);
    document.getElementById('dataPoints').textContent = data.dataPoints;
    
    // Calculate correlation
    if (analytics.rollingCorrelation.length > 0) {
        const latestCorr = analytics.rollingCorrelation[analytics.rollingCorrelation.length - 1].correlation;
        document.getElementById('correlation').textContent = latestCorr.toFixed(4);
    }
    
    // Create price chart
    if (data.priceData && data.priceData.times.length > 0) {
        const times = data.priceData.times;
        
        const priceTrace1 = {
            x: times,
            y: data.priceData.xPrices,
            type: 'scatter',
            mode: 'lines',
            name: `${data.symbolX}`,
            line: { color: '#3b82f6' }
        };
        
        const priceTrace2 = {
            x: times,
            y: data.priceData.yPrices,
            type: 'scatter',
            mode: 'lines',
            name: `${data.symbolY}`,
            line: { color: '#8b5cf6' },
            yaxis: 'y2'
        };
        
        Plotly.newPlot('priceChart', [priceTrace1, priceTrace2], {
            title: `${data.symbolX} vs ${data.symbolY}`,
            paper_bgcolor: 'rgba(0,0,0,0)',
            plot_bgcolor: 'rgba(0,0,0,0.3)',
            font: { color: '#e0e6ed' },
            xaxis: { title: 'Time' },
            yaxis: { title: `${data.symbolX} Price`, side: 'left' },
            yaxis2: { title: `${data.symbolY} Price`, side: 'right', overlaying: 'y' }
        });
    }
    
    // Create spread & z-score chart
    if (analytics.spread && analytics.spread.length > 0) {
        const times = analytics.spread.map(s => s.time);
        const spreads = analytics.spread.map(s => s.spread);
        const zScores = analytics.spread.map(s => s.zScore);
        
        const spreadTrace = {
            x: times,
            y: spreads,
            type: 'scatter',
            mode: 'lines',
            name: 'Spread',
            line: { color: '#60a5fa' },
            yaxis: 'y'
        };
        
        const zScoreTrace = {
            x: times,
            y: zScores,
            type: 'scatter',
            mode: 'lines',
            name: 'Z-Score',
            line: { color: '#f59e0b' },
            yaxis: 'y2'
        };
        
        Plotly.newPlot('spreadChart', [spreadTrace, zScoreTrace], {
            title: 'Spread & Z-Score',
            paper_bgcolor: 'rgba(0,0,0,0)',
            plot_bgcolor: 'rgba(0,0,0,0.3)',
            font: { color: '#e0e6ed' },
            xaxis: { title: 'Time' },
            yaxis: { title: 'Spread', side: 'left' },
            yaxis2: { title: 'Z-Score', side: 'right', overlaying: 'y' }
        });
    }
    
    // Create rolling correlation chart
    if (analytics.rollingCorrelation && analytics.rollingCorrelation.length > 0) {
        const times = analytics.rollingCorrelation.map(r => r.time || r.index);
        const correlations = analytics.rollingCorrelation.map(r => r.correlation);
        
        const corrTrace = {
            x: times,
            y: correlations,
            type: 'scatter',
            mode: 'lines',
            name: 'Rolling Correlation',
            line: { color: '#10b981' }
        };
        
        Plotly.newPlot('correlationChart', [corrTrace], {
            title: 'Rolling Correlation',
            paper_bgcolor: 'rgba(0,0,0,0)',
            plot_bgcolor: 'rgba(0,0,0,0.3)',
            font: { color: '#e0e6ed' },
            xaxis: { title: 'Index' },
            yaxis: { title: 'Correlation' }
        });
    }
}

// Show notification
function showNotification(message, type = 'success') {
    const notification = document.createElement('div');
    notification.className = 'notification';
    notification.style.background = type === 'error' ? '#ef4444' : '#10b981';
    notification.textContent = message;
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.remove();
    }, 3000);
}

// Binance WebSocket Collector
function normalizeBinanceTick(j) {
    const ts = new Date(j.T || j.E).toISOString();
    return { symbol: j.s, ts, price: Number(j.p), size: Number(j.q) };
}

async function startBinanceCollector() {
    if (collectionRunning) return;
    
    const symbolsInput = document.getElementById('collectSymbols').value;
    const symbols = symbolsInput.split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
    
    if (!symbols.length) {
        showNotification('Please enter at least one symbol', 'error');
        return;
    }
    
    collectionRunning = true;
    collectedData = [];
    
    const statusDiv = document.getElementById('collectorStatus');
    statusDiv.innerHTML = `<div style="color: #60a5fa;"> Connecting to Binance...</div>`;
    
    document.getElementById('startCollectorBtn').style.display = 'none';
    document.getElementById('stopCollectorBtn').style.display = 'inline-block';
    document.getElementById('saveDataBtn').style.display = 'none';
    
    // Connect to each symbol WebSocket
    binanceSockets = symbols.map(symbol => {
        const url = `wss://fstream.binance.com/ws/${symbol}@trade`;
        const ws = new WebSocket(url);
        
        ws.onopen = () => {
            console.log(`Binance WS connected: ${symbol}`);
            statusDiv.innerHTML = `<div style="color: #10b981;">✓ Live collecting ${symbols.length} symbol(s)... (${collectedData.length} ticks)</div>`;
        };
        
        ws.onmessage = (ev) => {
            try {
                const j = JSON.parse(ev.data);
                if (j.e === 'trade') {
                    collectedData.push(normalizeBinanceTick(j));
                    statusDiv.innerHTML = `<div style="color: #10b981;">✓ Live collecting ${symbols.length} symbol(s)... (${collectedData.length} ticks)</div>`;
                    
                    // Show save button after collecting data
                    if (collectedData.length > 10) {
                        document.getElementById('saveDataBtn').style.display = 'inline-block';
                    }
                }
            } catch (e) {
                console.error('Parse error:', e);
            }
        };
        
        ws.onclose = (ev) => {
            console.log(`Binance WS closed ${symbol} code=${ev.code}`);
        };
        
        ws.onerror = (ev) => {
            console.error(`Binance WS error ${symbol}`, ev);
        };
        
        return ws;
    });
    
    showNotification('Started collecting live data from Binance!');
}

function stopBinanceCollector() {
    if (!collectionRunning) return;
    
    binanceSockets.forEach(ws => {
        try { ws.close(1000, 'user stop'); } catch(e) {}
    });
    
    binanceSockets = [];
    collectionRunning = false;
    
    document.getElementById('startCollectorBtn').style.display = 'inline-block';
    document.getElementById('stopCollectorBtn').style.display = 'none';
    
    const statusDiv = document.getElementById('collectorStatus');
    statusDiv.innerHTML = `<div style="color: #f59e0b;">⏸ Stopped. Collected ${collectedData.length} ticks.</div>`;
    
    showNotification('Stopped collection');
}

async function saveCollectedData() {
    if (collectedData.length === 0) {
        showNotification('No data to save', 'error');
        return;
    }
    
    try {
        // Convert collected data to NDJSON format
        const ndjson = collectedData.map(x => JSON.stringify(x)).join('\n');
        const blob = new Blob([ndjson], { type: 'application/json' });
        const formData = new FormData();
        formData.append('file', blob, `ticks_${new Date().toISOString().replaceAll(':', '-')}.ndjson`);
        
        console.log(`Saving ${collectedData.length} ticks to server...`);
        
        const response = await fetch('/api/upload/upload', {
            method: 'POST',
            body: formData
        });
        
        const result = await response.json();
        console.log('Save response:', result);
        
        if (response.ok) {
            document.getElementById('collectorStatus').innerHTML = `
                <div style="color: #10b981;">
                    ✓ Saved ${result.count} ticks to server!<br>
                    Symbols: ${result.symbols.join(', ')}
                </div>
            `;
            showNotification(`Saved ${result.count} ticks to server!`);
            collectedData = [];
            document.getElementById('saveDataBtn').style.display = 'none';
        } else {
            showNotification('Save failed: ' + result.error, 'error');
        }
    } catch (error) {
        showNotification('Save error: ' + error.message, 'error');
    }
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    initWebSocket();
    loadAlerts();

    document.getElementById('startCollectorBtn').addEventListener('click', startBinanceCollector);
    document.getElementById('stopCollectorBtn').addEventListener('click', stopBinanceCollector);
    document.getElementById('saveDataBtn').addEventListener('click', saveCollectedData);
    
    // setTimeout(() => {
    //     document.getElementById('analyzeBtn').click();
    // }, 1000);
});

window.deleteAlert = deleteAlert;

