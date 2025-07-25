# 思源媒体播放器 - B站扩展使用说明

## 概述

为了避免潜在的版权问题，思源媒体播放器已将B站相关API抽取为可选的扩展脚本。
用户需要手动添加B站扩展脚本才能使用B站相关功能。

## 功能特性

- **脚本注入机制**：通过思源笔记代码片段动态注入B站功能
- **按需启用**：不添加脚本时，B站相关功能完全不显示

## 使用步骤

### 1. 添加B站扩展脚本

1. 下载B站扩展脚本：[GitHub下载](https://github.com/mm-o/siyuan-media-player/raw/main/docs/bilibili-extension.js) | [Gitee下载](https://gitee.com/m-o/siyuan-media-player/blob/master/docs/bilibili-extension.js)
2. 打开思源笔记
3. 进入 `设置` → `外观` → `代码片段` → `JS`
4. 点击 `+` 添加新的代码片段
5. 将下载的脚本文件内容完整复制到代码片段中
6. 保存代码片段

### 2. 重启或刷新

- 重启思源笔记，或者
- 刷新浏览器页面（如果使用浏览器版本）

### 3. 验证扩展状态

1. 打开媒体播放器插件
2. 进入 `设置` 标签页
3. 在 `账号` 部分应该能看到 `B站账号` 选项
4. 在 `列表` 标签页的添加菜单中应该能看到B站相关选项

## 扩展管理

### 控制台管理

可以在浏览器控制台中使用以下命令管理扩展：

```javascript
// 检查扩展状态
window.bilibiliExtensionUtils.status()

// 启用扩展
window.bilibiliExtensionUtils.enable()

// 禁用扩展
window.bilibiliExtensionUtils.disable()

// 查看扩展信息
window.bilibiliExtensionUtils.info()

// 查看所有已注册的扩展
window.siyuanMediaPlayerExtensions?.getAll()
```

### 扩展系统事件

扩展系统会触发以下事件，可用于监听扩展状态变化：

- `mediaPlayerExtensionRegistered`：扩展注册时触发
- `mediaPlayerExtensionToggled`：扩展启用/禁用时触发
- `mediaPlayerExtensionUnregistered`：扩展卸载时触发

## 技术实现

### 关键修改点

1. **API配置动态化**：将硬编码的 `BILI_API` 改为从扩展系统动态获取
2. **功能条件显示**：所有B站相关UI都添加了 `isBilibiliAvailable()` 检查
3. **扩展注册系统**：提供全局的扩展注册和管理机制
4. **向后兼容**：不破坏现有功能，渐进式改进

## 注意事项

### 法律声明

- 此扩展仅供技术学习和个人使用
- 请遵守B站等相关网站的使用条款
- 如有版权争议，请及时删除扩展脚本

### 使用限制

- 扩展脚本需要用户手动添加，不会自动启用
- 删除代码片段后，B站功能将自动禁用
- 扩展系统仅在插件启动时初始化

### 故障排除

**Q: 添加脚本后B站功能仍未显示？**
A: 请检查：
1. 代码片段是否保存成功
2. 是否重启了思源笔记或刷新了页面
3. 浏览器控制台是否有错误信息

**Q: 如何确认扩展是否正常工作？**
A: 在浏览器控制台执行 `window.bilibiliExtensionUtils.status()` 查看状态

**Q: 如何临时禁用B站功能？**
A: 在控制台执行 `window.bilibiliExtensionUtils.disable()` 或删除代码片段

**Q: 看到"注册失败"的错误怎么办？**
A: 这通常是正常的，因为扩展系统会尝试多次注册。只要最终看到"注册成功"即可。如果持续失败，请：
1. 检查代码片段是否完整复制
2. 重启思源笔记
3. 在控制台检查是否有其他错误信息

---

**免责声明**：此扩展仅为技术演示，使用者需自行承担使用风险，开发者不对任何法律问题负责。
