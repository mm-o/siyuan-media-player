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
    
    // 组件状态
    let tabs: PlaylistConfig[] = [];
    let activeTabId = 'default';
    let viewMode: 'detailed' | 'compact' | 'grid' | 'grid-single' = 'detailed';
    
    // 计算属性
    $: activeTab = tabs.find(tab => tab.id === activeTabId);
    $: itemCount = activeTab?.items?.length || 0;
    
    // 事件分发器
    const dispatch = createEventDispatcher();

    /**
     * 处理媒体播放
     */
    export async function handleMediaPlay(item: MediaItem) {
        try {
            if (item.source === 'alist' && item.is_dir) {
                await loadAListDirectory(item.sourcePath);
                return;
            }
            
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
                
                Object.assign(playOptions, {
                    url: streamInfo.mpdUrl || streamInfo.video.url,
                    headers: streamInfo.headers,
                    type: streamInfo.mpdUrl ? 'bilibili-dash' : 'bilibili'
                });
            }
            
            dispatch('play', playOptions);
            currentItem = item;
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
            
            alistTab = Object.assign(alistTab, {
                alistPath: path,
                alistPathParts: path.split('/').filter(Boolean)
                    .map((part, i, arr) => ({ 
                        name: part, 
                        path: '/' + arr.slice(0, i + 1).join('/') 
                    }))
            });
            
            activeTabId = alistTab.id;
            dispatch('tabChange', { tabId: alistTab.id });
            
            alistTab.items = await AListManager.createMediaItemsFromDirectory(path);
            tabs = [...tabs];
            dispatch('tabsUpdate', { tabs });
        } catch (error) {
            console.error("获取AList媒体列表失败:", error);
            showMessage(i18n.playList.error.loadFailed);
        }
    }

    // 生命周期
    onMount(async () => {
        MediaManager.cleanupCache();
        try { await AListManager.initFromConfig(await configManager.getConfig()); } catch {}
        
        await loadPlaylists();

        // 添加外部API事件监听
        window.addEventListener('addMediaToPlaylist', (e: any) => {
            const { url, autoPlay = true, ...options } = e.detail || {};
            url && handleMediaAdd(url, autoPlay, options);
        });
    });

    // 监听变化
    $: if (tabs.length > 0) {
        savePlaylists();
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
    }

    /**
     * 保存播放列表
     */
    function savePlaylists() {
        const playlistsToSave = tabs.map(tab => ({
            id: tab.id,
            name: tab.name,
            isFixed: tab.isFixed,
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
            
            if (activeTab?.id.startsWith('alist-')) {
                showMessage("非AList媒体将添加到默认标签");
                activeTabId = 'default';
                dispatch('tabChange', { tabId: 'default' });
                
                if (autoPlay) {
                    setTimeout(() => handleMediaAdd(mediaUrl, true, options), 100);
                }
                return;
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
            
            if (activeTab) {
                activeTab.items = [...(activeTab.items || []), mediaItem];
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
        if (!activeTab?.items?.length) return;
        if (bvid) return activeTab.items.find(i => i.bvid === bvid);
        const clean = url.parseTime(mediaUrl).mediaUrl.split('?')[0];
        return activeTab.items.find(i => (i.url?.split('?')[0] || '') === clean);
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
        const { item } = event.detail;
        const action = event.type;
        
        const actions = {
            play: () => handleMediaPlay(item),
            
            playPart: () => handleMediaPlay(item),
            
            togglePin: () => {
                const tab = tabs.find(t => t.id === activeTabId);
                if (!tab) return;
                
                const updatedItems = tab.items.map(i => 
                    i.id === item.id ? { ...i, isPinned: !i.isPinned } : i
                );
                
                tab.items = [
                    ...updatedItems.filter(i => i.isPinned),
                    ...updatedItems.filter(i => !i.isPinned)
                ];
                tabs = [...tabs];
            },
            
            toggleFavorite: () => {
                const favTab = tabs.find(t => t.id === 'favorites');
                const activeTab = tabs.find(t => t.id === activeTabId);
                if (!favTab || !activeTab) return;
                
                if (!item.isFavorite) {
                    favTab.items = [...(favTab.items || []), { ...item, isFavorite: true }];
                } else {
                    favTab.items = favTab.items.filter(i => i.id !== item.id);
                }
                
                activeTab.items = activeTab.items.map(i => 
                    i.id === item.id ? { ...i, isFavorite: !i.isFavorite } : i
                );
                
                tabs = [...tabs];
            },
            
            remove: () => {
                const currentTab = tabs.find(t => t.id === activeTabId);
                if (!currentTab) return;
                
                currentTab.items = currentTab.items.filter(i => i.id !== item.id);
                
                if (item.isFavorite) {
                    const favTab = tabs.find(t => t.id === 'favorites');
                    if (favTab) {
                        favTab.items = favTab.items.filter(i => i.id !== item.id);
                    }
                }
                
                tabs = [...tabs];
            },
            
            moveTo: () => {
                const { tabId } = event.detail;
                const currentTab = tabs.find(t => t.id === activeTabId);
                const targetTab = tabs.find(t => t.id === tabId);
                
                if (!currentTab || !targetTab || currentTab === targetTab) return;
                
                // 移动项目
                targetTab.items = [...targetTab.items, { ...item }];
                currentTab.items = currentTab.items.filter(i => i.id !== item.id);
                tabs = [...tabs];
                
                showMessage(i18n.playList.message.itemMoved?.replace('${name}', targetTab.name) || `已移动到 ${targetTab.name}`);
            }
        };
        
        if (actions[action]) actions[action]();
    }

    // 事件处理函数
    const handleTabChange = (event) => activeTabId = event.detail.tabId;
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
        if (!mediaItem || !activeTab) return;
        
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
            activeTab.items = [...activeTab.items, mediaItem];
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

    // 切换视图模式
    function toggleViewMode() {
        const modes = ['detailed', 'compact', 'grid', 'grid-single'] as const;
        viewMode = modes[(modes.indexOf(viewMode) + 1) % modes.length];
    }
</script>

<div class="playlist {className}" class:hidden>
    <!-- 头部 -->
    <div class="playlist-header">
        <h3>{i18n.playList.title}</h3>
        <div class="header-controls">
            <span class="playlist-count">{itemCount} {i18n.playList.itemCount}</span>
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
        {tabs}
        {activeTabId}
        {i18n}
        {configManager}
        on:tabChange={handleTabChange}
        on:tabsUpdate={handleTabsUpdate}
        on:addMedia={handleAddMedia}
        on:reload={handleReload}
    />
    
    <!-- 内容区 -->
    <div class="playlist-content" class:grid-view={viewMode === 'grid' || viewMode === 'grid-single'} style="margin-top: 0;">
        {#if activeTab?.items?.length > 0}
            <div class="playlist-items" class:grid-single={viewMode === 'grid-single'}>
                {#each activeTab.items as item (item.id)}
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