# Token Worker 授权系统

本项目是一个基于 Cloudflare Worker 的轻量级、极速的 UUID/口令验证系统，由 Cloudflare D1（Serverless SQLite） 提供数据支持。

## ✨ 特性

- ⚡️ **极致性能**: 运行在全球部署的 Cloudflare Edge 节点上。
- 🗄️ **Cloudflare D1**: 使用 Serverless SQLite 存储和验证 UUID。
- 🕒 **动态过期与用量限制**: 支持每一个 UUID 独立的配置额度（例如：每日调用次数限制、生命周期有效时间限制）。
- 🛡️ **管理接口**: 受保护的 Admin 接口，支持快速生成、添加、删除和查询 UUID。

## 📁 项目结构

- `worker.js`: Cloudflare Worker 的核心代码脚本。
- `schema.sql`: D1 数据库建表语句。
- `wrangler.toml`: Cloudflare 项目配置文件。

## 🛠️ 前置准备

- 已安装 [Node.js](https://nodejs.org/)
- 已全局或通过 npx 安装 [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/install-and-update/) 
- 拥有一个 Cloudflare 账号

## 🚀 部署与初始化指南

### 1. 安装依赖

```bash
npm install
```

### 2. 创建 D1 数据库

运行以下命令在你的 Cloudflare 账号下创建一个 D1 数据库 (如果你没有登录，命令会提示你授权登录)：

```bash
npm run db:create
```

该命令执行后，控制台会输出 `database_name` 和 `database_id`。
**非常重要**：请打开根目录的 `wrangler.toml` 文件，将你在控制台获取的 ID 填入 `database_id` 字段中。

### 3. 初始化数据库表结构

将表结构应用到你的 D1 数据库中：

**本地测试环境初始化:**
```bash
npm run db:init:local
```

**线上远程环境初始化:**
```bash
npm run db:init:remote
```

### 4. 设置安全密钥 (Secrets)

你必须设置一个 `ADMIN_SECRET`，这相当于你的管理员密码，所有发往 `/admin/*` 的请求都必须在 Header 携带此密钥才能通过验证。

```bash
npx wrangler secret put ADMIN_SECRET
```
*(在提示时输入你想要的复杂密码)*

### 5. 本地运行与测试

通过以下命令在本地启动 Worker 服务进行测试：

```bash
npm run dev
```

### 6. 部署到 Cloudflare

一键部署到 Cloudflare 的边缘网络：

```bash
npm run deploy
```

---

## 📖 API 接口路由清单

### 🟢 客户端调用接口 (无管理员鉴权)

**路由: `GET /verify?uuid={your_uuid}`**

*   **功能**: 极速验证口令并扣除 1 次今日额度。
*   **逻辑判定顺序**:
    1.  检查是否存在。
    2.  检查是否过期（当前时间 > 激活时间 + 有效期）。
    3.  检查今日次数是否已达上限（根据系统或特殊定制额度）。
*   **成功返回**: `{"valid": true, "remaining_today": 49, "expires_at": "..."}`
*   **失败返回**: 状态码 `403` (过期) 或 `429` (次数用尽) 或 `404` (不存在)。

### 🔴 管理员接口 (Header 必须包含 `x-admin-key: 你的密钥`)

**1. 创建单个口令**
*   **路由**: `POST /admin/add?limit={日限额}&term={有效年数}` *(注：limit 和 term 的动态支持需根据最新 Worker.js 代码实际参数配置，此处作逻辑展示)*
*   **说明**: 生成一个带特征前缀（如 fenguois）的新 UUID。可扩展支持动态传入 `limit` (每日次数) 和 `term` (有效期，单位：年)。

**2. 批量生成口令**
*   **路由**: `POST /admin/generate`
*   **说明**: 内部循环一次性向数据库批量插入多条默认规格的 UUID（目前代码默认 3000 条，每批次 50 条并发）。

**3. 删除指定口令**
*   **路由**: `POST /admin/delete?uuid={target_uuid}`
*   **说明**: 从数据库中永久删除该 UUID 记录。

**4. 查询口令详情** (如有实现)
*   **路由**: `GET /admin/info?uuid={target_uuid}`
*   **说明**: 返回该口令的完整信息，包括剩余次数、北京时间格式的到期日等。

---

## 🧰 常见运维与客服场景处理

在日常运营中，很多客诉或规则修改**完全不需要改动 Worker 代码**，你只需要在 Cloudflare 的 D1 仪表盘中，或使用 Wrangler 命令行执行简单的 SQL 语句即可处理：

**1. 给某个用户重置今天的次数（让他继续用）：**
```sql
UPDATE licenses SET daily_count = 0 WHERE uuid = 'xxx';
```

**2. 给某个用户提升“套餐”（比如升级到每日 500 次）：**
*(注意：需要你的 schema.sql 支持 max_daily_count 字段，或 Worker.js 动态读取该字段逻辑)*
```sql
UPDATE licenses SET max_daily_count = 500 WHERE uuid = 'xxx';
```

**3. 给某个用户续费/延长到期时间（在原基础上增加半年）：**
*(注意：需要你的 schema.sql 或 Worker 支持 term_ms 或有效操作)*
```sql
UPDATE licenses SET term_ms = term_ms + 15768000000 WHERE uuid = 'xxx';
```

**4. 指定某人到一个确切的日期到期（比如封号/提前结束）：**
```sql
UPDATE licenses SET term_ms = (目标时间的毫秒时间戳) - activated_at WHERE uuid = 'xxx';
```

---

## 📄 License

本项目基于 MIT 协议开源 - 查看 [LICENSE](./LICENSE) 文件了解更多详情。
