const express = require("express");
const router = express.Router();
const multer = require("multer");
const fs = require("fs");
const Tick = require("../models/tick");

const upload = multer({
  dest: "uploads/",
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      "application/x-ndjson",
      "application/json"
    ];
    if (allowedTypes.includes(file.mimetype) || file.originalname.endsWith(".ndjson")) {
      cb(null, true);
    } else {
      cb(new Error("Only NDJSON or JSON files are allowed"));
    }
  },
});

// Upload NDJSON File
router.post("/upload", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });

    const filePath = req.file.path;
    const data = fs.readFileSync(filePath, "utf8");

    const lines = data.trim().split("\n").filter(Boolean);
    const ticks = lines.map(line => {
      const t = JSON.parse(line);
      return {
        symbol: t.symbol,
        ts: new Date(t.ts),
        price: t.price,
        size: t.size || t.qty
      };
    });

    const result = await Tick.insertMany(ticks, { ordered: false });

    fs.unlinkSync(filePath);

    res.json({
      message: "✅ File uploaded successfully",
      count: result.length,
      symbols: [...new Set(ticks.map(t => t.symbol))]
    });
  } catch (err) {
    console.error("Upload Error:", err);

    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    res.status(500).json({ error: err.message });
  }
});

// Get Upload Statistics
router.get("/stats", async (req, res) => {
  try {
    const stats = await Tick.aggregate([
      {
        $group: {
          _id: "$symbol",
          count: { $sum: 1 },
          firstTick: { $min: "$ts" },
          lastTick: { $max: "$ts" }
        }
      }
    ]);
    res.json(stats);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Export router
module.exports = router;
