# 媒体播放器自定义属性说明

## 自定义属性列表

### 1. 时间戳
- **属性**: `custom-media="timestamp"`
- **附加属性**: `custom-timestamp="02:03"`

### 2. 循环片段
- **属性**: `custom-media="loop"`
- **附加属性**: `custom-loop-start="01:30"`, `custom-loop-end="02:45"`

### 3. 截图
- **属性**: `custom-media="screenshot"`

### 4. 截图+时间戳
- **超级块属性**: `custom-media="mediacard"`, `custom-timestamp="02:03"`
- **时间戳块属性**: `custom-media="timestamp"`, `custom-timestamp="02:03"`
- **截图块属性**: `custom-media="screenshot"`

### 5. 媒体笔记
- **属性**: `custom-type="MediaNote"`
- **附加属性**: `custom-mediaurl="媒体URL"`, `custom-website="bilibili"`

## 网站来源识别

直接使用 `MediaItem.source` 字段：

- **bilibili** - B站视频
- **openlist** - OpenList服务器
- **webdav** - WebDAV服务器
- **local** - 本地文件（默认）

## 查询示例

可以通过SQL查询特定类型的媒体块：

```sql
-- 查询时间戳块
SELECT * FROM blocks WHERE id IN (
    SELECT block_id FROM attributes WHERE name = 'custom-media' AND value = 'timestamp'
);

-- 查询媒体笔记
SELECT * FROM blocks WHERE id IN (
    SELECT block_id FROM attributes WHERE name = 'custom-type' AND value = 'MediaNote'
);

-- 查询B站媒体笔记
SELECT * FROM blocks WHERE id IN (
    SELECT block_id FROM attributes WHERE name = 'custom-website' AND value = 'bilibili'
);
```