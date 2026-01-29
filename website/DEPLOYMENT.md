# DeepDiagram 官网部署文档

## 架构

官网作为独立的 Next.js 15 应用，与产品应用（React SPA）分开部署，共用同一域名 `deepd.cturing.cn`：

| 服务 | 路径 | 技术栈 | 端口 | 镜像 |
|------|------|--------|------|------|
| **官网** | `/` | Next.js 15 (standalone) | 3000 | `twwch/deepdiagram-website:latest` |
| **产品应用** | `/app` | React 19 + Nginx | 80 | `twwch/deepdiagram-frontend:latest` |
| **后端 API** | `/api` | FastAPI + LangGraph | 8000 | `twwch/deepdiagram-backend:latest` |
| **数据库** | — | PostgreSQL 16 | 5432 | `postgres:16-alpine` |

## CI/CD

推送到 `main` 分支或打 `v*` tag 时，GitHub Actions 会自动构建并推送 Docker 镜像到 Docker Hub：

- `twwch/deepdiagram-website:latest`
- `twwch/deepdiagram-frontend:latest`
- `twwch/deepdiagram-backend:latest`

配置文件：`.github/workflows/docker-build-push.yml`

### 所需 Secrets

| Secret | 说明 |
|--------|------|
| `DOCKERHUB_USERNAME` | Docker Hub 用户名 |
| `DOCKERHUB_TOKEN` | Docker Hub Access Token |

## Docker 部署

### 使用 docker-compose（推荐）

项目根目录已包含完整的 `docker-compose.yml`，包含所有 4 个服务：

```bash
# 拉取最新镜像
docker compose pull

# 启动所有服务
docker compose up -d

# 查看状态
docker compose ps

# 查看官网日志
docker compose logs -f website
```

### 单独构建官网镜像

```bash
cd website
docker build -t twwch/deepdiagram-website:latest .
docker run -d -p 3000:3000 --name deepdiagram-website twwch/deepdiagram-website:latest
```

## Nginx 网关配置

所有服务通过 Nginx 网关按路径分流，统一入口为 `deepd.cturing.cn`：

```nginx
upstream website {
    server website:3000;
}

upstream frontend {
    server frontend:80;
}

upstream backend {
    server backend:8000;
}

server {
    listen 80;
    server_name deepd.cturing.cn;

    client_max_body_size 200m;

    # 产品应用 /app
    location /app {
        proxy_pass http://frontend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # 后端 API
    location /api {
        proxy_pass http://backend;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;

        # SSE 支持
        proxy_buffering off;
        proxy_cache off;
        proxy_read_timeout 300s;
        proxy_set_header Connection '';
        proxy_http_version 1.1;
        chunked_transfer_encoding off;
    }

    # 官网（默认路由）
    location / {
        proxy_pass http://website;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

> `/app` 和 `/api` 的 location 必须在 `/` 之前，Nginx 按最长匹配优先。

## 本地开发

```bash
cd website
npm install
npm run dev
```

开发服务器运行在 http://localhost:3000

## 构建验证

```bash
npm run build
```

构建成功后会在 `.next/` 目录生成 standalone 产物，所有页面均为 SSG 静态生成。

## 更新部署

```bash
# 方式 1：CI 自动部署（推荐）
# 推送代码到 main 分支，GitHub Actions 自动构建镜像
git push origin main

# 服务器上拉取新镜像并重启
docker compose pull website
docker compose up -d website

# 方式 2：手动构建
docker compose build website
docker compose up -d website
```
