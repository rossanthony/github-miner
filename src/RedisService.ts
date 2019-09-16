import { RedisClient, RedisError } from 'redis';

export class RedisService {
    constructor(
        private redisClient: RedisClient, 
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

    public async scard(key: string): Promise<number> {
        return new Promise((resolve) => {
            this.redisClient.scard(key, (error: RedisError | null, reply: number) => {
                if (error) {
                    console.log('Redis error thrown for scard:', key);
                }
                resolve(reply || 0);
            });
        });
    }

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
