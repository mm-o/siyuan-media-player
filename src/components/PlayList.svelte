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
    import { BilibiliParser } from '../core/bilibili';
    // 从'../core/config'中导入ConfigManager类型
    import type { ConfigManager } from '../core/config';
    // 导入url工具
    import { url } from '../core/utils';
    // 从'../core/biliUtils'中导入parseBiliUrl函数
    import { parseBiliUrl } from '../core/biliUtils';
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

    /**
     * 处理媒体播放
     */
    export async function handleMediaPlay(item: MediaItem) {
        try {
            // 处理目录导航
            if (item.action === 'navigateToTab' && item.targetTabId) {
                playlistTabId = item.targetTabId;
                dispatch('tabChange', { tabId: item.targetTabId });
                return;
            }
            
            // 处理AList目录打开
            if (item.is_dir && item.source === 'alist' && item.sourcePath) {
                await loadAListDirectory(item.sourcePath);
                return;
            }
            
            // 处理媒体播放
            const config = await configManager.getConfig();
            const playOptions = {
                ...item,
                type: item.type || 'video',
            };
            
            // 处理B站视频
            if (item.type === 'bilibili' && item.bvid && item.cid) {
                if (!config.bilibiliLogin?.userInfo?.mid) {
                    showMessage(i18n.playList.error.needBiliLogin || '需要登录B站才能播放视频');
                    return;
                }
                
                const streamInfo = await BilibiliParser.getProcessedVideoStream(
                    item.bvid, item.cid, 0, config
                );
                
                // 获取B站dash信息
                if (streamInfo.dash) {
                    // 直接使用B站dash格式
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

    /**
     * 处理媒体添加
     */
    async function handleMediaAdd(mediaUrl: string, autoPlay = true, options: any = {}) {
        try {
            // 处理AList媒体添加
            if (options.source === 'alist' && options.sourcePath) {
                if (options.is_dir) {
                    await loadAListDirectory(options.sourcePath);
                    return;
                }
                
                const mediaItem = await AListManager.createMediaItemFromPath(options.sourcePath, {
                    startTime: options.startTime,
                    endTime: options.endTime
                });
                
                if (autoPlay) {
                    dispatch('play', mediaItem);
                    currentItem = mediaItem;
                }
                return;
            }
            
            // 仅接受特定类型的媒体URL
            // 本地文件路径 (file://) 只允许从文件选择器添加
            if ((mediaUrl.startsWith('file://') && !options.fromFileSelector) || 
                (!mediaUrl.startsWith('file://') && 
                !mediaUrl.startsWith('http://') && 
                !mediaUrl.startsWith('https://') &&
                !mediaUrl.includes('bilibili.com') && 
                !mediaUrl.includes('b23.tv'))) {
                showMessage(i18n.playList.error.invalidMediaLink || "不支持的媒体链接格式");
                return;
            }
            
            if (playlistTab?.id.startsWith('alist-')) {
                // 只有当前是AList标签时，才转到默认标签
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
            
            // 处理普通链接和B站链接
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
            
            let existingItem = findExistingItem(mediaUrl, currentBvid);
            
            if (existingItem) {
                const updatedItem = { ...existingItem, startTime, endTime } as MediaItem;
                
                if (currentP && currentBvid && existingItem.type === 'bilibili') {
                    await updateBiliPart(updatedItem, currentBvid, currentP);
                }
                
                if (autoPlay) await handleMediaPlay(updatedItem);
                return;
            }
            
            const mediaItem = await MediaManager.createMediaItem(mediaUrl);
            if (!mediaItem) {
                showMessage(i18n.playList.error.cannotParse);
                return;
            }
            
            Object.assign(mediaItem, { startTime, endTime });
            
            if (playlistTab) {
                playlistTab.items = [...(playlistTab.items || []), mediaItem];
                await savePlaylists();
                
                if (autoPlay) await handleMediaPlay(mediaItem);
                showMessage(i18n.playList.message.added);
            }
        } catch (error) {
            showMessage(i18n.playList.error.addMediaFailed);
        }
    }
    
    /**
     * 查找已存在的媒体项
     */
    function findExistingItem(mediaUrl, bvid) {
        if (!playlistTab?.items?.length) return;
        if (bvid) return playlistTab.items.find(i => i.bvid === bvid);
        const clean = url.parseTime(mediaUrl).mediaUrl.split('?')[0];
        return playlistTab.items.find(i => (i.url?.split('?')[0] || '') === clean);
    }
    
    /**
     * 更新B站视频分P信息
     */
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

    /**
     * 处理媒体项操作
     */
    function handleMediaItemAction(event: CustomEvent) {
        const action = event.type;
        const { item } = event.detail;
        
        if (action === 'play') {
            handleMediaPlay(item);
        } else if (action === 'playPart') {
            handleMediaPlay(event.detail.item);
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
        } else if (action === 'remove') {
            if (!playlistTab) return;
            
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
            
            // 移动项目
            targetTab.items = [...targetTab.items, { ...item }];
            playlistTab.items = playlistTab.items.filter(i => i.id !== item.id);
            tabs = [...tabs];
            savePlaylists();
            
            // 如果是从目录标签点击移动到，则自动跳转到目标标签
            if (playlistTab.id === DIRECTORY_TAB_ID) {
                playlistTabId = tabId;
                dispatch('tabChange', { tabId });
            }
            
            showMessage(i18n.playList.message.itemMoved?.replace('${name}', targetTab.name) || `已移动到 ${targetTab.name}`);
        }
    }

    // 事件处理函数
    const handleTabChange = (event) => playlistTabId = event.detail.tabId;
    const handleTabsUpdate = (event) => tabs = event.detail.tabs;
    const handleAddMedia = (event) => {
        const { url, options = {} } = event.detail;
        handleMediaAdd(url, options.autoPlay !== false, options);
    };
    const handleReload = () => loadPlaylists();
    
    /**
     * 处理外部媒体项
     */
    export async function handleMediaItem(mediaItem: MediaItem) {
        if (!mediaItem || !playlistTab) return;
        
        let existingItem = findExistingItem(mediaItem.url, mediaItem.bvid);
        
        if (existingItem) {
            const updatedItem = {
                ...existingItem,
                startTime: mediaItem.startTime,
                endTime: mediaItem.endTime,
                isLoop: mediaItem.isLoop,
                loopCount: mediaItem.loopCount
            };
            
            if (mediaItem.bvid && mediaItem.cid && existingItem.cid !== mediaItem.cid) {
                Object.assign(updatedItem, {
                    id: mediaItem.id,
                    title: mediaItem.title,
                    cid: mediaItem.cid
                });
            }
            
            await handleMediaPlay(updatedItem);
            showMessage(i18n.playList.message.existingItemPlay);
        } else {
            playlistTab.items = [...playlistTab.items, mediaItem];
            tabs = [...tabs];
            await handleMediaPlay(mediaItem);
            showMessage(i18n.playList.message.added);
        }
    }

    // 导出方法
    export function addItem(item: MediaItem) {
        items = [...items, item];
    }

    export function addMedia(url: string, options?: { autoPlay?: boolean }) {
        handleMediaAdd(url, options?.autoPlay !== false);
    }

    // 播放下一个媒体
    export function playNext() {
        if (!playlistTab?.items?.length || !currentItem) return false;
        
        // B站视频分P处理
        if (currentItem.type === 'bilibili' && currentItem.bvid) {
            const currPart = parseInt(currentItem.id?.match(/-p(\d+)/)?.[1] || '1', 10);
            
            // 检查是否有分P信息
            return playNextBiliPart(currentItem, currPart);
        }
        
        // 常规列表项目处理
        const idx = playlistTab.items.findIndex(i => i.id === currentItem.id || i.url === currentItem.url);
        if (idx >= 0) {
            handleMediaPlay(playlistTab.items[(idx + 1) % playlistTab.items.length]);
            return true;
        }
        return false;
    }
    
    // 播放B站视频的下一个分P
    async function playNextBiliPart(item, currPart) {
        try {
            const parts = await BilibiliParser.getVideoParts({ bvid: item.bvid });
            if (!parts || !parts.length) return false;
            
            // 找到下一个分P
            const nextPart = parts.find(p => p.page === currPart + 1);
            if (nextPart) {
                // 创建下一个分P的媒体项
                const nextItem = { ...item };
                await updateBiliPart(nextItem, item.bvid, currPart + 1);
                handleMediaPlay(nextItem);
                return true;
            } else if (configManager && configManager.getConfig() && configManager.getConfig().settings.loop) {
                // 如果是最后一个分P且启用了循环，则回到第一个分P
                const nextItem = { ...item };
                await updateBiliPart(nextItem, item.bvid, 1);
                handleMediaPlay(nextItem);
                return true;
            }
        } catch (error) {
            console.error("切换B站分P失败:", error);
        }
        return false;
    }

    // 切换视图模式
    function toggleViewMode() {
        const modes = ['detailed', 'compact', 'grid', 'grid-single'] as const;
        viewMode = modes[(modes.indexOf(viewMode) + 1) % modes.length];
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