FROM ubuntu:24.04

ENV DEBIAN_FRONTEND=noninteractive

# 安装基础工具、MySQL 和 Node.js
RUN apt-get update && apt-get install -y \
    curl \
    mysql-server \
    && curl -fsSL https://deb.nodesource.com/setup_18.x | bash - \
    && apt-get install -y nodejs \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# 将当前目录的所有代码复制到容器的 /app 目录下
COPY . /app/

# 进入后端目录安装依赖
RUN cd /app/wall-backend && npm install

# 赋予启动脚本执行权限
RUN chmod +x /app/entrypoint.sh

EXPOSE 3000

ENTRYPOINT ["/app/entrypoint.sh"]