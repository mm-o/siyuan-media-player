# SiYuan Media Proxy

独立媒体代理服务，给思源媒体播放器转发需要特殊请求头、`Range`、`m3u8` 重写的媒体资源。

支持：

- B 站媒体直链
- 百度网盘媒体流
- 阿里云盘媒体流
- `m3u8` 清单重写
- `Range` 分片请求
- 本地状态页和最近请求查看

默认端口：

- `16810`

## 快速开始

### 方式 1：直接运行

要求：

- Node.js 18+

启动：

```bash
cd proxy
node media-proxy-server.mjs
```

自定义端口：

```bash
MEDIA_PROXY_PORT=16810 node media-proxy-server.mjs
```

### 方式 2：Docker Compose

```bash
cd proxy
docker compose up -d --build
```

停止：

```bash
docker compose down
```

## 访问地址

- 状态页：`http://127.0.0.1:16810/`
- 健康检查：`http://127.0.0.1:16810/healthz`
- 状态接口：`http://127.0.0.1:16810/api/admin/status`
- 媒体代理：`http://127.0.0.1:16810/api/webdav/media`

## 接口说明

### `GET /healthz`

返回：

```json
{
  "ok": true,
  "uptimeMs": 12345
}
```

### `GET /api/admin/status`

返回当前运行信息、站点统计、最近请求列表。

### `GET /api/webdav/media`

参数：

- `url`: 目标媒体地址
- `auth`: 可选，Authorization
- `cookie`: 可选，Cookie

示例：

```text
http://127.0.0.1:16810/api/webdav/media?url=https%3A%2F%2Fexample.com%2Fvideo.m3u8
```

### `POST /api/webdav/http`

用于普通 HTTP 转发。

请求体示例：

```json
{
  "url": "https://example.com/api",
  "method": "GET",
  "headers": {
    "Accept": "application/json"
  }
}
```

## Docker 部署建议

如果思源跑在 Docker 里，而代理跑在宿主机或另一个容器里，请确保：

1. 代理服务已经启动
2. 宿主机 `16810` 端口可访问
3. 插件所在浏览器环境能够访问 `http://127.0.0.1:16810`

最常见的方式是：

- 宿主机直接运行代理
- 或单独用 Docker 跑代理，并把 `16810:16810` 映射出来

## 状态页能力

状态页会展示：

- 服务在线状态
- 运行时长
- 总请求数、成功数、错误数、活动请求数
- 最近命中的目标站点
- 最近代理请求列表

这对排查“有没有走代理”“最近失败的是哪一类请求”会方便很多。
