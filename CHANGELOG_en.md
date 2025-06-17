# Changelog

## v0.3.5 (2025.6.2)

### Feature Updates
- **Playlist Refactoring**: Optimized playlist component structure and performance
- **Settings Component Refactoring**:
  - Removed complex pro and alist styles, simplified to toggle switches
  - Unified component processing logic, significantly improved efficiency
  - Added database avid and notebook ID display
  - Removed save and reset buttons, implemented real-time saving with individual reset

### Feature Adjustments
- **Script Feature Removal**: Removed built-in custom script loading functionality, recommend using SiYuan's built-in JS script feature instead
- **Code Simplification**: Cleaned up script management related code, reduced plugin size
- **Core Focus**: Focus on media playback and note integration features, avoiding feature duplication

## v0.3.4 (2025.5.26)

### Feature Updates
- **Button Layout Optimization**: Adjusted function button positions for improved user experience
- **Icon Update**: Modified dock bar icon for better recognizability
- **Link Logic Refactoring**: Refactored media link checking logic with support for local media links
- **Bug Fixes**: Fixed issues with local media timestamp links not working properly
- **Detail Optimizations**: Various detail improvements and feature optimizations

## v0.3.3 (2025.5.18)

### Feature Updates
- **Interface Overhaul**: Removed top icons, open player through dock bar button
- **Button Layout Optimization**: Moved function buttons to the top, can be hidden via toggle
- **Playback Loop Enhancement**: Added single item loop and list loop functionality
- **Loop Control**: Added pause after loop completion feature
- **Danmaku Feature**: Added danmaku list for easy export of bullet comments
- **Account Display Optimization**: Optimized account display method
- **List Sorting Feature**: Added playlist sorting functionality with support for name, time, and type sorting
- **Script Loading Feature**: Support for loading custom JavaScript scripts with script status management through settings panel
- **Plugin Extensibility Enhancement**: Provides script API allowing users to create custom operations and interface elements through scripts

## v0.3.2 (2025.5.11)

### Feature Enhancements
- **UI Interface Optimization**: Unified design style for assistant, playlist, and settings panels, improving overall user experience
- **AList Cloud Support**: Added AList cloud storage support, expanding media source options
- **File Selection Optimization**: Support for direct local file selection import, simplifying media addition process
- **Panel Adjustment**: Support for panel drag-to-resize, flexible interface layout adjustment
- **Loop Settings Enhancement**: Added setting option for automatic pause after loop playback
- **Create Media Notes**: Added media notes functionality with custom note template support
- **Tab Menu Simplification**: Optimized tab menu, removed complex tab+right-click operation logic

### Insertion Feature Optimization
- Extended document insertion methods with more options:
  - Insert at cursor (insertBlock)
  - Append to block end (appendBlock)
  - Add to block beginning (prependBlock)
  - Update current block (updateBlock)
  - Insert at document top (prependDoc)
  - Insert at document bottom (appendDoc)
  - Copy to clipboard (clipboard)
- Extended link format, support for inserting timestamps and screenshots in one action
- Unified custom format system, added restore default format functionality

### Code Optimization
- Extremely streamlined `src/core/utils.ts` file, removed redundant code, simplified function implementation, merged similar functionality
- Standardized API naming, using naming consistent with SiYuan's official API (such as `insertBlock`, `appendBlock`, etc.)
- Enhanced error handling, making code more robust
- Removed most success notification messages (showMessage), only keeping failure case notifications, further streamlining code
- Improved clipboard operation success rate and added success notifications
- Optimized document structure, improved README_zh_CN.md file organization, added collapsible sections and clearer directory structure 