<div class="sy__outline" style="max-width: 800px; margin: 0 auto;">
    <div style="text-align: center; padding: 2em; background: linear-gradient(135deg, var(--b3-theme-primary), var(--b3-theme-secondary)); border-radius: 12px;">
        <h1 style="color: var(--b3-theme-on-primary); margin: 0; font-size: 2.2em;">🎬 思源媒体播放器</h1>
        <div style="color: var(--b3-theme-on-primary-light); margin-top: 0.5em; font-size: 1.1em;">专业的思源笔记媒体播放插件，集成多平台播放、智能笔记管理与高效学习工具</div>
        <div style="margin-top: 1.5em; display: flex; justify-content: center; gap: 12px; flex-wrap: wrap;">
            <a href="https://github.com/mm-o/siyuan-media-player/blob/main/更新日志.md"
               style="padding: 8px 16px; background: rgba(255,255,255,0.2); color: white; border-radius: 6px; text-decoration: none; font-size: 0.9em;">🗓 更新日志</a>
               <a href="https://github.com/mm-o/siyuan-media-player/issues"
               style="padding: 8px 16px; background: rgba(255,255,255,0.2); color: white; border-radius: 6px; text-decoration: none; font-size: 0.9em;">💬 问题反馈</a>
            <a href="https://vcne5rvqxi9z.feishu.cn/wiki/HOKAw3KTiigaVukvcencOUh7nEb"
               style="padding: 8px 16px; background: rgba(255,255,255,0.2); color: white; border-radius: 6px; text-decoration: none; font-size: 0.9em;">👏 鸣谢</a>
        </div>
    </div>
     <div style="margin-top: 1.5em; padding: 1.5em; background: var(--b3-theme-surface-lighter); border: 1px solid var(--b3-theme-border); border-radius: 8px; box-shadow: 0 4px 12px var(--b3-theme-shadow);">
        <h2 style="color: var(--b3-theme-primary); margin: 0 0 1em; text-align: center; font-size: 1.3em;">🚀 近期更新</h2>

<h3>📅 v0.6.3 版本更新 (2025.10.10)</h3>
<h4>✨ 新增功能</h4>
<ul>
  <li><strong>📝 笔记面板增强</strong>:
    <ul>
      <li>笔记面板添加文档搜索功能，支持快速查找和添加文档 <a href="https://github.com/mm-o/siyuan-media-player/issues/154">#154</a>。</li>
    </ul>
  </li>
  <li><strong>⌨️ 全局快捷键扩展</strong>:
    <ul>
      <li>将播放/暂停功能扩展为可自定义的全局快捷键，提升操作便捷性。</li>
    </ul>
  </li>
  <li><strong>🎵 音频播放增强</strong>:
    <ul>
      <li>支持歌曲信息智能解析，自动提取并显示歌词和封面。</li>
      <li>增强上一曲/下一曲切换逻辑，解决播放中断问题，确保流畅播放体验。</li>
    </ul>
  </li>
  <li><strong>🎨 字幕样式多样化</strong>:
    <ul>
      <li>新增多种字幕显示样式选择：默认、专注时钟、透明唱片、动感波光，满足不同场景需求。</li>
    </ul>
  </li>
</ul>
<h4>🐛 问题修复</h4>
<ul>
  <li><strong>☁️ 百度网盘</strong>: 受官方限制，需要提交应用申请，不确定审核时间，暂时不可用。</li>
</ul>

<h3>📅 v0.6.2 版本更新 (2025.10.8)</h3>
<h4>✨ 新增功能</h4>
<ul>
  <li><strong>📋 批量复制超链接</strong>:
    <ul>
      <li>新增一键批量复制视频的 Markdown 超链接功能，方便快速整理和分享 <a href="https://github.com/mm-o/siyuan-media-player/issues/147">#147</a>。</li>
    </ul>
  </li>
  <li><strong>🏷️ 多标签播放器</strong>:
    <ul>
      <li>增加播放器多标签支持，可同时打开多个播放器标签页 <a href="https://github.com/mm-o/siyuan-media-player/issues/151">#151</a>。</li>
    </ul>
  </li>
  <li><strong>📸 截图格式设置</strong>:
    <ul>
      <li>新增截图格式选择功能，支持 PNG（无损）、JPEG（小体积）、WebP（推荐）三种格式。</li>
      <li>支持调节 JPEG/WebP 格式的压缩质量（60-100%），平衡文件大小与图像质量。</li>
    </ul>
  </li>
  <li><strong>🔐 证书验证配置</strong>:
    <ul>
      <li>尝试增加跳过证书验证功能，最终效果取决于思源笔记的 <code>/api/network/forwardProxy</code> API 是否支持 <code>ignoreCertificateErrors</code> 参数。如果不支持，可以考虑提交 Feature Request 给思源官方 <a href="https://github.com/mm-o/siyuan-media-player/issues/153">#153</a>。</li>
    </ul>
  </li>
  <li><strong>⌨️ 快捷键增强</strong>:
    <ul>
      <li>新增自定义快捷切换播放速度功能，快速在不同播放速度间切换 <a href="https://github.com/mm-o/siyuan-media-player/issues/149">#149</a>。</li>
      <li>将增降播放速度、快捷调整播放速度、增降音量等播放器内快捷键更改为用户自定义全局快捷键，避免快捷键冲突 <a href="https://github.com/mm-o/siyuan-media-player/issues/150">#150</a>。</li>
    </ul>
  </li>
</ul>
<h4>🔧 界面优化</h4>
<ul>
  <li><strong>🎛️ 按钮布局优化</strong>: 优化播放列表右上角功能按键排布，提升操作便捷性。</li>
  <li><strong>📋 播放列表显示元素</strong>: 设置界面中的播放列表显示元素改为自适应布局，根据屏幕宽度自动调整排列。</li>
  <li><strong>🎨 滑块组件样式优化</strong>: 优化设置面板中的滑块组件样式，完全使用思源笔记原生样式，确保视觉一致性。</li>
  <li><strong>📑 关于面板导航优化</strong>: 优化关于面板中的目录导航显示，提升阅读体验和导航便捷性。</li>
</ul>
<h4>🐛 问题修复</h4>
<ul>
  <li><strong>☁️ 网盘功能修复</strong>: 修复百度网盘登录问题，确保正常访问和播放。</li>
  <li><strong>⚙️ 设置显示修复</strong>: 修复播放列表数据库设置项显示为 <code>[object Object]</code> 的问题，现在正确显示数据库 ID。</li>
</ul>

<h3>📅 v0.6.1 版本更新 (2025.9.20)</h3>
<h4>✨ 新增功能</h4>
<ul>
  <li><strong>☁️ 夸克网盘 TV 版集成</strong>:
    <ul>
      <li>新增夸克网盘 TV 版扫码登录支持，可实现浏览、播放及时间戳标记。</li>
    </ul>
  </li>
  <li><strong>字幕智能加载</strong>:
    <ul>
      <li>支持从网盘中自动加载同名字幕，或手动选择同一文件夹下的字幕文件。</li>
    </ul>
  </li>
</ul>
<h4>⚡ 性能与体验优化</h4>
<ul>
    <ul>
      <li><strong>性能优化</strong>: 本地视频缩略图加载机制重构，废除文件缓存 (<code>thumb-cache.json</code>)，改为<strong>纯内存会话缓存</strong>。</li>
      <li><strong>按需生成</strong>: 缩略图仅在懒加载时生成一次，后续从内存瞬时读取，实现零磁盘I/O，极大提升流畅度与资源利用率。</li>
      <li><strong>逻辑统一</strong>:统一本地文件夹的添加逻辑，不再写入数据库，减少了对数据库的依赖。</li>
    </ul>
  </li>
</ul>
<h4>🐛 问题修复</h4>
<ul>
  <li><strong>界面修复</strong>:
    <ul>
      <li>修复了 TVBox 影视详情页在 Dock 栏中宽度异常的问题，使其自适应面板尺寸。</li>
      <li>修复了在特定主题（如 Asri）下，插件内 Tab 标签页初始位置错位的问题。</li>
    </ul>
  </li>
  <li><strong>网盘功能修复</strong>:
    <ul>
      <li>修复了网盘标签刷新时可能出现的错误提示。</li>
      <li>修复了部分网盘视频时间戳链接点击无法正确跳转的问题。</li>
      <li>修复了 123 网盘无法截图的问题。</li>
    </ul>
  </li>
  <li><strong>导航修复</strong>:
    <ul>
      <li>修复了本地文件夹视图中，路径面包屑导航可能错误指向上级目录的问题。</li>
    </ul>
  </li>
</ul>

<h3>📅 v0.6.0 版本更新 (2025.9.17)</h3>
<h4>✨ 新增功能</h4>
<ul>
  <li><strong>📺 TVBox 影视聚合</strong>:
    <ul>
      <li>支持通过自定义源加载影视媒体，聚合多平台内容。</li>
      <li>自动从豆瓣抓取海报、名称、别名、英文名称、评分、上映年份、国家地区、语言、类型、简介、影人、预告片等详细信息。</li>
      <li>支持多源聚合搜索与 HLS 分片视频播放。</li>
    </ul>
  </li>
  <li><strong>💬 字幕系统全面增强</strong>:
    <ul>
      <li><strong>智能加载</strong>: 自动查找并加载同名字幕文件，并在菜单中默认勾选第一项。</li>
      <li><strong>编码修复</strong>: 解决字幕乱码问题，通过 <code>UTF-8</code> + <code>GBK</code> 智能降级解码，兼容各类编码<a href="https://github.com/mm-o/siyuan-media-player/issues/138">#138</a>。</li>
      <li><strong>双语优化</strong>: 智能解析多行字幕，完美支持双语分行显示<a href="https://github.com/mm-o/siyuan-media-player/issues/102">#102</a>。</li>
      <li><strong>格式扩展</strong>: 新增对 <code>.ass</code> 字幕格式的解析支持。</li>
      <li><strong>样式自定义</strong>: 支持通过设置滑块实时调整字幕字体大小。</li>
    </ul>
  </li>
  <li><strong>⌨️ 全局快捷键扩展</strong>:
    <ul>
      <li>新增“播放/暂停”、“快进”、“快退”、“上一曲”、“下一曲”等全局快捷键，快捷键默认留空<a href="https://github.com/mm-o/siyuan-media-player/issues/141">#141</a>。</li>
    </ul>
  </li>
</ul>
<h4>⚡ 界面（性能）优化</h4>
<ul>
  <li><strong>🚀 播放列表性能重构</strong>:
    <ul>
      <li><strong>多级缓存系统</strong>:
        <ul>
          <li><strong>标签页缓存</strong>: 首次加载标签页（普通列表、文件夹、网盘）后，其完整状态（文件列表、排序）将被缓存，切换回来时可实现“秒开”<a href="https://github.com/mm-o/siyuan-media-player/issues/139">#139</a>。</li>
        </ul>
      </li>
      <li><strong>智能懒加载</strong>:
        <ul>
          <li>浏览文件夹或网盘时，视频缩略图仅在滚动到可视区域时才加载，极大提升大目录的浏览流畅度<a href="https://github.com/mm-o/siyuan-media-player/issues/143">#143</a>。</li>
          <li>自动预加载少量首屏项目，优化初次加载体验。</li>
        </ul>
      </li>
    </ul>
  </li>
</ul>
<h4>🐛 问题修复</h4>
<ul>
  <li><strong>文件名解析</strong>: 修复了导入含多个<code>.</code>的媒体文件（如<code>A.B.mp4</code>）时，标题被错误截断的问题。</li>
  <li><strong>交互与状态修复</strong>:
    <ul>
      <li>修复了已缓存的标签页未能记住上次的视图布局和排序方式的 bug<a href="https://github.com/mm-o/siyuan-media-player/issues/142">#142</a>。</li>
      <li>修复了从文件夹视图切换到普通标签页时，顶部导航面包屑会残留的 bug。</li>
    </ul>
  </li>
  <li><strong>播放器设置</strong>: 解决了“选择字幕”、“画中画”、“全屏”按钮点击失效的问题<a href="https://github.com/mm-o/siyuan-media-player/issues/102">#102</a>。</li>
</ul>

<h3>📅 v0.5.8 版本更新 (2025.9.8)</h3>
<h4>✨ 新增功能</h4>
<ul>
  <li>📄 <strong>PDF支持</strong>：初步支持在弹窗(Dialog)中打开本地、WebDAV及网盘中的PDF文件。</li>
</ul>
<h4>⚡ 性能优化 & 🐛 问题修复</h4>
<ul>
  <li><strong>修复</strong>：解决了因加载本地文件夹和思源空间视频缩略图导致的界面<strong>卡顿白屏</strong>问题。</li>
  <li><strong>修复</strong>：修复了 `/` 菜单在某些情况下错位的问题。</li>
  <li><strong>修复</strong>：修复特定场景下本地文件夹扫描失败的问题。</li>
</ul>
<h3>📅 v0.5.6版本更新 (2025.9.5)</h3>
<h4>✨ 新增功能</h4>
<ol>
  <li>🔊 <strong>音量增强与快捷键</strong>
    <ul>
      <li>音量上限提升至 600%（≤100 时每次步进 ±10，>100 时每次步进 ±20）</li>
      <li>播放器快捷键同步支持上述步进逻辑</li>
    </ul>
  </li>
  <li>🔐 <strong>OpenList 访客模式</strong>
    <ul>
      <li>支持无需用户名/密码的访客访问，便于内网或公开目录分享</li>
    </ul>
  </li>
  <li>🗂️ <strong>123 网盘集成</strong>
    <ul>
      <li>支持登录、浏览与播放，兼容时间戳与循环片段链接</li>
    </ul>
  </li>
  <li>💬 <strong>字幕增强</strong>
    <ul>
      <li>支持手动选择字幕并自动同步到字幕列表</li>
      <li>双语字幕显示：同时显示主/副两路字幕，适合多语言学习
        <ul>
          <li>B站自动双语：自动尝试加载英文与中文字幕</li>
          <li>手动双语选择：字幕选择支持多选（Ctrl 选 2 个文件），第一个为主字幕（上行），第二个为副字幕（下行）</li>
        </ul>
      </li>
    </ul>
  </li>
  <li>🪟 <strong>画中画小窗增强</strong>
    <ul>
      <li>小窗模式支持上一曲/下一曲与列表循环 <a href="https://github.com/mm-o/siyuan-media-player/issues/134">#134</a></li>
    </ul>
  </li>
  <li>🧭 <strong>播放列表排序</strong>
    <ul>
      <li>排序按钮依次循环：名称 → 类型 → 来源，支持升序/降序</li>
      <li>每个播放列表标签独立记忆排序方式 <a href="https://github.com/mm-o/siyuan-media-player/issues/132">#132</a></li>
    </ul>
  </li>
  <li>📺 <strong>B站合集细化</strong>
    <ul>
      <li>支持在合集内展开分P列表 <a href="https://github.com/mm-o/siyuan-media-player/issues/135">#135</a></li>
    </ul>
  </li>
  <li>💻 <strong>本地导入增强</strong>
    <ul>
      <li>导入本地文件夹支持按层级结构导入，保留目录层次</li>
    </ul>
  </li>
  <li>🧩 <strong>发布服务兼容</strong>
    <ul>
      <li>新增 plugin.json 字段 <code>disabledInPublish</code>：在发布服务中启用</li>
    </ul>
  </li>
</ol>

<h4>🔧 界面优化</h4>
<ol>
  <li>🎛️ <strong>面板/标签/文件切换反馈</strong>
    <ul>
      <li>增加过渡动画，交互更流畅</li>
    </ul>
  </li>
  <li>💬 <strong>悬浮提示优化</strong>
    <ul>
      <li>统一为思源样式</li>
    </ul>
  </li>
  <li>🏷️ <strong>卡片视图可读性</strong>
    <ul>
      <li>鼠标悬浮显示完整标题 <a href="https://github.com/mm-o/siyuan-media-player/issues/133">#133</a></li>
    </ul>
  </li>
  <li>🖱️ <strong>右键菜单统一</strong>
    <ul>
      <li>目录与播放列表标签右键菜单统一（钉住/取消钉住、重命名、刷新、清空、删除）</li>
    </ul>
  </li>
</ol>

<h4>🐛 问题修复与稳定性</h4>
<ol>
  <li>🔗 <strong>OpenList 链接与播放</strong>
    <ul>
      <li>直链播放优先；增强各类 OpenList 链接格式的兼容性与健壮性</li>
    </ul>
  </li>
  <li>👥 <strong>网盘多账号</strong>
    <ul>
      <li>多账号场景稳定性与兼容性增强</li>
    </ul>
  </li>
  <li>⏱️ <strong>时间戳/循环片段链接</strong>
    <ul>
      <li>优化编码与解析方式，正确处理包含汉字等特殊字符的路径 <a href="https://github.com/mm-o/siyuan-media-player/issues/131">#131</a></li>
    </ul>
  </li>
  <li>🌐 <strong>WebDAV 路径显示</strong>
    <ul>
      <li>重构路径与链接显示逻辑，提升一致性与健壮性</li>
    </ul>
  </li>
</ol>

<h3>📅 v0.5.5版本更新 (2025.8.23)</h3>
<h4>✨ 新增功能</h4>
<ol>
<li>☁️ <strong>百度网盘深度集成</strong>：
  <ul>
    <li><strong>多种登录方式</strong>：支持百度App扫码登录与授权码登录</li>
    <li><strong>播放列表集成</strong>：可浏览并添加网盘媒体到播放列表</li>
    <li><strong>文件夹钉住与导入</strong>：支持标签栏钉住文件夹，一键批量导入</li>
    <li><strong>高清播放体验</strong>：非会员支持播放1080p</li>
  </ul>
</li>
<li>☁️ <strong>自定义云盘账号</strong>：OpenList/WebDAV 支持自定义名称，便于识别多账号</li>
<li>🔗 <strong>兼容反向代理</strong>：OpenList 新增“路径前缀”配置项</li>

</ol>
<h4>🔧 界面优化</h4>
<ol>
<li>🧩 <strong>Dock 侧栏</strong>：去除重复边框/圆角，统一继承主题</li>
<li>🧭 <strong>播放列表底部输入区</strong>：层级与顶部标题一致，避免遮挡播放器</li>
<li>🏷️ <strong>云盘标签</strong>：播放列表添加云盘时，标签使用自定义名称，告别 IP/序号</li>
<li>➕ <strong>添加菜单</strong>：云盘账号以名称显示，更易识别</li>
<li>🎨 <strong>样式作用域</strong>：修复影响全局的问题</li>
</ol>
<h4>🐛 问题修复</h4>
<ol>
<li>🧠 修复思维导图生成可能导致的错误</li>
<li>⏱️ 修复时间戳插入导致的崩溃</li>
<li>👥 修复多账号添加不识别的问题</li>
<li>⌨️ 修复输入框层级问题 <a href="https://github.com/mm-o/siyuan-media-player/issues/127">#127</a></li>
<li>⌨️ 快捷键：修复按住 A 键触发 3x 影响全局的问题；现仅在播放器内生效，且仅单独按 A 生效（Ctrl+方向键仍用于调速）</li>
<li>⚙️ <strong>OpenList API</strong>：规范化 API 利用，去除不必要的路径清理逻辑</li>
</ol>

<h3>📅 v0.5.4版本更新 (2025.8.19)</h3>
<h4>✨ 新增功能</h4>
<ol>
<li>🧠 <strong>思维导图</strong>：助手面板新增思维导图功能，支持点击跳转</li>
<li>⚙️ <strong>AI 账号配置</strong>：支持 OpenAI/Azure 兼容接口，可直接调用自定义 AI 服务</li>
<li>☁️ <strong>阿里云盘支持</strong>：新增阿里云盘账号配置和文件浏览</li>
<li>📱 <strong>手机端播放</strong>：支持手机端媒体播放功能</li>
<li>🎛️ <strong>播放器增强</strong>：新增上一曲/下一曲按钮，支持快捷键（Shift + ←/→）</li>
<li>📌 <strong>网盘钉住</strong>：网盘文件夹可钉住到标签栏并批量添加 <a href="https://github.com/mm-o/siyuan-media-player/issues/121">#121</a></li>
</ol>
<h4>🔧 界面优化</h4>
<ol>
<li>🎨 <strong>UI 重构</strong>：完全依托思源样式，适应不同主题</li>
<li>🖥️ <strong>播放器界面</strong>：优化画中画、网页全屏、全屏按钮类型 <a href="https://github.com/mm-o/siyuan-media-player/issues/126">#126</a></li>
<li>⏰ <strong>时间格式</strong>：时间戳、循环片段链接优化为时分秒格式 <a href="https://github.com/mm-o/siyuan-media-player/issues/120">#120</a></li>
<li>🔗 <strong>链接顺序</strong>：批量添加按链接顺序处理 <a href="https://github.com/mm-o/siyuan-media-player/issues/122">#122</a></li>
</ol>
<h4>🐛 问题修复</h4>
<ol>
<li>🧾 <strong>批量导出</strong>：修复字幕、总结等批量插入崩溃问题</li>
<li>🧭 <strong>标签状态</strong>：优化默认标签钉住状态</li>
<li>💳 <strong>会员系统</strong>：加强会员激活逻辑</li>
<li>🔑 <strong>主键冲突</strong>：修复主键为媒体标题时导入失败问题</li>
<li>🗂️ <strong>思源空间</strong>：修复添加失败问题，支持文件夹钉住并导入功能</li>
</ol>

<h3>📅 v0.5.2版本更新 (2025.8.9)</h3>
<h4>🔧 兼容性修复</h4>
<ol>
<li>🔄 <strong>智能数据库升级</strong>：自动检测旧版本数据库结构，智能提示用户升级</li>
<li>📝 <strong>用户友好提示</strong>：检测到主键作为媒体标题的旧结构时，显示清晰的升级说明</li>
<li>✅ <strong>安全数据迁移</strong>：用户确认后自动创建媒体标题字段并迁移所有数据</li>
<li>🎯 <strong>无损升级</strong>：保留原有数据不变，仅新增优化字段结构</li>
<li>🚫 <strong>可选操作</strong>：用户可选择立即升级或稍后处理，不强制执行</li>
</ol>
<h4>🐛 缺陷修复</h4>
<ol>
<li>🎬 修复弹幕滚动逻辑异常问题</li>
<li>🏷️ <strong>标签显示修复</strong>：修复数据库标签选项描述为空时不显示的问题，默认支持显示视图和钉住</li>
<li>🧹 移除过时的配置清理工具，优化设置界面</li>
</ol>
<h4>💡 用户体验优化</h4>
<ol>
<li>📋 优化兼容性提示界面，提供清晰的操作说明和选择按钮</li>
<li>🎨 提升数据库字段映射容错性，确保各种配置环境下的稳定运行</li>
</ol>

<h3>📅 v0.5.1版本更新 (2025.8.8)</h3>
<h4>✨ 功能改进</h4>
<ol>
<li>🧭 助手面板新增<strong>文档视图</strong>：播放进度联动高亮，支持拖拽复制</li>
<li>📋 播放列表<strong>按标签保存独立视图状态</strong> <a href="https://github.com/mm-o/siyuan-media-player/issues/116">#116</a></li>
<li>🎛️ 支持<strong>自定义播放列表项显示元素</strong> <a href="https://github.com/mm-o/siyuan-media-player/issues/107">#107</a></li>
<li>🔍 搜索交互优化：改为<strong>按回车触发搜索</strong>，避免实时抖动 <a href="https://github.com/mm-o/siyuan-media-player/issues/109">#109</a></li>
<li>⌨️ 新增快捷键 <strong>A</strong>：一键切换至<strong>3.0x</strong>，再次按下恢复原速度 <a href="https://github.com/mm-o/siyuan-media-player/issues/105">#105</a></li>
<li>🌐 账号服务器地址输入<strong>容错率提升</strong></li>
<li>📝 媒体标题字段可<strong>独立配置</strong>，主键支持自定义 <a href="https://github.com/mm-o/siyuan-media-player/issues/90">#90</a></li>
<li>💳 会员限时折扣：年付<strong>¥20</strong>，永久<strong>¥99</strong></li>
</ol>

<h4>🐛 修复缺陷</h4>
<ol>
<li>修复点击合集子集自动添加到播放列表的问题</li>
<li>修复合集与分P仅播放第一集的问题</li>
<li>修复网盘<strong>导航条</strong>不显示的问题 <a href="https://github.com/mm-o/siyuan-media-player/issues/117">#117</a></li>
<li>修复数据库每页<strong>50条</strong>时无法完整加载到播放列表的问题 <a href="https://github.com/mm-o/siyuan-media-player/issues/108">#108</a></li>
</ol>

<h4>🔧 开发重构</h4>
<ol>
<li>脚本依赖调整：B站功能需安装扩展脚本：
<a href="https://github.com/mm-o/siyuan-media-player/raw/main/docs/bilibili-extension.js">GitHub</a> |
<a href="https://gitee.com/m-o/siyuan-media-player/blob/master/docs/bilibili-extension.js">Gitee</a>
</li>
</ol>

<h3>📅 v0.5.0版本更新 (2025.8.6)</h3>
<h4>✨ 功能改进</h4>
<p>🎯 <strong>会员系统</strong>: 新增三种会员类型（恶龙永久会员、年付会员、体验会员），支持跳转购买，前期打赏用户赠送永久恶龙会员。<strong>限期折扣，截止10月10日</strong></p>
<p>👥 <strong>多账号支持</strong>: 支持多个账号同时管理（B站、OpenList、WebDAV），播放列表菜单提供二级菜单快速切换</p>
<p>📌 <strong>标签钉住功能</strong>: 播放列表标签支持钉住到标签栏，快速访问常用列表 <a href="https://github.com/mm-o/siyuan-media-player/issues/95">#95</a></p>
<p>📋 <strong>分P列表增强</strong>: 分P列表显示完整标题，提升内容识别度 <a href="https://github.com/mm-o/siyuan-media-player/issues/100">#100</a></p>
<p>📖 <strong>设置面板优化</strong>: 新增关于标签页，集成README文档和目录导航</p>
<p>🎨 <strong>播放速度优化</strong>: 播放速度选项更加人性化（0.5x-4.0x，步长0.25x）</p>
<p>📝 <strong>循环片段改进</strong>: 循环次数改为输入类型，不再限制上限</p>
<p>📥 <strong>批量添加增强</strong>:</p>
<ul>
<li>B站合集获取所有视频，不再限制100个 <a href="https://github.com/mm-o/siyuan-media-player/issues/88">#88</a></li>
<li>批量处理稳定性提升，错误不会中断整个流程</li>
<li>支持BV号直接添加 <a href="https://github.com/mm-o/siyuan-media-player/issues/79">#79</a></li>
<li>支持多种分隔符混合输入（空格、换行、逗号）<a href="https://github.com/mm-o/siyuan-media-player/issues/85">#85</a></li>
</ul>
<p>🗂️ <strong>播放列表扩展</strong>: OpenList和WebDAV媒体支持添加到播放列表和数据库 <a href="https://github.com/mm-o/siyuan-media-player/issues/73">#73</a></p>
<p>📔 <strong>媒体笔记增强</strong>: 支持DailyNote模式创建，点击按钮直接创建并打开新标签 <a href="https://github.com/mm-o/siyuan-media-player/issues/96">#96</a> <a href="https://github.com/mm-o/siyuan-media-player/issues/98">#98</a></p>

<h4>🐛 修复缺陷</h4>
<p>🌙 <strong>暗黑模式修复</strong>: 修复暗黑模式下分P列表显示不清的问题 <a href="https://github.com/mm-o/siyuan-media-player/issues/101">#101</a></p>
<p>🎨 <strong>视图样式优化</strong>: 优化紧凑视图分P展开样式，提升视觉体验</p>
<p>📝 <strong>文档背景修复</strong>: 重置说明文档背景，暗黑模式下更加清晰</p>
<p>⏱️ <strong>时间戳修复</strong>: 修复插入时间戳时点击下一行不换行、中间回车崩溃的问题 <a href="https://github.com/mm-o/siyuan-media-player/issues/97">#97</a></p>
<p>🧹 <strong>状态清理修复</strong>: 修复字幕、弹幕、总结状态未正确清空的问题 <a href="https://github.com/mm-o/siyuan-media-player/issues/94">#94</a></p>

<h4>🔧 开发重构</h4>
<p>🔄 <strong>媒体播放重构</strong>: WebDAV和OpenList媒体通过思源代理API访问，提升稳定性</p>
<p>🔗 <strong>链接处理优化</strong>: 重构链接点击逻辑，解决首次打开播放失败问题</p>
<p>🏗️ <strong>合集添加统一</strong>: 统一合集添加到底部输入框，样式继承分P设计</p>
<p>🔄 <strong>配置自动迁移</strong>: 新增配置迁移工具，自动处理单账号到多账号的配置升级，确保用户无感知升级</p>
<blockquote>
<p>📋 <strong>查看完整更新日志</strong>: <a href="https://github.com/mm-o/siyuan-media-player/blob/main/更新日志.md">更新日志.md</a></p>
</blockquote>

<h4>🎯 交流群</h4>
<p><strong>QQ群</strong>: <a href="https://qm.qq.com/q/wpHDtsfxCw">QQ群</a> QQ群号：306538841（已打赏未进群用户请提供订单号进群）</p>
    </div>
    <div style="margin-top: 1.5em; padding: 1.5em; background: var(--b3-theme-surface-lighter); border: 1px solid var(--b3-theme-border); border-radius: 8px; box-shadow: 0 4px 12px var(--b3-theme-shadow);">
        <h2 style="color: var(--b3-theme-primary); margin: 0 0 1em; text-align: center; font-size: 1.3em;">🚀 核心功能</h2>
        <ul style="margin: 0; list-style: none; padding: 0;">
            <li style="margin: 0.5em 0; padding: 10px 14px; background: var(--b3-theme-surface); border-radius: 8px; border-left: 4px solid var(--b3-theme-primary); box-shadow: 0 2px 4px var(--b3-theme-shadow-light);">🎥 <strong>多平台播放</strong> - 本地媒体、扩展媒体、OpenList、WebDAV云存储统一播放</li>
            <li style="margin: 0.5em 0; padding: 10px 14px; background: var(--b3-theme-surface); border-radius: 8px; border-left: 4px solid var(--b3-theme-primary); box-shadow: 0 2px 4px var(--b3-theme-shadow-light);">⏰ <strong>时间戳跳转</strong> - 精确时间戳链接，一键跳转到指定播放位置</li>
            <li style="margin: 0.5em 0; padding: 10px 14px; background: var(--b3-theme-surface); border-radius: 8px; border-left: 4px solid var(--b3-theme-primary); box-shadow: 0 2px 4px var(--b3-theme-shadow-light);">🔄 <strong>循环片段</strong> - 自定义循环播放片段，重点内容反复学习</li>
            <li style="margin: 0.5em 0; padding: 10px 14px; background: var(--b3-theme-surface); border-radius: 8px; border-left: 4px solid var(--b3-theme-primary); box-shadow: 0 2px 4px var(--b3-theme-shadow-light);">📔 <strong>媒体笔记</strong> - 截图、字幕、弹幕导出，支持子文档创建和智能搜索配置，完整的学习笔记生态</li>
            <li style="margin: 0.5em 0; padding: 10px 14px; background: var(--b3-theme-surface); border-radius: 8px; border-left: 4px solid var(--b3-theme-primary); box-shadow: 0 2px 4px var(--b3-theme-shadow-light);">🤖 <strong>媒体助手</strong> - 字幕列表、弹幕列表、AI媒体总结智能分析</li>
            <li style="margin: 0.5em 0; padding: 10px 14px; background: var(--b3-theme-surface); border-radius: 8px; border-left: 4px solid var(--b3-theme-primary); box-shadow: 0 2px 4px var(--b3-theme-shadow-light);">📋 <strong>播放列表</strong> - 数据库驱动管理，标签分类、拖拽排序、多视图展示</li>
            <li style="margin: 0.5em 0; padding: 10px 14px; background: var(--b3-theme-surface); border-radius: 8px; border-left: 4px solid var(--b3-theme-primary); box-shadow: 0 2px 4px var(--b3-theme-shadow-light);">📥 <strong>批量导入</strong> - 一键导入扩展收藏夹、扩展合集、本地文件夹、思源笔记工作空间、OpenList、WebDAV云存储到播放列表</li>
            <li style="margin: 0.5em 0; padding: 10px 14px; background: var(--b3-theme-surface); border-radius: 8px; border-left: 4px solid var(--b3-theme-primary); box-shadow: 0 2px 4px var(--b3-theme-shadow-light);">📝 <strong>笔记面板</strong> - 独立的文档和块内容查看编辑，支持ID输入、智能标签、右键菜单操作</li>
            <li style="margin: 0.5em 0; padding: 10px 14px; background: var(--b3-theme-surface); border-radius: 8px; border-left: 4px solid var(--b3-theme-primary); box-shadow: 0 2px 4px var(--b3-theme-shadow-light);">🔗 <strong>智能链接识别</strong> - 数据库URL字段媒体链接直接播放，Ctrl+点击强制浏览器打开</li>
            <li style="margin: 0.5em 0; padding: 10px 14px; background: var(--b3-theme-surface); border-radius: 8px; border-left: 4px solid var(--b3-theme-primary); box-shadow: 0 2px 4px var(--b3-theme-shadow-light);">⚙️ <strong>设置面板</strong> - 账号配置、播放器设置、通用选项一站式管理</li>
            <li style="margin: 0.5em 0; padding: 10px 14px; background: var(--b3-theme-surface); border-radius: 8px; border-left: 4px solid var(--b3-theme-primary); box-shadow: 0 2px 4px var(--b3-theme-shadow-light);">🔧 <strong>脚本扩展</strong> - 支持第三方扩展脚本，用户自主选择功能模块</li>
        </ul>
    </div>
    <div style="margin-top: 1.5em; padding: 1.5em; background: var(--b3-theme-surface-lighter); border: 1px solid var(--b3-theme-border); border-radius: 8px; box-shadow: 0 4px 12px var(--b3-theme-shadow);">
        <h2 style="color: var(--b3-theme-primary); margin: 0 0 1em; text-align: center; font-size: 1.3em;">⚠️ 免责说明</h2>
        <ul style="margin: 0;  list-style: none; padding: 0;">
            <li style="margin: 0.5em 0; padding: 10px 14px; background: var(--b3-theme-surface); border-radius: 8px; border-left: 4px solid var(--b3-theme-primary); box-shadow: 0 2px 4px var(--b3-theme-shadow-light);">🎯 <strong>技术架构</strong> - 插件采用扩展化设计，核心代码专注于播放功能，不包含任何第三方服务代码</li>
            <li style="margin: 0.5em 0; padding: 10px 14px; background: var(--b3-theme-surface); border-radius: 8px; border-left: 4px solid var(--b3-theme-primary); box-shadow: 0 2px 4px var(--b3-theme-shadow-light);">🎛️ <strong>扩展选择</strong> - 用户可根据需要自主选择是否使用第三方扩展脚本</li>
            <li style="margin: 0.5em 0; padding: 10px 14px; background: var(--b3-theme-surface); border-radius: 8px; border-left: 4px solid var(--b3-theme-primary); box-shadow: 0 2px 4px var(--b3-theme-shadow-light);">🛡️ <strong>安全提醒</strong> - 扩展脚本为独立功能模块，请根据个人需求谨慎选择使用</li>
        </ul>
    </div>
    <div style="margin-top: 1.5em; padding: 1.5em; background: var(--b3-theme-surface-lighter); border: 1px solid var(--b3-theme-border); border-radius: 8px; box-shadow: 0 4px 12px var(--b3-theme-shadow);">
        <h2 style="color: var(--b3-theme-primary); margin: 0 0 1em; text-align: center; font-size: 1.3em;">🧧 打赏</h2>
        <p style="margin: 0.5em 0;">如果思源媒体播放器对你有帮助，欢迎给作者点个赞或打赏一杯咖啡，这将鼓励作者持续优化和开发更多实用功能：</p>
        <div style="margin: 1em 0; text-align: center; display: flex; justify-content: space-around; flex-wrap: wrap; gap: 20px;">
            <div style="text-align: center;">
                <img src="/plugins/siyuan-media-player/assets/images/alipay.jpg"
                     alt="支付宝付款码"
                     style="width: 280px; border-radius: 8px; box-shadow: 0 2px 4px var(--b3-theme-shadow-light);">
                <p style="margin: 0.5em 0; color: var(--b3-theme-text-lighter);">支付宝</p>
            </div>
            <div style="text-align: center;">
                <img src="/plugins/siyuan-media-player/assets/images/wechat.jpg"
                     alt="微信付款码"
                     style="width: 280px; border-radius: 8px; box-shadow: 0 2px 4px var(--b3-theme-shadow-light);">
                <p style="margin: 0.5em 0; color: var(--b3-theme-text-lighter);">微信</p>
            </div>
        </div>
    </div>
    <div style="margin-top: 1.5em; padding: 1.5em; background: var(--b3-theme-surface-lighter); border: 1px solid var(--b3-theme-border); border-radius: 8px; box-shadow: 0 4px 12px var(--b3-theme-shadow);">
        <h2 style="color: var(--b3-theme-primary); margin: 0 0 1em; text-align: center; font-size: 1.3em;">📖 使用指南</h2>
        <ul style="margin: 0;  list-style: none; padding: 0;">
            <li style="margin: 0.5em 0; padding: 10px 14px; background: var(--b3-theme-surface); border-radius: 8px; border-left: 4px solid var(--b3-theme-primary); box-shadow: 0 2px 4px var(--b3-theme-shadow-light);">
                <details>
                <summary style="color: var(--b3-theme-primary); cursor: pointer; font-weight: 500; font-size: 1.05em;">🗄️ <strong>绑定数据库</strong> - 配置播放列表数据存储</summary>
                <div style="margin-top: 0.8em; padding-top: 0.8em; border-top: 1px solid var(--b3-theme-border);">
                1. 选择一个数据库块，点击数据库图标或者右键 > 复制 > 复制 ID<br>
                2. 打开思源媒体播放器设置面板<br>
                3. 在"通用"标签找到"播放列表数据库"<br>
                4. 粘贴步骤一复制的数据库块ID，绑定数据库<br>
                5. 绑定成功后，所有播放列表数据将同步到指定数据库<br>
                6. 支持自动创建画廊视图，方便直观管理媒体列表
                </div>
                </details>
            </li>
            <li style="margin: 0.5em 0; padding: 10px 14px; background: var(--b3-theme-surface); border-radius: 8px; border-left: 4px solid var(--b3-theme-primary); box-shadow: 0 2px 4px var(--b3-theme-shadow-light);">
                <details>
                <summary style="color: var(--b3-theme-primary); cursor: pointer; font-weight: 500; font-size: 1.05em;">🔧 <strong>配置扩展账号</strong> - 登录扩展服务访问个人资源</summary>
                <div style="margin-top: 0.8em; padding-top: 0.8em; border-top: 1px solid var(--b3-theme-border);">
                1. 在设置面板中找到"扩展账号"部分<br>
                2. 点击"登录扩展账号"按钮<br>
                3. 扫描显示的二维码（使用扩展服务手机APP）<br>
                4. 登录成功后可观看扩展视频并批量添加收藏夹
                </div>
                </details>
            </li>
            <li style="margin: 0.5em 0; padding: 10px 14px; background: var(--b3-theme-surface); border-radius: 8px; border-left: 4px solid var(--b3-theme-primary); box-shadow: 0 2px 4px var(--b3-theme-shadow-light);">
                <details>
                <summary style="color: var(--b3-theme-primary); cursor: pointer; font-weight: 500; font-size: 1.05em;">🔗 <strong>配置OpenList服务</strong> - 连接云存储服务器</summary>
                <div style="margin-top: 0.8em; padding-top: 0.8em; border-top: 1px solid var(--b3-theme-border);">
                1. 在设置面板中找到"OpenList配置"部分<br>
                2. 填写OpenList服务器地址（如：http://localhost:5244）<br>
                3. 输入用户名和密码<br>
                4. 配置成功后可直接浏览和播放OpenList中的媒体文件
                </div>
                </details>
            </li>
            <li style="margin: 0.5em 0; padding: 10px 14px; background: var(--b3-theme-surface); border-radius: 8px; border-left: 4px solid var(--b3-theme-primary); box-shadow: 0 2px 4px var(--b3-theme-shadow-light);">
                <details>
                <summary style="color: var(--b3-theme-primary); cursor: pointer; font-weight: 500; font-size: 1.05em;">☁️ <strong>配置WebDAV云存储</strong> - 连接WebDAV服务</summary>
                <div style="margin-top: 0.8em; padding-top: 0.8em; border-top: 1px solid var(--b3-theme-border);">
                1. 在设置面板中找到"WebDAV配置"部分<br>
                2. 填写WebDAV服务器地址<br>
                3. 输入用户名和密码<br>
                4. 支持坚果云、NextCloud等主流WebDAV服务<br>
                5. 配置成功后可直接浏览和播放WebDAV中的媒体文件
                </div>
                </details>
            </li>
            <li style="margin: 0.5em 0; padding: 10px 14px; background: var(--b3-theme-surface); border-radius: 8px; border-left: 4px solid var(--b3-theme-primary); box-shadow: 0 2px 4px var(--b3-theme-shadow-light);">
                <details>
                <summary style="color: var(--b3-theme-primary); cursor: pointer; font-weight: 500; font-size: 1.05em;">📁 <strong>添加本地媒体</strong> - 支持多选</summary>
                <div style="margin-top: 0.8em; padding-top: 0.8em; border-top: 1px solid var(--b3-theme-border);">
                1. 直接点击播放列表底部部的"添加"按钮<br>
                2. 在弹出的文件管理器选择需要添加的媒体<br>
                3. 点击打开就可以添加到播放列表<br>
                4. 支持单选和多选<br>
                5. 系统会自动检测同名字幕文件
                </div>
                </details>
            </li>
            <li style="margin: 0.5em 0; padding: 10px 14px; background: var(--b3-theme-surface); border-radius: 8px; border-left: 4px solid var(--b3-theme-primary); box-shadow: 0 2px 4px var(--b3-theme-shadow-light);">
                <details>
                <summary style="color: var(--b3-theme-primary); cursor: pointer; font-weight: 500; font-size: 1.05em;">📂 <strong>添加本地文件夹</strong> - 批量导入本地文件</summary>
                <div style="margin-top: 0.8em; padding-top: 0.8em; border-top: 1px solid var(--b3-theme-border);">
                1. 点击播放列表标签“+”弹出菜单<br>
                2. 点击“添加本地文件夹”<br>
                3. 在弹出的文件浏览器选择需要添加的文件夹<br>
                4. 点击“选择文件夹”按钮<br>
                5. 系统将自动扫描并批量导入所有符合条件的媒体文件
                </div>
                </details>
            </li>
            <li style="margin: 0.5em 0; padding: 10px 14px; background: var(--b3-theme-surface); border-radius: 8px; border-left: 4px solid var(--b3-theme-primary); box-shadow: 0 2px 4px var(--b3-theme-shadow-light);">
                <details>
                <summary style="color: var(--b3-theme-primary); cursor: pointer; font-weight: 500; font-size: 1.05em;">🏠 <strong>添加思源空间媒体</strong> - 浏览工作空间文件</summary>
                <div style="margin-top: 0.8em; padding-top: 0.8em; border-top: 1px solid var(--b3-theme-border);">
                1. 点击播放列表标签“+”弹出菜单<br>
                2. 点击“添加添加思源空间”即可添加思源工作空间到播放列表<br>
                5. 思源空间的媒体使用相对路径，便于工作空间迁移
                </div>
                </details>
            </li>
            <li style="margin: 0.5em 0; padding: 10px 14px; background: var(--b3-theme-surface); border-radius: 8px; border-left: 4px solid var(--b3-theme-primary); box-shadow: 0 2px 4px var(--b3-theme-shadow-light);">
                <details>
                <summary style="color: var(--b3-theme-primary); cursor: pointer; font-weight: 500; font-size: 1.05em;">🔗 <strong>添加OpenList媒体</strong> - 云存储流式播放</summary>
                <div style="margin-top: 0.8em; padding-top: 0.8em; border-top: 1px solid var(--b3-theme-border);">
                1. 确保已配置OpenList服务器连接<br>
                2. 点击播放列表标签“+”弹出菜单<br>
                3. 点击“添加OpenList云盘”<br>
                4. 媒体将通过流式播放，无需下载到本地
                </div>
                </details>
            </li>
            <li style="margin: 0.5em 0; padding: 10px 14px; background: var(--b3-theme-surface); border-radius: 8px; border-left: 4px solid var(--b3-theme-primary); box-shadow: 0 2px 4px var(--b3-theme-shadow-light);">
                <details>
                <summary style="color: var(--b3-theme-primary); cursor: pointer; font-weight: 500; font-size: 1.05em;">☁️ <strong>添加WebDAV媒体</strong> - 云盘直接播放</summary>
                <div style="margin-top: 0.8em; padding-top: 0.8em; border-top: 1px solid var(--b3-theme-border);">
                1. 确保已配置WebDAV云存储连接<br>
                2. 点击播放列表标签“+”弹出菜单<br>
                3. 点击“添加WebDAV云盘”<br>
                4. 媒体将通过流式播放，无需下载到本地
                </div>
                </details>
            </li>
            <li style="margin: 0.5em 0; padding: 10px 14px; background: var(--b3-theme-surface); border-radius: 8px; border-left: 4px solid var(--b3-theme-primary); box-shadow: 0 2px 4px var(--b3-theme-shadow-light);">
                <details>
                <summary style="color: var(--b3-theme-primary); cursor: pointer; font-weight: 500; font-size: 1.05em;">📥 <strong>批量导入扩展收藏夹</strong> - 一键导入收藏视频</summary>
                <div style="margin-top: 0.8em; padding-top: 0.8em; border-top: 1px solid var(--b3-theme-border);">
                1. 确保已登录扩展账号<br>
                2. 点击播放列表标签“+”弹出菜单
                3. 点击“添加扩展收藏夹”<br>
                3. 选择要导入的收藏夹<br>
                4. 系统将批量导入收藏夹中的所有视频
                </div>
                </details>
            </li>
            <li style="margin: 0.5em 0; padding: 10px 14px; background: var(--b3-theme-surface); border-radius: 8px; border-left: 4px solid var(--b3-theme-primary); box-shadow: 0 2px 4px var(--b3-theme-shadow-light);">
                <details>
                <summary style="color: var(--b3-theme-primary); cursor: pointer; font-weight: 500; font-size: 1.05em;">📚 <strong>批量导入扩展合集</strong> - 一键导入合集视频</summary>
                <div style="margin-top: 0.8em; padding-top: 0.8em; border-top: 1px solid var(--b3-theme-border);">
                1. 确保已登录扩展账号<br>
                2. 点击播放列表标签"+"弹出菜单<br>
                3. 点击"添加扩展合集"<br>
                4. 输入合集中任意视频的链接<br>
                5. 按回车确认，系统将自动获取整个合集并批量导入所有视频
                </div>
                </details>
            </li>
            <li style="margin: 0.5em 0; padding: 10px 14px; background: var(--b3-theme-surface); border-radius: 8px; border-left: 4px solid var(--b3-theme-primary); box-shadow: 0 2px 4px var(--b3-theme-shadow-light);">
                <details>
                <summary style="color: var(--b3-theme-primary); cursor: pointer; font-weight: 500; font-size: 1.05em;">🏷️ <strong>标签管理</strong> - 创建和管理播放列表标签</summary>
                <div style="margin-top: 0.8em; padding-top: 0.8em; border-top: 1px solid var(--b3-theme-border);">
                1. 在播放列表顶部点击"+"按钮创建新标签<br>
                2. 输入标签名称并确认<br>
                3. <strong>重命名标签</strong>：右键点击标签 > 选择"重命名"<br>
                4. <strong>删除标签</strong>：右键点击标签 > 选择"删除"即可删除标签及标签下媒体<br>
                5. <strong>清空标签</strong>：右键点击标签 > 选择"清空"即可清空标签下媒体
                </div>
                </details>
            </li>
            <li style="margin: 0.5em 0; padding: 10px 14px; background: var(--b3-theme-surface); border-radius: 8px; border-left: 4px solid var(--b3-theme-primary); box-shadow: 0 2px 4px var(--b3-theme-shadow-light);">
                <details>
                <summary style="color: var(--b3-theme-primary); cursor: pointer; font-weight: 500; font-size: 1.05em;">🔄 <strong>智能刷新</strong> - 自动同步文件夹、扩展收藏夹、扩展合集</summary>
                <div style="margin-top: 0.8em; padding-top: 0.8em; border-top: 1px solid var(--b3-theme-border);">
                1. 右键点击需要刷新的标签<br>
                2. 选择"刷新标签"<br>
                3. 系统将根据标签类型自动执行相应的刷新策略：<br>
                • <strong>文件夹标签</strong>：检测本地文件夹变化，智能增删媒体项<br>
                • <strong>扩展收藏夹</strong>：检测收藏夹内容变化，保持数据一致性<br>
                • <strong>扩展合集</strong>：检测合集内容变化，自动同步最新视频<br>
                4. 智能对比现有数据，仅处理变化项目，性能提升显著
                </div>
                </details>
            </li>
            <li style="margin: 0.5em 0; padding: 10px 14px; background: var(--b3-theme-surface); border-radius: 8px; border-left: 4px solid var(--b3-theme-primary); box-shadow: 0 2px 4px var(--b3-theme-shadow-light);">
                <details>
                <summary style="color: var(--b3-theme-primary); cursor: pointer; font-weight: 500; font-size: 1.05em;">🔄 <strong>拖拽操作</strong> - 媒体移动和排序</summary>
                <div style="margin-top: 0.8em; padding-top: 0.8em; border-top: 1px solid var(--b3-theme-border);">
                <strong>拖拽移动媒体：</strong><br>
                1. <strong>在标签间移动</strong>：将媒体项从一个标签拖拽到另一个标签<br>
                <strong>拖拽排序：</strong><br>
                1. <strong>媒体排序</strong>：在同一标签内拖拽媒体项调整播放顺序<br>
                2. <strong>标签排序</strong>：拖拽标签头部调整标签的显示顺序<br>
                3. 排序后的顺序会自动保存到数据库
                </div>
                </details>
            </li>
            <li style="margin: 0.5em 0; padding: 10px 14px; background: var(--b3-theme-surface); border-radius: 8px; border-left: 4px solid var(--b3-theme-primary); box-shadow: 0 2px 4px var(--b3-theme-shadow-light);">
                <details>
                <summary style="color: var(--b3-theme-primary); cursor: pointer; font-weight: 500; font-size: 1.05em;">📝 <strong>笔记集成</strong> - 截图、时间戳、循环片段和媒体笔记</summary>
                <div style="margin-top: 0.8em; padding-top: 0.8em; border-top: 1px solid var(--b3-theme-border);">
                <strong>创建截图（带时间戳）：</strong><br>
                1. 播放视频到需要截图的位置<br>
                2. 点击截图按钮创建截图<br>
                3. 截图会根据设置是否带时间戳<br><br>
                <strong>创建时间戳和循环片段：</strong><br>
                1. 播放视频到需要标记的位置<br>
                2. 点击时间戳按钮创建时间戳链接<br>
                3. <strong>创建循环片段</strong>：<br>
                   - 点击循环片段按钮设置起点<br>
                   - 播放到结束位置再次点击设置终点<br>
                   - 可设置循环次数和循环后是否暂停<br>
                4. 生成的链接会根据设置插入到指定位置或复制到剪贴板<br><br>
                <strong>创建媒体笔记：</strong><br>
                1. 播放要记录笔记的媒体<br>
                2. 点击控制栏中的"媒体笔记"按钮（或使用快捷键）<br>
                3. 系统根据自定义模板创建笔记，包含媒体信息、时间戳、缩略图等<br>
                4. 笔记可插入当前文档、创建到指定笔记本或在指定文档下创建子文档<br>
                5. <strong>智能搜索配置</strong>：在设置中输入文档名称或笔记本名称进行搜索，快速定位目标位置<br>
                6. <strong>子文档创建</strong>：选择父文档后，系统将在其下自动创建子文档，保持笔记结构的层次性
                </div>
                </details>
            </li>
            <li style="margin: 0.5em 0; padding: 10px 14px; background: var(--b3-theme-surface); border-radius: 8px; border-left: 4px solid var(--b3-theme-primary); box-shadow: 0 2px 4px var(--b3-theme-shadow-light);">
                <details>
                <summary style="color: var(--b3-theme-primary); cursor: pointer; font-weight: 500; font-size: 1.05em;">📝 <strong>笔记面板</strong> - 文档和块内容查看编辑</summary>
                <div style="margin-top: 0.8em; padding-top: 0.8em; border-top: 1px solid var(--b3-theme-border);">
                1. 点击思源媒体播放器面板顶部的"笔记"标签<br>
                2. <strong>添加笔记标签</strong>：点击"+"按钮，输入文档ID或块ID<br>
                3. <strong>查看内容</strong>：点击标签查看对应的文档或块内容<br>
                4. <strong>右键操作</strong>：右键点击标签可进行以下操作：<br>
                   - <strong>重命名</strong>：修改标签显示名称（最多4个字符）<br>
                   - <strong>在思源中打开</strong>：直接跳转到思源中的对应位置<br>
                   - <strong>复制ID</strong>：复制文档或块ID到剪贴板<br>
                   - <strong>删除标签</strong>：移除不需要的笔记标签<br>
                5. <strong>完整编辑</strong>：支持在面板中直接编辑文档内容，与思源编辑器功能一致
                </div>
                </details>
            </li>
            <li style="margin: 0.5em 0; padding: 10px 14px; background: var(--b3-theme-surface); border-radius: 8px; border-left: 4px solid var(--b3-theme-primary); box-shadow: 0 2px 4px var(--b3-theme-shadow-light);">
                <details>
                <summary style="color: var(--b3-theme-primary); cursor: pointer; font-weight: 500; font-size: 1.05em;">🧠 <strong>媒体助手（Pro版）</strong> - 字幕、弹幕、总结</summary>
                <div style="margin-top: 0.8em; padding-top: 0.8em; border-top: 1px solid var(--b3-theme-border);">
                1. 在播放视频时点击"媒体助手"按钮<br>
                2. <strong>字幕列表</strong>：浏览、搜索字幕内容，点击跳转<br>
                3. <strong>视频摘要</strong>：查看AI生成的内容概要<br>
                4. <strong>弹幕列表</strong>：浏览视频弹幕列表，需要在设置中开启<br>
                5. <strong>一键导出</strong>：将助手内容导出到笔记
                </div>
                </details>
            </li>
            <li style="margin: 0.5em 0; padding: 10px 14px; background: var(--b3-theme-surface); border-radius: 8px; border-left: 4px solid var(--b3-theme-primary); box-shadow: 0 2px 4px var(--b3-theme-shadow-light);">
                <details>
                <summary style="color: var(--b3-theme-primary); cursor: pointer; font-weight: 500; font-size: 1.05em;">⌨️ <strong>快捷键设置</strong> - 配置自定义快捷键</summary>
                <div style="margin-top: 0.8em; padding-top: 0.8em; border-top: 1px solid var(--b3-theme-border);">
                1. 打开思源设置 > 快捷键<br>
                2. 搜索"媒体播放器"或"siyuan-media-player"<br>
                3. 为以下功能设置快捷键：<br>
                   - <strong>⏱️ 添加时间戳</strong>：快速生成当前时间链接<br>
                   - <strong>🔄 循环片段</strong>：设置循环播放区间<br>
                   - <strong>📸 截图</strong>：捕获视频画面<br>
                   - <strong>📔 媒体笔记</strong>：快速创建笔记<br>
                   - <strong>🧠 打开媒体播放器面板</strong>：打开/关闭dock面板<br>
                4. <strong>播放器内置快捷键</strong>：<br>
                   - 空格：播放/暂停<br>
                   - 左右箭头：快退/快进<br>
                   - 上下箭头：音量调节<br>
                   - <strong>Ctrl+↑</strong>：增加播放速度（+0.25x，最高4x）<br>
                   - <strong>Ctrl+↓</strong>：减少播放速度（-0.25x，最低0.5x）
                </div>
                </details>
            </li>
            <li style="margin: 0.5em 0; padding: 10px 14px; background: var(--b3-theme-surface); border-radius: 8px; border-left: 4px solid var(--b3-theme-primary); box-shadow: 0 2px 4px var(--b3-theme-shadow-light);">
                <details>
                <summary style="color: var(--b3-theme-primary); cursor: pointer; font-weight: 500; font-size: 1.05em;">🎵 <strong>播放控制</strong> - 基本播放和循环功能</summary>
                <div style="margin-top: 0.8em; padding-top: 0.8em; border-top: 1px solid var(--b3-theme-border);">
                <strong>基本播放操作：</strong><br>
                1. <strong>播放/暂停</strong>：点击播放按钮或按空格键<br>
                2. <strong>进度控制</strong>：拖拽进度条或使用左右箭头键<br>
                3. <strong>音量调节</strong>：使用音量滑块或上下箭头键<br>
                4. <strong>播放速度</strong>：在设置中调整播放速度，或使用Ctrl+↑/↓快捷键<br>
                5. <strong>画中画模式</strong>：在播放器设置中开启，或选择"画中画"打开方式<br>
                6. <strong>全屏播放</strong>：点击全屏按钮或双击播放区域<br><br>
                <strong>循环播放功能：</strong><br>
                1. <strong>单项循环</strong>：重复播放当前媒体<br>
                2. <strong>列表循环</strong>：播放完列表后重新开始<br>
                3. <strong>片段循环</strong>：设置特定时间段重复播放<br>
                4. <strong>循环次数设置</strong>：在设置中配置循环次数<br>
                5. <strong>循环后暂停</strong>：可设置循环结束后自动暂停
                </div>
                </details>
            </li>
            <li style="margin: 0.5em 0; padding: 10px 14px; background: var(--b3-theme-surface); border-radius: 8px; border-left: 4px solid var(--b3-theme-primary); box-shadow: 0 2px 4px var(--b3-theme-shadow-light);">
                <details>
                <summary style="color: var(--b3-theme-primary); cursor: pointer; font-weight: 500; font-size: 1.05em;">🔗 <strong>自定义链接格式</strong> - 个性化时间戳链接</summary>
                <div style="margin-top: 0.8em; padding-top: 0.8em; border-top: 1px solid var(--b3-theme-border);">
                在设置中，您可以自定义时间戳链接的显示格式。例如：<br>
                <code>- [😄标题 时间 字幕](链接)</code> // 带有表情符号的链接<br>
                <code>> 🕒 时间 | 标题 | 字幕</code> // 引用格式的链接
                </div>
                </details>
            </li>
            <li style="margin: 0.5em 0; padding: 10px 14px; background: var(--b3-theme-surface); border-radius: 8px; border-left: 4px solid var(--b3-theme-primary); box-shadow: 0 2px 4px var(--b3-theme-shadow-light);">
                <details>
                <summary style="color: var(--b3-theme-primary); cursor: pointer; font-weight: 500; font-size: 1.05em;">📝 <strong>自定义媒体笔记模板</strong> - 个性化笔记格式</summary>
                <div style="margin-top: 0.8em; padding-top: 0.8em; border-top: 1px solid var(--b3-theme-border);">
                您可以在设置中创建自己的媒体笔记模板，支持各种变量：<br>
                <strong>可用变量</strong>：媒体标题、当前时间戳、艺术家名称、媒体URL、媒体时长、媒体缩略图、媒体类型、媒体ID、当前日期、当前日期和时间<br><br>
                <strong>目标配置</strong>：<br>
                • <strong>智能搜索</strong>：输入关键字搜索文档和笔记本，快速定位目标位置<br>
                • <strong>子文档创建</strong>：选择父文档后，媒体笔记将作为子文档创建，保持层次结构<br>
                • <strong>便捷设置</strong>：常用配置可保存，简化后续创建流程
                </div>
                </details>
            </li>
        </ul>
    </div>
</div>
