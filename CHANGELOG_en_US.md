# Changelog

## v0.3.4 (2025.5.26)

### Feature Updates
- **Button Layout**: Optimized function button positions for better usability
- **Icon Update**: Modified dock bar icon for improved visibility
- **Media Link Logic**: Refactored media link checking logic to support local media links
- **Bug Fixes**: Fixed issue with local media timestamp links not working properly
- **Various Improvements**: Multiple detail enhancements and optimizations

## v0.3.3 (2025.5.18)

### Feature Updates
- **UI Overhaul**: Removed top icons, now accessible through dock bar button
- **Button Layout Optimization**: Moved function buttons to the top with toggle visibility
- **Playback Loop Enhancement**: Added single item loop and playlist loop functionality
- **Loop Control**: Added pause after loop completion feature
- **Danmaku Features**: Added danmaku list for easy export of bullet comments
- **Account Display**: Optimized account display method

## v0.3.2 (2025.5.11)

### Feature Enhancements
- **UI Improvements**: Unified design style for assistant, playlist, and settings panels, enhancing overall user experience
- **AList Support**: Added AList cloud storage support, expanding media source options
- **File Selection**: Improved local file import with direct file selection, streamlining media addition
- **Panel Adjustments**: Added support for resizing panels through drag and drop, for flexible interface layout
- **Loop Settings**: New option to automatically pause playback after loop completion
- **Media Notes**: Added media notes creation feature with customizable note templates
- **Tab Menu Simplification**: Optimized tab menu, removing complex tab+right-click operation logic

### Insertion Function Improvements
- Extended document insertion methods with multiple options:
  - Insert at cursor (insertBlock)
  - Append to block end (appendBlock)
  - Add to block beginning (prependBlock)
  - Update current block (updateBlock)
  - Insert at document top (prependDoc)
  - Insert at document bottom (appendDoc)
  - Copy to clipboard (clipboard)
- Extended link format to support inserting timestamps with screenshots in one action
- Unified custom format system with reset to default options

### Code Optimization
- Extremely streamlined `src/core/utils.ts` file, removed redundant code, simplified function implementations, and merged similar functionality
- Standardized API naming to be consistent with SiYuan Note official API (such as `insertBlock`, `appendBlock`, etc.)
- Enhanced error handling, making the code more robust
- Removed most success notification messages (showMessage), only keeping failure notifications, further streamlining the code
- Improved clipboard operation success rate with success notifications
- Optimized documentation structure, improved README organization with collapsible sections and clearer table of contents

## v0.3.1 (2025.4.26)
1. Added support for showing/hiding Bilibili video subtitles via subtitle button in player interface
2. Added auto-scrolling for subtitle list in media assistant that follows playback progress
3. Optimized media assistant UI
4. Fixed errors caused by special characters in file paths
5. Enhanced screenshot feature with direct clipboard copy support
6. Unified subtitle handling logic for improved player performance

## v0.3.0 (2025.4.24)
1. Added Bilibili video danmaku (bullet comments) support
2. Introduced Pro features (optional)
3. Enhanced Bilibili favorites functionality with direct selection for adding to playlist
4. Added media assistant feature
5. Added subtitle support for both local media and Bilibili videos
6. Introduced video summary feature (currently supporting Bilibili videos only)

## v0.2.6 (2025.4.16)
1. Added external player options: PotPlayer and browser, for more flexible media viewing
2. Added quick browser opening: hold Ctrl key while clicking a link to open in browser
3. Media URLs in playlist are now clickable for easy browser viewing
4. Fixed the issue of duplicate Bilibili multi-part videos in playlists

## v0.2.5 (2025.4.10)
1. Added Bilibili favorites direct import feature, allowing one-click addition of entire favorite folders to playlist
2. Added 4 playlist view modes (detailed view, simple view, grid view, and cover view) to suit different browsing preferences
3. Fixed timestamp and loop segment links for Bilibili multi-part videos, links now correctly jump to the corresponding part
4. Refactored playlist system, split into multiple functional modules for improved performance and user experience 

## v0.2.2 (2025.4.7)
- Bug fixes
  - Fixed parsing failures for some network videos
  - Resolved stability issues in playlist management
- Performance optimization
  - Optimized memory usage, reduced resource consumption
  - Improved player loading speed
- UI improvements
  - Detail enhancements for better user experience
  - Fixed display issues with some interface elements

## v0.2.1 (2025.4.2)
- Added Bilibili multi-part video list feature
  - Automatically lists all video parts
  - Auto-collapse expanded part lists when double-clicking other items
- Enhanced player language support
  - Automatically switches player interface language based on SiYuan language settings
  - Improved English interface translations
- Optimized network media loading
  - Improved parse success rate for Samba and other network videos
  - Extended timeout and added automatic retry mechanism
  - Better support for slow network environments

## v0.2.0 (2025.3.28)
- Added internationalization (i18n) support
  - Complete support for Chinese and English interface localization
  - Dynamic language switching based on system settings
  - Automatic translation of playlist names when switching languages

## v0.1.9 (2024.3.27)
- Added batch import of media from local folders
- Added playlist clearing functionality
- Fixed playlist tab switching issues
- Fixed misalignment issues with the "/" command menu

## v0.1.8 (2025.3.26)
- Added Bilibili DASH stream support
  - Resolved audio/video synchronization issues
  - Improved playback stability
- Optimized link handling
  - Fixed timestamp and loop segment link issues
  - Improved link click behavior when player tab is not open
- Simplified settings options
  - Removed redundant settings
  - Added link insertion method selection (cursor position or clipboard)
- Fixed known issues and optimized performance

## v0.1.7 (2025.02.05)
- Improved content insertion mechanism
  - Changed from direct block insertion to clipboard copying
  - Users can freely choose where to paste
- Fixed misalignment issues with the "/" command menu
- Apologies, I've been quite busy recently, focusing on exams, and cannot update promptly. Please bear with the current version.

## v0.1.6 (2025.1.27)
- Optimized Bilibili multi-part video support
  - Correctly retrieves cid for multi-part videos
  - Displays part information in title
  - Supports direct jumping to specified parts via p parameter
- Optimized loop playback functionality
  - Loop count configurable in settings (1-10 times)
  - Player interface displays loop progress
  - Unified configuration management
- Fixed known issues
  - Fixed link processing logic (correctly identifies media links)
  - Optimized code structure

## v0.1.5 (2025.1.26)
- Refactored playback logic for improved stability
- Added loop segment support
- Fixed known issues
- Optimized performance

## v0.1.1 (2025-01-23)
- Refactored playback logic for improved stability
- Added loop segment support
- Fixed known issues
- Optimized performance

## v0.0.1 (2025-01-18)
- Initial release
- Basic playback functionality
- Bilibili video support
- Playlist management 