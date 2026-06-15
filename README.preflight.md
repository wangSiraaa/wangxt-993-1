# Trae Preflight

This folder is prepared for `wangxt-993-1`.

Use `.env` for stable local ports and compose project identity:

- APP_PORT: 18293
- API_PORT: 19293
- WEB_PORT: 20293
- DB_PORT: 21293
- REDIS_PORT: 22293

Smoke entry:

```bash
bash scripts/smoke.sh
```

The preflight files are environment scaffolding only. The generated business
project can replace or extend them when needed.
