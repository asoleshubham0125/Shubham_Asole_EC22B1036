const express = require('express');
const router = express.Router();

const alertService = require('../services/alertService');

// Get all alerts
router.get('/', (req, res) => {
  const allAlerts = alertService.getAlerts();

  res.json(allAlerts);
});

// Add a new alert
router.post('/', (req, res) => {
  const { symbolX, symbolY, metric, operator, threshold, message } = req.body;

  if (!symbolX || !symbolY || !metric || !operator || threshold === undefined) {
    return res.status(400).json({ error: 'Missing required fields!' });
  }

  const newAlert = alertService.addAlert({
    symbolX,
    symbolY,
    metric,
    operator,
    threshold,
    message: message || `${metric} ${operator} ${threshold}`
  });

  res.json(newAlert);
});

// Delete an alert by ID
router.delete('/:id', (req, res) => {
  const id = parseInt(req.params.id);

  alertService.removeAlert(id);

  res.json({ message: 'Alert removed successfully!' });
});

module.exports = router;
