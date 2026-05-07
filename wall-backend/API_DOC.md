# 匿名墙 API 接口文档

**Base URL**: `http://localhost:3000`

## 认证说明

登录/注册成功后，服务端通过 `Set-Cookie` 下发 `user_id`，属性为 `SameSite=Strict; HttpOnly; Path=/`。后续所有需要身份验证的请求自动携带此 cookie，**无需在请求体中传递 user_id**。

---

## 1. 认证接口 (Auth)

- **POST** `/api/auth/register`
  - 功能：用户注册，成功自动登录（设 cookie）。
  - 请求体：`{ "username": "newuser", "password": "123", "nickname": "新用户" }`
  - 成功返回：`{ "code": 201, "message": "注册成功", "user": { "id": 4, "username": "newuser", "nickname": "新用户" } }`
  - 错误码：400（参数不合法）、409（用户名已存在）

- **POST** `/api/auth/login`
  - 功能：用户登录，成功设 cookie。
  - 请求体：`{ "username": "student01", "password": "123456" }`
  - 成功返回：`{ "code": 200, "message": "登录成功", "user": { "id", "username", "nickname", "avatar" } }`
  - 错误码：400（参数为空）、401（用户名或密码错误）

- **POST** `/api/auth/logout`
  - 功能：退出登录，清除 cookie。
  - 请求体：无。
  - 成功返回：`{ "code": 200, "message": "已退出登录" }`

---

## 2. 帖子接口 (Posts)

> 以下写操作需登录（cookie），否则返回 401。

- **GET** `/api/posts`
  - 功能：获取全站帖子及嵌套评论。
  - 无需登录。

- **POST** `/api/posts`
  - 功能：发布帖子。
  - 请求体：`{ "content": "帖子内容" }`
  - 用户身份从 cookie 读取。

- **DELETE** `/api/posts/:postId`
  - 功能：删除帖子（只能删自己的）。
  - 请求体：无。
  - 错误码：401（未登录）、403（非本人帖子）

- **POST** `/api/posts/:postId/like`
  - 功能：点赞/取消赞。
  - 请求体：`{ "action": "like" }` 或 `{ "action": "unlike" }`

---

## 3. 评论接口 (Comments)

- **POST** `/api/posts/:postId/comments`
  - 功能：发布评论。
  - 请求体：`{ "text": "评论内容" }`
  - 用户身份从 cookie 读取。

- **DELETE** `/api/posts/:postId/comments/:commentId`
  - 功能：删除评论（只能删自己的）。
  - 请求体：无。
  - 错误码：401（未登录）、403（非本人评论）

---

## 4. 限制与安全

| 机制 | 说明 |
|------|------|
| 频率限制 | 每 IP 每秒最多 3 次请求，超限返回 429 |
| Cookie 认证 | `SameSite=Strict` + `HttpOnly`，禁止第三方携带，JS 不可读 |
| IDOR 防护 | 删帖/删评论校验 cookie 中的 user_id |
| XSS 过滤 | `<>` `"'` 替换为全角字符，`on*` 事件替换为安全标记 |
| SQL 注入防护 | 全部参数化查询 |
