# SiMedia for SiYuan

**A multi-source media player, cloud media center, and timestamp-note workspace for SiYuan Note**

Turn SiYuan Note into a unified player, cloud-drive media browser, timestamp recorder, and study-oriented media workspace.  
Supports local media, BBLL, TTVV, OpenList, WebDAV, Baidu Netdisk, Aliyun Drive, Quark, 115, 123 Pan, OneDrive, S3, and more.

[![Version](https://img.shields.io/badge/version-1.1.6-blue.svg)](https://github.com/mm-o/siyuan-media-player)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![SiYuan](https://img.shields.io/badge/SiYuan-3.0+-orange.svg)](https://github.com/siyuan-note/siyuan)

**🌐 [Official Site](https://simedia.745201.xyz) · 💳 [Purchase License](https://pay.ldxp.cn/shop/J7MJJ8YR/zmfsuc) · 👥 [QQ Group](https://qm.qq.com/q/wpHDtsfxCw) · 📝 [Changelog](./更新日志.md)**

---

## Latest Update

### v1.1.6 Release Notes (2026.4.18)
#### New Features
- **Player info button enhancement**: The player info button now shows the title, link, and episode / page list directly, and supports switching playback from inside the panel.

#### Improvements
- **Smarter proxy detection**: Media proxy detection now only bypasses proxying for true loopback addresses, avoiding false matches for LAN WebDAV / OpenList sources.

#### Bug Fixes
- **Mobile local playback**: Fixed cases where imported or local media on mobile incorrectly went through the proxy and failed to play.
- **Mac local-link playback**: Fixed absolute Mac paths such as `/Users/...` not being converted to the `file://` protocol, which previously became `http://127.0.0.1/...` and failed to play.
- **SiYuan workspace path detection**: Fixed `/public/`, `/assets/`, `/data/`, and similar workspace paths being mistaken for local files and incorrectly converted to `file://`, which could break playback inside the plugin.
- **Imported-link playback**: Fixed some imported links not being resolved or played correctly by unifying local-path, file-protocol, and playback-resolution handling.
- **BBLL link display**: Fixed BBLL links in player info and media notes showing internal `bilibili://...` or `blob:` URLs, and now consistently output the real BBLL page link.

### v1.1.5 Release Notes (2026.4.17)
#### New Features
- Added a custom player option so you can choose another player for playback.
- **Docker environment support**: Added support for Docker environments. This is currently provisional support, and playback experience still needs further optimization.
- **Initial mobile-page support**: Added initial support for the mobile page. The current experience is still not ideal and will continue to be improved.
- **Mini player refactor**: Added a minimal mini player and moved bottom controls closer to native SiYuan status-bar interaction, with a more compact unified structure and style.

#### Improvements
- **Quark playback optimization**: Reduced unnecessary relays and duplicate loads in the Quark playback chain, significantly improving startup, seeking, and timestamp-jump speed.
- **Multi-drive playback optimization**: Unified playback resolution flow for Aliyun Drive, 123 Pan, 115, OneDrive, and similar drives to reduce duplicate reads and extra waiting.
- **Multi-source loading optimization**: Improved loading flow for Aliyun Drive, Baidu Netdisk, TTVV, BBLL, and other sources to reduce duplicate requests and speed up opening.
- **Proxy flow refactor**: Refactored media proxy logic so normal cross-origin links no longer go through the proxy unless actually needed, making playback lighter and faster overall.
- **SiYuan style alignment**: Reused more of SiYuan's existing card, button, icon, and slider styles in the mini player to reduce custom style code.
- **Playback switching optimization**: Optimized switching between the full player and mini player to reduce repeated parsing and media loading, with background playback preferring pure-audio mode.
- **Player code cleanup**: Further compressed and unified player and mini-player internals by merging repeated methods and state handling.

#### Bug Fixes
- **Sidebar close fix**: Fixed the issue where the top button could not close the sidebar.
- **Local media metadata save fix**: Fixed the issue where edited local-media metadata could not be saved.
- **Slow Quark folder playback**: Fixed the long delay when starting playback from Quark folders, improving video open speed inside folders.
- **Duplicate cloud-drive loading**: Fixed cases where some drives performed an extra directory read or duplicate loading during playback.
- **Redundant subtitle scanning**: Reduced unnecessary subtitle scans during playback to lower extra waiting time.
- **BBLL account detection issue**: Fixed incorrect BBLL account recognition that could break favorites and related features.
- **Mini-player subtitle loading**: Fixed subtitles in the mini player relying on assistant-panel triggers by completing subtitle warmup and auto-attachment flow.
- **Player restore-to-video issue**: Fixed the case where restoring from the mini player back to the full player only showed the cover instead of the video.
- **Background playback display issue**: Fixed leftover playback layers and control icons in background-playback mode so hiding behavior is now more complete.

### v1.1.4 Release Notes (2026.4.12)

#### ✨ New Features
- **📱 Mobile Browsing & Playback**: Added support for browsing and playing media on mobile devices.
- **💬 Subtitle Selection**: Added subtitle selection feature with automatic same-name subtitle loading or manual selection, fully supporting cloud drive subtitles.

#### 🔧 Improvements
- **📋 Media Note Copy Optimization**: Unified copy logic for media notes and screenshots. When cover fetch fails, automatically uses current frame screenshot. Only copies text content (with image references) to avoid compatibility issues from copying images and text simultaneously.
- **📸 Screenshot Enhancement**: Optimized screenshot logic. Pure screenshots directly copy image Blob, while screenshots with timestamps upload images and return text references.
- **🎬 Danmaku State Persistence**: Fixed issue where danmaku would auto-show after seeking when manually closed. Now remembers user's show/hide state.
- **🔄 Danmaku Merge Function**: Player danmaku now supports merging identical content, grouping by time and showing count (e.g., "Danmaku text ×3"), consistent with assistant panel.
- **🏷️ Playlist Icon Display**: Supports displaying SiYuan custom icons (.png) and dynamic icons (api/icon/getDynamicIcon) with fully consistent interaction as standard Emoji.
- **🎛️ Dash.js Config Optimization**: Removed unsupported `fastSwitchEnabled` parameter, simplified config, increased retry count for better playback stability.
- **🔍 Search Box Color Adaptation**: Fixed search text visibility in dark mode by using SiYuan CSS variables for theme adaptation.
- **💻 Mac Local File Playback**: Fixed Mac local file link playback issue by automatically converting local paths to `file://` protocol.
- **🖼️ Cover Save Function**: Fixed cover save failure during media import. Now automatically creates directory and saves covers to `/public/siyuan-media-player/covers/`.
- **🎯 Codec Warning Optimization**: For unsupported codecs (H.265/HEVC, AV1, VP9), only shows warning on actual playback failure to avoid false positives.

#### 🐛 Bug Fixes
- **🔐 Quark Login Fix**: Fixed missing QR code button in Quark login.
- **📂 Media List Fix**: Fixed import error caused by undefined `selectFiles` and `selectFolder`.
- **🌐 SiYuan Resource Path**: Fixed local path conversion logic affecting SiYuan resource paths (`/assets/`, `/data/`, `/public/`, etc.).
- **🎬 Danmaku Reload Fix**: Fixed danmaku reloading issue when clicking to seek in subtitle or danmaku panel.

### v1.1.3 Release Notes (2026.4.9)

#### Improvements
- **New-window playback flow**: Switched new-window opening to the native SiYuan window chain, avoiding duplicate player mounts, making startup faster, and fixing incorrect playback-parameter delivery.
- **New-window document insertion**: Timestamp, screenshot, and loop-clip insertion now bridges back to the main window when inserting into the current document, so editor resolution stays stable.
- **Cloud playback optimization**: Unified direct-link optimization and proxy warmup for WebDAV, Quark, Baidu Netdisk, Aliyun Drive, OpenList, OneDrive, 123 Pan, 115, S3, and similar remote media sources.
- **Streaming engine enhancement**: Tuned DASH, HLS, and FLV buffering, retry, and recovery strategy for better Bilibili, cloud-drive, and large-file playback stability.
- **TVBox source strategy**: Added unified media-type detection for TVBox lines, with better mpd / m3u8 / flv matching.
- **Dead-code cleanup**: Removed the unused legacy GPU / hardware-decode detection code.

#### Bug Fixes
- **New-window double audio**: Fixed the case where audio started early or played twice before the video finished loading in a new window.
- **Insertion target lookup**: Fixed failures when inserting timestamps, screenshots, or loop clips from a new window into the active document.

### v1.1.2 Release Notes (2026.4.6)

#### ✨ New Features
- **🔍 Media List Search**: Added unified multi-source search for local media, BBLL, TTVV, cloud drives, and more.
- **📺 BBLL Triple Action**: Added like, coin, and favorite actions, with support for choosing favorite folders.
- **💬 BBLL Comment Assistant**: Added comment loading, reply expansion, emoji display, right-click copy, and subtitle language switching.
- **🔄 TTVV Refresh Button**: Added a reload entry for the current page.
- **📝 Sidebar Description**: Added a description card in the side panel.
- **📄 TTVV Detail Enhancement**: Added more detail fields and episode display.
- **🔗 Copy Link**: Added direct link copying without time parameters.
- **📂 Open File Location**: Local media now supports opening its file location directly.
- **📚 BBLL Category Expansion**: Added Bangumi and Film/TV categories with matching search support.
- **🎛️ BBLL Filter Browsing**: Added filter-based browsing for Bangumi and Film/TV.
- **ℹ️ Playlist Detail Panel**: Added a detail panel to show more item information.
- **✏️ Favorites Management**: Added rename and delete support for favorite items and folders.
- **🗑️ History Management**: Added single-item delete and clear-all support.

#### 🔧 Improvements
- **📝 Media Note Display**: Improved available field rendering in media notes.
- **🎬 TTVV Default Playback**: Optimized default playback to prefer m3u8.
- **🎵 BBLL Playback Method**: Switched to merged Dash stream playback for better stability and smoother high-quality playback.
- **🧭 Import Logic Optimization**: Improved compatibility with more system path formats.
- **🗂️ Default Media Library Adjustment**: Changed default folders to Videos, Music, and Images.
- **📁 Playlist Add Flow Optimization**: Improved the logic and UI template for creating new folders.
- **📌 Unified Insert Logic**: Unified insert behavior for media notes, timestamps, loop clips, and screenshots, with remembered target document support.

#### 🐛 Bug Fixes
- **📝 Subtitles and Summary**: Fixed cases where BBLL subtitles, danmaku, and AI summary were not displayed.
- **🧩 TTVV Pagination**: Fixed page switching not working correctly.
- **📸 Baidu Netdisk Screenshot**: Fixed screenshot failures.
- **🧾 Media Note Template**: Fixed incorrect field replacement and mixed content in note templates.
- **📋 Clipboard Copy**: Fixed media note copy-to-clipboard failures.
- **📂 Media List Collapse**: Fixed folders and media items collapsing automatically.
- **🕘 History Playback**: Fixed playback errors for history items in playlists.
- **📚 Document Selection**: Fixed inability to select notebooks and documents.
- **🔗 URL Import**: Fixed URL import not being added correctly.
- **🎥 BBLL Playback**: Fixed some Bilibili videos failing to play.

### v1.1.1 (2026.4.5)

- Fixed picture-in-picture, web fullscreen, and fullscreen not working, and made them mutually exclusive.
- Optimized external script loading for better stability.

### v1.1.0 (2026.4.5)

#### Architecture rewrite
- Full Vue 3 rewrite of the plugin core, major views, state flow, and module boundaries.
- Storage refactor with database-backed management for settings, accounts, history, favorites, resume state, and media records.
- Unified driver layer across local media, BBLL, TTVV, cloud drives, OpenList, and WebDAV.

#### New features
- New media list with clearer separation between browsing and playback.  
  ![Media list](https://simedia-home.745201.xyz/main-ui.png)
- Added 115 support.
- Added OneDrive support.
- Better image preview for local and cloud media.
- Media info management for viewing and editing metadata.  
  ![Multi-drive and media list](https://simedia-home.745201.xyz/multi-drive-view-sort.png)
- Independent window playback.  
  ![Independent windows](https://simedia-home.745201.xyz/multi-window.png)
- Better cursor insertion for timestamps, clips, and media notes.  
  ![Timestamp and media notes](https://simedia-home.745201.xyz/timestamp-insert.png)
- Better OpenList / WebDAV mount support.
- Preferred quality setting, defaulting to 720p.

#### List and UI refactor
- Playlist rewrite with more consistent expand, sync, switch, and state update logic.
- History refactor into a cleaner page-style structure.
- Favorites refactor into the same unified list model.
- Cleaner UI logic with less redundant branching and smoother interactions.

#### Cloud and playback fixes
- Quark rewrite and fixes for auth, media recognition, playback links, timestamp paths, and resume flow.
- Baidu Netdisk improvements for default quality selection and playback/timestamp behavior.
- BBLL fixes for history and post-extraction recommendation issues.
- Proxy playback improvements for better compatibility and stability.

#### Playback improvements
- Resume after restart.
- Resume flow cleanup across player, drivers, and page restore.
- Unified playback behavior for images, audio, video, and PDFs.

#### Fixes
- Fixed blank flashing when entering deeper playlist levels.
- Fixed playlist and media list expand/collapse desync.
- Fixed resume failures after independent-window or new-window playback.
- Fixed player config update errors.
- Fixed some cloud media being recognized only as “other files”.
- Fixed overlong and messy timestamp paths for some media.
- Fixed membership guide links, purchase links, and tooltip display.
- Fixed multiple Chinese copy and interaction-detail issues.

#### Optimizations
- Removed more duplicated logic and patch-style branching.
- Unified driver return structures.
- Simplified some player/list linkage logic.
- Clarified boundaries between document links, timestamps, resume, and proxy playback.

---

## Full Feature List

| Module | Feature | Description |
|--------|---------|-------------|
| Playback sources | Local media | Import, browse, play, and preview local video, audio, image, PDF, and URL-based media |
|  | BBLL | Supports videos, multi-part items, collections, favorites, history, detail fields, and episode side panels |
|  | TTVV | Supports source browsing, detail parsing, episode switching, and playback |
|  | Cloud drives | Supports Baidu Netdisk, Aliyun Drive, Quark TV / UC / Open, 115, 123 Pan, OneDrive, OpenList, WebDAV, and S3 |
|  | Images and non-video media | Unified entry for images, audio covers, PDFs, and mixed media types |
| Data and storage | Unified database storage | Media library, cloud accounts, playback history, settings, resume positions, and default folders are all stored in one database |
|  | Migration and repair | Built-in table creation, index repair, cleanup, migration, and storage optimization |
|  | Default library bootstrap | Automatically creates Media Library, Videos, Music, BBLL, and related default folders |
| Playlist | Three-page structure | Playlist, Favorites, and History are implemented as three unified pages in the same navigation layer |
|  | Tree navigation | Folder tree browsing with indentation, expand/collapse, and current-item highlighting |
|  | Expand / collapse all | One-click expand all and collapse all |
|  | Top actions | Sorting, adding, and more actions from the header |
|  | Root-level entries | Enter cloud accounts and media directories directly from the playlist page |
|  | Icon management | Local folders support custom icon changes |
| Favorites | Favorite media | Add local and cloud media into Favorites |
|  | Favorite folders | Add local and cloud folders into Favorites |
|  | Duplicate guard | Prevents duplicated favorite entries |
|  | Dedicated page | Favorites has its own unified page entry |
| History | Recent playback | Automatically records recently played media |
|  | History limit | Keeps the latest 30 history records by default |
|  | Replay from history | Replay history items with saved timing information |
|  | History page | History is exposed as a first-class page beside Playlist and Favorites |
| Media list | Dedicated browsing layer | Media List is separated from Playlist and focuses on browsing, filtering, details, and batch operations |
|  | Breadcrumb navigation | Navigate and jump back through folder path breadcrumbs |
|  | Search | Fast filtering by name and artist |
|  | Folder section | Folder area is shown independently with its own expand/collapse behavior |
|  | Media section | Media area is shown independently with its own expand/collapse behavior |
|  | Subfolder mode | Toggle between current folder only and recursive “include subfolders” mode |
|  | Cloud pagination | Cloud directories support paged browsing and page switching |
| Views and display | Folder views | Grid and list views for folders |
|  | Media views | Grid, waterfall, list, and detail views for media |
|  | Display elements | Toggle name, artist, size, duration, play count, added time, album, year, genre, bitrate, sample rate, codec, and resolution independently |
|  | Persistent column widths | List columns support resize and persistent width saving |
|  | Thumbnails | Unified local and remote thumbnail / cover loading |
| Sorting | Sort fields | Default order, name, added time, last played, play count, and type |
|  | Sort direction | Ascending and descending |
|  | Natural sort | Natural sorting for names, better for mixed numbers and multilingual titles |
| Sidebar and details | Statistics sidebar | Folder and media statistics including totals, played / unplayed, averages, HD count, artist count, album count, and newest added |
|  | Detail sidebar | Cover, title, description, and full metadata display |
|  | Edit sidebar | Local metadata editing and batch save workflows |
|  | Delete confirmation | Single-item and batch delete confirmation |
|  | Add panel | Add URL and create folder from the sidebar |
|  | Import panel | Import files, folders, copy as files, or save as links |
| Media management | Rename | Rename local media, local folders, and cloud items when supported by the driver |
|  | Delete | Local delete, cloud delete, and cascading folder delete |
|  | Create folder | Create folders in local libraries and supported cloud directories |
|  | Add URL | Add direct URL media items manually |
|  | Import local resources | Import files and folders either as copied files or as lightweight links |
|  | Download | Download cloud media to the local desktop environment |
|  | Context menu | Play, detail, favorite, rename, delete, create folder, add URL, open in new tab, download, and more |
| Batch operations | Multi-select | Multi-select, select all, and clear selection |
|  | Batch edit | Save edits across selected items |
|  | Batch delete | Delete multiple selected items together |
|  | Batch import confirmation | Confirm and import selected items from the import list |
| Cloud capabilities | Multi-account | Multiple accounts per provider with grouped display |
|  | Account management | Add, edit, refresh, and remove cloud accounts from Settings |
|  | Auth flows | Password login, QR login, auth-page login, token-based login, and other driver-defined flows |
|  | OpenList / WebDAV | Mount browsing, media recognition, playback, and refresh |
|  | Cloud file operations | Create folder, rename, delete, and download depending on driver capability |
|  | Cache strategy | Directory cache, page cache, and cache invalidation on account changes |
|  | Root mapping | Cloud roots are mapped into unified media nodes inside the library structure |
| Player | Built-in player | ArtPlayer-based unified video and audio playback |
|  | External players | MPV, PotPlayer, VLC, and browser playback |
|  | Open modes | New tab, right tab, bottom tab, and new window |
|  | Multi-instance | Supports both multi-instance and singleton reuse |
|  | Playback queue | Shared previous / next queue across entry points |
|  | Image viewer | Images open in a dedicated preview viewer with queue support |
|  | Audio cover | Audio items support cover display |
|  | HLS / FLV | Supports m3u8 and flv playback |
|  | Separate audio track | Supports standalone audio track loading and switching |
|  | Live flag | Supports runtime live-stream flag forwarding |
| Resume and controls | Resume playback | Resume after close and after restart |
|  | Progress persistence | Saves progress on pause and seek |
|  | Single loop | Loop the current item |
|  | Playlist loop | Loop playback across the queue |
|  | Loop segment | Loop between start and end timestamps |
|  | Pause after loop | Stop after clip loop finishes its configured count |
|  | Skip intro / outro | Time-based intro and outro skipping |
|  | Preferred quality | 720P, 1080P, 480P, 360P, and original / auto preference |
| Subtitles | Subtitle visibility | Show / hide subtitles |
|  | Preferred language | Auto-pick subtitle tracks by preferred language |
|  | Subtitle offset | Shift subtitle timing |
|  | Subtitle style | Style, font size, color, background color, and background opacity |
|  | Subtitle loading | Dynamic subtitle loading and setting-panel switching |
| Danmaku | Danmaku toggles | Enable and visibility controls |
|  | Danmaku style | Speed, opacity, font size, color, and display area |
|  | Danmaku modes | Scrolling, top, bottom, and mode filtering |
|  | Danmaku optimization | Anti-overlap, sync speed, heatmap, and max-length filtering |
| Notes and insertion | Timestamp links | Generate and replay timestamped media links |
|  | Timestamp offset | Shift generated timestamps backward or forward |
|  | Loop segment links | Insert repeatable clip segments into notes |
|  | Screenshot insertion | Insert screenshots with or without timestamps |
|  | Insert modes | Insert at cursor, append/prepend block, update current block, prepend/append document, or copy to clipboard |
|  | Media note creation | Insert into current doc, create under notebook, create under a target doc, or create in DailyNote |
|  | Target selection | Target notebook selection, target doc search, and target doc picking |
| Templates and formats | Template presets | Simple, Callout, and Quote presets |
|  | Link format | Custom link rendering format |
|  | Media note template | Variables for title, time, artist, duration, type, cover, ID, date, timestamp, and more |
|  | Screenshot format | PNG, JPEG, and WebP |
|  | Screenshot quality | JPEG / WebP quality control |
| UI and interaction | Media list toggle | Enable or disable Media List |
|  | Mobile floating button | Optional floating TV-style entry on mobile |
|  | Colorful file tree | Colorized hierarchy styling for plugin trees |
|  | Bordered file tree | Card-like bordered styling for plugin trees |
|  | Unified page structure | Playlist, Favorites, History, and Media List share a unified interaction structure |
| Driver system | Driver registry | All sources and cloud drives are wired through a shared registry |
|  | Driver metadata | Supports field definitions, input types, select options, QR login, auth pages, connection tests, and account descriptions |
|  | Unified upper-layer access | The list layer reads directories, resolves media, and performs file operations through the same driver abstraction |
| License and service | License entry | Official site, purchase entry, and membership authorization |
|  | Tiered capabilities | Membership gates advanced cloud, subtitle, screenshot, and UI customization capabilities |

---

## License Notes

The plugin includes a membership / license system for advanced sources and enhanced features.

- Official site: <https://simedia-home.745201.xyz>
- Purchase link: <https://pay.ldxp.cn/shop/J7MJJ8YR/zmfsuc>
