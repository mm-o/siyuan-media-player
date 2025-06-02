<script lang="ts">
    // 从"svelte"中导入createEventDispatcher和onMount
    import { createEventDispatcher, onMount } from "svelte";
    // 从"siyuan"中导入showMessage和Menu
    import { showMessage } from "siyuan";
    // 从'../core/types'中导入MediaItem和PlaylistConfig类型
    import type { MediaItem, PlaylistConfig } from '../core/types';
    // 从'../core/media'中导入MediaManager
    import { MediaManager } from '../core/media';
    // 从'../core/bilibili'中导入BilibiliParser
    import { BilibiliParser, parseBiliUrl } from '../core/bilibili';
    // 从'../core/config'中导入ConfigManager类型
    import type { ConfigManager } from '../core/config';
    // 导入url工具
    import { url, database } from '../core/utils';
    // 从'../core/alist'中导入AListManager
    import { AListManager } from '../core/alist';
    // 导入子组件
    import PlayListTabs from './playlist/PlayListTabs.svelte';
    import PlayListItem from './playlist/PlayListItem.svelte';
    import PlayListFooter from './playlist/PlayListFooter.svelte';

    // 组件属性
    export let items: MediaItem[] = [];
    export let currentItem: MediaItem | null = null;
    export let configManager: ConfigManager;
    export let className = '';
    export let hidden = false;
    export let i18n: any;
    
    // 新增组件属性
    export let allTabs = [];
    export let activeTabId = 'playlist';
    
    // 组件状态
    let tabs: PlaylistConfig[] = [];
    let playlistTabId = 'default';
    let viewMode: 'detailed' | 'compact' | 'grid' | 'grid-single' = 'detailed';
    let sortBy = 0; // 0:默认, 1:名称, 2:时间, 3:类型
    
    // 计算属性
    $: playlistTab = tabs.find(tab => tab.id === playlistTabId);
    $: activeTab = playlistTab;
    $: itemCount = activeTab?.items?.length || 0;
    
    // 排序后的项目
    $: sortedItems = playlistTab?.items && sortBy ? 
        [...playlistTab.items].sort((a, b) => 
            a.isPinned !== b.isPinned ? (a.isPinned ? -1 : 1) : 
            sortBy === 1 ? a.title.localeCompare(b.title) :
            sortBy === 2 ? (b.id?.split('-').pop() || '0').localeCompare(a.id?.split('-').pop() || '0') :
            (a.type || '').localeCompare(b.type || '')
        ) : playlistTab?.items || [];
    
    // 事件分发器
    const dispatch = createEventDispatcher();
    
    // 常量定义
    const DIRECTORY_TAB_ID = 'directory'; // 目录标签ID
    
    // 面板切换处理
    function changePanelTab(tabId) {
        if (tabId === activeTabId) return;
        window.dispatchEvent(new CustomEvent('mediaPlayerTabChange', { 
            detail: { tabId } 
        }));
    }

    // 合并播放/添加/查找逻辑
    async function playOrAddMediaItem(mediaItem: MediaItem, autoPlay = true) {
        let existingItem = findExistingItem(mediaItem.url, mediaItem.bvid);
        if (existingItem) {
            Object.assign(existingItem, { ...mediaItem });
            if (autoPlay) await playMedia(existingItem);
            showMessage(i18n.playList.message.existingItemPlay);
        } else {
            playlistTab.items = [...(playlistTab.items || []), mediaItem];
            tabs = [...tabs];
            if (autoPlay) await playMedia(mediaItem);
            showMessage(i18n.playList.message.added);
            
            // 同步到数据库
            syncMediaItemToDatabase(mediaItem, 'add');
        }
    }

    // 只负责播放
    async function playMedia(item: MediaItem) {
        try {
            if (item.action === 'navigateToTab' && item.targetTabId) {
                playlistTabId = item.targetTabId;
                dispatch('tabChange', { tabId: item.targetTabId });
                return;
            }
            if (item.is_dir && item.source === 'alist' && item.sourcePath) {
                await loadAListDirectory(item.sourcePath);
                return;
            }
            const config = await configManager.getConfig();
            const playOptions = { ...item, type: item.type || 'video' };
            if (item.type === 'bilibili' && item.bvid && item.cid) {
                if (!config.bilibiliLogin?.userInfo?.mid) {
                    showMessage(i18n.playList.error.needBiliLogin || '需要登录B站才能播放视频');
                    return;
                }
                const streamInfo = await BilibiliParser.getProcessedVideoStream(item.bvid, item.cid, 0, config);
                if (streamInfo.dash) {
                    const videoUrl = streamInfo.dash.video?.[0]?.baseUrl || '';
                    Object.assign(playOptions, {
                        url: videoUrl,
                        headers: streamInfo.headers,
                        type: 'bilibili-dash',
                        biliDash: streamInfo.dash
                    });
                } else {
                    console.warn("B站视频没有dash格式");
                }
            }
            currentItem = item;
            dispatch('play', playOptions);
        } catch (error) {
            console.error("播放失败:", error);
            showMessage(i18n.playList.error.playRetry);
        }
    }
    
    /**
     * 加载AList目录
     */
    async function loadAListDirectory(path: string) {
        if (!path) return;
        
        try {
            let alistTab = tabs.find(t => t.id.startsWith('alist-')) || (() => {
                const id = `alist-main-${Date.now()}`;
                tabs = [...tabs, {id, name: 'AList', items: [], isFixed: true}];
                return tabs[tabs.length - 1];
            })();
            
            // 使用新字段保存路径
            alistTab.path = path;
            alistTab.sourceType = 'alist';
            // 保留兼容性
            alistTab.alistPath = path;
            alistTab.alistPathParts = path.split('/').filter(Boolean)
                .map((part, i, arr) => ({name: part, path: '/'+arr.slice(0, i+1).join('/')}));
            
            playlistTabId = alistTab.id;
            dispatch('tabChange', {tabId: alistTab.id});
            
            alistTab.items = await AListManager.createMediaItemsFromDirectory(path);
            tabs = [...tabs];
            dispatch('tabsUpdate', {tabs});
        } catch (error) {
            console.error("获取AList媒体列表失败:", error);
            showMessage(i18n.playList.error.loadFailed);
        }
    }

    // 生命周期
    onMount(() => {
        const init = async () => {
            MediaManager.cleanupCache();
            try { await AListManager.initFromConfig(await configManager.getConfig()); } catch {}
            await loadPlaylists();
            
            // 尝试从数据库同步
            try { await syncMediaItemsFromDatabase(); } catch {}
        };
        
        // 监听面板激活
        const handleTabActivate = (e: any) => {
            if (e.detail?.tabId) {
                activeTabId = e.detail.tabId;
            }
        };
        
        window.addEventListener('mediaPlayerTabActivate', handleTabActivate);
        init();
        
        return () => {
            window.removeEventListener('mediaPlayerTabActivate', handleTabActivate);
        };
    });

    // 监听变化
    $: if (tabs.length > 0) {
        savePlaylists();
    }

    // 当面板切换到播放列表时，在特定情况下自动切换到默认标签
    $: if (false) { // 禁用自动切换，让所有标签可以手动切换
        // 不直接修改，而是通过事件确保UI一致
        handleTabChange({ detail: { tabId: 'default' } });
    }

    /**
     * 加载播放列表
     */
    async function loadPlaylists() {
        const config = await configManager.load();
        tabs = await Promise.all(
            config.playlists.map(async tab => ({
                ...tab,
                items: await MediaManager.createMediaItems(tab.items || [])
            }))
        );
        
        // 检查是否存在目录标签，不存在则添加
        if (!tabs.find(tab => tab.id === DIRECTORY_TAB_ID)) {
            tabs = [
                { id: DIRECTORY_TAB_ID, name: i18n.playList.directory?.title || '目录', isFixed: true, items: [] },
                ...tabs
            ];
        } else {
            // 如果目录标签已存在，确保其名称使用当前语言
            tabs = tabs.map(tab => {
                if (tab.id === DIRECTORY_TAB_ID && tab.isFixed) {
                    return { ...tab, name: i18n.playList.directory?.title || '目录' };
                }
                return tab;
            });
        }
    }

    /**
     * 保存播放列表
     */
    function savePlaylists() {
        const playlistsToSave = tabs.map(tab => ({
            id: tab.id,
            name: tab.name,
            isFixed: tab.isFixed,
            path: tab.path,
            sourceType: tab.sourceType,
            alistPath: tab.alistPath,
            items: (tab.items || []).map(item => ({
                id: item.id,
                title: item.title,
                type: item.type,
                url: item.url,
                aid: item.aid,
                bvid: item.bvid,
                cid: item.cid,
                startTime: item.startTime,
                endTime: item.endTime,
                isLoop: item.isLoop,
                loopCount: item.loopCount,
                isPinned: item.isPinned,
                isFavorite: item.isFavorite
            }))
        }));
        configManager.updatePlaylists(playlistsToSave);
    }

    // 统一查找已存在媒体项
    function findExistingItem(mediaUrl, bvid) {
        if (!playlistTab?.items?.length) return;
        if (bvid) return playlistTab.items.find(i => i.bvid === bvid);
        const clean = url.parseTime(mediaUrl).mediaUrl.split('?')[0];
        return playlistTab.items.find(i => (i.url?.split('?')[0] || '') === clean);
    }
    
    // 更新B站分P
    async function updateBiliPart(item: MediaItem, bvid: string, p: number) {
        try {
            const parts = await BilibiliParser.getVideoParts({ bvid });
            const currentPart = parts.find(part => part.page === p);
            
            if (currentPart) {
                const baseId = item.id.split('-p')[0];
                item.id = `${baseId}-p${p}`;
                if (p > 1) {
                    item.title = `${item.title.split(' - P')[0]} - P${p}${currentPart.part ? ': ' + currentPart.part : ''}`;
                } else {
                    item.title = item.title.split(' - P')[0];
                }
                item.cid = String(currentPart.cid);
            }
        } catch {}
    }

    // 统一"下一个播放"逻辑
    export async function playNext() {
        if (!playlistTab?.items?.length || !currentItem) return false;
        
        if (currentItem.type === 'bilibili' && currentItem.bvid) {
            const currPart = parseInt(currentItem.id?.match(/-p(\d+)/)?.[1] || '1', 10);
            try {
                const parts = await BilibiliParser.getVideoParts({ bvid: currentItem.bvid });
                if (!parts?.length) return false;
                
                const nextPart = parts.find(p => p.page === currPart + 1);
                const config = await configManager.getConfig();
                
                if (nextPart || config?.settings?.loop) {
                    const nextItem = { ...currentItem };
                    await updateBiliPart(nextItem, currentItem.bvid, nextPart ? currPart + 1 : 1);
                    await playMedia(nextItem);
                    return true;
                }
            } catch (error) {
                console.error("切换B站分P失败:", error);
            }
            return false;
        }
        
        const idx = playlistTab.items.findIndex(i => i.id === currentItem.id || i.url === currentItem.url);
        if (idx >= 0) {
            await playMedia(playlistTab.items[(idx + 1) % playlistTab.items.length]);
            return true;
        }
        return false;
    }

    // 统一处理外部媒体项
    export async function handleMediaItem(mediaItem: MediaItem) {
        await playOrAddMediaItem(mediaItem, true);
    }

    // 统一事件处理
    function handleMediaItemAction(event: CustomEvent) {
        const action = event.type;
        const { item } = event.detail;
        if (action === 'play' || action === 'playPart') {
            playMedia(item);
        } else if (action === 'togglePin') {
            if (!playlistTab || !playlistTab.items) return;
            const updatedItems = playlistTab.items.map(i => 
                i.id === item.id ? { ...i, isPinned: !i.isPinned } : i
            );
            playlistTab.items = [
                ...updatedItems.filter(i => i.isPinned),
                ...updatedItems.filter(i => !i.isPinned)
            ];
            tabs = [...tabs];
            savePlaylists();
            
            // 同步到数据库
            syncMediaItemToDatabase(playlistTab.items.find(i => i.id === item.id), 'update');
        } else if (action === 'toggleFavorite') {
            const favTab = tabs.find(t => t.id === 'favorites');
            if (!favTab || !playlistTab) return;
            if (!item.isFavorite) {
                favTab.items = [...(favTab.items || []), { ...item, isFavorite: true }];
            } else {
                favTab.items = favTab.items.filter(i => i.id !== item.id);
            }
            playlistTab.items = playlistTab.items.map(i => 
                i.id === item.id ? { ...i, isFavorite: !i.isFavorite } : i
            );
            tabs = [...tabs];
            savePlaylists();
            
            // 同步到数据库
            syncMediaItemToDatabase(playlistTab.items.find(i => i.id === item.id), 'update');
        } else if (action === 'remove') {
            if (!playlistTab) return;
            
            // 在移除前同步到数据库
            syncMediaItemToDatabase(item, 'delete');
            
            playlistTab.items = playlistTab.items.filter(i => i.id !== item.id);
            if (item.isFavorite) {
                const favTab = tabs.find(t => t.id === 'favorites');
                if (favTab) {
                    favTab.items = favTab.items.filter(i => i.id !== item.id);
                }
            }
            tabs = [...tabs];
            savePlaylists();
        } else if (action === 'moveTo') {
            const { tabId } = event.detail;
            const targetTab = tabs.find(t => t.id === tabId);
            if (!playlistTab || !targetTab || playlistTab === targetTab) return;
            targetTab.items = [...targetTab.items, { ...item }];
            playlistTab.items = playlistTab.items.filter(i => i.id !== item.id);
            tabs = [...tabs];
            savePlaylists();
            if (playlistTab.id === DIRECTORY_TAB_ID) {
                playlistTabId = tabId;
                dispatch('tabChange', { tabId });
            }
            showMessage(i18n.playList.message.itemMoved?.replace('${name}', targetTab.name) || `已移动到 ${targetTab.name}`);
        }
    }

    // 事件处理
    const handleTabChange = (event) => playlistTabId = event.detail.tabId;
    const handleTabsUpdate = (event) => tabs = event.detail.tabs;
    const handleAddMedia = (event) => {
        const { url, options = {} } = event.detail;
        handleMediaAdd(url, options.autoPlay !== false, options);
    };
    const handleReload = () => loadPlaylists();

    // 统一处理媒体添加
    async function handleMediaAdd(mediaUrl: string, autoPlay = true, options: any = {}) {
        try {
            if (options.source === 'alist' && options.sourcePath) {
                if (options.is_dir) {
                    await loadAListDirectory(options.sourcePath);
                    return;
                }
                const mediaItem = await AListManager.createMediaItemFromPath(options.sourcePath, {
                    startTime: options.startTime,
                    endTime: options.endTime
                });
                await playOrAddMediaItem(mediaItem, autoPlay);
                return;
            }
            if (!mediaUrl.startsWith('file://') && 
                !mediaUrl.startsWith('http://') && 
                !mediaUrl.startsWith('https://') &&
                !mediaUrl.includes('bilibili.com') && 
                !mediaUrl.includes('b23.tv')) {
                showMessage(i18n.playList.error.invalidMediaLink || "不支持的媒体链接格式");
                return;
            }
            if (playlistTab?.id.startsWith('alist-')) {
                const isFileOrSiyuan = mediaUrl.startsWith('file://');
                if (!isFileOrSiyuan) {
                    showMessage("非AList媒体将添加到默认标签");
                    playlistTabId = 'default';
                    dispatch('tabChange', { tabId: 'default' });
                    if (autoPlay) {
                        setTimeout(() => handleMediaAdd(mediaUrl, true, options), 100);
                    }
                    return;
                }
            }
            let { mediaUrl: parsedUrl, startTime, endTime } = url.parseTime(mediaUrl);
            startTime = options.startTime ?? startTime;
            endTime = options.endTime ?? endTime;
            const biliInfo = parseBiliUrl(parsedUrl);
            const currentBvid = biliInfo?.bvid;
            const currentP = biliInfo?.p;
            if (currentBvid) {
                mediaUrl = `https://www.bilibili.com/video/${currentBvid}`;
                const config = await configManager.getConfig();
                if (!config.bilibiliLogin?.userInfo?.mid) {
                    showMessage(i18n.playList.error.needBiliLogin || '需要登录B站才能添加视频');
                    return;
                }
            }
            let mediaItem = await MediaManager.createMediaItem(mediaUrl);
            if (!mediaItem) {
                showMessage(i18n.playList.error.cannotParse);
                return;
            }
            Object.assign(mediaItem, { startTime, endTime });
            if (currentBvid && currentP && mediaItem.type === 'bilibili') {
                await updateBiliPart(mediaItem, currentBvid, currentP);
            }
            await playOrAddMediaItem(mediaItem, autoPlay);
        } catch (error) {
            showMessage(i18n.playList.error.addMediaFailed);
        }
    }

    // 其它导出方法
    export function addItem(item: MediaItem) {
        items = [...items, item];
    }

    export function addMedia(url: string, options?: { autoPlay?: boolean }) {
        handleMediaAdd(url, options?.autoPlay !== false);
    }

    // 切换视图模式
    function toggleViewMode() {
        const modes = ['detailed', 'compact', 'grid', 'grid-single'] as const;
        viewMode = modes[(modes.indexOf(viewMode) + 1) % modes.length];
    }

    // 数据库同步功能
    async function syncMediaItemToDatabase(item: MediaItem, action: 'add' | 'update' | 'delete') {
        try {
            const config = await configManager.getConfig();
            const dbId = config?.settings?.playlistDbId;
            
            if (!dbId || !item) return;
            
            // 获取数据库JSON
            const dbJson = await database.getDatabaseJson(dbId);
            if (!dbJson) return;
            
            // 根据操作类型处理
            switch (action) {
                case 'add':
                    // 添加媒体项到数据库，先检查标题字段是否存在
                    if (!database.getFieldByName(dbJson, '标题')) {
                        database.addField(dbJson, 'text', '标题');
                    }
                    if (!database.getFieldByName(dbJson, '链接')) {
                        database.addField(dbJson, 'link', '链接');
                    }
                    if (!database.getFieldByName(dbJson, '类型')) {
                        database.addField(dbJson, 'select', '类型', { options: [
                            { text: '视频', color: '#ee6666', backgroundColor: '#f8d6d6' },
                            { text: '音频', color: '#5470c6', backgroundColor: '#d2daef' },
                            { text: 'B站', color: '#fa7298', backgroundColor: '#fdd7e3' }
                        ]});
                    }
                    
                    // 设置字段值
                    database.setFieldValue(dbJson, item.id, '标题', item.title || '未命名');
                    database.setFieldValue(dbJson, item.id, '链接', item.url || '');
                    
                    // 设置类型
                    const typeValue = item.type === 'bilibili' ? 'B站' : 
                                      (item.type === 'audio' ? '音频' : '视频');
                    database.setFieldValue(dbJson, item.id, '类型', {
                        text: typeValue,
                        color: typeValue === 'B站' ? '#fa7298' : 
                               typeValue === '音频' ? '#5470c6' : '#ee6666',
                        backgroundColor: typeValue === 'B站' ? '#fdd7e3' : 
                                        typeValue === '音频' ? '#d2daef' : '#f8d6d6'
                    });
                    break;
                    
                case 'update':
                    // 更新媒体项信息
                    database.updateFieldValue(dbJson, item.id, '标题', item.title || '未命名');
                    database.updateFieldValue(dbJson, item.id, '链接', item.url || '');
                    
                    // 更新类型
                    const updatedType = item.type === 'bilibili' ? 'B站' : 
                                       (item.type === 'audio' ? '音频' : '视频');
                    database.updateFieldValue(dbJson, item.id, '类型', {
                        text: updatedType,
                        color: updatedType === 'B站' ? '#fa7298' : 
                               updatedType === '音频' ? '#5470c6' : '#ee6666',
                        backgroundColor: updatedType === 'B站' ? '#fdd7e3' : 
                                        updatedType === '音频' ? '#d2daef' : '#f8d6d6'
                    });
                    break;
                    
                case 'delete':
                    // 从数据库中删除
                    database.deleteRow(dbJson, item.id);
                    break;
            }
            
            // 保存更改
            await database.saveDatabaseJson(dbId, dbJson);
        } catch (error) {
            console.error('数据库同步失败:', error);
        }
    }

    // 从数据库同步媒体项
    async function syncMediaItemsFromDatabase() {
        try {
            const config = await configManager.getConfig();
            const dbId = config?.settings?.playlistDbId;
            
            if (!dbId) return;
            
            const dbJson = await database.getDatabaseJson(dbId);
            if (!dbJson?.rows?.length) return;
            
            // 查找默认标签，没有则创建
            const defaultTab = tabs.find(tab => tab.id === 'default');
            if (!defaultTab) return;
            
            // 获取已有项目的ID集合
            const existingIds = new Set((defaultTab.items || []).map(item => item.id));
            
            // 获取需要同步的项目
            const itemsToSync = dbJson.rows.filter(row => !existingIds.has(row.id));
            if (!itemsToSync.length) return;
            
            // 同步新项目到播放列表
            for (const row of itemsToSync) {
                try {
                    const title = database.getFieldValue(dbJson, row.id, '标题') || '未命名';
                    const link = database.getFieldValue(dbJson, row.id, '链接');
                    
                    if (!link) continue;
                    
                    // 解析类型
                    const typeValue = database.getFieldValue(dbJson, row.id, '类型')?.text || '视频';
                    const type = typeValue === 'B站' ? 'bilibili' : 
                                typeValue === '音频' ? 'audio' : 'video';
                    
                    // 创建媒体项
                    const mediaItem = {
                        id: row.id,
                        title: title,
                        url: link,
                        type: type
                    };
                    
                    // 添加到默认标签
                    defaultTab.items = [...defaultTab.items, mediaItem];
                } catch (e) {
                    console.error('同步数据库项目失败:', e);
                }
            }
            
            tabs = [...tabs];
            showMessage(`从数据库同步了 ${itemsToSync.length} 个媒体项`);
        } catch (error) {
            console.error('从数据库同步失败:', error);
        }
    }
</script>

<div class="playlist {className}" class:hidden>
    <!-- 头部导航 -->
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
        <div class="header-controls">
            <span class="playlist-count">{itemCount} {i18n.playList.itemCount}</span>
            <button class="view-mode-btn" on:click={() => sortBy = (sortBy + 1) % 4}
                title={i18n.playList.sortMode?.[sortBy] || ["默认排序", "按名称排序", "按时间排序", "按类型排序"][sortBy]}>
                <svg viewBox="0 0 24 24" width="16" height="16">
                    <path d="M3 18h6v-2H3v2zM3 6v2h18V6H3zm0 7h12v-2H3v2z" />
                </svg>
            </button>
            <button 
                class="view-mode-btn" 
                on:click={toggleViewMode}
                title={i18n.playList.viewMode[viewMode]}
            >
                <svg viewBox="0 0 24 24" width="16" height="16" class={"view-" + viewMode}>
                    <path />
                </svg>
            </button>
        </div>
    </div>
    
    <!-- 标签页 -->
    <PlayListTabs 
        tabs={tabs}
        activeTabId={playlistTabId}
        {i18n}
        {configManager}
        on:tabChange={handleTabChange}
        on:tabsUpdate={handleTabsUpdate}
        on:addMedia={handleAddMedia}
        on:reload={handleReload}
    />
    
    <!-- AList导航条 -->
    {#if playlistTab?.id?.startsWith('alist-') && (playlistTab?.path || playlistTab?.alistPath)}
        <div class="alist-path-nav"><button class="path-item" on:click={() => loadAListDirectory('/')}>{i18n.playList.directory?.root || "根目录"}</button>{#each (playlistTab.alistPathParts || []) as part}<span class="path-sep">/</span><button class="path-item" on:click={() => loadAListDirectory(part.path)}>{part.name}</button>{/each}</div>
    {/if}
    
    <!-- 内容区 -->
    <div class="playlist-content" class:grid-view={viewMode === 'grid' || viewMode === 'grid-single'}>
        {#if playlistTab?.items?.length > 0}
            <div class="playlist-items" class:grid-single={viewMode === 'grid-single'}>
                {#each sortedItems as item (item.id)}
                    <PlayListItem 
                        {item}
                        {currentItem}
                        {i18n}
                        {viewMode}
                        {tabs}
                        on:play={handleMediaItemAction}
                        on:playPart={handleMediaItemAction}
                        on:togglePin={handleMediaItemAction}
                        on:toggleFavorite={handleMediaItemAction}
                        on:remove={handleMediaItemAction}
                        on:moveTo={handleMediaItemAction}
                    />
                {/each}
            </div>
        {:else}
            <div class="playlist-empty">
                {i18n.playList.empty}
            </div>
        {/if}
    </div>
    
    <!-- 底部 -->
    <PlayListFooter 
        {i18n}
        on:addMedia={handleAddMedia}
    />
</div> 