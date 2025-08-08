<div class="sy__outline" style="max-width: 800px; margin: 0 auto;">
    <div style="text-align: center; padding: 2em; background: linear-gradient(135deg, var(--b3-theme-primary), var(--b3-theme-secondary)); border-radius: 12px;">
        <h1 style="color: var(--b3-theme-on-primary); margin: 0; font-size: 2.2em;">🎬 SiYuan Media Player</h1>
        <div style="color: var(--b3-theme-on-primary-light); margin-top: 0.5em; font-size: 1.1em;">Professional SiYuan Note media playback plugin with multi-platform playback, intelligent note management, and efficient learning tools</div>
        <div style="margin-top: 1.5em; display: flex; justify-content: center; gap: 12px; flex-wrap: wrap;">
            <a href="https://github.com/mm-o/siyuan-media-player/blob/main/更新日志.md"
               style="padding: 8px 16px; background: rgba(255,255,255,0.2); color: white; border-radius: 6px; text-decoration: none; font-size: 0.9em;">🗓 Changelog</a>
               <a href="https://github.com/mm-o/siyuan-media-player/issues"
               style="padding: 8px 16px; background: rgba(255,255,255,0.2); color: white; border-radius: 6px; text-decoration: none; font-size: 0.9em;">💬 Issue Feedback</a>
            <a href="https://vcne5rvqxi9z.feishu.cn/wiki/HOKAw3KTiigaVukvcencOUh7nEb"
               style="padding: 8px 16px; background: rgba(255,255,255,0.2); color: white; border-radius: 6px; text-decoration: none; font-size: 0.9em;">👏 Acknowledgments</a>
        </div>
    </div>
        <div style="margin-top: 1.5em; padding: 1.5em; background: var(--b3-theme-surface-lighter); border: 1px solid var(--b3-theme-border); border-radius: 8px; box-shadow: 0 4px 12px var(--b3-theme-shadow);">
        <h2 style="color: var(--b3-theme-primary); margin: 0 0 1em; text-align: center; font-size: 1.3em;">🚀 Recent Updates</h2>

<h3>📅 v0.5.1 Update (2025.8.8)</h3>
<h4>✨ Feature Improvements</h4>
<ol>
<li>🧭 Assistant panel adds <strong>Document View</strong>: auto-follow highlight with playback, supports drag-and-drop copy</li>
<li>📋 Playlist <strong>per-tag view state</strong> is saved <a href="https://github.com/mm-o/siyuan-media-player/issues/116">#116</a></li>
<li>🎛️ Support <strong>customizable playlist item display elements</strong> <a href="https://github.com/mm-o/siyuan-media-player/issues/107">#107</a></li>
<li>🔍 Search UX improved: now <strong>press Enter to trigger search</strong> <a href="https://github.com/mm-o/siyuan-media-player/issues/109">#109</a></li>
<li>⌨️ New shortcut <strong>A</strong>: toggle to <strong>3.0x</strong>, press again to restore original speed <a href="https://github.com/mm-o/siyuan-media-player/issues/105">#105</a></li>
<li>🌐 Improved tolerance for <strong>account server address</strong> input</li>
<li>📝 <strong>Media title field</strong> can be configured independently; primary key is now customizable <a href="https://github.com/mm-o/siyuan-media-player/issues/90">#90</a></li>
<li>💳 Limited-time membership discount: Annual <strong>¥20</strong>, Lifetime <strong>¥99</strong></li>
</ol>

<h4>🐛 Bug Fixes</h4>
<ol>
<li>Fixed issue where clicking a collection subset <strong>auto-added</strong> it to the playlist</li>
<li>Fixed issue where <strong>only the first episode</strong> played for collections and multi-part videos</li>
<li>Fixed <strong>cloud disk navigation bar</strong> not displaying <a href="https://github.com/mm-o/siyuan-media-player/issues/117">#117</a></li>
<li>Fixed issue where database default page size <strong>50</strong> failed to load all items into the playlist <a href="https://github.com/mm-o/siyuan-media-player/issues/108">#108</a></li>
</ol>

<h4>🔧 Development Refactoring</h4>
<ol>
<li>Bilibili features require the extension script:
<a href="https://github.com/mm-o/siyuan-media-player/raw/main/docs/bilibili-extension.js">GitHub</a> |
<a href="https://gitee.com/m-o/siyuan-media-player/blob/master/docs/bilibili-extension.js">Gitee</a>
</li>
</ol>

<h3>📅 v0.5.0 Update (2025.8.6)</h3>
<h4>✨ Feature Improvements</h4>
<p>🎯 <strong>Membership System</strong>: Added three membership types (Dragon Permanent Member, Annual Member, Trial Member), supports purchase redirection, early donors receive permanent Dragon membership. <strong>Limited-time discount until October 10th</strong></p>
<p>👥 <strong>Multi-Account Support</strong>: Support multiple account management (Bilibili, OpenList, WebDAV), playlist menu provides secondary menu for quick switching</p>
<p>📌 <strong>Tab Pinning Feature</strong>: Playlist tabs support pinning to tab bar for quick access to frequently used lists <a href="https://github.com/mm-o/siyuan-media-player/issues/95">#95</a></p>
<p>📋 <strong>P-List Enhancement</strong>: P-list displays complete titles, improving content recognition <a href="https://github.com/mm-o/siyuan-media-player/issues/100">#100</a></p>
<p>📖 <strong>Settings Panel Optimization</strong>: Added About tab with integrated README documentation and navigation</p>
<p>🎨 <strong>Playback Speed Optimization</strong>: More user-friendly playback speed options (0.5x-4.0x, 0.25x increments)</p>
<p>📝 <strong>Loop Segment Improvement</strong>: Loop count changed to input type, no longer limited to upper limit</p>
<p>📥 <strong>Batch Addition Enhancement</strong>:</p>
<ul>
<li>Bilibili collections get all videos, no longer limited to 100 <a href="https://github.com/mm-o/siyuan-media-player/issues/88">#88</a></li>
<li>Improved batch processing stability, errors won't interrupt entire process</li>
<li>Support direct BV number addition <a href="https://github.com/mm-o/siyuan-media-player/issues/79">#79</a></li>
<li>Support mixed delimiter input (space, newline, comma) <a href="https://github.com/mm-o/siyuan-media-player/issues/85">#85</a></li>
</ul>
<p>🗂️ <strong>Playlist Extension</strong>: OpenList and WebDAV media support adding to playlists and database <a href="https://github.com/mm-o/siyuan-media-player/issues/73">#73</a></p>
<p>📔 <strong>Media Notes Enhancement</strong>: Support DailyNote mode creation, click button to directly create and open new tab <a href="https://github.com/mm-o/siyuan-media-player/issues/96">#96</a> <a href="https://github.com/mm-o/siyuan-media-player/issues/98">#98</a></p>

<h4>🐛 Bug Fixes</h4>
<p>🌙 <strong>Dark Mode Fix</strong>: Fixed display issues with P-list in dark mode <a href="https://github.com/mm-o/siyuan-media-player/issues/101">#101</a></p>
<p>🎨 <strong>View Style Optimization</strong>: Optimized compact view P-list expansion style for better visual experience</p>
<p>📝 <strong>Document Background Fix</strong>: Reset documentation background for clearer display in dark mode</p>
<p>⏱️ <strong>Timestamp Fix</strong>: Fixed crash when clicking next line without line break and pressing enter in middle during timestamp insertion <a href="https://github.com/mm-o/siyuan-media-player/issues/97">#97</a></p>
<p>🧹 <strong>State Cleanup Fix</strong>: Fixed subtitle, danmaku, and summary states not being properly cleared <a href="https://github.com/mm-o/siyuan-media-player/issues/94">#94</a></p>

<h4>🔧 Development Refactoring</h4>
<p>🔄 <strong>Media Playback Refactoring</strong>: WebDAV and OpenList media access through SiYuan proxy API for improved stability</p>
<p>🔗 <strong>Link Processing Optimization</strong>: Refactored link click logic to resolve first-time playback failure issues</p>
<p>🏗️ <strong>Collection Addition Unification</strong>: Unified collection addition to bottom input box with inherited P-list styling</p>
<p>🔄 <strong>Automatic Config Migration</strong>: Added config migration tool to automatically handle single-account to multi-account configuration upgrades, ensuring seamless user experience</p>
<blockquote>
<p>📋 <strong>View Complete Changelog</strong>: <a href="https://github.com/mm-o/siyuan-media-player/blob/main/更新日志.md">更新日志.md</a></p>
</blockquote>

<h4>🎯 Discussion Group</h4>
<p><strong>QQ Group</strong>: <a href="https://qm.qq.com/q/wpHDtsfxCw">QQ Group</a> QQ Group Number: 306538841 (Donors who haven't joined please provide order number to join)</p>
    </div>
    <div style="margin-top: 1.5em; padding: 1.5em; background: var(--b3-theme-surface-lighter); border: 1px solid var(--b3-theme-border); border-radius: 8px; box-shadow: 0 4px 12px var(--b3-theme-shadow);">
        <h2 style="color: var(--b3-theme-primary); margin: 0 0 1em; text-align: center; font-size: 1.3em;">🚀 Core Features</h2>
        <ul style="margin: 0; list-style: none; padding: 0;">
            <li style="margin: 0.5em 0; padding: 10px 14px; background: var(--b3-theme-surface); border-radius: 8px; border-left: 4px solid var(--b3-theme-primary); box-shadow: 0 2px 4px var(--b3-theme-shadow-light);">🎥 <strong>Multi-platform Playback</strong> - Unified playback for local media, extended media, OpenList, and WebDAV cloud storage</li>
            <li style="margin: 0.5em 0; padding: 10px 14px; background: var(--b3-theme-surface); border-radius: 8px; border-left: 4px solid var(--b3-theme-primary); box-shadow: 0 2px 4px var(--b3-theme-shadow-light);">⏰ <strong>Timestamp Navigation</strong> - Precise timestamp links for one-click navigation to specific playback positions</li>
            <li style="margin: 0.5em 0; padding: 10px 14px; background: var(--b3-theme-surface); border-radius: 8px; border-left: 4px solid var(--b3-theme-primary); box-shadow: 0 2px 4px var(--b3-theme-shadow-light);">🔄 <strong>Loop Segments</strong> - Custom loop playback segments for repeated learning of key content</li>
            <li style="margin: 0.5em 0; padding: 10px 14px; background: var(--b3-theme-surface); border-radius: 8px; border-left: 4px solid var(--b3-theme-primary); box-shadow: 0 2px 4px var(--b3-theme-shadow-light);">📔 <strong>Media Notes</strong> - Screenshots, subtitles, and danmaku export with sub-document creation and smart search configuration for complete learning note ecosystem</li>
            <li style="margin: 0.5em 0; padding: 10px 14px; background: var(--b3-theme-surface); border-radius: 8px; border-left: 4px solid var(--b3-theme-primary); box-shadow: 0 2px 4px var(--b3-theme-shadow-light);">🤖 <strong>Media Assistant</strong> - Subtitle lists, danmaku lists, and AI media summaries for intelligent analysis</li>
            <li style="margin: 0.5em 0; padding: 10px 14px; background: var(--b3-theme-surface); border-radius: 8px; border-left: 4px solid var(--b3-theme-primary); box-shadow: 0 2px 4px var(--b3-theme-shadow-light);">📋 <strong>Playlist Management</strong> - Database-driven management with tag classification, drag-and-drop sorting, and multi-view display</li>
            <li style="margin: 0.5em 0; padding: 10px 14px; background: var(--b3-theme-surface); border-radius: 8px; border-left: 4px solid var(--b3-theme-primary); box-shadow: 0 2px 4px var(--b3-theme-shadow-light);">📥 <strong>Batch Import</strong> - One-click import of extension favorites, extension collections, local folders, SiYuan workspace, OpenList, and WebDAV cloud storage to playlists</li>
            <li style="margin: 0.5em 0; padding: 10px 14px; background: var(--b3-theme-surface); border-radius: 8px; border-left: 4px solid var(--b3-theme-primary); box-shadow: 0 2px 4px var(--b3-theme-shadow-light);">📝 <strong>Notes Panel</strong> - Independent document and block content viewing and editing with ID input, smart tags, and context menu operations</li>
            <li style="margin: 0.5em 0; padding: 10px 14px; background: var(--b3-theme-surface); border-radius: 8px; border-left: 4px solid var(--b3-theme-primary); box-shadow: 0 2px 4px var(--b3-theme-shadow-light);">🔗 <strong>Smart Link Recognition</strong> - Direct playback of database URL field media links, Ctrl+click to force browser opening</li>
            <li style="margin: 0.5em 0; padding: 10px 14px; background: var(--b3-theme-surface); border-radius: 8px; border-left: 4px solid var(--b3-theme-primary); box-shadow: 0 2px 4px var(--b3-theme-shadow-light);">⚙️ <strong>Settings Panel</strong> - One-stop management for account configuration, player settings, and general options</li>
            <li style="margin: 0.5em 0; padding: 10px 14px; background: var(--b3-theme-surface); border-radius: 8px; border-left: 4px solid var(--b3-theme-primary); box-shadow: 0 2px 4px var(--b3-theme-shadow-light);">🔧 <strong>Script Extensions</strong> - Support for third-party extension scripts, user-selectable functional modules</li>
        </ul>
    </div>
    <div style="margin-top: 1.5em; padding: 1.5em; background: var(--b3-theme-surface-lighter); border: 1px solid var(--b3-theme-border); border-radius: 8px; box-shadow: 0 4px 12px var(--b3-theme-shadow);">
        <h2 style="color: var(--b3-theme-primary); margin: 0 0 1em; text-align: center; font-size: 1.3em;">⚠️ Disclaimer</h2>
        <ul style="margin: 0; list-style: none; padding: 0;">
            <li style="margin: 0.5em 0; padding: 10px 14px; background: var(--b3-theme-surface); border-radius: 8px; border-left: 4px solid var(--b3-theme-primary); box-shadow: 0 2px 4px var(--b3-theme-shadow-light);">🎯 <strong>Technical Architecture</strong> - Plugin adopts extensible design, core code focuses on playback functionality, contains no third-party service code</li>
            <li style="margin: 0.5em 0; padding: 10px 14px; background: var(--b3-theme-surface); border-radius: 8px; border-left: 4px solid var(--b3-theme-primary); box-shadow: 0 2px 4px var(--b3-theme-shadow-light);">🎛️<strong>Extension Selection</strong> - Users can autonomously choose whether to use third-party extension scripts based on needs</li>
            <li style="margin: 0.5em 0; padding: 10px 14px; background: var(--b3-theme-surface); border-radius: 8px; border-left: 4px solid var(--b3-theme-primary); box-shadow: 0 2px 4px var(--b3-theme-shadow-light);">🛡️<strong>Security Reminder</strong> - Extension scripts are independent functional modules, please choose carefully based on personal needs</li>
        </ul>
    </div>
    <div style="margin-top: 1.5em; padding: 1.5em; background: var(--b3-theme-surface-lighter); border: 1px solid var(--b3-theme-border); border-radius: 8px; box-shadow: 0 4px 12px var(--b3-theme-shadow);">
        <h2 style="color: var(--b3-theme-primary); margin: 0 0 1em; text-align: center; font-size: 1.3em;">🧧 Support, Encourage & Feature Requests</h2>
        <p style="margin: 0.5em 0;">If SiYuan Media Player has been helpful to you, please consider giving the author a like or buying a cup of coffee. This will encourage the author to continue optimizing and developing more useful features:</p>
        <div style="margin: 1em 0; text-align: center; display: flex; justify-content: space-around; flex-wrap: wrap; gap: 20px;">
            <div style="text-align: center;">
                <img src="/plugins/siyuan-media-player/assets/images/alipay.jpg"
                     alt="Alipay QR Code"
                     style="width: 280px; border-radius: 8px; box-shadow: 0 2px 4px var(--b3-theme-shadow-light);">
                <p style="margin: 0.5em 0; color: var(--b3-theme-text-lighter);">Alipay</p>
            </div>
            <div style="text-align: center;">
                <img src="/plugins/siyuan-media-player/assets/images/wechat.jpg"
                     alt="WeChat QR Code"
                     style="width: 280px; border-radius: 8px; box-shadow: 0 2px 4px var(--b3-theme-shadow-light);">
                <p style="margin: 0.5em 0; color: var(--b3-theme-text-lighter);">WeChat</p>
            </div>
        </div>
  </div>
    <div style="margin-top: 1.5em; padding: 1.5em; background: var(--b3-theme-surface-lighter); border: 1px solid var(--b3-theme-border); border-radius: 8px; box-shadow: 0 4px 12px var(--b3-theme-shadow);">
        <h2 style="color: var(--b3-theme-primary); margin: 0 0 1em; text-align: center; font-size: 1.3em;">📖 User Guide</h2>
        <ul style="margin: 0; list-style: none; padding: 0;">
            <li style="margin: 0.5em 0; padding: 10px 14px; background: var(--b3-theme-surface); border-radius: 8px; border-left: 4px solid var(--b3-theme-primary); box-shadow: 0 2px 4px var(--b3-theme-shadow-light);">
<details>
                <summary style="color: var(--b3-theme-primary); cursor: pointer; font-weight: 500; font-size: 1.05em;">🗄️ <strong>Bind Database</strong> - Configure playlist data storage</summary>
                <div style="margin-top: 0.8em; padding-top: 0.8em; border-top: 1px solid var(--b3-theme-border);">
                1. Select a database block, click the database icon or right-click > Copy > Copy ID<br>
                2. Open SiYuan Media Player settings panel<br>
                3. Find "Playlist Database" in the "General" tab<br>
                4. Paste the database block ID copied in step 1 to bind the database<br>
                5. After successful binding, all playlist data will sync to the specified database<br>
                6. Supports auto-creation of gallery view for intuitive media list management
                </div>
                </details>
            </li>
            <li style="margin: 0.5em 0; padding: 10px 14px; background: var(--b3-theme-surface); border-radius: 8px; border-left: 4px solid var(--b3-theme-primary); box-shadow: 0 2px 4px var(--b3-theme-shadow-light);">
<details>
                <summary style="color: var(--b3-theme-primary); cursor: pointer; font-weight: 500; font-size: 1.05em;">🔧 <strong>Configure Extension Account</strong> - Login to extension service to access personal resources</summary>
                <div style="margin-top: 0.8em; padding-top: 0.8em; border-top: 1px solid var(--b3-theme-border);">
                1. Find the "Extension Account" section in the settings panel<br>
                2. Click the "Login to Extension Account" button<br>
                3. Scan the displayed QR code (using extension service mobile app)<br>
                4. After successful login, you can watch extension videos and batch add favorites
                </div>
</details>
            </li>
            <li style="margin: 0.5em 0; padding: 10px 14px; background: var(--b3-theme-surface); border-radius: 8px; border-left: 4px solid var(--b3-theme-primary); box-shadow: 0 2px 4px var(--b3-theme-shadow-light);">
<details>
                <summary style="color: var(--b3-theme-primary); cursor: pointer; font-weight: 500; font-size: 1.05em;">🔗 <strong>Configure OpenList Service</strong> - Connect to cloud storage server</summary>
                <div style="margin-top: 0.8em; padding-top: 0.8em; border-top: 1px solid var(--b3-theme-border);">
                1. Find the "OpenList Configuration" section in the settings panel<br>
                2. Fill in the OpenList server address (e.g., http://localhost:5244)<br>
                3. Enter username and password<br>
                4. After successful configuration, you can directly browse and play media files from OpenList
                </div>
</details>
            </li>
            <li style="margin: 0.5em 0; padding: 10px 14px; background: var(--b3-theme-surface); border-radius: 8px; border-left: 4px solid var(--b3-theme-primary); box-shadow: 0 2px 4px var(--b3-theme-shadow-light);">
<details>
                <summary style="color: var(--b3-theme-primary); cursor: pointer; font-weight: 500; font-size: 1.05em;">☁️ <strong>Configure WebDAV Cloud Storage</strong> - Connect to WebDAV service</summary>
                <div style="margin-top: 0.8em; padding-top: 0.8em; border-top: 1px solid var(--b3-theme-border);">
                1. Find the "WebDAV Configuration" section in the settings panel<br>
                2. Fill in the WebDAV server address<br>
                3. Enter username and password<br>
                4. Supports mainstream WebDAV services like Jianguoyun (坚果�?, NextCloud<br>
                5. After successful configuration, you can directly browse and play media files from WebDAV
                </div>
</details>
            </li>
            <li style="margin: 0.5em 0; padding: 10px 14px; background: var(--b3-theme-surface); border-radius: 8px; border-left: 4px solid var(--b3-theme-primary); box-shadow: 0 2px 4px var(--b3-theme-shadow-light);">
<details>
                <summary style="color: var(--b3-theme-primary); cursor: pointer; font-weight: 500; font-size: 1.05em;">📁 <strong>Add Local Media</strong> - Support multiple selection</summary>
                <div style="margin-top: 0.8em; padding-top: 0.8em; border-top: 1px solid var(--b3-theme-border);">
                1. Click the "Add" button at the bottom of the playlist<br>
                2. Select the media files you want to add in the file manager<br>
                3. Click "Open" to add them to the playlist<br>
                4. Supports single and multiple selection<br>
                5. System automatically detects subtitle files with the same name
                </div>
</details>
            </li>
            <li style="margin: 0.5em 0; padding: 10px 14px; background: var(--b3-theme-surface); border-radius: 8px; border-left: 4px solid var(--b3-theme-primary); box-shadow: 0 2px 4px var(--b3-theme-shadow-light);">
<details>
                <summary style="color: var(--b3-theme-primary); cursor: pointer; font-weight: 500; font-size: 1.05em;">📂 <strong>Add Local Folder</strong> - Batch import local files</summary>
                <div style="margin-top: 0.8em; padding-top: 0.8em; border-top: 1px solid var(--b3-theme-border);">
                1. Click the "+" on the playlist tab to open the menu<br>
                2. Click "Add Local Folder"<br>
                3. Select the folder you want to add in the file browser<br>
                4. Click the "Select Folder" button<br>
                5. System will automatically scan and batch import all qualified media files
                </div>
</details>
            </li>
            <li style="margin: 0.5em 0; padding: 10px 14px; background: var(--b3-theme-surface); border-radius: 8px; border-left: 4px solid var(--b3-theme-primary); box-shadow: 0 2px 4px var(--b3-theme-shadow-light);">
<details>
                <summary style="color: var(--b3-theme-primary); cursor: pointer; font-weight: 500; font-size: 1.05em;">🏠 <strong>Add SiYuan Workspace Media</strong> - Browse workspace files</summary>
                <div style="margin-top: 0.8em; padding-top: 0.8em; border-top: 1px solid var(--b3-theme-border);">
                1. Click the "+" on the playlist tab to open the menu<br>
                2. Click "Add SiYuan Workspace" to add SiYuan workspace to the playlist<br>
                3. SiYuan workspace media uses relative paths for easy workspace migration
                </div>
</details>
            </li>
            <li style="margin: 0.5em 0; padding: 10px 14px; background: var(--b3-theme-surface); border-radius: 8px; border-left: 4px solid var(--b3-theme-primary); box-shadow: 0 2px 4px var(--b3-theme-shadow-light);">
<details>
                <summary style="color: var(--b3-theme-primary); cursor: pointer; font-weight: 500; font-size: 1.05em;">🔗 <strong>Add OpenList Media</strong> - Cloud storage streaming playback</summary>
                <div style="margin-top: 0.8em; padding-top: 0.8em; border-top: 1px solid var(--b3-theme-border);">
                1. Ensure OpenList server connection is configured<br>
                2. Click the "+" on the playlist tab to open the menu<br>
                3. Click "Add OpenList Cloud"<br>
                4. Media will stream directly without downloading to local storage
                </div>
</details>
            </li>
            <li style="margin: 0.5em 0; padding: 10px 14px; background: var(--b3-theme-surface); border-radius: 8px; border-left: 4px solid var(--b3-theme-primary); box-shadow: 0 2px 4px var(--b3-theme-shadow-light);">
<details>
                <summary style="color: var(--b3-theme-primary); cursor: pointer; font-weight: 500; font-size: 1.05em;">☁️ <strong>Add WebDAV Media</strong> - Direct cloud playback</summary>
                <div style="margin-top: 0.8em; padding-top: 0.8em; border-top: 1px solid var(--b3-theme-border);">
                1. Ensure WebDAV cloud storage connection is configured<br>
                2. Click the "+" on the playlist tab to open the menu<br>
                3. Click "Add WebDAV Cloud"<br>
                4. Media will stream directly without downloading to local storage
                </div>
</details>
            </li>
            <li style="margin: 0.5em 0; padding: 10px 14px; background: var(--b3-theme-surface); border-radius: 8px; border-left: 4px solid var(--b3-theme-primary); box-shadow: 0 2px 4px var(--b3-theme-shadow-light);">
<details>
                <summary style="color: var(--b3-theme-primary); cursor: pointer; font-weight: 500; font-size: 1.05em;">📥 <strong>Batch Import Extension Favorites</strong> - One-click import favorite videos</summary>
                <div style="margin-top: 0.8em; padding-top: 0.8em; border-top: 1px solid var(--b3-theme-border);">
                1. Ensure extension account is logged in<br>
                2. Click the "+" on the playlist tab to open the menu<br>
                3. Click "Add Extension Favorites"<br>
                3. Select the favorites folder to import<br>
                4. System will batch import all videos from the favorites folder
                </div>
</details>
            </li>
            <li style="margin: 0.5em 0; padding: 10px 14px; background: var(--b3-theme-surface); border-radius: 8px; border-left: 4px solid var(--b3-theme-primary); box-shadow: 0 2px 4px var(--b3-theme-shadow-light);">
<details>
                <summary style="color: var(--b3-theme-primary); cursor: pointer; font-weight: 500; font-size: 1.05em;">📚 <strong>Batch Import Extension Collections</strong> - One-click import collection videos</summary>
                <div style="margin-top: 0.8em; padding-top: 0.8em; border-top: 1px solid var(--b3-theme-border);">
                1. Ensure extension account is logged in<br>
                2. Click the "+" on the playlist tab to open the menu<br>
                3. Click "Add Extension Collection"<br>
                4. Enter any video link from the collection<br>
                5. Press Enter to confirm, system will automatically get the entire collection and batch import all videos
                </div>
</details>
            </li>
            <li style="margin: 0.5em 0; padding: 10px 14px; background: var(--b3-theme-surface); border-radius: 8px; border-left: 4px solid var(--b3-theme-primary); box-shadow: 0 2px 4px var(--b3-theme-shadow-light);">
<details>
                <summary style="color: var(--b3-theme-primary); cursor: pointer; font-weight: 500; font-size: 1.05em;">🏷�?<strong>Tag Management</strong> - Create and manage playlist tags</summary>
                <div style="margin-top: 0.8em; padding-top: 0.8em; border-top: 1px solid var(--b3-theme-border);">
                1. Click the "+" button at the top of the playlist to create a new tag<br>
                2. Enter tag name and confirm<br>
                3. <strong>Rename tag</strong>: Right-click the tag > Select "Rename"<br>
                4. <strong>Delete tag</strong>: Right-click the tag > Select "Delete" to remove tag and media under it<br>
                5. <strong>Clear tag</strong>: Right-click the tag > Select "Clear" to clear media under the tag
                </div>
</details>
            </li>
            <li style="margin: 0.5em 0; padding: 10px 14px; background: var(--b3-theme-surface); border-radius: 8px; border-left: 4px solid var(--b3-theme-primary); box-shadow: 0 2px 4px var(--b3-theme-shadow-light);">
                <details>
                <summary style="color: var(--b3-theme-primary); cursor: pointer; font-weight: 500; font-size: 1.05em;">🔄 <strong>Smart Refresh</strong> - Auto sync folders, extension favorites, extension collections</summary>
                <div style="margin-top: 0.8em; padding-top: 0.8em; border-top: 1px solid var(--b3-theme-border);">
                1. Right-click the tag you want to refresh<br>
                2. Select "Refresh Tag"<br>
                3. System will automatically execute corresponding refresh strategy based on tag type:<br>
                �?<strong>Folder tags</strong>: Detect local folder changes, intelligently add/remove media items<br>
                �?<strong>Extension favorites</strong>: Detect favorites content changes, maintain data consistency<br>
                �?<strong>Extension collections</strong>: Detect collection content changes, auto sync latest videos<br>
                4. Intelligently compare existing data, only process changed items for significant performance improvement
                </div>
                </details>
            </li>
            <li style="margin: 0.5em 0; padding: 10px 14px; background: var(--b3-theme-surface); border-radius: 8px; border-left: 4px solid var(--b3-theme-primary); box-shadow: 0 2px 4px var(--b3-theme-shadow-light);">
                <details>
                <summary style="color: var(--b3-theme-primary); cursor: pointer; font-weight: 500; font-size: 1.05em;">🔄 <strong>Drag & Drop Operations</strong> - Media movement and sorting</summary>
                <div style="margin-top: 0.8em; padding-top: 0.8em; border-top: 1px solid var(--b3-theme-border);">
                <strong>Drag media items:</strong><br>
                1. <strong>Move between tags</strong>: Drag media items from one tag to another<br>
                <strong>Drag sorting:</strong><br>
                1. <strong>Media sorting</strong>: Drag media items within the same tag to adjust playback order<br>
                2. <strong>Tag sorting</strong>: Drag tag headers to adjust tag display order<br>
                3. Sort order is automatically saved to database
                </div>
</details>
            </li>
            <li style="margin: 0.5em 0; padding: 10px 14px; background: var(--b3-theme-surface); border-radius: 8px; border-left: 4px solid var(--b3-theme-primary); box-shadow: 0 2px 4px var(--b3-theme-shadow-light);">
<details>
                <summary style="color: var(--b3-theme-primary); cursor: pointer; font-weight: 500; font-size: 1.05em;">📝 <strong>Note Integration</strong> - Screenshots, timestamps, loop segments and media notes</summary>
                <div style="margin-top: 0.8em; padding-top: 0.8em; border-top: 1px solid var(--b3-theme-border);">
                <strong>Create screenshots (with timestamp):</strong><br>
                1. Play video to the position you want to screenshot<br>
                2. Click the screenshot button to create screenshot<br>
                3. Screenshot will include timestamp based on settings<br><br>
                <strong>Create timestamps and loop segments:</strong><br>
                1. Play video to the position you want to mark<br>
                2. Click timestamp button to create timestamp link<br>
                3. <strong>Create loop segment</strong>:<br>
                   - Click loop segment button to set start point<br>
                   - Play to end position and click again to set end point<br>
                   - Can set loop count and whether to pause after loop<br>
                4. Generated links will be inserted at specified location or copied to clipboard based on settings<br><br>
                <strong>Create media notes:</strong><br>
                1. Play the media you want to take notes on<br>
                2. Click the "Media Notes" button in the control bar (or use shortcut key)<br>
                3. System creates notes based on custom template, including media info, timestamp, thumbnail, etc.<br>
                4. Notes can be inserted into current document, created in specified notebook, or created as sub-documents under specified documents<br>
                5. <strong>Smart Search Configuration</strong>: Input document name or notebook name in settings to search and quickly locate target position<br>
                6. <strong>Sub-document Creation</strong>: After selecting parent document, system will automatically create sub-documents underneath, maintaining hierarchical note structure
                </div>
</details>
            </li>
            <li style="margin: 0.5em 0; padding: 10px 14px; background: var(--b3-theme-surface); border-radius: 8px; border-left: 4px solid var(--b3-theme-primary); box-shadow: 0 2px 4px var(--b3-theme-shadow-light);">
                <details>
                <summary style="color: var(--b3-theme-primary); cursor: pointer; font-weight: 500; font-size: 1.05em;">📝 <strong>Notes Panel</strong> - Document and block content viewing and editing</summary>
                <div style="margin-top: 0.8em; padding-top: 0.8em; border-top: 1px solid var(--b3-theme-border);">
                1. Click the "Notes" tab at the top of the SiYuan Media Player panel<br>
                2. <strong>Add note tabs</strong>: Click the "+" button and enter document ID or block ID<br>
                3. <strong>View content</strong>: Click tabs to view corresponding document or block content<br>
                4. <strong>Context menu operations</strong>: Right-click tabs for the following operations:<br>
                   - <strong>Rename</strong>: Modify tag display name (maximum 4 characters)<br>
                   - <strong>Open in SiYuan</strong>: Jump directly to the corresponding position in SiYuan<br>
                   - <strong>Copy ID</strong>: Copy document or block ID to clipboard<br>
                   - <strong>Delete tab</strong>: Remove unwanted note tabs<br>
                5. <strong>Complete editing</strong>: Support direct editing of document content in the panel, consistent with SiYuan editor functionality
                </div>
                </details>
            </li>
            <li style="margin: 0.5em 0; padding: 10px 14px; background: var(--b3-theme-surface); border-radius: 8px; border-left: 4px solid var(--b3-theme-primary); box-shadow: 0 2px 4px var(--b3-theme-shadow-light);">
<details>
                <summary style="color: var(--b3-theme-primary); cursor: pointer; font-weight: 500; font-size: 1.05em;">🧠 <strong>Media Assistant (Pro Version)</strong> - Subtitles, danmaku, summaries</summary>
                <div style="margin-top: 0.8em; padding-top: 0.8em; border-top: 1px solid var(--b3-theme-border);">
                1. Click the "Media Assistant" button while playing video<br>
                2. <strong>Subtitle list</strong>: Browse and search subtitle content, click to jump<br>
                3. <strong>Video summary</strong>: View AI-generated content overview<br>
                4. <strong>Danmaku list</strong>: Browse video danmaku list, needs to be enabled in settings<br>
                5. <strong>One-click export</strong>: Export assistant content to notes
                </div>
</details>
            </li>
            <li style="margin: 0.5em 0; padding: 10px 14px; background: var(--b3-theme-surface); border-radius: 8px; border-left: 4px solid var(--b3-theme-primary); box-shadow: 0 2px 4px var(--b3-theme-shadow-light);">
<details>
                <summary style="color: var(--b3-theme-primary); cursor: pointer; font-weight: 500; font-size: 1.05em;">⌨️ <strong>Shortcut Settings</strong> - Configure custom shortcuts</summary>
                <div style="margin-top: 0.8em; padding-top: 0.8em; border-top: 1px solid var(--b3-theme-border);">
                1. Open SiYuan Settings > Shortcuts<br>
                2. Search for "Media Player" or "siyuan-media-player"<br>
                3. Set shortcuts for the following functions:<br>
                   - <strong>⏱️ Add Timestamp</strong>: Quickly generate current time link<br>
                   - <strong>🔄 Loop Segment</strong>: Set loop playback interval<br>
                   - <strong>📸 Screenshot</strong>: Capture video frame<br>
                   - <strong>📔 Media Notes</strong>: Quickly create notes<br>
                   - <strong>🧠 Open Media Player Panel</strong>: Open/close dock panel<br>
                4. <strong>Built-in player shortcuts</strong>:<br>
                   - Space: Play/pause<br>
                   - Left/right arrows: Rewind/fast forward<br>
                   - Up/down arrows: Volume adjustment<br>
                   - <strong>Ctrl+�?/strong>: Increase playback speed (+0.5x, max 5x)<br>
                   - <strong>Ctrl+�?/strong>: Decrease playback speed (-0.5x, min 0.5x)
                </div>
</details>
            </li>
            <li style="margin: 0.5em 0; padding: 10px 14px; background: var(--b3-theme-surface); border-radius: 8px; border-left: 4px solid var(--b3-theme-primary); box-shadow: 0 2px 4px var(--b3-theme-shadow-light);">
<details>
                <summary style="color: var(--b3-theme-primary); cursor: pointer; font-weight: 500; font-size: 1.05em;">🎵 <strong>Playback Control</strong> - Basic playback and loop functions</summary>
                <div style="margin-top: 0.8em; padding-top: 0.8em; border-top: 1px solid var(--b3-theme-border);">
                <strong>Basic playback operations:</strong><br>
                1. <strong>Play/pause</strong>: Click play button or press space<br>
                2. <strong>Progress control</strong>: Drag progress bar or use left/right arrow keys<br>
                3. <strong>Volume adjustment</strong>: Use volume slider or up/down arrow keys<br>
                4. <strong>Playback speed</strong>: Adjust playback speed in settings or use Ctrl+�?�?shortcuts<br>
                5. <strong>Picture-in-Picture</strong>: Enable in player settings or select "Picture-in-Picture" open mode<br>
                6. <strong>Fullscreen</strong>: Click fullscreen button or double-click play area<br><br>
                <strong>Loop playback functions:</strong><br>
                1. <strong>Single loop</strong>: Repeat current media<br>
                2. <strong>Playlist loop</strong>: Restart from beginning after finishing playlist<br>
                3. <strong>Segment loop</strong>: Set specific time segment for repeated playback<br>
                4. <strong>Loop count setting</strong>: Configure loop count in settings<br>
                5. <strong>Pause after loop</strong>: Can set to automatically pause after loop ends
                </div>
</details>
            </li>
            <li style="margin: 0.5em 0; padding: 10px 14px; background: var(--b3-theme-surface); border-radius: 8px; border-left: 4px solid var(--b3-theme-primary); box-shadow: 0 2px 4px var(--b3-theme-shadow-light);">
<details>
                <summary style="color: var(--b3-theme-primary); cursor: pointer; font-weight: 500; font-size: 1.05em;">🔗 <strong>Custom Link Format</strong> - Personalized timestamp links</summary>
                <div style="margin-top: 0.8em; padding-top: 0.8em; border-top: 1px solid var(--b3-theme-border);">
                In settings, you can customize the display format of timestamp links. For example:<br>
                <code>- [😄Title Time Subtitle](Link)</code> // Link with emoji<br>
                <code>> 🕒 Time | Title | Subtitle</code> // Quote-formatted link
                </div>
</details>
            </li>
            <li style="margin: 0.5em 0; padding: 10px 14px; background: var(--b3-theme-surface); border-radius: 8px; border-left: 4px solid var(--b3-theme-primary); box-shadow: 0 2px 4px var(--b3-theme-shadow-light);">
                <details>
                <summary style="color: var(--b3-theme-primary); cursor: pointer; font-weight: 500; font-size: 1.05em;">📝 <strong>Custom Media Notes Template</strong> - Personalized note format</summary>
                <div style="margin-top: 0.8em; padding-top: 0.8em; border-top: 1px solid var(--b3-theme-border);">
                You can create your own media notes template in settings with various variables:<br>
                <strong>Available variables</strong>: Media title, current timestamp, artist name, media URL, media duration, media thumbnail, media type, media ID, current date, current date and time<br><br>
                <strong>Target Configuration</strong>:<br>
                �?<strong>Smart Search</strong>: Input keywords to search documents and notebooks, quickly locate target position<br>
                �?<strong>Sub-document Creation</strong>: After selecting parent document, media notes will be created as sub-documents, maintaining hierarchical structure<br>
                �?<strong>Convenient Settings</strong>: Common configurations can be saved, simplifying subsequent creation process
                </div>
                </details>
            </li>
        </ul>
    </div>
</div>
