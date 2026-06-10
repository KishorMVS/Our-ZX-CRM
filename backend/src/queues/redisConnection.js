/**
 * Redis Connection Singleton for BullMQ
 * Uses IORedis — shared across Queue + Worker instances
 */
const IORedis = require("ioredis");
const net = require("net");

let connection = null;
let isConnected = false;

/**
 * Perform a fast, non-blocking TCP socket check to see if Redis is running.
 * This avoids instantiating IORedis (and printing repetitive errors) when Redis is down.
 */
const detectRedisAvailability = () => {
    return new Promise((resolve) => {
        const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";
        try {
            let host = "localhost";
            let port = 6379;
            
            if (redisUrl.includes("@")) {
                const parts = redisUrl.split("@")[1].split(":");
                host = parts[0];
                port = parseInt(parts[1]) || 6379;
            } else {
                const cleanUrl = redisUrl.replace("redis://", "");
                const parts = cleanUrl.split(":");
                host = parts[0];
                port = parseInt(parts[1]) || 6379;
            }
            
            const socket = new net.Socket();
            socket.setTimeout(800); // 800ms timeout
            
            socket.on("connect", () => {
                socket.destroy();
                resolve(true);
            });
            
            socket.on("timeout", () => {
                socket.destroy();
                resolve(false);
            });
            
            socket.on("error", () => {
                socket.destroy();
                resolve(false);
            });
            
            socket.connect(port, host);
        } catch (e) {
            resolve(false);
        }
    });
};

const getRedisConnection = () => {
    if (connection) return connection;

    const redisUrl = process.env.REDIS_URL || "redis://localhost:6379";

    connection = new IORedis(redisUrl, {
        maxRetriesPerRequest: null, // Required by BullMQ
        enableReadyCheck: false,
        retryStrategy: (times) => {
            if (times === 1) {
                console.warn("\n⚠️  [Redis] Redis server is not running or unreachable on localhost:6379.");
                console.warn("   [Redis] The auto-call queue pipeline is waiting for Redis to start.");
                console.warn("   [Redis] Easiest fix: Run 'docker run -d -p 6379:6379 redis' or use a free Upstash Redis.\n");
            }
            // Retry every 10 seconds to keep logs clean
            return 10000;
        },
    });

    connection.on("connect", () => {
        isConnected = true;
        console.log("[Redis] Connected successfully");
    });
    
    connection.on("ready", () => {
        isConnected = true;
    });

    connection.on("close", () => {
        isConnected = false;
    });

    connection.on("error", (err) => {
        isConnected = false;
        const msg = err && err.message ? err.message : String(err);
        // Suppress connection failure logs since we already log a friendly prompt on first failure
        if (msg.includes("ECONNREFUSED") || msg.includes("ENOTFOUND") || msg.includes("unreachable")) {
            return;
        }
        console.error("[Redis] Connection error:", msg);
    });

    return connection;
};

const closeRedisConnection = async () => {
    if (connection) {
        await connection.quit();
        connection = null;
        isConnected = false;
        console.log("[Redis] Connection closed");
    }
};

const isRedisConnected = () => {
    return isConnected;
};

module.exports = { 
    getRedisConnection, 
    closeRedisConnection,
    isRedisConnected,
    detectRedisAvailability,
};


