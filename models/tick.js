const mongoose = require('mongoose');

const TickSchema = new mongoose.Schema({
  symbol: {
    type: String,
    required: true,
    index: true
  },
  ts: {
    type: Date,
    required: true,
    index: true
  },
  price: {
    type: Number,
    required: true
  },
  size: {
    type: Number,
    required: true
  }
}, {
  timestamps: true
});

TickSchema.index({ symbol: 1, ts: 1 });

module.exports = mongoose.model('Tick', TickSchema);

