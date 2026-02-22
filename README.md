# Token Worker 授权系统

本项目是一个基于 Cloudflare Worker 的轻量级、极速的 UUID/口令验证系统，由 Cloudflare D1（Serverless SQLite） 提供数据支持。

## ✨ 特性

- ⚡️ **极致性能**: 运行在全球部署的 Cloudflare Edge 节点上。
- 🗄️ **Cloudflare D1**: 使用 Serverless SQLite 存储和验证 UUID。
- 🕒 **动态过期与用量限制**: 支持每一个 UUID 独立的配置额度（例如：每日调用次数限制、生命周期有效时间限制）。
- 🛡️ **管理接口**: 受保护的 Admin 接口，支持快速生成、添加、删除和查询 UUID。

## 📁 项目结构

- `worker.js`: Cloudflare Worker 的核心代码脚本。
- `schema.sql`: D1 数据库建表语句。你需要将此内容复制到控制台执行。

---

## 🚀 部署指南 (纯 Cloudflare 网页端操作)

你完全不需要本地安装 Node.js 或任何命令行工具，只需在 Cloudflare 仪表盘 (Dashboard) 配置即可完成部署。

### 1. 创建 D1 数据库

1. 登录 Cloudflare 控制台。
2. 在左侧菜单找到 **[Workers & Pages] -> [D1 SQL Database]**。
3. 点击右上角 **[Create database] (创建数据库)**。
4. 命名为 `token-worker-db`（或者你想要的任何名字），点击 **[Create] (创建)**。

### 2. 写入数据库表结构

1. 进入你刚刚创建的 D1 数据库管理页面。
2. 找到并打开 **[Console] (控制台)** 选项卡。
3. 打开本项目中的 [`schema.sql`](./schema.sql) 文件，复制里面所有的 SQL 语句。
4. 粘贴到控制台的输入框内，点击执行（**Execute**）。
   *这会为你自动创建必需的 `licenses` 表。*

### 3. 创建 Cloudflare Worker

1. 在左侧菜单回到 **[Workers & Pages] -> [Overview]**。
2. 点击右上角的 **[Create application] (创建应用程序)**，然后点击 **[Create Worker] (创建 Worker)**。
3. 命名你的 Worker（如 `token-worker`），然后点击 **[Deploy] (部署)**。
4. 点击 **[Edit code] (编辑代码)** 进入在线网页编辑器。
5. 打开本项目中的 [`worker.js`](./worker.js) 文件，复制里面的所有代码。
6. 将网页编辑器中原有的代码（如 `export default { fetch() {...} }`）**全部删掉并替换**为你复制的代码。
7. （先不要点保存/部署，我们需要先绑定数据库）。

### 4. 绑定 D1 数据库与设置密钥

打开你的 Worker 项目详情页（**[Workers & Pages] -> 点击你的 Worker 名字**）：

**绑定数据库：**
1. 切换到 **[Settings] (设置)** 选项卡 -> 选择左侧的 **[Bindings] (绑定)** 菜单。
2. 点击 **[Add] (添加)** 按钮，类型选择 **[D1 database]**。
3. **Variable name (变量名)** 必须精准填写为 `DB` （代码中读取的是 env.DB）。
4. **D1 database** 选择你刚刚在第 1 步创建的数据库（下拉菜单选择）。
5. 部署保存。

**设置管理员密钥 (Variables)：**
1. 仍然在 **[Settings] (设置)** 选项卡 -> 选择左侧的 **[Variables and Secrets] (变量和加密) -> [Environment variables]**。
2. 点击 **[Add variable] (添加变量)**。
3. **Variable name (变量名)** 填写 `ADMIN_SECRET`。
4. **Value (值)** 填入你自定义的管理员密码（例如：`MySuperSecret123!`）。
5. 点击 **[Deploy] (部署)** 使其生效。

### 5. 完成上线

由于你已经完成了代码编辑（第 3 步）、数据库绑定与变量定义（第 4 步），现在你的服务已经完美跑在了 Cloudflare 的全球边缘节点上！你可以通过分配到的 `xxx.xxx.workers.dev` 域名来访问。

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

*(提示：可以使用 Postman 或 cURL 在电脑/手机上调用)*

**1. 创建单个口令**
*   **路由**: `POST /admin/add`
*   **说明**: 生成一个带特征前缀（如 fenguois）的新 UUID。并在数据库中记录。

**2. 批量生成口令**
*   **路由**: `POST /admin/generate`
*   **说明**: 内部循环一次性向数据库批量插入多条默认规格的 UUID。

**3. 删除指定口令**
*   **路由**: `POST /admin/delete?uuid={target_uuid}`
*   **说明**: 从数据库中永久删除该 UUID 记录。

---

## 🧰 常见运维与客服场景处理

在日常运营中，很多客诉或规则修改**完全不需要改动 Worker 代码**。
你只需要回到 Cloudflare **[D1 仪表盘]** 的 **[Console] (控制台)**，执行简单的 SQL 语句即可：

**1. 给某个用户重置今天的次数（让他继续用）：**
```sql
UPDATE licenses SET daily_count = 0 WHERE uuid = 'xxx';
```

**2. 给某个用户提升“套餐”（比如升级到每日 500 次）：**
*(需前置代码逻辑或表结构支持)*
```sql
UPDATE licenses SET max_daily_count = 500 WHERE uuid = 'xxx';
```

**3. 给某个用户续费/延长到期时间（在原基础上增加半年）：**
*(需前置代码逻辑或表结构支持)*
```sql
UPDATE licenses SET term_ms = term_ms + 15768000000 WHERE uuid = 'xxx';
```

**4. 指定某人到一个确切的日期到期（比如封号/提前结束）：**
*(需前置代码逻辑或表结构支持)*
```sql
UPDATE licenses SET term_ms = (目标时间的毫秒时间戳) - activated_at WHERE uuid = 'xxx';
```

**5. 详细查询某个/多个口令的状态和剩余天数**
*(需配合 `term_ms` 和 `max_daily_count` 字段)*
```sql
SELECT 
    uuid, 
    max_daily_count AS 每日限额,
    datetime(activated_at / 1000, 'unixepoch', 'localtime') AS 激活时间,
    datetime((activated_at + term_ms) / 1000, 'unixepoch', 'localtime') AS 到期时间,
    ((activated_at + term_ms - (strftime('%s', 'now') * 1000)) / 86400000) AS 剩余天数
FROM licenses 
WHERE uuid IN (
    'fenguois-23a4-4599-b4c9-db1f954072b0'
);
```

---

## 📄 License

本项目基于 MIT 协议开源 - 查看 [LICENSE](./LICENSE) 文件了解更多详情。
