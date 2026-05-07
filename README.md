# 匿名墙

校园匿名交流平台，采用 **Node.js + Express + MySQL** 架构。

## 项目结构

```
wall/
├── index.html              # 前端主页面
├── script.js               # 前端逻辑（含 XSS 防护、cookie 认证）
├── style.css               # 样式
├── wall-backend/
│   ├── server.js           # 后端主入口（限频、cookie 解析、静态托管）
│   ├── db.js               # 数据库连接池
│   ├── routes/
│   │   ├── auth.js         # 注册 + 登录 + 登出（cookie 下发）
│   │   └── posts.js        # 帖子/评论/点赞 CRUD（XSS 过滤）
│   ├── sql/
│   │   └── init.sql        # 建表 + 种子数据
│   ├── .env                # 环境变量（数据库密码等）
│   ├── package.json
│   └── API_DOC.md          # 接口文档
```

## 快速启动

1. 确保本地运行着 MySQL（XAMPP 或独立安装均可）。
2. 创建数据库并导入表结构：
   ```
   mysql -u root -p < wall-backend/sql/init.sql
   ```
3. 修改 `wall-backend/.env` 中的数据库密码。
4. 安装依赖并启动：
   ```
   cd wall-backend
   npm install
   npm start
   ```
5. 浏览器打开 `http://localhost:3000`（前后端同源，无需 CORS）。

## API 端点

| 方法 | 端点 | 说明 |
|------|------|------|
| POST | `/api/auth/register` | 用户注册（成功自动登录） |
| POST | `/api/auth/login` | 用户登录（设 HttpOnly cookie） |
| POST | `/api/auth/logout` | 退出登录（清 cookie） |
| GET | `/api/posts` | 获取全部帖子及评论 |
| POST | `/api/posts` | 发布帖子（cookie 认证） |
| DELETE | `/api/posts/:id` | 删除帖子（IDOR 防护） |
| POST | `/api/posts/:id/comments` | 发表评论（cookie 认证） |
| DELETE | `/api/posts/:id/comments/:cid` | 删除评论（IDOR 防护） |
| POST | `/api/posts/:id/like` | 点赞/取消赞 |

详见 [API_DOC.md](wall-backend/API_DOC.md)。

## 安全措施

### 认证与会话

| 措施 | 说明 |
|------|------|
| HttpOnly Cookie | `user_id` 存储在 `SameSite=Strict; HttpOnly` cookie 中，JS 不可读写 |
| SameSite=Strict | 禁止第三方网站携带 cookie，杜绝 CSRF |
| 防伪造 | 后端只认 cookie，请求体中的 `user_id` 一律忽略 |
| 登出 | 服务端清 cookie，客户端清 localStorage |

### 输入过滤

| 措施 | 位置 | 说明 |
|------|------|------|
| SQL 注入防护 | 全部路由 | 所有查询使用 `?` 参数化 |
| IDOR 水平越权 | posts.js | 删帖/删评论校验 cookie 中的 user_id |
| 频率限制 | server.js | 每 IP 每秒最多 3 次，超限返回 429 |
| XSS 双引号 | 前后端双重 | `"` `'` → `＂` `＇` |
| XSS 尖括号 | 前后端双重 | `<` `>` → `＜` `＞` |
| XSS on* 事件 | 前后端双重 | `onclick=` → `@@on_click=` |
| 输入校验 | auth.js | 用户名/密码长度、唯一性校验 |

### XSS 过滤流程

```
用户输入: <script>alert("1")</script> <div onclick='x'> <3
    ↓ sanitizeContent() 发送前替换
存入数据库: ＜script＞alert(＂1＂)＜/script＞ ＜div @@on_click=＇x＇＞ ＜3
    ↓ restoreContent() 显示前恢复
恢复后: <script>alert("1")</script> <div onclick='x'> <3
    ↓ escapeHtml() 渲染转义
浏览器显示: 纯文本，不执行任何代码
```

### 待实施

- 密码 bcrypt 哈希（当前明文比对，实验环境）
- 点赞按人限制（当前为全局计数器）

## 技术栈

- 前端：原生 HTML/CSS/JS（无框架）
- 后端：Express 5.x
- 数据库：MySQL + mysql2（连接池）
- 认证：HttpOnly + SameSite=Strict cookie
