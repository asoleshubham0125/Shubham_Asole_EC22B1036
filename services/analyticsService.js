/**
 * Compute analytics for a pair of time series
 * @param {Array} alignedX - Array of data points for first symbol
 * @param {Array} alignedY - Array of data points for second symbol
 * @param {number} window - Rolling window size for calculations
 * @returns {Object} Analytics results
 */
function computeAnalytics(alignedX, alignedY, window) {
    const xPrices = alignedX.map(d => d.close);
    const yPrices = alignedY.map(d => d.close);
    
    const hedgeRatio = calculateHedgeRatio(xPrices, yPrices);
    const spread = calculateSpread(xPrices, yPrices, hedgeRatio.slope);
    
    // Calculate rolling statistics
    const rollingMean = calculateRollingMean(spread, window);
    const rollingStd = calculateRollingStd(spread, window);
    const zScore = calculateZScore(spread, rollingMean, rollingStd);
    
    // Calculate correlation
    const correlation = calculateCorrelation(xPrices, yPrices);
    
    // Format analytics to match frontend expectations
    return {
        hedgeRatio: hedgeRatio.slope,
        hedgeR2: hedgeRatio.rSquared,
        correlation,
        spread: spread.map((s, i) => ({
            time: alignedX[i].time,
            spread: s,
            zScore: zScore[i]
        })),
        rollingCorrelation: alignedX.map((_, i) => ({
            index: i,
            correlation: correlation
        }))
    };
}

/**
 * Calculates the hedge ratio using linear regression
 * @param {Array} x - Array of prices for first symbol
 * @param {Array} y - Array of prices for second symbol
 * @returns {Object} Slope and R-squared of the regression
 */
function calculateHedgeRatio(x, y) {
    const n = x.length;
    const sumX = sum(x);
    const sumY = sum(y);
    const sumXY = sumProduct(x, y);
    const sumX2 = sumSquares(x);
    
    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;
    
    // Calculate R-squared
    const yHat = x.map(xi => slope * xi + intercept);
    const rSquared = calculateRSquared(y, yHat);
    
    return { slope, intercept, rSquared };
}

/**
 * Calculates the spread between two price series using the hedge ratio
 * @param {Array} x - Array of prices for first symbol
 * @param {Array} y - Array of prices for second symbol
 * @param {number} hedgeRatio - The calculated hedge ratio
 * @returns {Array} The spread series
 */
function calculateSpread(x, y, hedgeRatio) {
    return y.map((yi, i) => yi - hedgeRatio * x[i]);
}

/**
 * Performs Augmented Dickey-Fuller test for stationarity
 * @param {Array} series - Time series to test
 * @returns {Object} Test results
 */
function adfTest(series) {
    const n = series.length;
    if (n < 20) return { testStatistic: null, pValue: null, isStationary: false };
    
    const y = series.slice(1);
    const x = series.slice(0, -1);
    const dy = y.map((yi, i) => yi - x[i]);
    
    const sumX = sum(x);
    const sumY = sum(dy);
    const sumXY = sumProduct(x, dy);
    const sumX2 = sumSquares(x);
    
    const beta = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const alpha = (sumY - beta * sumX) / n;
    
    // Simplified test statistic calculation
    const testStatistic = beta / Math.sqrt((1 - calculateRSquared(dy, x.map(xi => alpha + beta * xi))) / (n - 2));
    
    // Approximate critical values (10%, 5%, 1%)
    const criticalValues = [-2.57, -2.86, -3.43];
    const isStationary = testStatistic < criticalValues[1]; // Using 5% significance level
    
    return {
        testStatistic,
        isStationary,
        criticalValues
    };
}

// Helper functions
function sum(arr) {
    return arr.reduce((a, b) => a + b, 0);
}

function mean(arr) {
    return sum(arr) / arr.length;
}

function sumProduct(arr1, arr2) {
    return arr1.reduce((sum, val, i) => sum + val * arr2[i], 0);
}

function sumSquares(arr) {
    return arr.reduce((sum, val) => sum + val * val, 0);
}

function std(arr) {
    const m = mean(arr);
    return Math.sqrt(arr.reduce((sum, val) => sum + Math.pow(val - m, 2), 0) / arr.length);
}

function calculateRSquared(actual, predicted) {
    const actualMean = mean(actual);
    const totalSS = sumSquares(actual.map(y => y - actualMean));
    const residualSS = actual.reduce((sum, y, i) => sum + Math.pow(y - predicted[i], 2), 0);
    return 1 - (residualSS / totalSS);
}

function calculateCorrelation(x, y) {
    const n = x.length;
    const sumX = sum(x);
    const sumY = sum(y);
    const sumXY = sumProduct(x, y);
    const sumX2 = sumSquares(x);
    const sumY2 = sumSquares(y);
    
    return (n * sumXY - sumX * sumY) / 
           Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));
}

function calculateRollingMean(arr, window) {
    const result = [];
    for (let i = 0; i < arr.length; i++) {
        const start = Math.max(0, i - window + 1);
        const windowSlice = arr.slice(start, i + 1);
        result.push(mean(windowSlice));
    }
    return result;
}

function calculateRollingStd(arr, window) {
    const result = [];
    for (let i = 0; i < arr.length; i++) {
        const start = Math.max(0, i - window + 1);
        const windowSlice = arr.slice(start, i + 1);
        result.push(std(windowSlice));
    }
    return result;
}

function calculateZScore(spread, rollingMean, rollingStd) {
    return spread.map((s, i) => (s - rollingMean[i]) / (rollingStd[i] || 1));
}

module.exports = {
    computeAnalytics,
    adfTest,
    calculateHedgeRatio,
    calculateSpread
};
