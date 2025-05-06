<script lang="ts">
    // 从"svelte"中导入createEventDispatcher和onMount
    import { createEventDispatcher, onMount } from "svelte";
    // 从"siyuan"中导入showMessage和Menu
    import { showMessage } from "siyuan";
    // 从'../core/types'中导入MediaItem和PlaylistConfig类型
    import type { MediaItem, PlaylistConfig } from '../core/types';
    // 从'../core/media'中导入MediaManager
    import { MediaManager, DEFAULT_THUMBNAILS } from '../core/media';
    // 从'../core/bilibili'中导入BilibiliParser
    import { BilibiliParser } from '../core/bilibili';
    // 从'../core/config'中导入ConfigManager类型
    import type { ConfigManager } from '../core/config';
    // 从'../core/utils'中导入parseMediaLink函数
    import { parseMediaLink } from '../core/utils';
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
    async function handleMediaPlay(item: MediaItem) {
        try {
            // AList文件夹处理
            if (item.source === 'alist' && item.is_dir) {
                    const path = item.sourcePath || '/';
                    const tab = tabs.find(t => t.id === activeTabId);
                    if (!tab) return;
                    
                // 更新路径和文件列表
                    tab.alistPath = path;
                tab.alistPathParts = path.split('/').filter(Boolean).map((part, i, arr) => (
                    { name: part, path: '/' + arr.slice(0, i + 1).join('/') }
                    ));
                
                // 加载文件列表
                const files = await AListManager.listFiles(path);
                    tab.items = [];
                    
                // 处理文件
                    await Promise.all(files.map(async file => {
                        if (AListManager.isMediaFile(file)) {
                            const mediaItem = await AListManager.createMediaItem(file, path);
                            if (mediaItem) tab.items.push(mediaItem);
                        } else if (file.is_dir) {
                            tab.items.push({
                            id: `alist-${Date.now().toString(36)}`,
                                title: file.name,
                                type: 'folder',
                            url: '#', 
                                source: 'alist',
                            sourcePath: `${path === '/' ? '' : path}/${file.name}`,
                                is_dir: true,
                            thumbnail: DEFAULT_THUMBNAILS.folder
                            } as MediaItem);
                        }
                    }));
                    
                    tabs = [...tabs];
                    dispatch('tabsUpdate', { tabs });
                    return;
            }
            
            // 获取配置和准备播放选项
            const config = await configManager.getConfig();
            const playOptions = {
                id: item.id,
                url: item.url,
                title: item.title,
                type: item.type || 'video',
                startTime: item.startTime,
                endTime: item.endTime,
                isLoop: item.isLoop,
                loopCount: item.loopCount,
                bvid: item.bvid,
                cid: item.cid
            };
            
            // 处理不同类型的媒体
            if (item.type === 'bilibili' && item.bvid && item.cid) {
                // 检查B站登录状态
                if (!config.bilibiliLogin?.userInfo?.mid) {
                    showMessage(i18n.playList.error.needBiliLogin || '需要登录B站才能播放视频');
                    return;
                }
                
                // B站视频处理
                const streamInfo = await BilibiliParser.getProcessedVideoStream(
                    item.bvid, item.cid, 0, config
                );
                
                Object.assign(playOptions, {
                    url: streamInfo.mpdUrl || streamInfo.video.url,
                    headers: streamInfo.headers,
                    type: streamInfo.mpdUrl ? 'bilibili-dash' : 'bilibili'
                });
            }
            
            // 触发播放事件并更新当前项
            dispatch('play', playOptions);
            currentItem = item;
            
        } catch (error) {
            console.error(`[播放失败] ${error.message || error}`);
            showMessage(i18n.playList.error.playRetry);
        }
    }

    // 生命周期
    onMount(async () => {
        MediaManager.cleanupCache();
        
        // 初始化
        try {
            await AListManager.initFromConfig(await configManager.getConfig());
        } catch {}
        
        await loadPlaylists();
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
    async function handleMediaAdd(url: string, autoPlay: boolean = true) {
        try {
            // 统一解析媒体链接及参数，使用let而不是const以便后续修改
            let { mediaUrl, startTime, endTime } = parseMediaLink(url);
            
            // 使用现有函数解析B站视频信息
            const biliInfo = parseBiliUrl(mediaUrl);
            const currentBvid = biliInfo?.bvid;
            const currentP = biliInfo?.p;
            
            // 如果是B站视频，检查登录状态
            if (currentBvid) {
                mediaUrl = `https://www.bilibili.com/video/${currentBvid}`;
                
                // 检查B站登录状态
                const config = await configManager.getConfig();
                if (!config.bilibiliLogin?.userInfo?.mid) {
                    showMessage(i18n.playList.error.needBiliLogin || '需要登录B站才能添加视频');
                    return;
                }
            }
            
            // 检查是否已存在
            let existingItem;
            if (currentBvid) {
                // 对于B站视频，仅基于BV号比较
                existingItem = activeTab?.items?.find(item => item.bvid === currentBvid);
            } else {
                // 对于其他类型媒体，使用完整URL比较
                existingItem = activeTab?.items?.find(item => item.url === mediaUrl);
            }
            
            if (existingItem) {
                // 基本参数更新
                const updatedItem = { 
                    ...existingItem, 
                    startTime, 
                    endTime
                } as MediaItem;
                
                // 处理B站分P信息
                if (currentP && currentBvid && existingItem.type === 'bilibili') {
                    try {
                        const parts = await BilibiliParser.getVideoParts({ bvid: currentBvid });
                        const currentPart = parts.find(part => part.page === currentP);
                        
                        if (currentPart) {
                            // 更新分P信息
                            const baseId = existingItem.id.split('-p')[0];
                            updatedItem.id = `${baseId}-p${currentP}`;
                            updatedItem.title = `${existingItem.title.split(' - P')[0]} - P${currentP}${currentPart.part ? ': ' + currentPart.part : ''}`;
                            updatedItem.cid = String(currentPart.cid);
                        }
                    } catch {}
                }
                
                if (autoPlay) await handleMediaPlay(updatedItem);
                return;
            }
            
            // 创建新媒体项并设置参数
            const mediaItem = await MediaManager.createMediaItem(mediaUrl);
            if (!mediaItem) {
                showMessage(i18n.playList.error.cannotParse);
                return;
            }
            
            // 设置参数并添加到播放列表
            Object.assign(mediaItem, { startTime, endTime });
            
            if (activeTab) {
                activeTab.items = [...(activeTab.items || []), mediaItem];
                await savePlaylists();
                
                if (autoPlay) await handleMediaPlay(mediaItem);
                showMessage(i18n.playList.message.added);
            }
        } catch (error) {
            console.error(`[添加媒体失败] ${error.message || error}`);
            showMessage(i18n.playList.error.addMediaFailed);
        }
    }

    /**
     * 处理媒体项操作
     */
    function handleMediaItemAction(event: CustomEvent) {
        const { item } = event.detail;
        const action = event.type;
        
        // 使用映射表替代switch语句
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
                const favoritesTab = tabs.find(t => t.id === 'favorites');
                const activeTab = tabs.find(t => t.id === activeTabId);
                if (!favoritesTab || !activeTab) return;
                
                if (!item.isFavorite) {
                    favoritesTab.items = [...(favoritesTab.items || []), { ...item, isFavorite: true }];
                } else {
                    favoritesTab.items = favoritesTab.items.filter(i => i.id !== item.id);
                }
                
                activeTab.items = activeTab.items.map(i => 
                    i.id === item.id ? { ...i, isFavorite: !i.isFavorite } : i
                );
                
                tabs = [...tabs];
            },
            
            remove: () => {
                const currentTab = tabs.find(t => t.id === activeTabId);
                if (!currentTab) return;
                
                // 从当前标签页移除项目
                currentTab.items = currentTab.items.filter(i => i.id !== item.id);
                
                // 如果是收藏项，也从收藏夹移除
                if (item.isFavorite) {
                    const favTab = tabs.find(t => t.id === 'favorites');
                    if (favTab) {
                        favTab.items = favTab.items.filter(i => i.id !== item.id);
                    }
                }
                
                tabs = [...tabs];
            }
        };
        
        // 执行对应操作
        if (actions[action]) actions[action]();
    }

    // 事件处理函数
    const handleTabChange = (event) => activeTabId = event.detail.tabId;
    const handleTabsUpdate = (event) => tabs = event.detail.tabs;
    const handleAddMedia = (event) => handleMediaAdd(event.detail.url, event.detail.options?.autoPlay);
    
    /**
     * 处理外部媒体项
     */
    export async function handleMediaItem(mediaItem: MediaItem) {
        // 检查媒体项是否有效
        if (!mediaItem || !activeTab) return;
        
        // 提取BV号
        const currentBvid = mediaItem.bvid;
        
        // 查找已存在项
        let existingItem;
        if (currentBvid) {
            // B站视频根据BV号查找
            existingItem = activeTab.items.find(item => item.bvid === currentBvid);
        } else {
            // 其他媒体根据URL查找
            existingItem = activeTab.items.find(item => 
                item.url === mediaItem.url
            );
        }
        
        if (existingItem) {
            // 更新已存在项的参数
            const updatedItem = {
                ...existingItem,
                startTime: mediaItem.startTime,
                endTime: mediaItem.endTime,
                isLoop: mediaItem.isLoop,
                loopCount: mediaItem.loopCount
            };
            
            // 处理B站分P信息
            if (currentBvid && mediaItem.cid && existingItem.cid !== mediaItem.cid) {
                Object.assign(updatedItem, {
                    id: mediaItem.id,
                    title: mediaItem.title,
                    cid: mediaItem.cid
                });
            }
            
            await handleMediaPlay(updatedItem);
            showMessage(i18n.playList.message.existingItemPlay);
        } else {
            // 添加新项并播放
            activeTab.items = [...activeTab.items, mediaItem];
            tabs = [...tabs];
            await handleMediaPlay(mediaItem);
            showMessage(i18n.playList.message.added);
        }
    }

    /**
     * 导出方法：添加项到播放列表
     */
    export function addItem(item: MediaItem) {
        items = [...items, item];
    }

    /**
     * 导出方法：添加媒体
     */
    export function addMedia(url: string, options?: { autoPlay?: boolean }) {
        handleMediaAdd(url, options?.autoPlay !== false);
    }

    // 切换视图模式
    function toggleViewMode() {
        const modes: ('detailed' | 'compact' | 'grid' | 'grid-single')[] = ['detailed', 'compact', 'grid', 'grid-single'];
        const currentIndex = modes.indexOf(viewMode);
        viewMode = modes[(currentIndex + 1) % modes.length];
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
                        on:play={handleMediaItemAction}
                        on:playPart={handleMediaItemAction}
                        on:togglePin={handleMediaItemAction}
                        on:toggleFavorite={handleMediaItemAction}
                        on:remove={handleMediaItemAction}
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