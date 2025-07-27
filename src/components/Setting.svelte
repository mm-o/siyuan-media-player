<script lang="ts">
    import { onMount } from "svelte";
    import { showMessage, getFrontend } from "siyuan";
    import type { ISettingItem, SettingType } from "../core/types";
    // @ts-ignore
    import Tabs from './Tabs.svelte';
    
    const isMobile = () => getFrontend().endsWith('mobile'); // 运行环境判断
    import { notebook } from "../core/document";

    import { QRCodeManager, isBilibiliAvailable } from "../core/bilibili";

    export let group: string;
    export let config: any;
    export let i18n: any;
    export let activeTabId = 'settings';
    export let plugin: any;
    
    // 配置管理 - 极简版
    const getConfig = async () => await plugin.loadData('config.json') || {};
    const saveConfig = async (cfg) => { await plugin.saveData('config.json', cfg, 2); window.dispatchEvent(new CustomEvent('configUpdated', { detail: cfg })); };

    // 数据库操作 - 极简版
    const processDbId = async (id: string) => { if (!id || !/^\d{14}-[a-z0-9]{7}$/.test(id)) return { id, avId: '' }; const avId = (await fetch('/api/query/sql', { method: 'POST', body: JSON.stringify({ stmt: `SELECT markdown FROM blocks WHERE type='av' AND id='${id}'` }) }).then(r => r.json()).catch(() => ({ data: [] }))).data?.[0]?.markdown?.match(/data-av-id="([^"]+)"/)?.[1]; return { id, avId: avId || id }; };
    const initDb = async (id: string) => { try { const { avId } = await processDbId(id); return !!(await fetch('/api/av/getAttributeView', { method: 'POST', body: JSON.stringify({ id: avId }) }).then(r => r.json()).catch(() => ({ code: -1 }))).code === 0; } catch { return false; } };
    
    // 默认值定义
    const DEFAULTS = {
        pro: { enabled: false },
        openlist: { enabled: false },
        openlistConfig: { server: "http://localhost:5244", username: "admin", password: "" },
        webdav: { enabled: false },
        webdavConfig: { server: "https://your-webdav-server.com", username: "", password: "" },
        bilibiliLogin: null,
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
        notebook: { id: '', name: '' },
        parentDoc: { id: '', name: '', path: '' },
        enableDatabase: false,
        playlistDb: { id: '', avId: '' },
        playlistView: { mode: 'detailed', tab: '目录', expanded: [] },
        screenshotWithTimestamp: false,
        linkFormat: "- [😄标题 艺术家 字幕 时间](链接)",
        mediaNotesTemplate: "# 📽️ 标题的媒体笔记\n- 📅 日 期：日期\n- ⏱️ 时 长：时长\n- 🎨 艺 术 家：艺术家\n- 🔖 类 型：类型\n-  链 接：[链接](链接)\n- ![封面](封面)\n- 📝 笔记内容："
    };
    
    // 状态和数据
    let activeTab = 'account';
    let state: any = {};
    let settingItems: ISettingItem[] = [];
    let notebooks = [];
    let notebookOptions = [];
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

        // OpenList账号
        { key: "openlist",type: "checkbox" as SettingType,tab: "account",
        title: i18n.setting.openlist?.title || "OpenList 服务器", value: state.openlist?.enabled,
        description: accDesc('/plugins/siyuan-media-player/assets/images/openlist.svg', 'OpenList云盘',
            state.openlist?.enabled ? '已连接' : '未启用', state.openlist?.enabled ? '#4caf50' : '#999',
            state.openlist?.enabled ? (state.openlistConfig?.server || '未配置服务器') : '连接您的云存储服务',
            state.openlist?.enabled ? `用户: ${state.openlistConfig?.username || '未设置'}` : '支持多种云盘协议'),
        onChange: (v) => { state.openlist = { ...state.openlist, enabled: v }; } },
                    { key: "openlistServer", value: state.openlistConfig?.server, type: "textarea" as SettingType, tab: "account",
        displayCondition: (s) => !s.openlist?.enabled,
        title: i18n.setting.openlist?.server || "OpenList 服务器",
        description: i18n.setting.openlistConfig?.server || "OpenList服务器地址", rows: 1,
        onChange: (v) => state.openlistConfig.server = v },
        { key: "openlistUsername", value: state.openlistConfig?.username, type: "textarea" as SettingType, tab: "account",
        displayCondition: (s) => !s.openlist?.enabled,
        title: i18n.setting.openlist?.username || "OpenList 用户名",
        description: i18n.setting.openlistConfig?.username || "OpenList账号用户名", rows: 1,
        onChange: (v) => state.openlistConfig.username = v },
        { key: "openlistPassword", value: state.openlistConfig?.password, type: "textarea" as SettingType, tab: "account",
        displayCondition: (s) => !s.openlist?.enabled,
        title: i18n.setting.openlist?.password || "OpenList 密码",
        description: i18n.setting.openlistConfig?.password || "OpenList账号密码", rows: 1,
        onChange: (v) => state.openlistConfig.password = v },

        // WebDAV账号
        { key: "webdav", type: "checkbox" as SettingType, tab: "account",
        title: i18n.setting.webdav?.title || "WebDAV 服务器", value: state.webdav?.enabled,
        description: accDesc('/plugins/siyuan-media-player/assets/images/webdav.svg', 'WebDAV云盘',
            state.webdav?.enabled ? '已连接' : '未启用', state.webdav?.enabled ? '#4caf50' : '#999',
            state.webdav?.enabled ? (state.webdavConfig?.server || '未配置服务器') : '连接您的WebDAV存储',
            state.webdav?.enabled ? `用户: ${state.webdavConfig?.username || '未设置'}` : '支持标准WebDAV协议'),
        onChange: (v) => { state.webdav = { ...state.webdav, enabled: v }; } },
        { key: "webdavServer", value: state.webdavConfig?.server, type: "textarea" as SettingType, tab: "account",
        displayCondition: (s) => !s.webdav?.enabled,
        title: i18n.setting.webdav?.server || "WebDAV 服务器",
        description: i18n.setting.webdavConfig?.server || "WebDAV服务器地址", rows: 1,
        onChange: (v) => state.webdavConfig.server = v },
        { key: "webdavUsername", value: state.webdavConfig?.username, type: "textarea" as SettingType, tab: "account",
        displayCondition: (s) => !s.webdav?.enabled,
        title: i18n.setting.webdav?.username || "WebDAV 用户名",
        description: i18n.setting.webdavConfig?.username || "WebDAV账号用户名", rows: 1,
        onChange: (v) => state.webdavConfig.username = v },
        { key: "webdavPassword", value: state.webdavConfig?.password, type: "textarea" as SettingType, tab: "account",
        displayCondition: (s) => !s.webdav?.enabled,
        title: i18n.setting.webdav?.password || "WebDAV 密码",
        description: i18n.setting.webdavConfig?.password || "WebDAV账号密码", rows: 1,
        onChange: (v) => state.webdavConfig.password = v },

            // B站账号 - 只有扩展启用时才显示
            ...(isBilibiliAvailable() ? [{
              key: "bilibili", type: "checkbox" as SettingType, tab: "account",
              title: i18n.setting.bilibili?.account || "B站账号",
              value: !!state.bilibiliLogin?.sessdata,
              description: ((u) => accDesc(
                u?.face || '#iconBili', u?.uname || 'Bilibili',
                u ? `LV${u.level_info?.current_level} ${u.vipStatus ? '💎' : ''}` : '未登录', u ? '#fb7299' : '#999',
                u ? `UID ${u.mid} · 硬币 ${u.money}` : '登录B站账号',
                u ? `EXP ${u.level_info?.current_exp}/${u.level_info?.next_exp === '--' ? 'MAX' : u.level_info?.next_exp}` : '解锁视频播放功能'
              ))(state.bilibiliLogin),
              onChange: async (v) => v ?
                (qrCodeManager ||= new QRCodeManager(
                    q => (qrcode = q, settingItems = createSettings(state)),
                    async loginData => (state.bilibiliLogin = loginData, settingItems = createSettings(state),
                        await saveConfig({ ...(await getConfig()), settings: state }), qrCodeManager?.stopPolling())
                ), await qrCodeManager.startLogin()) :
                (state.bilibiliLogin = null, qrcode = { data: '', key: '' }, settingItems = createSettings(state),
                    await saveConfig({ ...(await getConfig()), settings: state }), qrCodeManager?.stopPolling())
            }, {
              key: "biliQr", type: "images" as SettingType, tab: "account",
              value: qrcode?.data ? [{ url: qrcode.data }] : [],
              displayCondition: () => !!qrcode?.data && !state.bilibiliLogin?.sessdata,
              title: "扫码登录"
            }] : []),
                       
            // 播放器设置
            { key: "openMode", value: state.openMode, type: "select" as SettingType, tab: "player",
              title: i18n.setting.items.openMode?.title || "打开方式",
              description: i18n.setting.items.openMode?.description,
              displayCondition: () => !isMobile(), // 移动端隐藏打开方式选项
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
              slider: { min: 50, max: 500, step: 50 } },
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
              title: i18n.setting.items.pauseAfterLoop?.title || "片段循环后暂停",
              description: i18n.setting.items.pauseAfterLoop?.description },
            { key: "loopPlaylist", value: state.loopPlaylist, type: "checkbox" as SettingType, tab: "player",
              title: i18n.setting.items?.loopPlaylist?.title || "循环列表",
              description: i18n.setting.items?.loopPlaylist?.description || "播放完列表后从头开始",
              onChange: (v) => (state.loopPlaylist = v, v && (state.loopSingle = false)) },
            { key: "loopSingle", value: state.loopSingle, type: "checkbox" as SettingType, tab: "player",
              title: i18n.setting.items?.loopSingle?.title || "单项循环",
              description: i18n.setting.items?.loopSingle?.description || "重复播放当前媒体",
              onChange: (v) => (state.loopSingle = v, v && (state.loopPlaylist = false)) },
            
            // 通用设置
            { key: "enableDatabase", value: state.enableDatabase, type: "checkbox" as SettingType, tab: "general",
              title: i18n.setting?.items?.enableDatabase?.title || "绑定数据库",
              description: i18n.setting?.items?.enableDatabase?.description || "启用播放列表数据库功能，用于保存和管理媒体项目" },
            { key: "playlistDb", value: state.playlistDb?.id || "", type: "textarea" as SettingType, tab: "general",
              displayCondition: () => state.enableDatabase,
              title: i18n.setting?.items?.playlistDb?.title || "播放列表数据库",
              description: state.playlistDb?.avId
                ? (i18n.setting?.items?.playlistDb?.avIdDescription?.replace('${avId}', state.playlistDb.avId) || `属性视图ID: ${state.playlistDb.avId}`)
                : (i18n.setting?.items?.playlistDb?.description || "输入数据库ID（支持数据库块ID或数据库ID/avid，格式：14位数字-7位字符）"),
              onChange: async (v) => {
                const result = v ? await processDbId(v) : { id: '', avId: '' };
                state.playlistDb = result;
                if (result.avId) await initDb(v).catch(() => {});
                settingItems = createSettings(state);
              },
              rows: 1 },
            { key: "targetDocumentSearch", value: "", type: "text" as SettingType, tab: "general",
              title: i18n.setting.items?.mediaNoteLocation?.search?.title || "媒体笔记创建位置",
              description: i18n.setting.items?.mediaNoteLocation?.search?.description || "输入关键字后按回车搜索文档",
              onKeydown: async (e) => {
                if (e.key === 'Enter') {
                  const result = await notebook.searchAndUpdate(e.target.value, state, { getConfig, saveConfig });
                  if (result.success && result.docs) {
                    notebookOptions = [...notebooks.map(nb => ({ label: nb.name, value: nb.id })), ...result.docs.map(doc => ({ label: doc.hPath || '无标题', value: doc.path?.split('/').pop()?.replace('.sy', '') || doc.id, notebook: doc.box, path: doc.path?.replace('.sy', '') || '' }))];
                    settingItems = createSettings(state);
                  }
                }
              } },
            { key: "targetNotebook", value: state.parentDoc?.id || state.notebook?.id || "", type: "select" as SettingType, tab: "general",
              title: i18n.setting.items?.mediaNoteLocation?.target?.title || "媒体笔记目标笔记本/文档",
              description: state.parentDoc?.id ? `目标文档：${state.parentDoc.name}` : (state.notebook?.id ? `目标笔记本：${state.notebook.name}` : (i18n.setting.items?.mediaNoteLocation?.target?.description || "选择创建媒体笔记的目标笔记本")),
              onChange: (v) => {
                const notebook = notebooks.find(nb => nb.id === v);
                const docOption = notebookOptions.find(opt => opt.value === v);
                if (notebook) { state.notebook = { id: v, name: notebook.name }; state.parentDoc = { id: '', name: '', path: '' }; }
                else if (docOption) { state.parentDoc = { id: v, name: docOption.label, path: docOption.path || '' }; state.notebook = { id: docOption.notebook || '', name: '' }; }
              },
              options: notebookOptions.length ? notebookOptions : notebooks.map(nb => ({ label: nb.name, value: nb.id })) },
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
        notebookOptions = [
            ...notebooks.map(nb => ({ label: nb.name, value: nb.id })),
            ...(state.parentDoc?.id ? [{ label: state.parentDoc.name, value: state.parentDoc.id, path: state.parentDoc.path }] : [])
        ];
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

<div class="panel common-panel" data-name={group}>
    <!-- 统一导航 -->
    <Tabs {activeTabId} {i18n}>
        <svelte:fragment slot="controls">
            <span class="panel-count">{tabs.find(tab => tab.id === activeTab)?.name || i18n.setting.description}</span>
        </svelte:fragment>
    </Tabs>

    <div class="panel-tabs">
        {#each tabs as tab}
            <button class="tab" class:active={activeTab === tab.id} on:click={() => activeTab = tab.id}>{tab.name}</button>
        {/each}
    </div>

    <div class="panel-content">
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
                    {:else if item.type === 'text'}
                        <input
                            type="text"
                            class="b3-text-field fn__block"
                            value={String(item.value)}
                            on:input={(e) => handleChange(e, item)}
                            on:keydown={(e) => item.onKeydown && item.onKeydown(e)}>
                        <span class="clear-icon" on:click={() => resetItem(item.key)}>
                            <svg class="icon"><use xlink:href="#iconRefresh"></use></svg>
                        </span>
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
                        <select class="select-wrapper" style="max-width: 200px; width: 200px;" value={item.value} on:change={(e) => handleChange(e, item)}>
                            {#each item.options || [] as option}
                                <option value={option.value} title={option.label}>{option.label.length > 30 ? option.label.slice(0, 30) + '...' : option.label}</option>
                            {/each}
                        </select>
                    {/if}
                </div>
            </div>
            {/if}
        {/each}
    </div>
</div>