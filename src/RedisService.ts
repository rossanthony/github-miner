import redis, { RedisClient, RedisError } from 'redis';

export class RedisService {
    constructor(
        private redisClient: RedisClient = redis.createClient({
            host: process.env.REDIS_HOST || '127.0.0.1',
            port: +process.env.REDIS_PORT || 6379,
        }),
    ) {}

    /**
     * Add the specified members to the set stored at key.
     * @return integer
     * 1 if the element was added to the set
     * 0 if the element already exists in the set
     */
    public async sadd(key: string, value: any): Promise<number> {
        return new Promise((resolve) => {
            this.redisClient.sadd(key, value, (error: RedisError | null, reply: number) => {
                if (error) {
                    console.log('Redis error thrown for sadd:', key);
                }
                resolve(reply || 0);
            });
        });
    }

    /**
     * Check if value is member of set.
     * @return integer
     * 1 if value exists in the set
     * 0 if not present
     */
    public async sismember(key: string, value: any): Promise<number> {
        return new Promise((resolve) => {
            this.redisClient.sismember(key, value, (error: RedisError | null, reply: number) => {
                if (error) {
                    console.log('Redis error thrown for sismember:', key);
                }
                resolve(reply || 0);
            });
        });
    }

    /**
     * Returns all the members of the set value stored at key.
     */
    public async smembers(key: string): Promise<string[]> {
        return new Promise((resolve) => {
            this.redisClient.smembers(key, (error: RedisError | null, reply: string[]) => {
                if (error) {
                    console.log('Redis error thrown for smembers:', key);
                }
                resolve(reply || []);
            });
        });
    }

    /**
     * Returns the set cardinality (number of elements) of the set stored at key.
     */
    public async scard(key: string): Promise<number | null> {
        return new Promise((resolve) => {
            this.redisClient.scard(key, (error: RedisError | null, reply: number) => {
                if (error) {
                    console.log('Redis error thrown for scard:', key);
                }
                resolve(reply || null);
            });
        });
    }

    /**
     * Removes the specified keys. A key is ignored if it does not exist.
     */
    public async del(key: string): Promise<number> {
        return new Promise((resolve) => {
            this.redisClient.del(key, (error: RedisError | null, reply: number) => {
                if (error) {
                    console.log('Redis error thrown for del:', key);
                }
                resolve(reply);
            });
        });
    }
}
