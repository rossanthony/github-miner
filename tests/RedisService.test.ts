import { RedisClient } from 'redis';
import { RedisService } from '../src/RedisService'

describe('RedisService public methods', () => {
    let redisService: RedisService;
    const mockRedisClient = RedisClient.prototype;

    beforeEach(() => {
        redisService = new RedisService(mockRedisClient);
    });

    test('RedisService can be newed up without passing any params', () => {
        expect(new RedisService()).toBeInstanceOf(RedisService);
    });

    describe('sadd method', () => {
        test('calls sadd on redis client', async () => {
            mockRedisClient.sadd = jest.fn().mockImplementation((key, value, cb) => {
                cb(null, 1);
            });
            const res = await redisService.sadd('key', 'val');
            expect(res).toBe(1);
        });

        test('silently logs error and returns 0', async () => {
            mockRedisClient.sadd = jest.fn().mockImplementation((key, value, cb) => {
                cb(new Error('Boom!'));
            });
            const res = await redisService.sadd('key', 'val');
            expect(res).toBe(0);
        });
    });

    describe('sismember method', () => {
        test('calls sismember on redis client', async () => {
            mockRedisClient.sismember = jest.fn().mockImplementation((key, value, cb) => {
                cb(null, 1);
            });
            const res = await redisService.sismember('key', 'val');
            expect(res).toBe(1);
        });

        test('silently logs error and returns 0', async () => {
            mockRedisClient.sismember = jest.fn().mockImplementation((key, value, cb) => {
                cb(new Error('Boom!'));
            });
            const res = await redisService.sismember('key', 'val');
            expect(res).toBe(0);
        });
    });

    describe('smembers method', () => {
        test('calls smembers on redis client and returns array of strings', async () => {
            mockRedisClient.smembers = jest.fn().mockImplementation((key, cb) => {
                cb(null, ['foo', 'bar']);
            });
            const res = await redisService.smembers('key');
            expect(res).toStrictEqual(['foo', 'bar']);
        });

        test('silently logs error and returns 0', async () => {
            mockRedisClient.smembers = jest.fn().mockImplementation((key, cb) => {
                cb(new Error('Boom!'));
            });
            const res = await redisService.smembers('key');
            expect(res).toStrictEqual([]);
        });
    });

    describe('scard method', () => {
        test('calls scard on redis client and returns cardinality of set', async () => {
            mockRedisClient.scard = jest.fn().mockImplementation((key, cb) => {
                cb(null, 99);
            });
            const res = await redisService.scard('key');
            expect(res).toBe(99);
        });

        test('silently logs error and returns 0', async () => {
            mockRedisClient.scard = jest.fn().mockImplementation((key, cb) => {
                cb(new Error('Boom!'));
            });
            const res = await redisService.scard('key');
            expect(res).toBe(null);
        });
    });

    describe('del method', () => {
        test('calls del on redis client', async () => {
            mockRedisClient.del = jest.fn().mockImplementation((key, cb) => {
                cb(null, 1);
            });
            const res = await redisService.del('key');
            expect(res).toBe(1);
        });

        test('silently logs error and returns 0', async () => {
            mockRedisClient.del = jest.fn().mockImplementation((key, cb) => {
                cb(new Error('Boom!'));
            });
            const res = await redisService.del('key');
            expect(res).toBe(undefined);
        });
    });
});
