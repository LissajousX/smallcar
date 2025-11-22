FROM ubuntu:22.04

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update && \
    apt-get install -y --no-install-recommends \
      ca-certificates \
      curl \
      git \
      nginx \
      jq \
      python3 \
      python3-pip \
    && pip3 install -U platformio \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /actions-runner

ARG RUNNER_VERSION=2.311.0

RUN curl -L "https://github.com/actions/runner/releases/download/v${RUNNER_VERSION}/actions-runner-linux-x64-${RUNNER_VERSION}.tar.gz" \
      -o actions-runner.tar.gz \
    && tar xzf actions-runner.tar.gz \
    && rm actions-runner.tar.gz

# Web 根目录，CI 会把 web/ 拷贝到这里，由 nginx 提供静态文件
RUN mkdir -p /usr/share/nginx/html

COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

EXPOSE 80

ENTRYPOINT ["/entrypoint.sh"]
