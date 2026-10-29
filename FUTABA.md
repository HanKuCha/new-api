# Futaba NewAPI 定制

`main` 基于官方 `QuantumNous/new-api` 的 `main` 合并定制；本次同步基线为
`e449cc700eb569cdfc2199cb73e97de46944f43c`（2026-10-28）。
`futaba-rc47` 保存线上 `v1.0.0-rc.47-futaba.3` 的应用源码。
`main` 的 `v1.0.0-rc.47-futaba.4-dev` 为同步后的开发版本，尚未部署到生产。

## 应用定制

- `/dashboard/users`：用户调用分析、分页、搜索、多指标排序和各用户模型明细；按消费日志原始 quota 聚合，保留免费调用，排除 user_id=0，支持独立日志库。
- `/api/data/users` 和 `/api/data/user-analytics` 向已登录用户开放；访问令牌仍要求 `log:read`，用户管理接口仍要求管理员。
- QQ 公告：登录控制台弹出黑色无边框公告，五秒阅读后确认；活动编号及群入口保存在 `web/src/lib/futaba-announcement.ts`。
- 用户 ID 限流：启动环境变量 `MODEL_REQUEST_RATE_LIMIT_USERS`，例如 `'{"11":[2,2]}'`，按用户跨令牌、跨分组共享当前时间窗的总请求数和成功请求数；全局限流关闭时仍生效。空值表示不配置用户覆盖规则，非法值拒绝启动。

## 运行环境定制

构建包含 CA 信任修补的镜像：

```sh
docker build -t new-api-futaba:source .
docker build -f deploy/futaba/Dockerfile.ca -t new-api-futaba:local .
```

`deploy/futaba/compose.override.yaml` 可叠加到已有 Compose 配置，保留四核配额、中文默认语言和用户限流环境入口。
在本地环境或未提交的 `.env` 中设置限流规则，再以原 Compose 文件为第一项运行：

```sh
docker compose -f docker-compose.yml -f deploy/futaba/compose.override.yaml config --quiet
docker compose -f docker-compose.yml -f deploy/futaba/compose.override.yaml up -d new-api
```

原生产部署使用 SQLite；强制记录 IP 通过数据库内的
`force_record_ip_log_insert`、`force_record_ip_log_update` 两个触发器实现。
`deploy/futaba/force-record-ip.sqlite.sql` 保存这两个触发器和存量用户设置的初始化语句，支持重复执行；仅适用于 SQLite，备份数据库后可用 `sqlite3 /path/to/one-api.db < deploy/futaba/force-record-ip.sqlite.sql` 应用。
分组策略、渠道管家权限、QQ 公告内容和 Uptime Kuma 配置属于运行数据，必须在升级时保留现有数据库和配置；仅克隆仓库不会创建这些运行数据。
仓库不包含生产数据库、账号密码、渠道密钥、令牌、会话密钥或生产 Compose 原件。

后续同步可在本地执行 `git fetch upstream`、`git merge upstream/main`，解决冲突并运行回归后再推送；不要用强制同步覆盖定制提交。

## 本次同步验证（2026-10-29）

- Bun 1.4.4：冻结依赖安装、`bun run typecheck`（1412 文件 / 2 项目）、定制文件 oxlint、24 项统计/导航/公告测试、`bun run build` 通过。
- `bun run format:check` 检出的格式差异均位于未修改的上游文件；本次定制文件无格式问题。
- Go 1.26.10：`go test -p 2 ./controller -run '^TestUserUsageAnalytics' -count=1 -v`，分别设置 `TEST_MANAGE_USER_DIALECT=sqlite/mysql/postgres`，并启用 `TEST_MANAGE_USER_SEPARATE_LOG_DB=1`，全部通过。
- 实际数据库版本：SQLite 3.50.4、MySQL 8.4.11、PostgreSQL 16.15；聚合测试在独立日志库下执行。此结果不代表覆盖了各数据库的全部功能或最低支持版本。
- `go test -p 2 ./middleware -run 'TestModel.*RateLimit|Test.*AccessToken' -count=1 -v`、`go build -p 2 -o /build/new-api .`、定制 Go 文件 gofmt 检查通过。
- Compose 叠加配置解析通过；IP 记录 SQL 在 SQLite 3.49.1 上通过初始化、重复执行、插入和更新验证，保留其他用户设置。
- 发布增量已检查生产连接信息、私钥和常见凭据格式；未上传生产数据库、密钥或运维脚本。

本次仅更新 GitHub 源码，未部署新版本到生产。新增 CA Dockerfile 复用现网修补步骤，本次没有重新构建或验收 CA 镜像。
