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
    // 从'../core/utils'中导入parseMediaLink函数
    import { parseMediaLink } from '../core/utils';
    // 导入子组件
    import PlayListTabs from './Playlist/PlayListTabs.svelte';
    import PlayListItem from './Playlist/PlayListItem.svelte';
    import PlayListFooter from './Playlist/PlayListFooter.svelte';

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
            // 获取配置和准备播放选项
            const config = await configManager.getConfig();
            const playOptions = {
                id: item.id,
                url: item.url,
                title: item.title,
                originalUrl: item.originalUrl || item.url,
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
                originalUrl: item.originalUrl,
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
            // 解析媒体链接
            const { mediaUrl, startTime, endTime } = parseMediaLink(url);
            
            // 检查是否已存在
            const existingItem = activeTab?.items?.find(item => item.url === mediaUrl);
            if (existingItem) {
                // 更新已存在项的参数并播放
                const updatedItem = { 
                    ...existingItem, 
                    startTime, 
                    endTime, 
                    originalUrl: url 
                } as MediaItem;
                
                if (autoPlay) {
                    await handleMediaPlay(updatedItem);
                }
                return;
            }
            
            // 创建新媒体项
            const mediaItem = await MediaManager.createMediaItem(mediaUrl);
            if (!mediaItem) {
                showMessage(i18n.playList.error.cannotParse);
                return;
            }
            
            // 设置参数
            if (startTime !== undefined) mediaItem.startTime = startTime;
            if (endTime !== undefined) mediaItem.endTime = endTime;
            mediaItem.originalUrl = url;
            
            // 添加到播放列表
            if (activeTab) {
                activeTab.items = [...(activeTab.items || []), mediaItem];
                await savePlaylists();
                
                // 如果需要自动播放
                if (autoPlay) {
                    await handleMediaPlay(mediaItem);
                }
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
        // 查找完全匹配的项（包括时间参数）
        const existingItem = activeTab?.items?.find(item => {
            const urlMatch = item.url === mediaItem.url || item.originalUrl === mediaItem.originalUrl;
            const timeMatch = mediaItem.startTime === item.startTime && mediaItem.endTime === item.endTime;
            return urlMatch && timeMatch;
        });

        if (existingItem) {
            // 如果找到完全匹配的项，直接播放
            await handleMediaPlay(existingItem);
            showMessage(i18n.playList.message.existingItemPlay);
        } else {
            // 查找仅URL匹配的项
            const urlMatchItem = activeTab?.items?.find(item => 
                item.url === mediaItem.url || item.originalUrl === mediaItem.originalUrl
            );

            if (urlMatchItem) {
                // 如果找到URL匹配的项，更新其时间参数并播放
                const updatedItem = {
                    ...urlMatchItem,
                    startTime: mediaItem.startTime,
                    endTime: mediaItem.endTime,
                    isLoop: mediaItem.isLoop,
                    loopCount: mediaItem.loopCount
                };
                await handleMediaPlay(updatedItem);
                showMessage(i18n.playList.message.existingItemPlay);
            } else {
                // 如果没找到匹配项，添加到播放列表并播放
                const tab = tabs.find(t => t.id === activeTabId);
                if (!tab) {
                    showMessage(i18n.playList.error.noActiveTab);
                    return;
                }
                tab.items = [...(tab.items || []), mediaItem];
                tabs = [...tabs];
                await handleMediaPlay(mediaItem);
                showMessage(i18n.playList.message.added);
            }
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
    <div class="playlist-content" class:grid-view={viewMode === 'grid' || viewMode === 'grid-single'}>
        {#if activeTab?.items?.length > 0}
            <div class="playlist-items" class:grid-single={viewMode === 'grid-single'}>
                {#each activeTab.items as item (item.id)}
                    <PlayListItem 
                        {item}
                        {currentItem}
                        {tabs}
                        {activeTabId}
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