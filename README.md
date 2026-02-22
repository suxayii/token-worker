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
| ⚙️ `wrangler.toml` (可选) | 若您日后使用 CLI 工具部署时的本地配置文件（纯网页部署可忽略） |

---

## 🚀 极简部署指南 (纯网页操作，零基础)

这套系统专门优化了部署流程，您**无需**在电脑上安装 Node.js、Wrangler CLI 或任何本地开发环境。全程只需在 Cloudflare 仪表盘 (Dashboard) 点点鼠标即可。

### 1. 创建 D1 数据库

1. 登录 [Cloudflare 控制台](https://dash.cloudflare.com/)。
2. 左侧菜单导航至 **[Workers & Pages]** -> **[D1 SQL Database]**。
3. 点击右上角 **[Create database] (创建数据库)**，随意命名（例如 `my-token-db`），然后点击创建。

### 2. 写入数据库表结构

1. 创建完成后，进入该数据库的管理页面。
2. 找到并打开 **[Console] (控制台)** 选项卡。
3. 打开本开源项目中的 [`schema.sql`](./schema.sql) 文件，复制里面所有的 SQL 语句。
4. 粘贴到控制台的输入框内，点击 **执行 (Execute)**。这会为您自动生成必需的 `licenses` 数据表。

### 3. 创建并部署 Worker 脚本

1. 左侧菜单导航至 **[Workers & Pages]** -> **[Overview]**。
2. 点击右上角的 **[Create application] (创建应用程序)**，然后点击 **[Create Worker] (创建 Worker)**。
3. 为您的核心服务命名（例如 `auth-worker`），然后直接点击右下角 **[Deploy] (部署)**。此时模板代码已经上线。
4. 在成功页面点击 **[Edit code] (编辑代码)**，进入云端代码编辑器。
5. 打开本项目中的 [`worker.js`](./worker.js) 文件，复制其所有内容。
6. 将网页编辑器中原有的全部代码**完全删除**并替换为复制进去的项目代码。
7. *先不要着急点击“保存并部署”，我们还需要完成下一步绑定。*

### 4. 绑定数据库与防爆破密钥

打开您的 Worker 项目详情页（**[Workers & Pages] -> 点击您刚才创建的 Worker**）：

🔑 **绑定数据库：**
1. 切换到 **[Settings] (设置)** 选项卡 -> 选择左侧的 **[Bindings] (绑定)** 菜单。
2. 点击 **[Add] (添加)** 按钮，类型请选择 **[D1 database]**。
3. ⚠️ **Variable name (变量名)** 必须精准填写为 `DB`（因代码中默认通过 `env.DB` 访问）。
4. **D1 database** 下拉框选择您在第 1 步创建的那个数据库。
5. 部署保存。

🔒 **设置管理员密钥 (Admin Secret)：**
1. 仍然在 **[Settings] (设置)** 选项卡 -> 选择左侧的 **[Variables and Secrets] (变量和加密) -> [Environment variables]**。
2. 点击 **[Add variable] (添加变量)**。
3. **Variable name (变量名)** 填写 `ADMIN_SECRET`。
4. **Value (值)** 填入您自定义的强密码（例如：`My0nlyAdMiNp4ssW0rd!`）。这把钥匙将用于日后所有的口令增删查改。
5. 点击 **[Deploy] (部署)** 使所有配置正式生效。

🎉 **恭喜您，大功告成！** 系统已平稳运行在 Cloudflare 边缘节点，可通过为您分配的 `*.workers.dev` 域名开始使用。

---

## 📖 API 接口路由全景指南

> 💡 **提示**：所有 `/admin/` 开头的接口都必须在 HTTP Header 中携带键值对 `x-admin-key: <您的 SECRET>`。

### 🟢 客户端验证接口 (对外开放)

**1. 极速验证扣减**
*   **路由**: `GET /verify?uuid={待验证的UUID}`
*   **动作逻辑**: 
    - 检查 UUID 是否存在于数据库 
    - 验证有效期是否过期
    - 校验/扣减当天的调用限频配额
*   **🟢 成功回调**: `{"valid": true, "remaining_today": 49, "expires_at": "..."}`
*   **🔴 异常回调**: HTTP `403` (已过期) / `429` (今日次数耗尽) / `404` (非法或不存在的口令)

---

### 🔴 管理控制台接口 (仅限管理员)

> **鉴权方式**：请在使用接口测试工具（如 Postman、cURL）或代码发请求时，在 HTTP Header 中强制添加 `x-admin-key: <您的 SECRET>`。

**1. 单点生成安全口令**
*   **路由**: `POST /admin/add`
*   **扩展参数 (Query)**: 支持通过 `?limit={日限额}&term={有效年数}` 定制逻辑 *(注：视您项目 Worker 具体扩展版本而定)*
*   **说明**: 随机生成一个带有特定防伪前缀（如 `fenguois-*`）的新 UUID，完成初始化并持久化到 D1 数据库。
*   **成功返回示例**:
    ```json
    { "success": true, "data": { "id": 1024, "uuid": "fenguois-1a2b3c..." } }
    ```

**2. 极限批量造库 (冷启动神器)**
*   **路由**: `POST /admin/generate`
*   **说明**: 供上线初期批量发卡、内部压测或冷启动时使用。脚本内置批量事务 (Batch Transactions)，一次性向数据库高并发插入一千至数千条默认规格口令。
*   **成功返回示例**:
    ```json
    { "success": true, "count": 3000 }
    // 耗时大概在两到三秒左右，完全不惧 Edge Network 的限制
    ```

**3. 永久封停销户 (物理删除)**
*   **路由**: `POST /admin/delete?uuid={目标UUID}`
*   **说明**: 将对应口令的所有业务数据及额度历史从 D1 数据库中**彻底物理抹除**。此操作不可逆，请谨慎防范误删事故。
*   **成功返回示例**:
    ```json
    { "success": true }
    ```

---

## 🧰 零代码运维手册 (SQL 实操)

作为项目的拥有者，日常遇到客诉处理、手动调整权益额度或者直接封禁违规用户时，**您完全不需要修改 Worker 核心代码**或者重新走部署流程。

只需登录 Cloudflare 控制台，进入 D1 数据库实例内部的 **[Console] (控制台)** 选项卡，输入下列经过实战检验的 SQL 语句进行执行（Execute），即可完成一切“上帝视角”的改动：

**1. 🍼 额度刷新：给某用户手动“解封”今日计费**
*使用场景：某些用户抱怨因为测试接口把今天可用次数用光了，客服想人工给他今天一次重新体验的机会。*
```sql
UPDATE licenses SET daily_count = 0 WHERE uuid = '填入用户的UUID';
```

**2. 🚀 永久提权：给某大客户或者自己定制专属的超大日限额**
*使用场景：默认发卡的普通用户限额 50 次，VIP 企业大客户需要提升到每日调用 8000 次。（前提条件：建议您的业务端配置了读取 `max_daily_count` 即扩展日限额字段的逻辑)*
```sql
UPDATE licenses SET max_daily_count = 8000 WHERE uuid = '填入用户的UUID';
```

**3. ⏱️ 充值续费：以“毫秒大单位”颗粒度硬核直充有效期**
*使用场景：用户充钱购买了半年的增值服务（半年时长约换算为 15768000000 毫秒），需要原封不动把这段时长叠加到原本他的老有效期内。（前提条件：配合表结构的 `term_ms` 字段逻辑起效)*
```sql
UPDATE licenses SET term_ms = term_ms + 15768000000 WHERE uuid = '填入用户的UUID';
```

**4. 🚫 封禁惩罚：将某人强制裁决到一个确定的过去时间点，使其当场验证失败**
*使用场景：风控检测到用户涉嫌极其恶劣的违规盗刷，将其到期时间强行倒退为过去的绝对时间戳（或者直接封定到昨天），他下次验证直接秒走 403 路由。*
```sql
UPDATE licenses SET term_ms = (目标时间的硬核毫秒时间戳) - activated_at WHERE uuid = '填入用户的UUID';
```

**5. 🕵️ 客服仪表盘探针：全景洞察所选 UUID 极其精确的当前寿命和账本余量**
*使用场景：客服接到单子，想要快速在数据库用一条查询指令出结果，这句不仅会格式化呈现激活时间、北京时区的到期日历，还能根据秒跳动实时算出他的**倒计时剩余存活天数**。*
```sql
SELECT 
    uuid AS 口令码, 
    max_daily_count AS 每日授权限额,
    datetime(activated_at / 1000, 'unixepoch', 'localtime') AS 首次激活时间,
    datetime((activated_at + term_ms) / 1000, 'unixepoch', 'localtime') AS 即将到期时间,
    ((activated_at + term_ms - (strftime('%s', 'now') * 1000)) / 86400000) AS 生命剩余天数
FROM licenses 
WHERE uuid IN (
    '请在这里小心粘贴需要首要排查的真实 UUID 文本',
    '如果有批量连带多个号需要查询的情况，可以用英文逗号隔开放下一行继续粘贴'
);
```

---

## 📄 开源许可证

本项目遵从 **MIT 宽松许可协议**。无论是个人学习、二次开发、还是商业化包装整合，都享有充分且自由的使用权。参阅 [LICENSE](./LICENSE) 文件获取完整声明。

