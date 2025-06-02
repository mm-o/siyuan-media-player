<script lang="ts">
    import { onMount } from "svelte";
    import { showMessage } from "siyuan";
    import type { ConfigManager } from "../core/config";
    import type { ISettingItem, SettingType } from "../core/types";
    import { notebook } from "../core/document";
    import { QRCodeManager } from "../core/bilibili";

    export let group: string;
    export let configManager: ConfigManager;
    export let i18n: any;
    export let allTabs = [];
    export let activeTabId = 'settings';
    
    // 状态和数据
    let activeTab = 'account';
    let state: any = {};
    let settingItems: ISettingItem[] = [];
    let notebooks = [];
    let qrCodeManager: QRCodeManager | null = null;
    let qrcode = { data: '', key: '' };
    
    // 标签页定义
    const tabs = [
        { id: 'account', name: i18n.setting.tabs?.account || '账号' },
        { id: 'player', name: i18n.setting.tabs?.player || '播放器' },
        { id: 'general', name: i18n.setting.tabs?.general || '通用' }
    ];
    
    // 面板切换处理
    function changePanelTab(tabId) {
        if (tabId === activeTabId) return;
        window.dispatchEvent(new CustomEvent('mediaPlayerTabChange', { detail: { tabId } }));
    }
    
    // 创建默认设置项
    function createSettings(state): ISettingItem[] {
        const scriptCount = (state.scripts || []).length;
        const enabledCount = (state.scripts || []).filter(s => s.enabled).length;
        
        return [
            // Pro账号
            {
                key: "pro",
                type: "checkbox" as SettingType,
                tab: "account",
                title: i18n.pro?.title || "Media Player Pro",
                value: state.pro?.enabled ?? false,
                description: i18n.pro?.desc || "开启Pro功能，支持更多特性",
                onChange: async (v) => {
                    state.pro = { ...state.pro, enabled: v };
                    settingItems = createSettings(state);
                    await configManager.updateSettings(state);
                }
            },
            { key: "proPanel", type: "images" as SettingType, value: [
                { url: "/plugins/siyuan-media-player/assets/images/alipay.jpg", caption: "支付宝付款码" },
                { url: "/plugins/siyuan-media-player/assets/images/wechat.jpg", caption: "微信付款码" }
              ], tab: "account",
              displayCondition: (s) => !s.pro?.enabled,
              title: i18n.pro?.priceTag || "¥ 18.00",
              description: i18n.pro?.priceWithStar || "或 ¥ 16.00 + <a href=\"https://github.com/mm-o/siyuan-media-player\" target=\"_blank\" rel=\"noopener noreferrer\">GitHub Star</a> 关注" },

            // B站账号（合并二维码管理）
            {
                key: "biliAccount",
                type: "account" as SettingType,
                tab: "account",
                title: i18n.setting.bilibili.account,
                value: "",
                avatar: (state.bilibili.userInfo && state.bilibili.userInfo.face) ? state.bilibili.userInfo.face : "#iconBili",
                name: (state.bilibili.userInfo && state.bilibili.userInfo.uname) ? state.bilibili.userInfo.uname : "Bilibili",
                nickname: (state.bilibili.userInfo && state.bilibili.userInfo.uname) ? state.bilibili.userInfo.uname : "",
                level: (state.bilibili.userInfo && state.bilibili.userInfo.level_info) ? state.bilibili.userInfo.level_info.current_level : "",
                uid: (state.bilibili.userInfo && state.bilibili.userInfo.mid) ? state.bilibili.userInfo.mid : "",
                status: state.bilibili.login ? (i18n.setting.bilibili?.loggedIn || "已登录") : (i18n.setting.account?.notLoggedIn || "未登录"),
                button: {
                    config: i18n.setting.bilibili?.login || "登录",
                    save: "",
                    exit: i18n.setting.bilibili?.logout || "退出",
                    state: state.bilibili.login ? "enabled" : (qrcode?.data ? "pending" : "disabled"),
                    buttonText: state.bilibili.login ? (i18n.setting.bilibili?.logout || "退出") : (i18n.setting.bilibili?.login || "登录"),
                    username: state.bilibili.userInfo?.uname,
                    userId: state.bilibili.userInfo?.mid
                },
                onAction: async () => {
                    if (state.bilibili.login) {
                        state.bilibili = { login: false, userInfo: null };
                        qrcode = { data: '', key: '' };
                        const config = await configManager.getConfig();
                        delete config.bilibiliLogin;
                        await configManager.save();
                        settingItems = createSettings(state);
                        if (qrCodeManager) qrCodeManager.stopPolling();
                    } else {
                        if (!qrCodeManager) {
                            qrCodeManager = new QRCodeManager(
                                configManager,
                                ({ data, key }) => {
                                    qrcode = { data, key };
                                    settingItems = createSettings(state);
                                },
                                userInfo => {
                                    const { mid, uname, face, level } = userInfo || {};
                                    state.bilibili = { login: true, userInfo: { mid, uname, face, level } };
                                    settingItems = createSettings(state);
                                    if (qrCodeManager) qrCodeManager.stopPolling();
                                    configManager.updateSettings(state);
                                }
                            );
                        }
                        await qrCodeManager.startLogin();
                    }
                }
            },
            { key: "bilibiliQrcode", type: "images" as SettingType, 
              value: qrcode?.data ? [{ url: qrcode.data, caption: qrcode.key }] : [], tab: "account",
              displayCondition: () => !!qrcode?.data && !state.bilibili.login,
              title: i18n.setting.bilibili?.scanTitle || "B站登录",
              description: i18n.setting.bilibili?.waitingScan || "等待扫码" },
            
            // AList账号
            {
                key: "alist",
                type: "checkbox" as SettingType,
                tab: "account",
                title: i18n.setting.alist?.title || "AList 服务器",
                value: state.alist?.enabled,
                description: i18n.setting.alist?.desc || "开启AList功能，配置服务器信息",
                onChange: async (v) => {
                    state.alist = { ...state.alist, enabled: v };
                    settingItems = createSettings(state);
                    await configManager.updateSettings(state);
                }
            },
            { key: "alistServer", value: state.alistConfig?.server ?? "http://localhost:5244", type: "textarea" as SettingType, tab: "account",
              displayCondition: (s) => !s.alist?.enabled,
              title: i18n.setting.alist?.server || "AList 服务器", 
              description: i18n.setting.alistConfig?.server || "AList服务器地址", rows: 1 },
            { key: "alistUsername", value: state.alistConfig?.username ?? "admin", type: "textarea" as SettingType, tab: "account",
              displayCondition: (s) => !s.alist?.enabled,
              title: i18n.setting.alist?.username || "AList 用户名", 
              description: i18n.setting.alistConfig?.username || "AList账号用户名", rows: 1 },
            { key: "alistPassword", value: state.alistConfig?.password ?? "", type: "textarea" as SettingType, tab: "account",
              displayCondition: (s) => !s.alist?.enabled,
              title: i18n.setting.alist?.password || "AList 密码", 
              description: i18n.setting.alistConfig?.password || "AList账号密码", rows: 1 },
            
            // 播放器设置
            { key: "openMode", value: state.openMode ?? "default", type: "select" as SettingType, tab: "player",
              title: i18n.setting.items.openMode?.title || "打开方式",
              description: i18n.setting.items.openMode?.description,
              options: [
                { label: i18n.setting.items.openMode?.options?.default || "新标签", value: "default" },
                { label: i18n.setting.items.openMode?.options?.right || "右侧新标签", value: "right" },
                { label: i18n.setting.items.openMode?.options?.bottom || "底部新标签", value: "bottom" },
                { label: i18n.setting.items.openMode?.options?.window || "新窗口", value: "window" }
              ] },
            { key: "playerType", value: state.playerType ?? "built-in", type: "select" as SettingType, tab: "player",
              title: i18n.setting.items.playerType.title,
              description: i18n.setting.items.playerType.description,
              options: [
                { label: i18n.setting.items.playerType.builtIn, value: "built-in" },
                { label: i18n.setting.items.playerType.potPlayer, value: "potplayer" },
                { label: i18n.setting.items.playerType.browser, value: "browser" }
              ] },
            { key: "playerPath", value: state.playerPath ?? "PotPlayerMini64.exe", type: "textarea" as SettingType, tab: "player",
              displayCondition: () => settingItems.find(i => i.key === 'playerType')?.value === 'potplayer',
              title: i18n.setting.items?.playerPath?.title || "PotPlayer路径",
              description: i18n.setting.items?.playerPath?.description || "设置PotPlayer可执行文件路径",
              rows: 1 },
            { key: "volume", value: state.volume ?? 70, type: "slider" as SettingType, tab: "player",
              title: i18n.setting.items.volume.title,
              description: i18n.setting.items.volume.description,
              slider: { min: 0, max: 100, step: 1 } },
            { key: "speed", value: state.speed ?? 100, type: "slider" as SettingType, tab: "player",
              title: i18n.setting.items.speed.title,
              description: i18n.setting.items.speed.description,
              slider: { min: 25, max: 200, step: 25 } },
            { key: "showSubtitles", value: state.showSubtitles ?? false, type: "checkbox" as SettingType, tab: "player",
              title: i18n.setting.items.showSubtitles?.title || "显示字幕",
              description: i18n.setting.items.showSubtitles?.description },
            { key: "enableDanmaku", value: state.enableDanmaku ?? false, type: "checkbox" as SettingType, tab: "player",
              title: i18n.setting.items.enableDanmaku?.title || "启用弹幕",
              description: i18n.setting.items.enableDanmaku?.description },
            { key: "loopCount", value: state.loopCount ?? 3, type: "slider" as SettingType, tab: "player",
              title: i18n.setting.items.loopCount.title,
              description: i18n.setting.items.loopCount.description,
              slider: { min: 1, max: 10, step: 1 } },
            { key: "pauseAfterLoop", value: state.pauseAfterLoop ?? false, type: "checkbox" as SettingType, tab: "player",
              title: i18n.setting.items.pauseAfterLoop?.title || "循环后暂停",
              description: i18n.setting.items.pauseAfterLoop?.description },
            { key: "loopPlaylist", value: state.loopPlaylist ?? false, type: "checkbox" as SettingType, tab: "player",
              title: i18n.setting.items?.loopPlaylist?.title || "循环列表",
              description: i18n.setting.items?.loopPlaylist?.description || "播放完列表后从头开始" },
            { key: "loopSingle", value: state.loopSingle ?? false, type: "checkbox" as SettingType, tab: "player",
              title: i18n.setting.items?.loopSingle?.title || "单项循环",
              description: i18n.setting.items?.loopSingle?.description || "重复播放当前媒体" },
            
            // 通用设置
            { key: "insertMode", value: state.insertMode ?? "updateBlock", type: "select" as SettingType, tab: "general",
              title: i18n.setting.items.insertMode?.title || "插入方式",
              description: i18n.setting.items.insertMode?.description || "选择时间戳和笔记的插入方式",
              options: [
                { label: i18n.setting.items.insertMode?.insertBlock || "插入光标处", value: "insertBlock" },
                { label: i18n.setting.items.insertMode?.appendBlock || "追加到块末尾", value: "appendBlock" },
                { label: i18n.setting.items.insertMode?.prependBlock || "添加到块开头", value: "prependBlock" },
                { label: i18n.setting.items.insertMode?.updateBlock || "更新当前块", value: "updateBlock" },
                { label: i18n.setting.items.insertMode?.prependDoc || "插入到文档顶部", value: "prependDoc" },
                { label: i18n.setting.items.insertMode?.appendDoc || "插入到文档底部", value: "appendDoc" },
                { label: i18n.setting.items.insertMode?.clipboard || "复制到剪贴板", value: "clipboard" }
              ] },
            { key: "targetNotebook", value: state.targetNotebook?.id ?? "", type: "select" as SettingType, tab: "general",
              title: i18n.setting.items?.targetNotebook?.title || "目标笔记本", 
              description: i18n.setting.items?.targetNotebook?.description || "选择创建媒体笔记的目标笔记本",
              options: (notebooks || []).map(nb => ({ label: nb.name, value: nb.id })) },
            { key: "playlistDbId", value: state.playlistDbId || "", type: "textarea" as SettingType, tab: "general",
              title: "播放列表数据库ID",
              description: "输入用于保存播放列表的数据库块ID",
              rows: 1 },
            { key: "screenshotWithTimestamp", value: state.screenshotWithTimestamp ?? false, type: "checkbox" as SettingType, tab: "general",
              title: i18n.setting.items?.screenshotWithTimestamp?.title || "截图包含时间戳",
              description: i18n.setting.items?.screenshotWithTimestamp?.description || "启用后，截图功能也会添加时间戳链接" },
            { key: "linkFormat", value: state.linkFormat || "- [😄标题 艺术家 字幕 时间](链接)", 
              type: "textarea" as SettingType, tab: "general",
              title: i18n.setting.items?.linkFormat?.title || "链接格式",
              description: i18n.setting.items?.linkFormat?.description || "支持变量：标题、时间、艺术家、链接、字幕、截图",
              rows: 1 },
            { key: "mediaNotesTemplate", 
              value: state.mediaNotesTemplate || "# 📽️ 标题的媒体笔记\n- 📅 日 期：日期\n- ⏱️ 时 长：时长\n- 🎨 艺 术 家：艺术家\n- 🔖 类 型：类型\n- 🔗 链 接：[链接](链接)\n- ![封面](封面)\n- 📝 笔记内容：", 
              type: "textarea" as SettingType, tab: "general",
              title: i18n.setting.items?.mediaNotesTemplate?.title || "媒体笔记模板",
              description: i18n.setting.items?.mediaNotesTemplate?.description || "支持变量：标题、时间、艺术家、链接、时长、封面、类型、ID、日期、时间戳",
              rows: 9 },

            // 脚本管理 - 完全内联状态显示，极简化
            { 
                key: "loadScript", 
                type: "account" as SettingType, 
                tab: "general",
                title: i18n.setting.items?.loadScript?.title || "加载脚本",
                description: i18n.setting.items?.loadScript?.description || "选择脚本文件加载到插件",
                button: { config: i18n.setting.items?.loadScript?.buttonText || "选择脚本文件", save: "", exit: "" },
                status: `已加载：${enabledCount}/${scriptCount}`,
                name: i18n.setting.items?.loadScript?.scriptManager || "脚本管理器",
                nickname: "",
                onAction: () => handleScripts('load')
            },
            
            // 脚本开关项 - 使用最简洁的表达，无多余变量
            ...(state.scripts || []).map(s => ({
                key: `script_${s.name}`,
                type: "checkbox" as SettingType,
                tab: "general",
                title: s.name,
                value: s.enabled ?? true,
                description: i18n.setting.items?.script?.description || "控制脚本是否启用",
                onChange: v => { s.enabled = v; configManager.updateSettings(state); settingItems = createSettings(state); }
            }))
        ];
    }

    // 初始化 - 精简方式加载初始数据
    async function refreshSettings() {
        const config = await configManager.load();
        Object.assign(state, configManager.getDefaultUIState(), config.settings || {});
        state.pro = config.settings?.pro ?? { enabled: false };
        state.insertMode = config.settings?.insertMode ?? "updateBlock";
        state.scripts = config.settings?.scripts || [];
        
        try { notebooks = await notebook.getList?.() || []; } catch {}
        handleScripts(); // 默认同步脚本
        settingItems = createSettings(state);
        
        // 更新笔记本选项
        const nbItem = settingItems.find(i => i.key === 'targetNotebook');
        nbItem && (nbItem.options = (notebooks || []).map(nb => ({ label: nb.name, value: nb.id })));
    }
    
    // 极简化的脚本处理函数 - 合并条件，减少重复
    async function handleScripts(action = 'sync') {
        if (!window.require) return;
        
        try {
            const { dialog } = window.require('@electron/remote');
            const fs = window.require('fs'), path = window.require('path');
            const dir = path.join(window.siyuan.config.system.workspaceDir, 'data/storage/petal/siyuan-media-player');
            !fs.existsSync(dir) && fs.mkdirSync(dir, { recursive: true });
            
            // 先处理文件加载
            if (action === 'load') {
                const result = await dialog.showOpenDialog({properties: ['openFile'], filters: [{extensions: ['js']}]});
                if (result?.filePaths?.[0]) {
                    fs.copyFileSync(result.filePaths[0], path.join(dir, path.basename(result.filePaths[0])));
                    showMessage(i18n.setting.items?.loadScript?.loadSuccess || "脚本已加载");
                }
            }
            
            // 更新脚本列表
            const savedMap = Object.fromEntries((state.scripts || []).map(s => [s.name, s.enabled ?? true]));
            state.scripts = fs.readdirSync(dir).filter(f => f.endsWith('.js'))
                .map(f => ({ name: f, enabled: savedMap[f] ?? true }));
            
            // 所有情况下都更新UI，确保立即显示
            settingItems = createSettings(state);
            await configManager.updateSettings(state);
        } catch (e) {}
    }

    // 保存设置（极简）
    async function save() {
        await configManager.updateSettings(state);
        showMessage(i18n.setting.saveSuccess || "保存成功");
        settingItems = createSettings(state);
    }

    // 重置设置（极简）
    function reset() {
        const config = configManager.getDefaultConfig();
        state = { ...configManager.getDefaultUIState(), ...config.settings };
        settingItems = createSettings(state);
        showMessage(i18n.setting.resetSuccess || "已重置");
    }

    function resetItem(key) {
        const config = configManager.getDefaultConfig();
        state[key] = config.settings[key] || configManager.getDefaultUIState()[key];
        settingItems = createSettings(state);
    }

    // 设置项变更处理
    function handleChange(e, item) {
        const v = e.target.type === 'checkbox' 
            ? e.target.checked 
            : e.target.value;
        if (item.key === 'alistServer') state.alistConfig.server = v;
        else if (item.key === 'alistUsername') state.alistConfig.username = v;
        else if (item.key === 'alistPassword') state.alistConfig.password = v;
        else if (item.key === 'pro') state.pro = { ...state.pro, enabled: v };
        else if (item.key === 'insertMode') state.insertMode = v;
        else if (item.key === 'targetNotebook') {
            const nb = notebooks.find(n => n.id === v);
            state.targetNotebook = { id: v, name: nb ? nb.name : "" };
        }
        else state[item.key] = v;
        if (item.onChange) item.onChange(v);
        settingItems = createSettings(state);
        configManager.updateSettings(state);
    }
    $: if (activeTab) refreshSettings();

    onMount(refreshSettings);
</script>

<div class="settings common-panel" data-name={group}>
    <div class="playlist-header">
        <div class="panel-nav">
            <h3 class:active={activeTabId === 'playlist'} on:click={() => changePanelTab('playlist')}>
                {i18n.playList?.title || "列表"}
            </h3>
            <h3 class:active={activeTabId === 'assistant'} on:click={() => changePanelTab('assistant')}>
                {i18n.assistant?.title || "助手"}
            </h3>
            <h3 class:active={activeTabId === 'settings'} on:click={() => changePanelTab('settings')}>
                {i18n.setting?.title || "设置"}
            </h3>
        </div>
        <span class="playlist-count">{tabs.find(tab => tab.id === activeTab)?.name || i18n.setting.description}</span>
    </div>

    <div class="playlist-tabs">
        {#each tabs as tab}
            <button class="tab" class:active={activeTab === tab.id} on:click={() => activeTab = tab.id}>
                {tab.name}
            </button>
        {/each}
    </div>

    <div class="setting-panel">
        {#each settingItems as item (item.key)}
            {#if item.tab === activeTab && (!item.displayCondition || item.displayCondition(state))}
            <div class="setting-item setting-item-{item.type}" data-key={item.key}>
                <div class="setting-info">
                    <div class="setting-title">{item.title}</div>
                    {#if item.description}<div class="setting-description">{@html item.description}</div>{/if}
                    
                    {#if item.type === 'slider'}
                        <div class="slider-wrapper">
                            <input type="range"
                                min={item.slider?.min ?? 0}
                                max={item.slider?.max ?? 100}
                                step={item.slider?.step ?? 1}
                                value={state[item.key]}
                                on:input={(e) => handleChange(e, item)}
                            />
                            <span class="slider-value">
                                {item.key === 'speed' ? Number(state[item.key]) / 100 + 'x' : state[item.key]}
                            </span>
                        </div>
                    {:else if item.type === 'textarea'}
                        <textarea 
                            class="b3-text-field fn__block" 
                            rows={item.rows || 4}
                            value={String(item.value)} 
                            placeholder={item.placeholder || ""}
                            on:input={(e) => handleChange(e, item)}
                        ></textarea>
                        <span class="clear-icon" on:click={() => resetItem(item.key)}>
                            <svg class="icon"><use xlink:href="#iconRefresh"></use></svg>
                        </span>
                    {:else if item.type === 'images'}
                        <div class="image-gallery">
                            {#each Array.isArray(item.value) ? item.value : [] as image}
                                <div class="image-item">
                                    <div class="image-preview">
                                        <img src={image.url} alt={image.caption || item.title} />
                                    </div>
                                </div>
                            {/each}
                        </div>
                        {:else if item.type === 'account'}
                        <div class="user-wrapper">
                                {#if item.avatar}
                                    {#if typeof item.avatar === 'string' && (item.avatar.startsWith('http') || item.avatar.startsWith('https'))}
                                        <img src={item.avatar} alt="头像" />
                                    {:else}
                                        <svg><use xlink:href={item.avatar}></use></svg>
                                    {/if}
                            {/if}
                            <div class="user-details">
                                    <div class="user-name">{item.name}
                                        {#if item.level}
                                            <span class="user-level">LV{item.level}</span>
                                    {/if}
                                </div>
                                    {#if item.uid}
                                        <div class="user-id">UID: {item.uid}</div>
                                    {/if}
                                    <div class="user-status">{item.status}</div>
                            </div>
                        </div>
                    {/if}
                </div>
                
                <div class="setting-control">
                    {#if item.type === 'checkbox'}
                        <label class="checkbox-wrapper">
                            <input type="checkbox" checked={Boolean(item.value)} on:change={(e) => handleChange(e, item)} />
                            <span class="checkbox-custom"></span>
                        </label>
                    {:else if item.type === 'select'}
                        <select class="select-wrapper" value={item.value} on:change={(e) => handleChange(e, item)}>
                            {#each item.options || [] as option}
                                <option value={option.value}>{option.label}</option>
                            {/each}
                        </select>
                    {:else if item.type === 'account'}
                        <button class="b3-button b3-button--outline" 
                                on:click={item.onAction}
                            disabled={item.key === 'biliAccount' && item.button?.state === "pending"}>
                            {item.button?.buttonText || "操作"}
                        </button>
                    {/if}
                </div>
            </div>
            {/if}
        {/each}
    </div>
    
    <div class="playlist-footer">
        <button class="add-btn" on:click={reset}>
            <svg class="icon"><use xlink:href="#iconRefresh"></use></svg>
            <span>{i18n.setting.reset}</span>
        </button>
        <button class="add-btn" on:click={save}>
            <svg class="icon"><use xlink:href="#iconCheck"></use></svg>
            <span>{i18n.setting.save}</span>
        </button>
    </div>
</div>