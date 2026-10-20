# Playback Integration API v1 / 播放集成 API v1

The supported public API is grouped under `window.siyuanMediaPlayer.integration`. Check its protocol, version, and capabilities before calling optional features:

```ts
const api = window.siyuanMediaPlayer?.integration
if (api?.protocol !== 'siplayer-integration' || api.version !== 1) return
if (!api.capabilities.includes('playback.query')) return

api.playback.getEffectivePlayback({ localDate: '2026-10-20' })
// { playingMs: number }
```

插件的正式公开接口统一位于 `window.siyuanMediaPlayer.integration`。调用可选能力前，先检查 `protocol`、`version` 和 `capabilities`。

## API groups / 接口分组

| Group | Capability | Main methods |
| --- | --- | --- |
| `playback` | `playback.events`, `playback.query`, `playback.control` | `events`, `getEffectivePlayback`, transport controls, subtitles, danmaku |
| `media` | `media.play` | `playItem`, `playLink`, `previous`, `next`, `toBackground`, `toBackgroundFromMedia` |
| `navigation` | `navigation.open` | `openMediaListTab`, `openDocumentTab`, `openPlayerTab`, `openNotesWindow`, `closeActivePlayerTab` |
| `actions` | `actions.invoke` | `trigger`, `createTimestampLink`, `runAiSummary` |
| `settings` | `settings.read` | `get` |

`playback` also includes `play`, `pause`, `resume`, `toggle`, `seek`, `seekTo`, `stepFrame`, `setLoopSegment`, time and rate queries, and the nested `subtitles` and `danmaku` methods. `playback.play` controls the active player; `media.playItem` routes a media item through the plugin's normal source resolution and player-opening flow.

事件名称集中在 `api.playback.events`：

```ts
api.playback.events.play     // 'siplayer:play'
api.playback.events.pause    // 'siplayer:pause'
api.playback.events.ended    // 'siplayer:ended'
api.playback.events.progress // 'siplayer:progress'
```

## Playback events / 播放事件

Listen on `window`; each event carries this frozen payload:

```ts
{
  mediaId: string
  at: number // Unix epoch milliseconds
  isPlaying: boolean
}
```

```ts
window.addEventListener(api.playback.events.play, (event) => {
  const { mediaId, at, isPlaying } = event.detail
})
```

`mediaId` is a stable identifier derived from the media reference. It does not expose the title, URL, or filesystem path. `progress` fires only while playback is active and the host document is visible, at most once per second.

在 `window` 上监听上述事件。payload 是冻结对象；`mediaId` 由媒体引用生成稳定标识，不包含标题、URL 或文件路径。只有播放中且宿主文档可见时才触发 `progress`，每秒最多一次。

## Effective playback / 有效播放时长

```ts
api.playback.getEffectivePlayback({ localDate: '2026-10-20' })
// { playingMs: number }
```

`localDate` uses the renderer's local calendar date. The result counts wall-clock time while playback is active and the host document is visible. Paused or ended time, media switches, and hidden-document time are excluded; intervals crossing local midnight are split by date. Each renderer tracks its own total, which resets when that renderer reloads.

`localDate` 使用当前渲染窗口的本地日历日期。返回值只累计播放器正在播放且宿主文档可见的墙上时间；暂停、结束、切换媒体和文档隐藏期间不计入。跨本地午夜的时段按日期拆分。每个渲染窗口独立累计，窗口重新加载后计数清零。

## Compatibility / 兼容入口

Existing top-level methods and `controller` remain available as legacy compatibility surfaces. The proposed top-level `getEffectivePlayback` call remains supported; its canonical v1 path is `integration.playback.getEffectivePlayback`. New integrations should use the grouped API. Request screenshots through `actions.trigger('screenshot')`; v1 does not expose a raw screenshot blob. The raw `player`, mutable runtime state, and undocumented window events are internal implementation details and are not covered by this contract.

现有顶层方法和 `controller` 暂时作为兼容接口保留。提案中的顶层 `getEffectivePlayback` 仍受支持，v1 的规范路径是 `integration.playback.getEffectivePlayback`。新接入请使用分组后的 API。截图通过 `actions.trigger('screenshot')` 请求；v1 不暴露原始截图 Blob。底层 `player`、可变运行时状态和未文档化的窗口事件属于内部实现，不在本契约范围内。

