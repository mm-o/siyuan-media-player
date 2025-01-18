<script lang="ts">
    import { createEventDispatcher, onMount } from "svelte";
    import { showMessage } from "siyuan";
    import type { MediaItem, Config, PlaylistConfig } from '../core/types';
    import { MediaManager } from '../core/media';
    import { Menu } from "siyuan";
    import { BilibiliParser } from '../core/bilibili';
    import type { ConfigManager } from '../core/config';
    
    // Props
    export let items: MediaItem[] = [];
    export let currentItem: MediaItem | null = null;
    export let configManager: ConfigManager;
    
    // State
    let tabs: PlaylistConfig[] = [];
    let activeTabId = 'default';
    let isAddingTab = false;
    let inputValue = '';
    let newTabInput: HTMLInputElement;
    
    // Computed
    $: activeTab = tabs.find(tab => tab.id === activeTabId);
    $: itemCount = activeTab?.items?.length || 0;
    
    // Event dispatcher
    const dispatch = createEventDispatcher<{
        select: MediaItem;
        play: MediaItem;
        remove: MediaItem;
        tabChange: string;
        addMedia: { tabId: string; url: string; };
    }>();

    // 点击计时器和最后点击的项目
    let clickTimer: number;
    let lastClickedItem: string | null = null;
    
    /**
     * 处理列表项点击
     * 单击选中项目，双击播放媒体
     */
    async function handleItemClick(item: MediaItem) {
        if (lastClickedItem === item.id) {
            // 双击：播放
            clearTimeout(clickTimer);
            lastClickedItem = null;
            
            try {
                // 如果是B站视频，获取播放流
                if (item.type === 'bilibili' && item.bvid && item.cid) {
                    const config = await configManager.getConfig();
                    const streamInfo = await BilibiliParser.getProcessedVideoStream(
                        item.bvid,
                        item.cid,
                        0,
                        config
                    );

                    const biliMediaItem: MediaItem = {
                        ...item,
                        url: streamInfo.video.url,
                        audioUrl: streamInfo.audio?.url,
                        headers: streamInfo.headers
                    };
                    
                    // 创建播放选项，确保包含所有必要信息
                    const playOptions = {
                        type: 'bilibili',
                        bvid: biliMediaItem.bvid,
                        originalUrl: biliMediaItem.originalUrl || biliMediaItem.url,
                        audioUrl: biliMediaItem.audioUrl,
                        headers: biliMediaItem.headers,  // 传递请求头
                        title: biliMediaItem.title,
                        autoplay: config.settings?.autoplay,
                        startTime: 0
                    };
                    
                    dispatch('play', {
                        ...biliMediaItem,
                        playOptions  // 添加播放选项
                    });
                    return;
                }
                
                // 非B站视频直接播放
                dispatch('play', item);
            } catch (err) {
                console.error('[PlayList] B站视频流获取失败:', err);
                showMessage('获取视频流失败');
            }
        } else {
            // 单击：选中项目并等待可能的第二次点击
            lastClickedItem = item.id;
            clickTimer = window.setTimeout(() => {
                dispatch('select', item);
                lastClickedItem = null;
            }, 300); // 300ms内的第二次点击视为双击
        }
    }

    // Lifecycle
    onMount(async () => {
        // 清理过期缓存
        MediaManager.cleanupCache();
        await loadPlaylists();
    });

    // Watch for changes
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
        tabs = loadedTabs;
    }

    /**
     * 保存播放列表
     */
    function savePlaylists() {
        const playlistsToSave = tabs.map(tab => ({
            id: tab.id,
            name: tab.name,
            isFixed: tab.isFixed,
            items: MediaManager.getMediaInfoFromItems(tab.items || [])
        }));
        configManager.updatePlaylists(playlistsToSave);
    }

    /**
     * 添加媒体到播放列表
     * 支持普通媒体文件和B站视频
     */
    async function addMediaToPlaylist(url: string) {
        if (!url) return;
        
        try {
            // 创建媒体项（会自动识别B站视频）
            const mediaItem = await MediaManager.createMediaItem(url);
            if (!mediaItem) {
                showMessage('无法解析媒体文件');
                return;
            }
            
            // 如果是B站视频，打印视频基本信息
            if (mediaItem.type === 'bilibili' && mediaItem.bvid && mediaItem.cid) {
                console.log('[思源媒体播放器] B站视频信息:', {
                    标题: mediaItem.title,
                    BV号: mediaItem.bvid,
                    CID: mediaItem.cid,
                    UP主: mediaItem.artist,
                    时长: mediaItem.duration
                });
            }
            
            // 添加到当前标签页的播放列表中
            const tab = tabs.find(t => t.id === activeTabId);
            if (!tab) return;

            tab.items = [...(tab.items || []), mediaItem];
            tabs = tabs;  // 触发Svelte更新
            inputValue = '';  // 清空输入框
            
            showMessage('已添加到播放列表');
            dispatch('addMedia', { tabId: activeTabId, url: url.trim() });
        } catch (e) {
            console.error('Failed to add media:', e);
            showMessage('添加媒体失败');
        }
    }

    /**
     * 标签操作
     */
    const tabActions = {
        add() {
            if (!isAddingTab) {
                isAddingTab = true;
                setTimeout(() => newTabInput?.focus(), 0);
            }
        },

        save(event: KeyboardEvent | FocusEvent, tab?: PlaylistConfig) {
            if (event instanceof KeyboardEvent && event.key !== 'Enter') return;
            
            const input = event.target as HTMLInputElement;
            const newName = input.value.trim();
            
            if (tab) {
                // 保存已有标签
                tabs = tabs.map(t => 
                    t.id === tab.id 
                    ? { ...t, name: newName || t.name, isEditing: false }
                    : t
                );
            } else if (newName) {
                // 添加新标签
                tabs = [...tabs, {
                    id: `tab-${Date.now()}`,
                    name: newName
                }];
                isAddingTab = false;
            }
            
            input.value = '';
        },

        showContextMenu(event: MouseEvent, tab: PlaylistConfig) {
            if (tab.isFixed) return;
            
            const menu = new Menu("tabContextMenu");
            menu.addItem({
                icon: "iconEdit",
                label: "重命名",
                click: () => {
                    tabs = tabs.map(t => ({
                        ...t,
                        isEditing: t.id === tab.id
                    }));
                    setTimeout(() => {
                        const input = document.querySelector(`#tab-edit-${tab.id}`) as HTMLInputElement;
                        input?.focus();
                        input?.select();
                    }, 0);
                }
            });
            
            menu.addItem({
                icon: "iconTrashcan",
                label: "删除",
                click: () => {
                    tabs = tabs.filter(t => t.id !== tab.id);
                    if (activeTabId === tab.id) {
                        activeTabId = 'default';
                    }
                }
            });
            
            menu.open({ x: event.clientX, y: event.clientY });
        }
    };

    /**
     * 媒体项操作
     */
    const itemActions = {
        showContextMenu(event: MouseEvent, item: MediaItem) {
            const menu = new Menu("mediaItemMenu");
            
            menu.addItem({
                icon: "iconPlay",
                label: "播放",
                click: () => dispatch('play', item)
            });
            
            menu.addItem({
                icon: "iconPin",
                label: item.isPinned ? "取消置顶" : "置顶",
                click: () => this.togglePin(item)
            });
            
            menu.addItem({
                icon: "iconHeart",
                label: item.isFavorite ? "取消收藏" : "收藏",
                click: () => this.toggleFavorite(item)
            });
            
            menu.addSeparator();
            
            menu.addItem({
                icon: "iconTrashcan",
                label: "删除",
                click: () => {
                    const tab = tabs.find(t => t.id === activeTabId);
                    if (!tab) return;
                    
                    // 从当前标签页移除项目
                    tab.items = tab.items.filter(i => i.id !== item.id);
                    tabs = tabs;
                    
                    // 如果是收藏项，也从收藏夹移除
                    if (item.isFavorite) {
                        const favoritesTab = tabs.find(t => t.id === 'favorites');
                        if (favoritesTab) {
                            favoritesTab.items = favoritesTab.items.filter(i => i.id !== item.id);
                        }
                    }
                    
                    // 触发删除事件
                    dispatch('remove', item);
                }
            });
            
            menu.open({ x: event.clientX, y: event.clientY });
        },

        togglePin(item: MediaItem) {
            const tab = tabs.find(t => t.id === activeTabId);
            if (!tab) return;
            
            const updatedItems = tab.items.map(i => 
                i.id === item.id ? { ...i, isPinned: !i.isPinned } : i
            );
            
            tab.items = [
                ...updatedItems.filter(i => i.isPinned),
                ...updatedItems.filter(i => !i.isPinned)
            ];
            tabs = tabs;
        },

        toggleFavorite(item: MediaItem) {
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
            
            tabs = tabs;
        }
    };

    // 处理播放列表播放事件
    async function handlePlay(event: CustomEvent<MediaItem>) {
        currentItem = event.detail;
        
        if (player) {
            const config = await configManager.getConfig();
            
            // 如果是B站视频
            if (currentItem.type === 'bilibili') {
                player.play(currentItem.url, {
                    type: 'bilibili',
                    bvid: currentItem.bvid,
                    originalUrl: currentItem.originalUrl || currentItem.url,
                    audioUrl: currentItem.audioUrl,
                    title: currentItem.title,
                    autoplay: config.settings?.autoplay,
                    startTime: 0  // 添加起始时间
                });
            } else {
                // 普通媒体直接播放
                player.play(currentItem.url, {
                    originalUrl: currentItem.originalUrl || currentItem.url,
                    autoplay: config.settings?.autoplay,
                    startTime: 0  // 添加起始时间
                });
            }
        }
    }
</script>

<div class="playlist">
    <!-- Header -->
    <div class="playlist-header">
        <h3>播放列表</h3>
        <span class="playlist-count">{itemCount} 个项目</span>
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
                        on:blur={(e) => tabActions.save(e, tab)}
                        on:keydown={(e) => tabActions.save(e, tab)}
                    />
                </div>
            {:else}
                <button 
                    class="tab" 
                    class:active={activeTabId === tab.id}
                    on:click={() => {
                        activeTabId = tab.id;
                        dispatch('tabChange', tab.id);
                    }}
                    on:contextmenu|preventDefault={(e) => tabActions.showContextMenu(e, tab)}
                >
                    {tab.name}
                </button>
            {/if}
        {/each}
        
        <div class="tab-add-wrapper">
            {#if isAddingTab}
                <input
                    bind:this={newTabInput}
                    type="text"
                    class="tab-input"
                    placeholder="新标签"
                    on:blur={tabActions.save}
                    on:keydown={tabActions.save}
                />
            {:else}
                <button class="tab tab-add" on:click={tabActions.add}>+</button>
            {/if}
        </div>
    </div>
    
    <!-- Content -->
    <div class="playlist-content">
        {#if !itemCount}
            <div class="playlist-empty">暂无媒体文件</div>
        {:else}
            <div class="playlist-items">
                {#each activeTab.items as item (item.id)}
                    <div 
                        class="playlist-item"
                        class:active={currentItem?.id === item.id}
                        on:click={() => handleItemClick(item)}
                        on:contextmenu|preventDefault={(e) => itemActions.showContextMenu(e, item)}
                    >
                        <!-- Thumbnail -->
                        <div class="item-thumbnail">
                            <img src={item.thumbnail} alt={item.title}>
                            <span class="duration">{item.duration || '--:--'}</span>
                        </div>
                        
                        <!-- Info -->
                        <div class="item-info">
                            <div class="item-title" title={item.title}>{item.title}</div>
                            {#if item.artist}
                                <div class="item-artist">
                                    <img 
                                        class="artist-icon" 
                                        src={item.artistIcon || '/images/default-avatar.png'} 
                                        alt={item.artist}
                                    >
                                    <span>{item.artist}</span>
                                </div>
                            {/if}
                            <div class="item-meta-group">
                                <div class="item-url" title={item.url}>{item.url}</div>
                            </div>
                        </div>
                    </div>
                {/each}
            </div>
        {/if}
    </div>
    
    <!-- Footer -->
    <div class="playlist-footer">
        <div class="input-wrapper">
            <input 
                type="text" 
                class="tab-input playlist-input" 
                placeholder="输入媒体链接..."
                bind:value={inputValue}
                on:keydown={(e) => e.key === 'Enter' && addMediaToPlaylist(inputValue)}
            />
            {#if inputValue}
                <span class="clear-icon" on:click={() => inputValue = ''}>×</span>
            {/if}
        </div>
        <button 
            class="add-btn" 
            on:click={() => inputValue && addMediaToPlaylist(inputValue)}
        >
            添加
        </button>
    </div>
</div> 