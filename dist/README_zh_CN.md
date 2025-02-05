+ 中文 | [English](README.md)
# 思源笔记媒体播放器插件

一个功能强大的思源笔记媒体播放器插件，支持多种媒体格式，提供丰富的播放功能。

## 打赏、鼓励、催更 🎉
![打赏、鼓励、催更](https://745201.xyz/c42d51ea098d3a8687eb50012d1689e.jpg)
![打赏、鼓励、催更](https://745201.xyz/e43d21e2c04f47ddcc294cd62a64e6f.jpg)

## 版本更新说明

### v0.1.7 (2025.02.05)
- 改进内容插入机制
  - 将直接插入块改为复制到剪贴板
  - 用户可以自由选择粘贴位置
- 修复/命令菜单错位的问题

- **非常抱歉，最近一段时间比较忙，全力备考，不能及时更新了，大家先将就用。**

### v0.1.6 (2025.1.27)
- 优化B站视频分P支持
  - 正确获取分P视频的cid
  - 标题中显示分P信息
  - 支持通过p参数直接跳转到指定分P
- 优化循环播放功能
  - 循环次数可在设置中配置(1-10次)
  - 播放器界面显示循环进度
  - 统一配置管理
- 修复已知问题
  - 修复链接处理逻辑（正确识别媒体链接）
  - 优化代码结构

### v0.1.5 (2025.1.26)
- 重构播放逻辑，提升稳定性
- 增加循环片段支持
- 修复已知问题
- 优化性能表现

### v0.1.1 (2025-01-23)
- 重构播放逻辑，提升稳定性
- 增加循环片段支持
- 修复已知问题
- 优化性能表现

### v0.0.1 (2025-01-18)
- 初始版本发布
- 基础播放功能
- B站视频支持
- 播放列表管理

## 功能特性

- **多格式支持**
  - 本地视频/音频文件（支持 mp4, mp3, webm, ogg, wav, m4v）
  - B站视频播放（支持 BV 号和链接）

- **播放控制**
  - 播放/暂停/停止
  - 音量调节
  - 播放速度控制（0.5x - 2.0x）
  - 全屏/网页全屏模式
  - 画中画模式
  - 画面翻转
  - 画面比例调节

- **高级功能**
  - 视频截图（支持复制到剪贴板）
  - 时间戳链接生成（支持B站和普通媒体）
  - 循环片段播放（支持B站和普通媒体）
  - 播放列表管理（支持分组、置顶、收藏）
  - 自定义设置（音量、速度、自动播放等）
  - B站账号登录（支持扫码登录）


## 使用说明

### 基本使用
1. 点击顶栏的媒体播放器图标打开播放器
2. 输入链接可以添加到播放列表
3. B站视频可直接粘贴视频链接到播放列表
4. 点击文档中的媒体链接自动使用播放器打开

### 播放列表功能
- 创建多个播放列表分组
- 支持媒体项置顶和收藏
- 右键菜单快捷操作

### 时间戳功能
- 点击时间戳按钮生成当前时间链接
- 支持B站视频和普通媒体的时间戳
- 点击时间戳链接自动跳转到指定时间

### 循环片段功能
- 点击循环片段按钮（两次）生成循环片段链接
- 支持B站视频和普通媒体的循环片段
- 点击循环片段链接进行片段循环播放

### 设置选项
通过播放器中的设置图标访问：
- 音量调节（0-100）
- 播放速度（0.5x-2.0x）
- 循环播放开关
- B站账号登录

## 开发计划

1. **B站功能增强**
   - 添加弹幕支持
   - 支持更多B站视频格式
   - 优化视频播放体验

2. **时间戳功能增强**
   - 自定义时间戳链接格式
   - 自定义时间戳显示样式
   - 批量生成时间戳功能

3. **其他计划功能**
   - 支持更多视频源（YouTube等）
   - 增强播放列表管理
   - 性能优化
   - 移动端适配

*注：具体开发时间表可能会根据用户反馈和技术可行性进行调整。*

## 支持

- 问题反馈：[GitHub Issues](https://github.com/mm-o/siyuan-media-player/issues)
- 作者：mm-o

## 感谢

- 感谢[思源笔记插件开发指南](https://ld246.com/article/1723732790981#START-UP)及其作者提供的详细开发文档。
- 感谢归叶插件开发者 [vv](https://github.com/Wetoria) 帮助解决开发问题，非常推荐他开发的[叶归插件](https://simplest-frontend.feishu.cn/docx/B3NndXHi7oLLXJxnxQmcczRsnse)，非常好用。
- 感谢 [ArtPlayer](https://artplayer.org/document/) 项目和开发者答疑解惑。
- 感谢 [bilibili-API-collect](https://socialsisteryi.github.io/bilibili-API-collect/) 项目提供的 B站 API 文档。

## 许可证

MIT License
