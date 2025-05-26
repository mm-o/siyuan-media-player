<script lang="ts">
    import { createEventDispatcher, onMount } from "svelte";
    import { showMessage } from "siyuan";
    import type { ConfigManager } from "../core/config";
    import type { ISettingItem, SettingType } from "../core/types";
    import { QRCodeManager } from "../core/bilibili";
    import { notebook } from "../core/document";

    export let group: string;
    export let configManager: ConfigManager;
    export let i18n: any;
    export let allTabs = [];
    export let activeTabId = 'settings';
    
    // 状态和数据
    let activeTab = 'account';
    let state = {
        qrcode: { data: '', key: '' },
        bilibili: { login: false, userInfo: null },
        pro: { enabled: false, showPanel: false },
        alist: { showConfig: false },
        selectedNotebookId: notebook.getPreferredId(),
        scripts: [] // 已加载的脚本列表
    };
    let settingItems: ISettingItem[] = [];
    const dispatch = createEventDispatcher();
    let qrCodeManager: QRCodeManager;
    
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
    function createSettings(): ISettingItem[] {
        return [
            // Pro账号
            { key: "proAccount", type: "account" as SettingType, value: "",
              title: i18n.pro?.title || "Media Player Pro",
              description: state.pro.enabled ? (i18n.pro?.statusEnabled || "已启用") : (i18n.pro?.description || "若你喜欢Media Player，可以尝试为其付费哦～"),
              button: { config: i18n.setting.account?.config || "登录", save: i18n.pro?.paid || "我已付款", exit: i18n.setting.account?.exit || "退出" } },
            { key: "proPanel", type: "images" as SettingType, value: [],
              title: i18n.pro?.priceTag || "¥ 18.00",
              description: i18n.pro?.priceWithStar || "或 ¥ 16.00 + <a href=\"https://github.com/mm-o/siyuan-media-player\" target=\"_blank\" rel=\"noopener noreferrer\">GitHub Star</a> 关注" },
            
            // B站账号
            { key: "biliAccount", type: "account" as SettingType, value: "",
              title: i18n.setting.bilibili.account,
              description: state.bilibili.login ? (i18n.setting.bilibili?.loggedIn || "已登录") : (i18n.setting.account?.notLoggedIn || "点击登录"), 
              button: { config: i18n.setting.bilibili?.login || "登录", save: "", exit: i18n.setting.bilibili?.logout || "退出" } },
            { key: "bilibiliQrcode", type: "images" as SettingType, value: [], 
              title: i18n.setting.bilibili?.scanTitle || "B站登录",
              description: i18n.setting.bilibili?.waitingScan || "等待扫码" },
            
            // AList配置
            { key: "alistAccount", type: "account" as SettingType, value: "",
              title: i18n.setting.alist?.title || "AList 配置", 
              description: i18n.setting.account?.alistNotConfigured || "配置 AList 服务器连接信息", 
              button: { config: i18n.setting.account?.config || "配置", save: i18n.setting.account?.save || "保存", exit: i18n.setting.account?.exit || "退出" } },
            { key: "alistServer", value: "http://localhost:5244", type: "textarea" as SettingType, 
              title: i18n.setting.alist?.server || "AList 服务器", 
              description: i18n.setting.alistConfig?.server || "AList服务器地址", rows: 1 },
            { key: "alistUsername", value: "admin", type: "textarea" as SettingType, 
              title: i18n.setting.alist?.username || "AList 用户名", 
              description: i18n.setting.alistConfig?.username || "AList账号用户名", rows: 1 },
            { key: "alistPassword", value: "", type: "textarea" as SettingType, 
              title: i18n.setting.alist?.password || "AList 密码", 
              description: i18n.setting.alistConfig?.password || "AList账号密码", rows: 1 },
            
            // 播放器设置
            { key: "openMode", value: "default", type: "select" as SettingType,
              title: i18n.setting.items.openMode?.title || "打开方式",
              description: i18n.setting.items.openMode?.description,
              options: [
                { label: i18n.setting.items.openMode?.options?.default || "新标签", value: "default" },
                { label: i18n.setting.items.openMode?.options?.right || "右侧新标签", value: "right" },
                { label: i18n.setting.items.openMode?.options?.bottom || "底部新标签", value: "bottom" },
                { label: i18n.setting.items.openMode?.options?.window || "新窗口", value: "window" }
              ] },
            { key: "playerType", value: "built-in", type: "select" as SettingType,
              title: i18n.setting.items.playerType.title,
              description: i18n.setting.items.playerType.description,
              options: [
                { label: i18n.setting.items.playerType.builtIn, value: "built-in" },
                { label: i18n.setting.items.playerType.potPlayer, value: "potplayer" },
                { label: i18n.setting.items.playerType.browser, value: "browser" }
              ] },
            { key: "playerPath", value: "PotPlayerMini64.exe", type: "textarea" as SettingType,
              title: i18n.setting.items?.playerPath?.title || "PotPlayer路径",
              description: i18n.setting.items?.playerPath?.description || "设置PotPlayer可执行文件路径",
              rows: 1 },
            { key: "volume", value: 70, type: "slider" as SettingType,
              title: i18n.setting.items.volume.title,
              description: i18n.setting.items.volume.description,
              slider: { min: 0, max: 100, step: 1 } },
            { key: "speed", value: 100, type: "slider" as SettingType,
              title: i18n.setting.items.speed.title,
              description: i18n.setting.items.speed.description,
              slider: { min: 25, max: 200, step: 25 } },
            { key: "showSubtitles", value: false, type: "checkbox" as SettingType,
              title: i18n.setting.items.showSubtitles?.title || "显示字幕",
              description: i18n.setting.items.showSubtitles?.description },
            { key: "enableDanmaku", value: false, type: "checkbox" as SettingType,
              title: i18n.setting.items.enableDanmaku?.title || "启用弹幕",
              description: i18n.setting.items.enableDanmaku?.description },
            { key: "loopCount", value: 3, type: "slider" as SettingType,
              title: i18n.setting.items.loopCount.title,
              description: i18n.setting.items.loopCount.description,
              slider: { min: 1, max: 10, step: 1 } },
            { key: "pauseAfterLoop", value: false, type: "checkbox" as SettingType,
              title: i18n.setting.items.pauseAfterLoop?.title || "循环后暂停",
              description: i18n.setting.items.pauseAfterLoop?.description },
            { key: "loopPlaylist", value: false, type: "checkbox" as SettingType,
              title: i18n.setting.items?.loopPlaylist?.title || "循环列表",
              description: i18n.setting.items?.loopPlaylist?.description || "播放完列表后从头开始" },
            { key: "loopSingle", value: false, type: "checkbox" as SettingType,
              title: i18n.setting.items?.loopSingle?.title || "单项循环",
              description: i18n.setting.items?.loopSingle?.description || "重复播放当前媒体" },
            
            // 通用设置
            { key: "insertMode", value: "cursor", type: "select" as SettingType,
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
            { key: "targetNotebook", value: state.selectedNotebookId, type: "select" as SettingType,
              title: i18n.setting.items?.targetNotebook?.title || "目标笔记本", 
              description: i18n.setting.items?.targetNotebook?.description || "选择创建媒体笔记的目标笔记本",
              options: [] },
            { key: "screenshotWithTimestamp", value: false, type: "checkbox" as SettingType,
              title: i18n.setting.items?.screenshotWithTimestamp?.title || "截图包含时间戳",
              description: i18n.setting.items?.screenshotWithTimestamp?.description || "启用后，截图功能也会添加时间戳链接" },
            { key: "linkFormat", value: "- [😄标题 艺术家 字幕 时间](链接)", 
              type: "textarea" as SettingType, 
              title: i18n.setting.items?.linkFormat?.title || "链接格式",
              description: i18n.setting.items?.linkFormat?.description || "支持变量：标题、时间、艺术家、链接、字幕、截图",
              rows: 1 },
            { key: "mediaNotesTemplate", 
              value: "# 📽️ 标题的媒体笔记\n- 📅 日 期：日期\n- ⏱️ 时 长：时长\n- 🎨 艺 术 家：艺术家\n- 🔖 类 型：类型\n- 🔗 链 接：[链接](链接)\n- ![封面](封面)\n- 📝 笔记内容：", 
              type: "textarea" as SettingType, 
              title: i18n.setting.items?.mediaNotesTemplate?.title || "媒体笔记模板",
              description: i18n.setting.items?.mediaNotesTemplate?.description || "支持变量：标题、时间、艺术家、链接、时长、封面、类型、ID、日期、时间戳",
              rows: 9 },
            { key: "loadScript", value: "", type: "account" as SettingType,
              title: i18n.setting.items?.loadScript?.title || "加载脚本",
              description: i18n.setting.items?.loadScript?.description || "选择脚本文件加载到插件",
              button: { config: i18n.setting.items?.loadScript?.buttonText || "选择脚本文件", save: "", exit: "" } }
        ];
    }

    // 初始化
    onMount(() => {
        qrCodeManager = new QRCodeManager(
            configManager,
            ({ data, key, message }) => {
                state.qrcode = { data, key };
                const item = settingItems.find(i => i.key === 'bilibiliQrcode');
                if (item) {
                    item.value = data ? [{ url: data, caption: message }] : [];
                    item.description = message || "等待扫码";
                }
            },
            userInfo => {
                state.bilibili = { login: true, userInfo };
                updateAccountDisplay('biliAccount');
                showMessage("登录成功");
            }
        );

        // 加载配置
        configManager.load().then(async config => {
            settingItems = createSettings().map(item => ({
                ...item,
                value: config.settings[item.key] ?? item.value
            }));
            
            state.selectedNotebookId = config.settings.targetNotebook || '';
            state.bilibili = {
                login: !!config.bilibiliLogin?.userInfo?.mid,
                userInfo: config.bilibiliLogin?.userInfo
            };
            state.pro = { enabled: config.proEnabled || false, showPanel: false };
            
            ['biliAccount', 'proAccount', 'alistAccount'].forEach(updateAccountDisplay);
            
            try {
                const result = await notebook.initSettingItem(settingItems, state.selectedNotebookId);
                settingItems = result.items;
                state.selectedNotebookId = result.selectedId;
            } catch (error) {
                console.error("加载笔记本列表失败:", error);
            }
            
            // 获取已加载脚本列表
            getScriptList();
        });
        
        // 事件监听
        window.addEventListener('mediaPlayerTabActivate', (e: any) => 
            e.detail?.tabId && (activeTabId = e.detail.tabId));
        
        return () => {
            qrCodeManager?.stopPolling();
            window.removeEventListener('mediaPlayerTabActivate', () => {});
        };
    });

    // 统一账号显示更新
    function updateAccountDisplay(key) {
        const item = settingItems.find(i => i.key === key);
        if (!item) return;
        
        if (key === 'proAccount') {
            item.description = state.pro.enabled ? (i18n.pro?.statusEnabled || "已启用") : 
                             (i18n.pro?.description || "若你喜欢Media Player，可以尝试为其付费哦～");
            item.button = { 
                ...item.button,
                state: state.pro.enabled ? "enabled" : (state.pro.showPanel ? "paying" : "disabled"),
                buttonText: state.pro.enabled ? (i18n.setting.account?.exit || "退出") : 
                          (state.pro.showPanel ? (i18n.pro?.paid || "我已付款") : (i18n.setting.account?.config || "登录"))
            };
            
            const panelItem = settingItems.find(i => i.key === 'proPanel');
            if (panelItem) {
                panelItem.value = state.pro.showPanel ? [
                    { url: "/plugins/siyuan-media-player/assets/images/alipay.jpg", caption: "支付宝付款码" },
                    { url: "/plugins/siyuan-media-player/assets/images/wechat.jpg", caption: "微信付款码" }
                ] : [];
            }
        } else if (key === 'biliAccount') {
            item.description = state.bilibili.login ? (i18n.setting.bilibili?.loggedIn || "已登录") : 
                              (i18n.setting.account?.notLoggedIn || "点击登录");
            item.button = {
                ...item.button,
                state: state.bilibili.login ? "enabled" : (state.qrcode.data ? "pending" : "disabled"),
                buttonText: state.bilibili.login ? (i18n.setting.bilibili?.logout || "退出") : 
                          (i18n.setting.bilibili?.login || "登录"),
                username: state.bilibili.userInfo?.uname,
                userId: state.bilibili.userInfo?.mid
            };
        } else if (key === 'alistAccount') {
            const hasConfig = !!(
                settingItems.find(i => i.key === 'alistServer')?.value &&
                settingItems.find(i => i.key === 'alistUsername')?.value
            );
            item.description = hasConfig ? (i18n.setting.account?.alistConfigured || "AList 已配置") : 
                              (i18n.setting.account?.alistNotConfigured || "配置 AList 服务器连接信息");
            item.button = {
                ...item.button,
                state: hasConfig ? "enabled" : "disabled",
                buttonText: state.alist.showConfig ? (i18n.setting.account?.save || "保存") : 
                          (i18n.setting.account?.config || "配置")
            };
        }
    }

    // 处理账号操作
    async function handleAccountAction(key) {
        if (key === 'proAccount') {
            const buttonState = settingItems.find(i => i.key === key)?.button?.state;
            if (buttonState === "enabled") {
                state.pro = { enabled: false, showPanel: false };
                await saveProConfig();
            } else if (buttonState === "paying") {
                state.pro = { enabled: true, showPanel: false };
                await saveProConfig();
            } else {
                state.pro.showPanel = true;
                const panelItem = settingItems.find(i => i.key === 'proPanel');
                if (panelItem) {
                    panelItem.value = [
                        { url: "/plugins/siyuan-media-player/assets/images/alipay.jpg", caption: "支付宝付款码" },
                        { url: "/plugins/siyuan-media-player/assets/images/wechat.jpg", caption: "微信付款码" }
                    ];
                }
            }
        } else if (key === 'biliAccount') {
            const buttonState = settingItems.find(i => i.key === key)?.button?.state;
            if (buttonState === "enabled") {
                state.bilibili = { login: false, userInfo: null };
                state.qrcode.data = '';
                const config = await configManager.getConfig();
                delete config.bilibiliLogin;
                await configManager.save();
                showMessage("已退出登录");
            } else if (buttonState !== "pending") {
                try { await qrCodeManager.startLogin(); } 
                catch (e) { showMessage(e.message || "获取二维码失败"); }
            }
        } else if (key === 'alistAccount') {
            state.alist.showConfig = !state.alist.showConfig;
        } else if (key === 'loadScript') {
            await loadScript();
        }
        
        updateAccountDisplay(key);
        settingItems = [...settingItems]; // 强制触发UI更新
    }
    
    // 加载脚本文件
    async function loadScript() {
        if (!window.require) return;
        try {
            const { dialog } = window.require('@electron/remote'), 
                  fs = window.require('fs'), 
                  path = window.require('path');
            
            const result = await dialog.showOpenDialog({
                properties: ['openFile'],
                filters: [{ extensions: ['js'] }]
            });
            
            if (result?.filePaths?.[0] && window.siyuan?.config?.system?.workspaceDir) {
                // 复制到插件目录
                const dir = path.join(window.siyuan.config.system.workspaceDir, 'data/storage/petal/siyuan-media-player');
                !fs.existsSync(dir) && fs.mkdirSync(dir, { recursive: true });
                fs.copyFileSync(result.filePaths[0], path.join(dir, path.basename(result.filePaths[0])));
                getScriptList();
                showMessage(i18n.setting.items?.loadScript?.loadSuccess || "脚本已加载");
            }
        } catch (e) {}
    }
    
    // 获取脚本列表并创建设置项
    async function getScriptList() {
        if (!window.require) return;
        try {
            // 获取脚本文件
            const fs = window.require('fs'), path = window.require('path');
            const dir = path.join(window.siyuan.config.system.workspaceDir, 'data/storage/petal/siyuan-media-player');
            if (!fs.existsSync(dir)) return;
            
            // 合并脚本状态
            const savedScripts = configManager.getConfig().settings.scripts || [];
            const files = fs.readdirSync(dir).filter(f => f.endsWith('.js'));
            
            // 更新脚本状态和设置项
            state.scripts = files.map(f => ({ 
                name: f, 
                enabled: savedScripts.find(s => s.name === f)?.enabled ?? true 
            }));
            
            settingItems = [
                ...settingItems.filter(item => !item.key.startsWith('script-')),
                ...state.scripts.map(s => ({ 
                    key: `script-${s.name}`, value: s.enabled, 
                    type: "checkbox" as SettingType, 
                    title: s.name, description: "脚本文件" 
                }))
            ];
        } catch (e) {}
    }

    // 处理脚本状态变更
    function handleScriptChange(event, name) {
        const enabled = event.target.checked;
        const idx = state.scripts.findIndex(s => s.name === name);
        if (idx >= 0) {
            // 更新状态
            state.scripts[idx].enabled = enabled;
            
            // 保存并触发重载
            const settings = configManager.getConfig().settings;
            settings.scripts = state.scripts;
            configManager.updateSettings(settings).then(() => {
                dispatch('changed', { settings });
                window.dispatchEvent(new CustomEvent('reloadUserScripts'));
            });
        }
    }
    
    // 保存Pro配置
    async function saveProConfig() {
        const config = await configManager.getConfig();
        config.proEnabled = state.pro.enabled;
        await configManager.save();
        dispatch('changed', { proEnabled: state.pro.enabled, settings: config.settings });
        showMessage(state.pro.enabled ? (i18n.pro?.activationSuccess || "Pro 已启用") : (i18n.pro?.activationDisabled || "Pro 已禁用"));
    }

    // 设置项变更处理
    function handleChange(event, item) {
        const idx = settingItems.findIndex(i => i.key === item.key);
        if (idx === -1) return;
        
        settingItems[idx].value = event.target.type === 'checkbox' 
            ? event.target.checked 
            : item.type === 'select' || item.type === 'textarea'
                ? event.target.value 
                : Number(event.target.value);
        
        // 处理脚本项状态更新
        if (item.key.startsWith('script-')) {
            handleScriptChange(event, item.key.replace('script-', ''));
        }
                
        settingItems = [...settingItems];
    }

    // 重置单个设置项
    function resetItem(key) {
        const defaultItem = createSettings().find(i => i.key === key);
        const idx = settingItems.findIndex(i => i.key === key);
        if (defaultItem && idx !== -1) {
            settingItems[idx].value = defaultItem.value;
            settingItems = [...settingItems];
        }
    }

    // 保存设置
    async function saveSettings() {
        // 隐藏配置面板并更新状态
        state.alist.showConfig = false;
        state.pro.showPanel = false;
        ['alistAccount', 'proAccount'].forEach(updateAccountDisplay);
        
        // 构建设置对象
        const settings: any = {};
        settingItems.forEach(item => {
            if (item.key.includes('.')) {
                const parts = item.key.split('.');
                let current = settings;
                for (let i = 0; i < parts.length - 1; i++) {
                    if (!current[parts[i]]) current[parts[i]] = {};
                    current = current[parts[i]];
                }
                current[parts[parts.length - 1]] = item.value;
            } else if (item.key.startsWith('alist')) {
                if (!settings.alistConfig) settings.alistConfig = {};
                settings.alistConfig[item.key.replace('alist', '').toLowerCase()] = item.value;
            } else {
                settings[item.key] = item.value;
            }
        });
        
        // 保存脚本配置
        settings.scripts = state.scripts.map(s => ({ name: s.name, enabled: s.enabled }));
        
        // 保存设置
        const notebookItem = settingItems.find(item => item.key === "targetNotebook");
        if (notebookItem) notebook.savePreferredId(String(notebookItem.value));
        
        await configManager.updateSettings(settings);
        dispatch('changed', { settings });
        showMessage(i18n.setting.saveSuccess);
    }

    // 重置设置
    function resetSettings() {
        settingItems = createSettings();
        state.alist.showConfig = false;
        state.pro.showPanel = false;
        ['alistAccount', 'proAccount'].forEach(updateAccountDisplay);
        showMessage(i18n.setting.resetSuccess);
    }
    
    // 过滤显示设置项
    $: visibleItems = settingItems.filter(item => {
        if (activeTab === 'account') {
            return item.key === 'proAccount' || 
                (item.key === 'bilibiliQrcode' && state.qrcode.data && !state.bilibili.login) || 
                (item.key === 'proPanel' && state.pro.showPanel) ||
                item.key === 'biliAccount' ||
                item.key === 'alistAccount' ||
                (item.key.startsWith('alist') && state.alist.showConfig);
        }
        if (activeTab === 'player') {
            return ['volume', 'speed', 'playerType', 'showSubtitles', 'enableDanmaku', 'loopCount', 'pauseAfterLoop', 'loopPlaylist', 'loopSingle', 'openMode'].includes(item.key) ||
                (item.key === 'playerPath' && settingItems.find(i => i.key === 'playerType')?.value === 'potplayer');
        }
        return ['insertMode', 'targetNotebook', 'screenshotWithTimestamp', 'linkFormat', 'mediaNotesTemplate', 'loadScript'].includes(item.key) || item.key.startsWith('script-');
    });
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
        {#each visibleItems as item (item.key)}
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
                                value={item.value}
                                on:input={(e) => handleChange(e, item)}
                            />
                            <span class="slider-value">
                                {item.key === 'speed' ? Number(item.value) / 100 + 'x' : item.value}
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
                    {:else if item.type === 'account' && item.button?.state === "enabled"}
                        <div class="user-wrapper">
                            {#if item.key === 'biliAccount' && state.bilibili.userInfo}
                                <img src={state.bilibili.userInfo.face} alt="头像" />
                            {:else if item.key === 'proAccount'}
                                <svg><use xlink:href="#iconVIP"></use></svg>
                            {:else if item.key === 'alistAccount'}
                                <svg><use xlink:href="#iconCloud"></use></svg>
                            {/if}
                            <div class="user-details">
                                <div class="user-name">
                                    {#if item.key === 'biliAccount' && state.bilibili.userInfo}
                                        {state.bilibili.userInfo.uname}
                                        <span class="user-level">LV{state.bilibili.userInfo.level_info.current_level}</span>
                                    {:else if item.key === 'proAccount'}
                                        {i18n.pro?.title || "Media Player Pro"}
                                    {:else if item.key === 'alistAccount'}
                                        {i18n.setting.alist?.title || "AList 服务器"}
                                    {/if}
                                </div>
                                <div class="user-id">
                                    {#if item.key === 'biliAccount' && state.bilibili.userInfo}
                                        UID: {state.bilibili.userInfo.mid}
                                    {:else if item.key === 'proAccount'}
                                        {i18n.pro?.statusEnabled || "已启用"}
                                    {:else if item.key === 'alistAccount'}
                                        {settingItems.find(i => i.key === 'alistServer')?.value || (i18n.setting.alist?.notConfigured || "未配置")}
                                    {/if}
                                </div>
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
                            on:click={() => handleAccountAction(item.key)}
                            disabled={item.key === 'biliAccount' && item.button?.state === "pending"}>
                            {item.button?.buttonText || "操作"}
                        </button>
                    {/if}
                </div>
            </div>

        {/each}
    </div>
    
    <div class="playlist-footer">
        <button class="add-btn" on:click={resetSettings}>
            <svg class="icon"><use xlink:href="#iconRefresh"></use></svg>
            <span>{i18n.setting.reset}</span>
        </button>
        <button class="add-btn" on:click={saveSettings}>
            <svg class="icon"><use xlink:href="#iconCheck"></use></svg>
            <span>{i18n.setting.save}</span>
        </button>
    </div>
</div>