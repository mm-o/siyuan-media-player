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
    // 导入三个模块（从新的文件路径导入）
    import { PlaylistInput } from './PlayList/PlaylistInput';
    import { PlaylistTabs } from './PlayList/PlaylistTabs';
    import { PlaylistItems } from './PlayList/PlaylistItems';

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
    let isAddingTab = false;
    let inputValue = '';
    let inputMode: 'normal' | 'localFolder' | 'bilibiliFavorites' = 'normal';
    
    // 计算属性
    $: activeTab = tabs.find(tab => tab.id === activeTabId);
    $: itemCount = activeTab?.items?.length || 0;
    
    // 事件分发器
    const dispatch = createEventDispatcher<{
        select: MediaItem;
        play: {
            url: string;
            audioUrl?: string;
            headers?: any;
            originalUrl?: string;
            startTime?: number;
            endTime?: number;
            isLoop?: boolean;
            loopCount?: number;
            type?: string;
            bvid?: string;
            title?: string;
        };
    }>();

    // 模块实例
    let playlistInput: PlaylistInput;
    let playlistTabs: PlaylistTabs;
    let playlistItems: PlaylistItems;
    
    /**
     * 处理媒体播放
     */
    async function handleMediaPlay(item: MediaItem) {
        try {
            const config = await configManager.getConfig();
            let playOptions: any = {};
            
            if (item.type === 'bilibili' && item.bvid && item.cid) {
                const streamInfo = await BilibiliParser.getProcessedVideoStream(
                    item.bvid,
                    item.cid,
                    0,
                    config
                );
                
                playOptions = {
                    url: streamInfo.mpdUrl || streamInfo.video.url,
                    headers: streamInfo.headers,
                    title: item.title,
                    originalUrl: item.originalUrl || item.url,
                    type: streamInfo.mpdUrl ? 'bilibili-dash' : 'bilibili'
                };
            } else {
                playOptions = {
                    url: item.url,
                    title: item.title,
                    originalUrl: item.originalUrl || item.url,
                    type: item.type || 'video'
                };
            }
            
            playOptions = {
                ...playOptions,
                startTime: item.startTime,
                endTime: item.endTime,
                isLoop: item.startTime !== undefined && item.endTime !== undefined
            };
            
            dispatch('play', playOptions);
            currentItem = item;
            playlistItems.setCurrentItem(item);
            
        } catch (error) {
            console.error("[Playlist] " + i18n.playList.error.playFailed, error);
            showMessage(i18n.playList.error.playRetry);
        }
    }

    // 生命周期
    onMount(async () => {
        // 清理过期缓存
        MediaManager.cleanupCache();
        
        // 初始化标签页管理器
        playlistTabs = new PlaylistTabs(
            i18n,
            (data) => {
                // 更新UI状态
                tabs = data.tabs;
                activeTabId = data.activeTabId;
                isAddingTab = data.isAddingTab;
                inputMode = data.inputMode as any;
            },
            configManager
        );
        
        // 初始化媒体项管理器
        playlistItems = new PlaylistItems(
            i18n,
            () => tabs,
            () => activeTabId,
            (tabId) => playlistTabs.findTab(tabId),
            (updatedTabs) => {
                tabs = updatedTabs;
                savePlaylists();
            },
            handleMediaPlay
        );
        
        // 初始化播放列表输入处理器
        playlistInput = new PlaylistInput(
            i18n, 
            handleMediaPlay, 
            () => playlistTabs.getActiveTab(), 
            savePlaylists
        );
        
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
        const loadedTabs = await Promise.all(
            config.playlists.map(async tab => ({
                ...tab,
                items: await MediaManager.createMediaItems(tab.items || [])
            }))
        );
        playlistTabs.setTabs(loadedTabs);
    }

    /**
     * 保存播放列表
     */
    function savePlaylists() {
        const playlistsToSave = tabs.map(tab => ({
            id: tab.id,
            name: tab.name,
            isFixed: tab.isFixed,
            items: tab.items && MediaManager.getMediaInfoFromItems(tab.items)
        }));
        configManager.updatePlaylists(playlistsToSave);
    }

    /**
     * 处理提交
     */
    export async function handleSubmit(externalUrl?: string) {
        const url = externalUrl || inputValue.trim();
        await playlistInput.handleSubmit(url, externalUrl ? undefined : {value: inputValue});
        // 清空输入框
        inputValue = '';
    }

    /**
     * 处理外部链接传入的媒体项
     */
    export async function handleMediaItem(mediaItem: MediaItem) {
        await playlistInput.handleMediaItem(mediaItem);
    }

    /**
     * 添加媒体项到播放列表
     */
    export function addItem(item: MediaItem) {
        if (activeTab) {
            playlistTabs.addMediaItemToTab(activeTab.id, item);
        }
    }

    // UI处理函数
    function handleTabClick(tabId: string) {
        playlistTabs.setActiveTabId(tabId);
    }

    function handleTabContextMenu(event: MouseEvent, tab: PlaylistConfig) {
        playlistTabs.showContextMenu(event, tab);
    }

    function handleAddTabClick() {
        playlistTabs.add();
    }

    function handleAddTabContextMenu(event: MouseEvent) {
        playlistTabs.createAddTabMenu(event);
    }

    function handleTabInputBlur(event: FocusEvent, tab?: PlaylistConfig) {
        playlistTabs.save(event, tab);
    }

    function handleTabInputKeydown(event: KeyboardEvent, tab?: PlaylistConfig) {
        playlistTabs.save(event, tab);
    }

    function handleItemClick(item: MediaItem) {
        playlistItems.handleItemClick(item);
    }

    function handleItemContextMenu(event: MouseEvent, item: MediaItem) {
        playlistItems.showContextMenu(event, item);
    }

    function handlePartClick(item: MediaItem, part: any) {
        playlistItems.playVideoPart(item, part);
    }

    function isPlaying(item: MediaItem) {
        return playlistItems.isPlaying(item);
    }

    function isPartPlaying(item: MediaItem, part: any) {
        return playlistItems.isPartPlaying(item, part);
    }

    function isExpanded(item: MediaItem) {
        return playlistItems.isExpanded(item);
    }

    function getVideoParts(item: MediaItem) {
        return playlistItems.getVideoParts(item);
    }
</script>

<div class="playlist {className}" class:hidden>
    <!-- Header -->
    <div class="playlist-header">
        <h3>{i18n.playList.title}</h3>
        <span class="playlist-count">{itemCount} {i18n.playList.itemCount}</span>
    </div>
    
    <!-- Tabs -->
    <div class="playlist-tabs">
        {#each tabs as tab (tab.id)}
            {#if tab.isEditing}
                <div class="tab-edit-wrapper">
                    <input
                        id="tab-edit-{tab.id}"
                        type="text"
                        class="tab-input"
                        value={tab.name}
                        on:blur={(e) => handleTabInputBlur(e, tab)}
                        on:keydown={(e) => handleTabInputKeydown(e, tab)}
                    />
                </div>
            {:else}
                <button 
                    class="tab" 
                    class:active={activeTabId === tab.id}
                    on:click={() => handleTabClick(tab.id)}
                    on:contextmenu|preventDefault={(e) => handleTabContextMenu(e, tab)}
                >
                    {tab.name}
                </button>
            {/if}
        {/each}
        
        <div class="tab-add-wrapper">
            {#if isAddingTab}
                <input
                    type="text"
                    class="tab-input"
                    style="width: 100px; max-width: 100px;"
                    placeholder={inputMode === 'localFolder' ? i18n.playList.placeholder.folderPath : inputMode === 'bilibiliFavorites' ? i18n.playList.placeholder.bilibiliFavorites : i18n.playList.placeholder.newTab}
                    on:blur={handleTabInputBlur}
                    on:keydown={handleTabInputKeydown}
                />
            {:else}
                <button 
                    class="tab tab-add" 
                    on:click={handleAddTabClick}
                    on:contextmenu|preventDefault={handleAddTabContextMenu}
                >+</button>
            {/if}
        </div>
    </div>
    
    <!-- Content -->
    <div class="playlist-content">
        {#if activeTab && activeTab.items && activeTab.items.length > 0}
            <div class="playlist-items">
                {#each activeTab.items as item (item.id)}
                    <div 
                        class="playlist-item {isPlaying(item) ? 'playing' : ''}" 
                        on:click={() => handleItemClick(item)}
                        on:contextmenu|preventDefault={(e) => handleItemContextMenu(e, item)}
                    >
                        <div class="item-content">
                            <div class="item-thumbnail">
                                <img src={item.thumbnail || '/plugins/siyuan-media-player/thumbnails/default.svg'} alt={item.title} />
                                {#if item.duration}
                                    <div class="duration">{item.duration}</div>
                                {/if}
                            </div>
                            <div class="item-info">
                                <div class="item-title">{item.title}</div>
                                {#if item.artist}
                                    <div class="item-artist">
                                        {#if item.artistIcon}
                                            <img class="artist-icon" src={item.artistIcon} alt={item.artist} />
                                        {/if}
                                        <span>{item.artist}</span>
                                    </div>
                                {/if}
                                {#if item.url}
                                    <div class="item-url">{item.url}</div>
                                {/if}
                            </div>
                        </div>
                        
                        <!-- 分P列表 - 均匀排列 -->
                        {#if isExpanded(item) && getVideoParts(item)?.length > 1}
                            <div class="item-parts">
                                {#each getVideoParts(item) as part}
                                    <button 
                                        class="part-item {isPartPlaying(item, part) ? 'playing' : ''}" 
                                        on:click|stopPropagation={() => handlePartClick(item, part)}
                                        title="{part.part || `P${part.page}`}"
                                    >
                                        {part.page}
                                    </button>
                                {/each}
                            </div>
                        {/if}
                    </div>
                {/each}
            </div>
        {:else}
            <div class="playlist-empty">
                {i18n.playList.empty}
            </div>
        {/if}
    </div>
    
    <!-- Footer -->
    <div class="playlist-footer">
        <div class="input-wrapper">
            <input 
                type="text" 
                class="tab-input playlist-input" 
                placeholder={i18n.playList.placeholder.mediaLink}
                bind:value={inputValue}
                on:keydown={(e) => e.key === 'Enter' && handleSubmit()}
            />
            {#if inputValue}
                <span class="clear-icon" on:click={() => inputValue = ''}>×</span>
            {/if}
        </div>
        <button 
            class="add-btn" 
            on:click={() => inputValue && handleSubmit()}
        >
            {i18n.playList.action.add}
        </button>
    </div>
</div> 