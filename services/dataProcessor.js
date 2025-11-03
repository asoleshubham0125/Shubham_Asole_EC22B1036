// Convert NDJSON into array of JSON objects
function processNDJSON(data) {
  const lines = data.trim().split('\n').filter(line => line.trim());

  const jsonData = lines.map(line => JSON.parse(line));

  return jsonData;
}

// Group tick data into time (like 1min, 5min)
function aggregateTicks(ticks, timeframe) {
  const grouped = {};
  ticks.forEach(tick => {
    const timeValue = tick.time || tick.ts;
    const timeKey = getTimeKey(timeValue, timeframe);
    if (!grouped[timeKey]) {
      grouped[timeKey] = [];
    }
    grouped[timeKey].push(tick);
  });

  // Create summary
  const result = Object.entries(grouped).map(([time, group]) => {
    return {
      time: new Date(time),              
      open: group[0].price,             
      high: Math.max(...group.map(t => t.price)), 
      low: Math.min(...group.map(t => t.price)),   
      close: group[group.length - 1].price,       
      volume: group.reduce((sum, t) => sum + t.size, 0), 
      count: group.length               
    };
  });

  return result;
}

// Convert any timestamp into normalized time 
function getTimeKey(date, timeframe) {
  const d = new Date(date);

  if (isNaN(d.getTime())) {
    throw new Error(`Invalid time: ${date}`);
  }

  switch (timeframe) {
    case '1s': 
      d.setMilliseconds(0);
      break;

    case '1m':
      d.setMilliseconds(0);
      d.setSeconds(0);
      break;

    case '5m': 
      d.setMilliseconds(0);
      d.setSeconds(0);
      d.setMinutes(Math.floor(d.getMinutes() / 5) * 5);
      break;
  }

  return d.toISOString();
}

module.exports = {
  processNDJSON,
  aggregateTicks,
  getTimeKey
};
