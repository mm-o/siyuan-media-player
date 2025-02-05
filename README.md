[中文](README_zh_CN.md) | English
# SiYuan Media Player Plugin

A powerful media player plugin for SiYuan Note, supporting multiple media formats and providing rich playback features.

## Donate & Encourage & Updates 🎉
![Donate & Encourage](https://745201.xyz/c42d51ea098d3a8687eb50012d1689e.jpg)
![Donate & Encourage](https://745201.xyz/e43d21e2c04f47ddcc294cd62a64e6f.jpg)

## Features

- **Multiple Format Support**
  - Local video/audio files (supports mp4, mp3, webm, ogg, wav, m4v)
  - Bilibili video playback (supports BV numbers and links)

- **Playback Controls**
  - Play/Pause/Stop
  - Volume adjustment
  - Playback speed control (0.5x - 2.0x)
  - Fullscreen/Web fullscreen mode
  - Picture-in-Picture mode
  - Video flip
  - Aspect ratio adjustment

- **Advanced Features**
  - Video screenshots (supports clipboard copy)
  - Timestamp link generation (supports Bilibili and regular media)
  - Loop segment playback (supports Bilibili and regular media)
  - Playlist management (supports grouping, pinning, and favorites)
  - Custom settings (volume, speed, autoplay, etc.)
  - Bilibili account login (supports QR code login)

## Usage Guide

### Basic Usage
1. Click the media player icon in the top bar to open the player
2. Input links to add to playlist
3. Bilibili videos can be directly pasted into the playlist
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

### v0.1.7 (2025.02.05)
- Changed content insertion mechanism
  - Replaced direct block insertion with clipboard operations
  - Users can now freely paste content anywhere
- Fixed command menu misalignment issue

- **I apologize that I've been quite busy recently preparing for exams and cannot update timely. Please bear with it for now.**

### v0.1.6 (2025.1.27)
- Enhanced Bilibili video part support
  - Correctly fetch cid for multi-part videos
  - Display part information in title
  - Support jumping to specific part via p parameter
- Improved loop playback functionality
  - Loop count configurable in settings (1-10 times)
  - Display loop progress in player interface
  - Unified configuration management
- Fixed known issues
  - Fixed link handling logic (correct media link recognition)
  - Optimized code structure

### v0.1.5 (2025.1.26)
- Refactored playback logic for better stability
- Added loop segment support
- Fixed known issues
- Improved performance

### v0.1.1 (2025-01-23)
- Refactored playback logic for better stability
- Added loop segment support
- Fixed known issues
- Improved performance

### v0.0.1 (2025-01-18)
- Initial release
- Basic playback functionality
- Bilibili video support
- Playlist management

## Development Plans

1. **Bilibili Feature Enhancement**
   - Add danmaku support
   - Support more Bilibili video formats
   - Optimize video playback experience

2. **Timestamp Feature Enhancement**
   - Custom timestamp link format
   - Custom timestamp display style
   - Batch timestamp generation

3. **Other Planned Features**
   - Support more video sources (YouTube, etc.)
   - Enhanced playlist management
   - Performance optimization
   - Mobile adaptation

*Note: The development schedule may be adjusted based on user feedback and technical feasibility.*

## Support

- Issue feedback: [GitHub Issues](https://github.com/mm-o/siyuan-media-player/issues)
- Author: mm-o

## Acknowledgments

- Thanks to [SiYuan Plugin Development Guide](https://ld246.com/article/1723732790981#START-UP) and its author for providing detailed development documentation.
- Thanks to Wetoria plugin developer [vv](https://github.com/Wetoria) for helping solve development issues. Highly recommend his [Wetoria plugin](https://simplest-frontend.feishu.cn/docx/B3NndXHi7oLLXJxnxQmcczRsnse).
- Thanks to [ArtPlayer](https://artplayer.org/document/) project and developers for answering questions.
- Thanks to [bilibili-API-collect](https://socialsisteryi.github.io/bilibili-API-collect/) project for providing Bilibili API documentation.

## License

MIT License

