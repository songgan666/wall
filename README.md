
# 匿名墙后端

这是匿名墙项目的后端实现版本，采用 **Node.js + Express + MySQL** 架构。

## 文件夹结构 (wall-backend)
- `routes/`：路由文件夹（包含 auth.js 和 posts.js）
- `.env`：环境变量（存放数据库敏感信息）
- `.gitignore`：Git 忽略文件
- `db.js`：数据库连接池配置
- `server.js`：后端主入口文件
- `package.json`：项目依赖配置文件
- `API_DOC.md`：详细接口文档

## 完成的工作 (Backend Lead)
1. **数据库**：设计并实现了 users、posts、comments 三张核心表，建立了完整的外键关联。
2. **后端框架搭建**：使用 Express 搭建了 RESTful API 架构。
3. **业务逻辑开发**：
   - 实现了用户登录验证。
   - 实现了帖子的发布、全局拉取、点赞及删除。
   - 实现了评论的嵌套发布与删除。
4. **安全加固 (针对实验攻击需求)**：
   - **防 SQL 注入**：所有数据库交互均采用 mysql2 的参数化查询（? 占位符），不使用字符串拼接。
   - **防水平越权 (IDOR)**：在删除帖子/评论接口中，严格校验 user_id，防止攻击者通过篡改 ID 删除他人内容。

## 部署与运行
1. 确保本地运行着 XAMPP (Apache + MySQL)。
2. 在 phpMyAdmin 中创建 `anonymous_wall` 数据库，并执行建表 SQL 脚本。
3. 复制项目中的 `.env.example` 为 `.env`（根据你的环境配置数据库账号密码）。
4. 在当前目录下执行 `npm install` 安装依赖。
5. 执行 `node server.js` 启动服务，服务器将运行在 http://localhost:3000。

---
=======
