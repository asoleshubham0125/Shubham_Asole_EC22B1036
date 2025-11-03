const { size } = require("mathjs");
const tick = require("../models/tick");

let tickBuffer = [];
const BATCH_SIZE = 50;
const FLUSH_MS = 1000;

setInterval(async() => {
    if(tickBuffer.length === 0) return;
    const btach = tickBuffer.splice(0, tickBuffer.length);
    try{
        await tick.insertMany(btach);
        console.log(`Inserted ${batch.length} ticks`);
    }catch (e) {
        console.error("Insert error", e);
        tickBuffer.unshift(...btach);
    }
}, FLUSH_MS);

exports.handleSocketConnection = (io, socket) => {
    console.log("Socket connected: ", socket.id);

    socket.on("tick", (tick) => {
        try{
            const data = {
                ts: new Date(tick.ts),
                symbol: tick.symbol.toUpperCase(),
                price: +tick.price,
                size: +tick.size || 0,
            };
            tickBuffer.push(data);
            io.emit("liveTick", data);
        }catch(err){
            console.error("tick parse error", err);
        }
    });

    socket.on("dissconect", () =>{
        console.log("Socket disconnected", socket.id);
    })
};

exports.getTickCount = async (req, res) => {
  const count = await Tick.countDocuments();
  res.json({ totalTicks: count });
};
