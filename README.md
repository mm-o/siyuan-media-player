[中文](README_zh_CN.md) | English
# SiYuan Media Player Plugin

A powerful media player plugin for SiYuan Note, supporting various media formats and providing rich playback features.

## Features

- **Multiple Format Support**
  - Local video/audio files (supports mp4, mp3, webm, ogg, wav, m4v)
  - Bilibili videos (supports BV number and links)

- **Playback Controls**
  - Play/Pause/Stop
  - Volume adjustment
  - Playback speed control (0.5x - 2.0x)
  - Fullscreen/Web fullscreen mode
  - Picture-in-Picture mode
  - Video flip
  - Aspect ratio adjustment

- **Advanced Features**
  - Video screenshot (supports clipboard copy)
  - Timestamp link generation (supports Bilibili and regular media)
  - Loop segment playback (supports Bilibili and regular media)
  - Playlist management (supports grouping, pinning, favorites)
  - Custom settings (volume, speed, autoplay, etc.)
  - Bilibili account login (supports QR code login)

## Usage Guide

### Basic Usage
1. Click the media player icon in the top bar to open the player
2. Enter link to add to playlist
3. Paste Bilibili video links directly to the playlist
4. Click media links in documents to automatically open with the player

### Playlist Features
- Create multiple playlist groups
- Support for pinning and favoriting media items
- Right-click menu shortcuts

### Timestamp Features
- Click timestamp button to generate current time link
- Support timestamps for Bilibili and regular media
- Click timestamp links to jump to specific times

### Loop Segment Features
- Click loop segment button (twice) to generate loop segment link
- Support loop segments for Bilibili and regular media
- Click loop segment link to play the segment in loop

### Settings Options
Access through the settings icon in the player:
- Volume adjustment (0-100)
- Playback speed (0.5x-2.0x)
- Loop playback toggle
- Bilibili account login

## Version History

### v0.1.5 (2025.1.26)
- Refactored playback logic for better stability
- Added loop segment support
- Fixed known issues
- Optimized performance

### v0.1.1 (2025-01-23)
- Refactored playback logic for better stability
- Added loop segment support
- Fixed known issues
- Optimized performance

### v0.0.1 (2025-01-18)
- Initial release
- Basic playback functionality
- Bilibili video support
- Playlist management

## Development Plans

1. **Bilibili Feature Enhancements**
   - Add danmaku support
   - Support more Bilibili video formats
   - Optimize video playback experience

2. **Timestamp Feature Enhancements**
   - Custom timestamp link format
   - Custom timestamp display style
   - Batch timestamp generation

3. **Other Planned Features**
   - Support for more video sources (YouTube, etc.)
   - Enhanced playlist management
   - Performance optimization
   - Mobile adaptation

*Note: Development timeline may be adjusted based on user feedback and technical feasibility.*

## Support

- Issue reporting: [GitHub Issues](https://github.com/mm-o/siyuan-media-player/issues)
- Author: mm-o

## Thanks

- Thanks to [SiYuan Plugin Development Guide](https://ld246.com/article/1723732790981#START-UP) and its author for the detailed development documentation.
- Thanks to [vv](https://github.com/Wetoria), the developer of Leaf plugin, for helping solve development issues. His [Leaf plugin](https://simplest-frontend.feishu.cn/docx/B3NndXHi7oLLXJxnxQmcczRsnse) is highly recommended and very useful.
- Thanks to [ArtPlayer](https://artplayer.org/document/) project and its developers for answering questions and providing support.
- Thanks to [bilibili-API-collect](https://socialsisteryi.github.io/bilibili-API-collect/) project for providing Bilibili API documentation.

## License

MIT License

