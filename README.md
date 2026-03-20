<div align="center">
  <h1>🛡️ Token Worker 授权系统</h1>
  <p><b>一个基于 Cloudflare Edge 和 D1 Serverless 数据库构建的极速、轻量级 API 授权管理与验证系统。</b></p>
</div>

---

## ✨ 核心特性

- ⚡️ **极致性能**: 部署在 Cloudflare 全球 Edge 边缘节点，实现超低延迟的校验。
- 🗄️ **无需自建数据库**: 依托 Cloudflare D1 (Serverless SQLite)，零维护成本，免费额度极高。
- 🕒 **精细化控制**: 支持为每个 UUID（口令）灵活配置独立额度（如：每日调用次数限制、总生命周期有效期）。
- 🛡️ **安全闭环**: 客户端极速验证路由 + 受密钥严密保护的后台 Admin 操作接口。

---

## 📁 核心文件概览

| 文件名 | 功能描述 |
|:---|:---|
| 📄 `worker.js` | Cloudflare Worker 的核心逻辑代码（包含了限流、验证、各种路由判断） |
| 🗃️ `schema.sql` | D1 数据库初始化的建表 SQL 语句，部署时直接使用 |
| ⚙️ `wrangler.toml`| 开发者在本地使用 CLI 工具配置与一键发布时所依赖的文件 |

---

## 🚀 部署指南

无论是小白用户还是资深开发者，均能快速部署。我们提供 **纯网页操作（免代码环境）** 和 **Wrangler CLI 本地部署（推荐）** 两种方式。

### 方式一：Wrangler CLI 本地极速部署 (开发者推荐) 💻

如果您熟悉 Node.js 环境，使用 Wrangler 命令行部署是最专业、最高效的方式，且后期维护更方便。

#### 1. 环境准备
确保您的电脑上已全局安装 Node.js 和 Wrangler CLI：
```bash
npm install -g wrangler
# 如果您还没有登录，请执行以下命令，并在浏览器中授权
wrangler login
```

#### 2. 创建 D1 数据库
进入本项目的根目录，执行建库指令：
```bash
wrangler d1 create token-db
```
执行完毕后，终端会输出包含 `database_name` 和 `database_id` 的绑定信息，请备好这串信息以备后用。

#### 3. 自动初始化数据表
通过本地的 `schema.sql` 自动在远端创建核心工作表：
```bash
wrangler d1 execute token-db --file=./schema.sql --remote
```

#### 4. 配置 `wrangler.toml`
如果项目中没有 `wrangler.toml`，请在根目录下创建一个，并将您的 D1 ID 填入：
```toml
name = "auth-worker"
main = "worker.js"
compatibility_date = "2024-03-20"

# 数据库绑定 (代码中通过 env.DB 调用)
[[d1_databases]]
binding = "DB"
database_name = "token-db"
database_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"  # ← 填入第 2 步为您生成的 ID
```

#### 5. 设置超级密码并发布上线
为了安全保护 `/admin/*` 等管理接口，您需要通过 Secret 形式写入强密码（不要直接写在代码里）：
```bash
wrangler secret put ADMIN_SECRET
```
*（执行后会提示您输入密码，例如请输入 `MySecretKey`）*

最后，使用一键部署将代码推送至全球节点：
```bash
wrangler deploy
```
系统会返回类似 `https://auth-worker.<你的用户名>.workers.dev` 的专属域名，部署大功告成！

---

### 方式二：纯网页极简部署 (零基础/无本地环境) 🌐

如果您当前电脑上没有 Node 环境，完全可以通过控制台点点鼠标来完成。

**1. 创建并初始化 D1 数据库**
- 登录 [Cloudflare 控制台](https://dash.cloudflare.com/)，在左边导航找到 **[Workers & Pages]** -> **[D1 SQL Database]**。
- 点击 **[Create database]** 命名（如 `token-db`）并创建。
- 进入该库的 **[Console]**（控制台）面板，复制本项目 [`schema.sql`](./schema.sql) 的全部内容，粘贴并 **[Execute]**。

**2. 创建 Worker 脚本**
- 回到 **[Workers & Pages]** -> **[Overview]**，点击 **[Create Worker]** 命名为 `auth-worker`，并点击部署。
- 点击 **[Edit code]**（编辑代码），清除原代码，粘贴本项目 [`worker.js`](./worker.js) 的全部内容。（先不要急着点保存）

**3. 配置环境变量和数据库绑定**
- 返回 Worker 主页，切换到 **[Settings]**（设置）页签。
- 打开左侧 **[Bindings]** -> 点击 **[Add]** 添加 **[D1 database]**。⚠️将 **Variable name** 强制改为 `DB`，数据库选择您刚建立的 `token-db`。
- 打开左侧 **[Variables and Secrets]** -> 在首栏点击 **[Add variable]**。⚠️将 **Variable name** 填为 `ADMIN_SECRET`，将值设为您自定义的专属密语（例如 `MySecretKey`）保存。
- 最终回到代码编辑页进行最后一次 **Deploy (部署)** 保存，服务即上线！

---

## 📖 详细接口使用指南与 API 范例

所有 `/admin/` 相关的敏感操作，**必须**在 HTTP Request Header 中强行携带鉴权头部：
`x-admin-key: <您刚设置的 ADMIN_SECRET>`
只有常规的验证路由 `/verify` 对外公开。

### 🟢 客户端验证接口（对外开放/供软件调用）

**极速验证与扣减**
*   **路由**: `GET /verify?uuid={待验证的UUID}`
*   **用途**: 让客户端校验卡密是否合法、扣减当日调用次数。
*   **调用示例**:
    ```bash
    curl -X GET "https://auth-worker.<专属后缀>.workers.dev/verify?uuid=fenguois-xxxx..."
    ```
*   **✅ 成功返回示例 (`200 OK`)**:
    ```json
    {
      "valid": true,
      "id": 1024,
      "uuid": "fenguois-xxxx...",
      "remaining_today": 49,
      "uu": "aHR0cHM6Ly9...",
      "expires_at": "2027-03-20T12:00:00.000Z"
    }
    ```
*   **❌ 异常拦截回调示例**:
    *   `403 Forbidden`: 此卡已被封禁或 `Expired` (有效期届满过期)
    *   `429 Too Many Requests`: `{"valid":false, "reason":"Daily limit reached", "limit":50}` (今日扣减额度已耗尽)
    *   `404 Not Found`: 查不到此口令 (没开通卡密导致)

---

### 🔴 服务端管理台接口（后台管理员专用）

**1. 随机添加单张新口令**
*   **路由**: `POST /admin/add`
*   **调用示例**:
    ```bash
    curl -X POST "https://auth-worker.xxx.workers.dev/admin/add" \
         -H "x-admin-key: MySecretKey"
    ```
*   **成功返回**:
    ```json
    { "success": true, "data": { "id": 1, "uuid": "fgtwittx-..." } }
    ```

**2. 极限并发批量造卡 (适用于业务冷启动/发卡预备)**
*   **路由**: `POST /admin/generate`
*   **用途**: 利用 D1 的 Batch 底层并发逻辑，仅需几秒钟瞬间安全下发 3000 张新卡密入库。
*   **Javascript 发包示例**:
    ```javascript
    fetch('https://auth-worker.xxx.workers.dev/admin/generate', {
      method: 'POST',
      headers: { 'x-admin-key': 'MySecretKey' } // 替换为您配置的强密码
    })
    .then(res => res.json())
    .then(data => console.log('发卡结果:', data)); 
    // 若成功将输出：{ "success": true, "count": 3000 }
    ```

**3. 永久注销口令 (物理删除)**
*   **路由**: `POST /admin/delete?uuid={目标UUID}`
*   **用途**: 处理退款单或恶意用户，连根拔起并彻底清除由于其存在所占有的数据库空间。
*   **调用示例**:
    ```bash
    curl -X POST "https://auth-worker.xxx.workers.dev/admin/delete?uuid=fenguois-xxxx..." \
         -H "x-admin-key: MySecretKey"
    ```

---

## 🧰 运维实战锦囊：D1 原生 SQL 工具库教程

作为管理员，在许多场景下完全无需调用 API 或修改代码，**直接打开 Cloudflare 控制台 -> [D1 SQL Database] -> [Console] 以执行 SQL**，即可全知全能地操纵一切。

### 🔍 一、全景与精细化查询 (Query)

**1. 详细查询指定密钥（使用次数、激活日、绝对到期时刻）**
```sql
SELECT 
    uuid AS 口令明文,
    daily_count AS 今日已消耗次数,
    max_daily_count AS 设定的每日总限额,
    IFNULL(datetime(activated_at / 1000, 'unixepoch', 'localtime'), '尚未激活发车') AS 首次初刷时间,
    IFNULL(datetime((activated_at + term_ms) / 1000, 'unixepoch', 'localtime'), '无记录') AS 最终过期时刻,
    CAST(((activated_at + term_ms - (strftime('%s', 'now') * 1000)) / 86400000) AS INTEGER) AS 剩余存活总天数
FROM licenses 
WHERE uuid = '填写你想查的用户UUID';
```

**2. 探针大盘：全景透视最新 100 个有效密钥的寿命**
*(利用 `sqlite` 函数快速格式化后台数据用于审计)*
```sql
SELECT 
    uuid AS 卡密, 
    max_daily_count || '次/天' AS 权限天花板,
    daily_count AS 今天已查次数,
    datetime(activated_at / 1000, 'unixepoch', 'localtime') AS 激活日,
    datetime((activated_at + term_ms) / 1000, 'unixepoch', 'localtime') AS 到期日,
    CAST(((activated_at + term_ms - (strftime('%s', 'now') * 1000)) / 86400000) AS INTEGER) AS 剩余寿命天数
FROM licenses 
ORDER BY id DESC LIMIT 100;
```

### ⚙️ 二、精细化状态修改 (Update Limits & Terms)

**1. 🚀 增加“每日使用次数” (永久提升并发限额)**
*(每张新卡默认的 `max_daily_count` 是 50。比如企业大客户来了，你想把他的日调取阈值直接加到 8000 次，执行下面口令)*
```sql
UPDATE licenses SET max_daily_count = 8000 WHERE uuid = '你提取的UUID';
```

**2. ⏱️ 充值续期：延迟现有卡的过期时间（做加法叠加）**
*(如果用户买了你们的新套餐，你想在他目前的倒计时基础上增加确定的有效时长。注：1年约等于 `31536000000` 毫秒，半年约为 `15768000000` 毫秒)*
```sql
-- 将原剩余寿命直接无损外推 1 年半
UPDATE licenses SET term_ms = term_ms + (31536000000 + 15768000000) WHERE uuid = '目标UUID';
```

**3. 🎯 改写为确定的“绝对”过期时间**
*(如果不想算加法延长，而是希望让这张卡严格在特定时刻（例如2026年12月31日）被干掉失效)*
```sql
UPDATE licenses 
SET term_ms = (strftime('%s', '2026-12-31 23:59:59') * 1000) - activated_at 
WHERE uuid = '被修改的UUID' 
  AND activated_at IS NOT NULL; -- 必须基于他已经激活过为前提
```

**4. 🍼 额度特赦：人工“解封”今日计费阈值**
*(某用户在群里抱怨今天额度被测试用完了，你想人工给他做个今日次数“清零”特批，完全不影响他的总寿命)*
```sql
UPDATE licenses SET daily_count = 0 WHERE uuid = '群友的UUID';
```

**5. 🚫 立即执行强制封禁 (零毫秒寿命)**
*(发现对方在恶意发包，想让他立刻吃 `403 Expired`)*
```sql
UPDATE licenses SET term_ms = 0 WHERE uuid = '作弊者的UUID';
```

---

## 📄 开源许可证

本项目遵从 **MIT Protocol**。无论是个人学习、业务二开、还是打包进行商业集成发布，都享有充分且自由的使用权。参阅 [LICENSE](./LICENSE) 获取完整声明内容。
