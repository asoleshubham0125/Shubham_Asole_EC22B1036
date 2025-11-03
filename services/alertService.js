class AlertService {
  constructor() {
    this.alerts = [];
    this.nextId = 1;
  }

  // Add new alert
  addAlert(config) {
    const newAlert = {
      id: this.nextId++,
      ...config,
      active: true,
      createdAt: new Date()
    };
    this.alerts.push(newAlert);
    return newAlert;
  }

  // Remove alert
  removeAlert(id) {
    this.alerts = this.alerts.filter(alert => alert.id !== id);
  }

  // List all current alerts
  getAlerts() {
    return this.alerts;
  }

  // Check if a single alert should be triggered
  shouldTrigger(alert, value) {
    switch (alert.operator) {
      case 'gt':  return value >  alert.threshold;
      case 'lt':  return value <  alert.threshold;
      case 'gte': return value >= alert.threshold;
      case 'lte': return value <= alert.threshold;
      case 'eq':  return value === alert.threshold;
      default:    return false;
    }
  }

  // Check alerts for given symbols
  checkAlerts(data, symbolX, symbolY) {
    const results = [];

    if (!data?.analytics?.spread) return results;

    const spread = data.analytics.spread;
    const latestZ = spread[spread.length - 1]?.zScore;

    this.alerts.forEach(alert => {
      if (alert.symbolX === symbolX && alert.symbolY === symbolY) {
        if (this.shouldTrigger(alert, latestZ)) {
          results.push({ ...alert, currentValue: latestZ });
        }
      }
    });

    return results;
  }
}

module.exports = new AlertService();
