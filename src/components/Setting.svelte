<script lang="ts">
    import { onMount } from "svelte";
    import { showMessage } from "siyuan";
    import type { ISettingItem, SettingType } from "../core/types";
    import { notebook } from "../core/document";
    import { getAvIdByBlockId, MediaDB } from "../core/PlayList";
    import { QRCodeManager } from "../core/bilibili";

    export let group: string;
    export let config: any;
    export let i18n: any;
    export let allTabs = ['playList', 'assistant', 'settings'];
    export let activeTabId = 'settings';
    export let plugin: any;
    
    // 配置管理
    const getConfig = async () => await plugin.loadData('config.json') || {};
    const saveConfig = async (cfg) => { await plugin.saveData('config.json', cfg, 2); window.dispatchEvent(new CustomEvent('configUpdated', { detail: cfg })); };
    
    // 默认值定义
    const DEFAULTS = {
        pro: { enabled: false },
        bilibili: { login: false, userInfo: null },
        alist: { enabled: false },
        alistConfig: { server: "http://localhost:5244", username: "admin", password: "" },
        openMode: "default",
        playerType: "built-in",
        playerPath: "PotPlayerMini64.exe",
        volume: 70,
        speed: 100,
        showSubtitles: false,
        enableDanmaku: false,
        loopCount: 3,
        pauseAfterLoop: false,
        loopPlaylist: false,
        loopSingle: false,
        insertMode: "updateBlock",
        targetNotebook: { id: '', name: '' },
        playlistDb: { id: '', avId: '' },
        screenshotWithTimestamp: false,
        linkFormat: "- [😄标题 艺术家 字幕 时间](链接)",
        mediaNotesTemplate: "# 📽️ 标题的媒体笔记\n- 📅 日 期：日期\n- ⏱️ 时 长：时长\n- 🎨 艺 术 家：艺术家\n- 🔖 类 型：类型\n- 🔗 链 接：[链接](链接)\n- ![封面](封面)\n- 📝 笔记内容："
    };
    
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
    
    // 通用账号描述生成器
    const accDesc = (icon, name, status, statusColor, info1, info2) => 
        ({ icon, name, status, statusColor, info1, info2 });
    
    // 极简描述渲染
    const renderDesc = (d) => d?.icon ? 
        `${d.icon.startsWith('#') ? `<svg class="acc-icon"><use xlink:href="${d.icon}"></use></svg>` : `<img src="${d.icon}" class="acc-icon">`}
        <div class="acc-info"><b>${d.name}</b> <span style="color:${d.statusColor}">${d.status}</span><br><small>${d.info1}</small><br><small class="acc-muted">${d.info2}</small></div>` : d;
    
    // 面板切换处理
    function changePanelTab(tabId) {
        if (tabId === activeTabId) return;
        window.dispatchEvent(new CustomEvent('mediaPlayerTabChange', { detail: { tabId } }));
    }
    
    // 创建默认设置项
    function createSettings(state): ISettingItem[] {
        
        return [
            // Pro账号
            { key: "pro",type: "checkbox" as SettingType,tab: "account",
                title: i18n.pro?.title || "Media Player Pro", value: state.pro?.enabled,
                description: accDesc('#iconVIP', 'Pro会员', 
                    state.pro?.enabled ? '已激活' : '未激活', state.pro?.enabled ? '#f90' : '#999',
                    state.pro?.enabled ? '高级功能已解锁' : '解锁全部高级功能',
                    state.pro?.enabled ? '感谢您的支持' : '支持开发者'),
                onChange: async (v) => {
                    state.pro = { ...state.pro, enabled: v };
                    settingItems = createSettings(state);
                    const cfg = await getConfig(); cfg.settings = state; await saveConfig(cfg); } },
            { key: "proPanel", type: "images" as SettingType, value: [
                { url: "/plugins/siyuan-media-player/assets/images/alipay.jpg", caption: "支付宝付款码" },
                { url: "/plugins/siyuan-media-player/assets/images/wechat.jpg", caption: "微信付款码" }
              ], tab: "account",
              displayCondition: (s) => !s.pro?.enabled,
              title: i18n.pro?.priceTag || "¥ 18.00",
              description: i18n.pro?.priceWithStar || "或 ¥ 16.00 + <a href=\"https://github.com/mm-o/siyuan-media-player\" target=\"_blank\" rel=\"noopener noreferrer\">GitHub Star</a> 关注" },

            // AList账号
            { key: "alist",type: "checkbox" as SettingType,tab: "account",
                title: i18n.setting.alist?.title || "AList 服务器", value: state.alist?.enabled,
                description: accDesc('#iconCloud', 'AList云盘',
                    state.alist?.enabled ? '已连接' : '未启用', state.alist?.enabled ? '#4caf50' : '#999',
                    state.alist?.enabled ? (state.alistConfig?.server || '未配置服务器') : '连接您的云存储服务',
                    state.alist?.enabled ? `用户: ${state.alistConfig?.username || '未设置'}` : '支持多种云盘协议'),
                onChange: (v) => { state.alist = { ...state.alist, enabled: v }; } },
            { key: "alistServer", value: state.alistConfig?.server, type: "textarea" as SettingType, tab: "account",
              displayCondition: (s) => !s.alist?.enabled,
              title: i18n.setting.alist?.server || "AList 服务器", 
              description: i18n.setting.alistConfig?.server || "AList服务器地址", rows: 1,
              onChange: (v) => state.alistConfig.server = v },
            { key: "alistUsername", value: state.alistConfig?.username, type: "textarea" as SettingType, tab: "account",
              displayCondition: (s) => !s.alist?.enabled,
              title: i18n.setting.alist?.username || "AList 用户名", 
              description: i18n.setting.alistConfig?.username || "AList账号用户名", rows: 1,
              onChange: (v) => state.alistConfig.username = v },
            { key: "alistPassword", value: state.alistConfig?.password, type: "textarea" as SettingType, tab: "account",
              displayCondition: (s) => !s.alist?.enabled,
              title: i18n.setting.alist?.password || "AList 密码", 
              description: i18n.setting.alistConfig?.password || "AList账号密码", rows: 1,
              onChange: (v) => state.alistConfig.password = v },
 
            // B站账号
            { key: "bilibili", type: "checkbox" as SettingType, tab: "account",
              title: i18n.setting.bilibili?.account || "B站账号", value: state.bilibili?.login,
              description: ((u) => accDesc(
                u?.face || '#iconBili', u?.uname || 'Bilibili',
                u ? `LV${u.level_info?.current_level} ${u.vipStatus ? '💎' : ''}` : '未登录', u ? '#fb7299' : '#999',
                u ? `UID ${u.mid} · 硬币 ${u.money}` : '登录B站账号',
                u ? `EXP ${u.level_info?.current_exp}/${u.level_info?.next_exp === '--' ? 'MAX' : u.level_info?.next_exp}` : '解锁视频播放功能'
              ))(state.bilibili?.userInfo),
              onChange: async (v) => v ? 
                (qrCodeManager ||= new QRCodeManager(
                    { getConfig, save: () => {}, updateSettings: async s => await saveConfig({ ...(await getConfig()), settings: s }) },
                    q => (qrcode = q, settingItems = createSettings(state)),
                    async u => (state.bilibili = { login: true, userInfo: u }, await saveConfig({ ...(await getConfig()), settings: state }), qrCodeManager?.stopPolling(), settingItems = createSettings(state))
                ), await qrCodeManager.startLogin()) :
                (state.bilibili = { login: false, userInfo: null }, qrCodeManager?.stopPolling(), qrcode = { data: '', key: '' })},
            { key: "biliQr", type: "images" as SettingType, tab: "account",
              value: qrcode?.data ? [{ url: qrcode.data }] : [],
              displayCondition: () => !!qrcode?.data && !state.bilibili?.login,
              title: "扫码登录" },
                       
            // 播放器设置
            { key: "openMode", value: state.openMode, type: "select" as SettingType, tab: "player",
              title: i18n.setting.items.openMode?.title || "打开方式",
              description: i18n.setting.items.openMode?.description,
              options: [
                { label: i18n.setting.items.openMode?.options?.default || "新标签", value: "default" },
                { label: i18n.setting.items.openMode?.options?.right || "右侧新标签", value: "right" },
                { label: i18n.setting.items.openMode?.options?.bottom || "底部新标签", value: "bottom" },
                { label: i18n.setting.items.openMode?.options?.window || "新窗口", value: "window" }
              ] },
            { key: "playerType", value: state.playerType, type: "select" as SettingType, tab: "player",
              title: i18n.setting.items.playerType.title,
              description: i18n.setting.items.playerType.description,
              options: [
                { label: i18n.setting.items.playerType.builtIn, value: "built-in" },
                { label: i18n.setting.items.playerType.potPlayer, value: "potplayer" },
                { label: i18n.setting.items.playerType.browser, value: "browser" }
              ] },
            { key: "playerPath", value: state.playerPath, type: "textarea" as SettingType, tab: "player",
              displayCondition: () => settingItems.find(i => i.key === 'playerType')?.value === 'potplayer',
              title: i18n.setting.items?.playerPath?.title || "PotPlayer路径",
              description: i18n.setting.items?.playerPath?.description || "设置PotPlayer可执行文件路径",
              rows: 1 },
            { key: "volume", value: state.volume, type: "slider" as SettingType, tab: "player",
              title: i18n.setting.items.volume.title,
              description: i18n.setting.items.volume.description,
              slider: { min: 0, max: 100, step: 1 } },
            { key: "speed", value: state.speed, type: "slider" as SettingType, tab: "player",
              title: i18n.setting.items.speed.title,
              description: i18n.setting.items.speed.description,
              slider: { min: 25, max: 200, step: 25 } },
            { key: "showSubtitles", value: state.showSubtitles, type: "checkbox" as SettingType, tab: "player",
              title: i18n.setting.items.showSubtitles?.title || "显示字幕",
              description: i18n.setting.items.showSubtitles?.description },
            { key: "enableDanmaku", value: state.enableDanmaku, type: "checkbox" as SettingType, tab: "player",
              title: i18n.setting.items.enableDanmaku?.title || "启用弹幕",
              description: i18n.setting.items.enableDanmaku?.description },
            { key: "loopCount", value: state.loopCount, type: "slider" as SettingType, tab: "player",
              title: i18n.setting.items.loopCount.title,
              description: i18n.setting.items.loopCount.description,
              slider: { min: 1, max: 10, step: 1 } },
            { key: "pauseAfterLoop", value: state.pauseAfterLoop, type: "checkbox" as SettingType, tab: "player",
              title: i18n.setting.items.pauseAfterLoop?.title || "循环后暂停",
              description: i18n.setting.items.pauseAfterLoop?.description },
            { key: "loopPlaylist", value: state.loopPlaylist, type: "checkbox" as SettingType, tab: "player",
              title: i18n.setting.items?.loopPlaylist?.title || "循环列表",
              description: i18n.setting.items?.loopPlaylist?.description || "播放完列表后从头开始" },
            { key: "loopSingle", value: state.loopSingle, type: "checkbox" as SettingType, tab: "player",
              title: i18n.setting.items?.loopSingle?.title || "单项循环",
              description: i18n.setting.items?.loopSingle?.description || "重复播放当前媒体" },
            
            // 通用设置
            { key: "insertMode", value: state.insertMode, type: "select" as SettingType, tab: "general",
              title: i18n.setting.items.insertMode?.title || "插入方式",
              description: i18n.setting.items.insertMode?.description || "选择时间戳和笔记的插入方式",
              onChange: (v) => state.insertMode = v,
              options: [
                { label: i18n.setting.items.insertMode?.insertBlock || "插入光标处", value: "insertBlock" },
                { label: i18n.setting.items.insertMode?.appendBlock || "追加到块末尾", value: "appendBlock" },
                { label: i18n.setting.items.insertMode?.prependBlock || "添加到块开头", value: "prependBlock" },
                { label: i18n.setting.items.insertMode?.updateBlock || "更新当前块", value: "updateBlock" },
                { label: i18n.setting.items.insertMode?.prependDoc || "插入到文档顶部", value: "prependDoc" },
                { label: i18n.setting.items.insertMode?.appendDoc || "插入到文档底部", value: "appendDoc" },
                { label: i18n.setting.items.insertMode?.clipboard || "复制到剪贴板", value: "clipboard" }
              ] },
            { key: "targetNotebook", value: state.targetNotebook?.id || "", type: "select" as SettingType, tab: "general",
              title: i18n.setting.items?.targetNotebook?.title || "目标笔记本", 
              description: state.targetNotebook?.id ? `ID: ${state.targetNotebook.id}` : "选择创建媒体笔记的目标笔记本",
              onChange: (v) => state.targetNotebook = { id: v, name: notebooks.find(n => n.id === v)?.name || "" },
              options: notebooks.map(nb => ({ label: nb.name, value: nb.id })) },
            { key: "playlistDb", value: state.playlistDb?.id || "", type: "textarea" as SettingType, tab: "general",
              title: "播放列表数据库",
              description: state.playlistDb?.avId ? `属性视图ID: ${state.playlistDb.avId}` : "输入数据库块ID",
              onChange: async (v) => {
                const avId = v ? await getAvIdByBlockId(v).catch(() => '') : '';
                state.playlistDb = { id: v, avId };
                if (avId) await new MediaDB().init(v).catch(() => {});
                settingItems = createSettings(state);
              },
              rows: 1 },
            { key: "screenshotWithTimestamp", value: state.screenshotWithTimestamp, type: "checkbox" as SettingType, tab: "general",
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
              rows: 9 }
        ];
    }

    // 初始化
    async function refreshSettings() {
        const cfg = await getConfig();
        state = { ...DEFAULTS, ...(cfg.settings || {}) };
        try { notebooks = await notebook.getList?.() || []; } catch {}
        settingItems = createSettings(state);
    }


    // 重置单个设置项
    function resetItem(key) {
        state[key] = DEFAULTS[key];
        settingItems = createSettings(state);
    }

    // 设置项变更处理
    async function handleChange(e, item) {
        const v = e.target.type === 'checkbox' 
            ? e.target.checked 
            : e.target.value;
        if (item.onChange) {await item.onChange(v);} 
        else {state[item.key] = v;}
        settingItems = createSettings(state);
        const cfg = await getConfig(); cfg.settings = state; await saveConfig(cfg);
    }

    $: if (activeTab) refreshSettings();

    onMount(refreshSettings);
</script>

<div class="settings common-panel" data-name={group}>
    <div class="playlist-header">
        <div class="panel-nav">
            <h3 class:active={activeTabId === 'playlist'} on:click={() => changePanelTab('playlist')}>{i18n.playList?.title || "列表"}</h3>
            <h3 class:active={activeTabId === 'assistant'} on:click={() => changePanelTab('assistant')}>{i18n.assistant?.title || "助手"}</h3>
            <h3 class:active={activeTabId === 'settings'} on:click={() => changePanelTab('settings')}>{i18n.setting?.title || "设置"}</h3>
        </div>
        <span class="playlist-count">{tabs.find(tab => tab.id === activeTab)?.name || i18n.setting.description}</span>
    </div>

    <div class="playlist-tabs">
        {#each tabs as tab}
            <button class="tab" class:active={activeTab === tab.id} on:click={() => activeTab = tab.id}>{tab.name}</button>
        {/each}
    </div>

    <div class="setting-panel">
        {#each settingItems as item (item.key)}
            {#if item.tab === activeTab && (!item.displayCondition || item.displayCondition(state))}
            <div class="setting-item setting-item-{item.type}" data-key={item.key}>
                <div class="setting-info">
                    <div class="setting-title">{item.title}</div>
                    {#if item.description}
                        <div class="setting-description {item.description?.icon ? 'acc-desc' : ''}">
                            {@html renderDesc(item.description)}
                        </div>
                    {/if}
                    
                    {#if item.type === 'slider'}
                        <div class="slider-wrapper">
                            <input type="range"
                                min={item.slider?.min ?? 0}
                                max={item.slider?.max ?? 100}
                                step={item.slider?.step ?? 1}
                                value={state[item.key]}
                                on:input={(e) => handleChange(e, item)}>
                            <span class="slider-value">{item.key === 'speed' ? Number(state[item.key]) / 100 + 'x' : state[item.key]}</span>
                        </div>
                    {:else if item.type === 'textarea'}
                        <textarea 
                            class="b3-text-field fn__block" 
                            rows={item.rows || 4}
                            value={String(item.value)}
                            on:input={(e) => handleChange(e, item)}></textarea>
                        <span class="clear-icon" on:click={() => resetItem(item.key)}>
                            <svg class="icon"><use xlink:href="#iconRefresh"></use></svg>
                        </span>
                    {:else if item.type === 'images'}
                        <div class="image-gallery">
                            {#each Array.isArray(item.value) ? item.value : [] as image}
                                <img src={image.url} alt={image.caption || item.title} class="image-item">
                            {/each}
                        </div>
                    {/if}
                </div>
                
                <div class="setting-control">
                    {#if item.type === 'checkbox'}
                        <label class="checkbox-wrapper">
                            <input type="checkbox" checked={Boolean(item.value)} on:change={(e) => handleChange(e, item)}>
                            <span class="checkbox-custom"></span>
                        </label>
                    {:else if item.type === 'select'}
                        <select class="select-wrapper" value={item.value} on:change={(e) => handleChange(e, item)}>
                            {#each item.options || [] as option}
                                <option value={option.value}>{option.label}</option>
                            {/each}
                        </select>
                    {/if}
                </div>
            </div>
            {/if}
        {/each}
    </div>
</div>