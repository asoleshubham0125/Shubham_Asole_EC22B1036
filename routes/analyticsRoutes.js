const express = require("express");
const router = express.Router();
const Tick = require("../models/tick");
const { aggregateTicks } = require("../services/dataProcessor");
const { computeAnalytics, adfTest, calculateHedgeRatio, calculateSpread } = require("../services/analyticsService");

router.get("/analyze", async (req, res) => {
  try {
    const { symbolX, symbolY, timeframe = "1m", window = 30, startTime, endTime } = req.query;

    if (!symbolX || !symbolY) {
      return res.status(400).json({ error: "Both symbolX and symbolY are required" });
    }

    const query = {};
    if (startTime && endTime) {
      query.ts = { $gte: new Date(startTime), $lte: new Date(endTime) };
    }

    const [dataX, dataY] = await Promise.all([
      Tick.find({ symbol: symbolX, ...query }).sort({ ts: 1 }),
      Tick.find({ symbol: symbolY, ...query }).sort({ ts: 1 })
    ]);

    if (dataX.length === 0 || dataY.length === 0) {
      return res.status(404).json({ error: "No data found for the given symbols" });
    }

    const aggX = aggregateTicks(dataX.map(t => ({ time: t.ts, price: t.price, size: t.size })), timeframe);
    const aggY = aggregateTicks(dataY.map(t => ({ time: t.ts, price: t.price, size: t.size })), timeframe);

    const alignedX = [];
    const alignedY = [];
    const xTimes = new Map(aggX.map((item, i) => [item.time.getTime(), i]));

    aggY.forEach(y => {
      const xIndex = xTimes.get(y.time.getTime());
      if (xIndex !== undefined) {
        alignedX.push(aggX[xIndex]);
        alignedY.push(y);
      }
    });

    if (alignedX.length === 0) {
      return res.status(404).json({ error: "No overlapping timestamps found" });
    }

    const analytics = computeAnalytics(alignedX, alignedY, parseInt(window));

    res.json({
      symbolX,
      symbolY,
      timeframe,
      window,
      dataPoints: alignedX.length,
      analytics,
      priceData: {
        times: alignedX.map(d => d.time),
        xPrices: alignedX.map(d => d.close),
        yPrices: alignedY.map(d => d.close)
      }
    });
  } catch (err) {
    console.error("Error in /analyze:", err);
    res.status(500).json({ error: err.message });
  }
});

router.post("/adf-test", async (req, res) => {
  try {
    const { symbolX, symbolY, timeframe = "1m", startTime, endTime } = req.body;

    if (!symbolX || !symbolY) {
      return res.status(400).json({ error: "Both symbolX and symbolY are required" });
    }

    const query = {};
    if (startTime && endTime) {
      query.ts = { $gte: new Date(startTime), $lte: new Date(endTime) };
    }

    const [dataX, dataY] = await Promise.all([
      Tick.find({ symbol: symbolX, ...query }).sort({ ts: 1 }),
      Tick.find({ symbol: symbolY, ...query }).sort({ ts: 1 })
    ]);

    const aggX = aggregateTicks(dataX.map(t => ({ time: t.ts, price: t.price })), timeframe);
    const aggY = aggregateTicks(dataY.map(t => ({ time: t.ts, price: t.price })), timeframe);

    const alignedX = [];
    const alignedY = [];
    const xTimes = new Map(aggX.map((i, idx) => [i.time.getTime(), idx]));
    aggY.forEach(y => {
      const idx = xTimes.get(y.time.getTime());
      if (idx !== undefined) {
        alignedX.push(aggX[idx]);
        alignedY.push(y);
      }
    });

    if (alignedX.length === 0) {
      return res.status(404).json({ error: "No common data points found" });
    }

    const xPrices = alignedX.map(d => d.close);
    const yPrices = alignedY.map(d => d.close);

    const hedgeRatio = calculateHedgeRatio(xPrices, yPrices);
    const spread = calculateSpread(xPrices, yPrices, hedgeRatio.slope);

    const adfResult = adfTest(spread);

    res.json({
      symbolX,
      symbolY,
      hedgeRatio: hedgeRatio.slope,
      samples: spread.length,
      adfResult
    });
  } catch (err) {
    console.error("Error in /adf-test:", err);
    res.status(500).json({ error: err.message });
  }
});

router.get("/export", async (req, res) => {
  try {
    const { symbolX, symbolY, timeframe = "1m", startTime, endTime } = req.query;

    if (!symbolX || !symbolY) {
      return res.status(400).json({ error: "Both symbols required" });
    }

    const query = {};
    if (startTime && endTime) {
      query.ts = { $gte: new Date(startTime), $lte: new Date(endTime) };
    }

    const [dataX, dataY] = await Promise.all([
      Tick.find({ symbol: symbolX, ...query }).sort({ ts: 1 }),
      Tick.find({ symbol: symbolY, ...query }).sort({ ts: 1 })
    ]);

    const aggX = aggregateTicks(dataX.map(t => ({ time: t.ts, price: t.price })), timeframe);
    const aggY = aggregateTicks(dataY.map(t => ({ time: t.ts, price: t.price })), timeframe);

    const alignedX = [];
    const alignedY = [];
    const xTimes = new Map(aggX.map((i, idx) => [i.time.getTime(), idx]));
    aggY.forEach(y => {
      const idx = xTimes.get(y.time.getTime());
      if (idx !== undefined) {
        alignedX.push(aggX[idx]);
        alignedY.push(y);
      }
    });

    const csvLines = ["Time,X_Close,Y_Close,Spread"];
    alignedX.forEach((x, i) => {
      const y = alignedY[i];
      const spread = y.close - x.close;
      csvLines.push(`${x.time.toISOString()},${x.close},${y.close},${spread}`);
    });

    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", `attachment; filename="${symbolX}_${symbolY}_data.csv"`);
    res.send(csvLines.join("\n"));
  } catch (err) {
    console.error("Error in /export:", err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
