#!/bin/bash
set -e

# 设置 MySQL 服务端和客户端默认字符集为 utf8mb4
if ! grep -q 'character-set-server' /etc/mysql/mysql.conf.d/mysqld.cnf 2>/dev/null; then
    cat >> /etc/mysql/mysql.conf.d/mysqld.cnf << 'MYSQLCFG'

[mysqld]
character-set-server = utf8mb4
collation-server = utf8mb4_unicode_ci

[client]
default-character-set = utf8mb4
MYSQLCFG
fi

# 启动 MySQL 服务并等待其就绪
service mysql start
sleep 3

# 初始化数据库密码（首次运行）或忽略错误（已初始化过）
mysql --default-character-set=utf8mb4 -e "ALTER USER 'root'@'localhost' IDENTIFIED WITH mysql_native_password BY '123456'; FLUSH PRIVILEGES;" 2>/dev/null || true

# 导入表结构及种子数据（INSERT IGNORE 保证可重复执行）
mysql --default-character-set=utf8mb4 -u root -p123456 < /app/wall-backend/sql/init.sql

# 切换到后端目录并启动 Node.js 服务
cd /app/wall-backend
exec node server.js