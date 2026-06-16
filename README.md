# IMS Microservice System

## Services
- API Gateway
- Auth Service
- Product Service
- Transaction Service
- Report Service
- PostgreSQL Database
- Frontend (Nginx)

## Run Project

```bash
docker compose up --build
```

## Default Ports

| Service | Port |
|---|---|
| Frontend | 8080 |
| API Gateway | 3000 |
| Auth Service | 3001 |
| Product Service | 3002 |
| Transaction Service | 3003 |
| Report Service | 3004 |
| PostgreSQL | 5432 |

## Notes
- nginx.conf has been added.
- Docker Compose obsolete version removed.
- Structure preserved from original project.