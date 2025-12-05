import Redis from "ioredis";
import { log } from "./app";
import { getSecret } from "./services/secretManager";

let publisher: Redis | null = null;
let subscriber: Redis | null = null;

/**
 * Get Redis connection configuration
 * Supports both REDIS_URL (for Upstash) and individual host/port/password
 */
async function getRedisConfig(): Promise<{
  host: string;
  port: number;
  password?: string;
  tls?: { rejectUnauthorized: false };
}> {
  // Check if REDIS_URL is provided (Upstash format: rediss://default:password@host:port)
  const redisUrl = process.env.REDIS_URL;
  if (redisUrl) {
    try {
      const url = new URL(redisUrl);
      const password = url.password || undefined;
      const host = url.hostname;
      const port = parseInt(url.port || "6379");
      const isTLS = url.protocol === "rediss:";

      return {
        host,
        port,
        password,
        ...(isTLS && { tls: { rejectUnauthorized: false } }),
      };
    } catch (error) {
      log(`Failed to parse REDIS_URL: ${error}`, "redis");
      throw error;
    }
  }

  // Fallback to individual environment variables
  const host = process.env.REDIS_HOST || "localhost";
  const port = parseInt(process.env.REDIS_PORT || "6379");
  
  // Try to get password from Secret Manager first, then fallback to env var
  let password: string | undefined;
  if (process.env.NODE_ENV === "production") {
    password = (await getSecret("redis-password")) || undefined;
  }
  if (!password) {
    password = process.env.REDIS_PASSWORD || undefined;
  }

  const config: {
    host: string;
    port: number;
    password?: string;
    tls?: { rejectUnauthorized: false };
  } = {
    host,
    port,
  };

  if (password) {
    config.password = password;
  }

  // Enable TLS if REDIS_TLS is set to true or if port is 6380 (common TLS port)
  if (process.env.REDIS_TLS === "true" || port === 6380) {
    config.tls = { rejectUnauthorized: false };
  }

  return config;
}

export async function getRedisPublisher(): Promise<Redis> {
  if (!publisher) {
    const config = await getRedisConfig();

    publisher = new Redis({
      ...config,
      retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
      maxRetriesPerRequest: 3,
    });

    publisher.on("error", (error) => {
      log(`Redis Publisher Error: ${error.message}`, "redis");
    });

    publisher.on("connect", () => {
      log("Redis Publisher connected", "redis");
    });

    publisher.on("ready", () => {
      log("Redis Publisher ready", "redis");
    });
  }

  return publisher;
}

export async function getRedisSubscriber(): Promise<Redis> {
  if (!subscriber) {
    const config = await getRedisConfig();

    subscriber = new Redis({
      ...config,
      retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
      maxRetriesPerRequest: 3,
    });

    subscriber.on("error", (error) => {
      log(`Redis Subscriber Error: ${error.message}`, "redis");
    });

    subscriber.on("connect", () => {
      log("Redis Subscriber connected", "redis");
    });

    subscriber.on("ready", () => {
      log("Redis Subscriber ready", "redis");
    });
  }

  return subscriber;
}

export async function publishToChannel(channel: string, message: any): Promise<void> {
  try {
    const pub = await getRedisPublisher();
    await pub.publish(channel, JSON.stringify(message));
  } catch (error: any) {
    log(`Failed to publish to Redis channel ${channel}: ${error.message}`, "redis");
    throw error;
  }
}

export async function subscribeToChannel(
  channel: string,
  callback: (message: any) => void
): Promise<void> {
  try {
    const sub = await getRedisSubscriber();
    await sub.subscribe(channel);
    sub.on("message", (ch, message) => {
      if (ch === channel) {
        try {
          const parsed = JSON.parse(message);
          callback(parsed);
        } catch (error) {
          log(`Failed to parse Redis message from ${channel}: ${error}`, "redis");
        }
      }
    });
  } catch (error: any) {
    log(`Failed to subscribe to Redis channel ${channel}: ${error.message}`, "redis");
    throw error;
  }
}

export async function unsubscribeFromChannel(channel: string): Promise<void> {
  try {
    const sub = await getRedisSubscriber();
    await sub.unsubscribe(channel);
  } catch (error: any) {
    log(`Failed to unsubscribe from Redis channel ${channel}: ${error.message}`, "redis");
  }
}

export async function publishChatMessage(conversationId: number, message: any): Promise<void> {
  const channel = `chat:conversation:${conversationId}`;
  await publishToChannel(channel, message);
}

export async function publishTyping(conversationId: number, userId: string, isTyping: boolean): Promise<void> {
  const channel = `chat:typing:${conversationId}`;
  await publishToChannel(channel, {
    userId,
    isTyping,
    timestamp: Date.now(),
  });
}

export async function closeRedisConnections(): Promise<void> {
  if (publisher) {
    await publisher.quit();
    publisher = null;
  }
  if (subscriber) {
    await subscriber.quit();
    subscriber = null;
  }
  log("Redis connections closed", "redis");
}
