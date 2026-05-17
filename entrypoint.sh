#!/bin/bash

# 启动 MySQL 服务并等待其就绪
service mysql start
sleep 3

# 初始化数据库密码并导入表结构
mysql -e "ALTER USER 'root'@'localhost' IDENTIFIED WITH mysql_native_password BY '123456'; FLUSH PRIVILEGES;"
mysql -u root -p123456 < /app/wall-backend/sql/init.sql

# 切换到后端目录并启动 Node.js 服务
cd /app/wall-backend
node server.js