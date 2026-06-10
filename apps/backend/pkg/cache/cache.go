package cache

import (
	"context"
	"encoding/json"
	"sync"
	"time"

	"github.com/redis/go-redis/v9"
)

type Cache struct {
	redis  *redis.Client
	memory sync.Map
}

type memEntry struct {
	expiresAt time.Time
	raw       []byte
}

func New(redisURL string) *Cache {
	c := &Cache{}
	if redisURL != "" {
		opts, err := redis.ParseURL(redisURL)
		if err == nil {
			client := redis.NewClient(opts)
			if err := client.Ping(context.Background()).Err(); err == nil {
				c.redis = client
			}
		}
	}
	return c
}

func (c *Cache) Close() error {
	if c.redis != nil {
		return c.redis.Close()
	}
	return nil
}

func (c *Cache) GetJSON(ctx context.Context, key string, dest any) (bool, error) {
	raw, ok, err := c.getRaw(ctx, key)
	if err != nil || !ok {
		return ok, err
	}
	return true, json.Unmarshal(raw, dest)
}

func (c *Cache) SetJSON(ctx context.Context, key string, value any, ttl time.Duration) error {
	raw, err := json.Marshal(value)
	if err != nil {
		return err
	}
	return c.setRaw(ctx, key, raw, ttl)
}

func (c *Cache) Del(ctx context.Context, key string) {
	if c.redis != nil {
		_ = c.redis.Del(ctx, key).Err()
	}
	c.memory.Delete(key)
}

func (c *Cache) DelByPrefix(ctx context.Context, prefix string) {
	if c.redis != nil {
		var cursor uint64
		for {
			keys, next, err := c.redis.Scan(ctx, cursor, prefix+"*", 100).Result()
			if err != nil {
				break
			}
			if len(keys) > 0 {
				_ = c.redis.Del(ctx, keys...).Err()
			}
			cursor = next
			if cursor == 0 {
				break
			}
		}
	}
	c.memory.Range(func(k, _ any) bool {
		if key, ok := k.(string); ok && len(key) >= len(prefix) && key[:len(prefix)] == prefix {
			c.memory.Delete(key)
		}
		return true
	})
}

func (c *Cache) GetOrSetJSON(ctx context.Context, key string, ttl time.Duration, loader func() (any, error)) (any, error) {
	var cached any
	if ok, err := c.GetJSON(ctx, key, &cached); err == nil && ok {
		return cached, nil
	}
	value, err := loader()
	if err != nil {
		return nil, err
	}
	_ = c.SetJSON(ctx, key, value, ttl)
	return value, nil
}

func (c *Cache) AuthMeKey(userID, companyID string) string {
	return "auth:me:" + userID + ":" + companyID
}

func (c *Cache) getRaw(ctx context.Context, key string) ([]byte, bool, error) {
	if c.redis != nil {
		val, err := c.redis.Get(ctx, key).Bytes()
		if err == redis.Nil {
			return nil, false, nil
		}
		if err != nil {
			return nil, false, err
		}
		return val, true, nil
	}
	if v, ok := c.memory.Load(key); ok {
		e := v.(memEntry)
		if time.Now().After(e.expiresAt) {
			c.memory.Delete(key)
			return nil, false, nil
		}
		return e.raw, true, nil
	}
	return nil, false, nil
}

func (c *Cache) Diagnostics() map[string]any {
	backend := "memory"
	if c.redis != nil {
		backend = "redis"
	}
	return map[string]any{"backend": backend, "redisConfigured": c.redis != nil}
}

func (c *Cache) Ping(ctx context.Context) string {
	if c.redis != nil {
		if err := c.redis.Ping(ctx).Err(); err != nil {
			return "error: " + err.Error()
		}
		return "PONG"
	}
	return "memory-only"
}

func (c *Cache) setRaw(ctx context.Context, key string, raw []byte, ttl time.Duration) error {
	if c.redis != nil {
		return c.redis.Set(ctx, key, raw, ttl).Err()
	}
	c.memory.Store(key, memEntry{expiresAt: time.Now().Add(ttl), raw: raw})
	return nil
}
