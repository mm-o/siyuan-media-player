<script lang="ts">
    // 从"svelte"中导入createEventDispatcher和onMount
    import { createEventDispatcher, onMount } from "svelte";
    // 从"siyuan"中导入showMessage
    import { showMessage } from "siyuan";
    // 从'../core/types'中导入MediaItem、Config和PlaylistConfig类型
    import type { MediaItem, Config, PlaylistConfig } from '../core/types';
    // 从'../core/media'中导入MediaManager
    import { MediaManager } from '../core/media';
    // 从"siyuan"中导入Menu
    import { Menu } from "siyuan";
    // 从'../core/bilibili'中导入BilibiliParser
    import { BilibiliParser } from '../core/bilibili';
    // 从'../core/config'中导入ConfigManager类型
    import type { ConfigManager } from '../core/config';
    // 从'../types/media'中导入MediaInfo类型
    import type { MediaInfo } from '../types/media';
    
    // 组件属性
    export let items: MediaItem[] = [];
    export let currentItem: MediaItem | null = null;
    export let configManager: ConfigManager;
    
    // 组件状态
    let tabs: PlaylistConfig[] = [];
    let activeTabId = 'default';
    let isAddingTab = false;
    let inputValue = '';
    let newTabInput: HTMLInputElement;
    
    // 计算属性
    $: activeTab = tabs.find(tab => tab.id === activeTabId);
    $: itemCount = activeTab?.items?.length || 0;
    
    // 事件分发器
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
    let lastClickTime = 0;
    
    /**
     * 统一处理播放请求
     * 用于处理双击播放、右键播放等多个入口的播放请求
     */
    async function handlePlayRequest(item: MediaItem, options: {
        startTime?: number;
        endTime?: number;
        isLoop?: boolean;
        autoplay?: boolean;
    } = {}) {
        try {
            console.log("[Playlist] 处理播放请求:", { 
                item, 
                options,
                type: item.type,
                hasStartTime: options.startTime !== undefined,
                hasEndTime: options.endTime !== undefined,
                isLoop: options.isLoop
            });
            
            // 获取播放器配置
            const config = await configManager.getConfig();
            
            // 如果是B站视频，获取播放流
            if (item.type === 'bilibili' && item.bvid && item.cid) {
                const streamInfo = await BilibiliParser.getProcessedVideoStream(
                    item.bvid,
                    item.cid,
                    0,  // 不限制清晰度
                    config,
                    item.page  // 分P页码
                );
                
                // 触发播放事件
                dispatch('play', {
                    ...item,
                    url: streamInfo.video.url,
                    audioUrl: streamInfo.audio.url,
                    headers: streamInfo.headers,
                    ...options,  // 合并传入的播放选项
                });
            } else {
                // 普通媒体直接播放
                dispatch('play', {
                    ...item,
                    ...options,  // 合并传入的播放选项
                });
            }
            
            // 更新当前项
            currentItem = item;
            
        } catch (error) {
            console.error("[Playlist] 播放失败:", error);
            showMessage("播放失败，请重试");
        }
    }

    /**
     * 处理列表项点击
     * 单击选中项目，双击播放媒体
     */
    async function handleItemClick(item: MediaItem) {
        // 检查是否为双击
        const now = Date.now();
        if (lastClickedItem === item.id && now - lastClickTime < 300) {
            // 双击：播放
            await handlePlayRequest(item, {
                autoplay: true
            });
            // 重置点击状态
            lastClickedItem = null;
            lastClickTime = 0;
        } else {
            // 单击：选择
            lastClickedItem = item.id;
            lastClickTime = now;
            dispatch('select', item);
        }
    }

    // 生命周期
    onMount(async () => {
        // 清理过期缓存
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
            // 处理B站视频ID
            let processedUrl = url;
            const bvMatch = url.match(/^(BV[\w]+)$/i);
            const avMatch = url.match(/^(av\d+)$/i);
            
            if (bvMatch) {
                processedUrl = `https://www.bilibili.com/video/${bvMatch[1]}`;
            } else if (avMatch) {
                processedUrl = `https://www.bilibili.com/video/${avMatch[1]}`;
            }
            
            // 创建媒体项（会自动识别B站视频）
            const mediaItem = await MediaManager.createMediaItem(processedUrl);
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
            dispatch('addMedia', { tabId: activeTabId, url: processedUrl.trim() });
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
            // 如果标签是固定的，不显示右键菜单
            if (tab.isFixed) return;
            
            // 创建右键菜单
            const menu = new Menu("tabContextMenu");
            // 添加重命名项
            menu.addItem({
                icon: "iconEdit",
                label: "重命名",
                click: () => {
                    // 将当前标签设置为编辑状态
                    tabs = tabs.map(t => ({
                        ...t,
                        isEditing: t.id === tab.id
                    }));
                    // 延迟执行，确保DOM更新后再获取输入框
                    setTimeout(() => {
                        const input = document.querySelector(`#tab-edit-${tab.id}`) as HTMLInputElement;
                        input?.focus();
                        input?.select();
                    }, 0);
                }
            });
            // 添加删除项
            menu.addItem({
                icon: "iconTrashcan",
                label: "删除",
                click: () => {
                    // 从标签列表中移除当前标签
                    tabs = tabs.filter(t => t.id !== tab.id);
                    // 如果当前标签是激活的，设置默认标签为激活
                    if (activeTabId === tab.id) {
                        activeTabId = 'default';
                    }
                }
            });
            // 打开右键菜单
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

    /**
     * 处理外部传入的媒体项
     */
    export async function handleMediaItem(item: MediaItem) {
        try {
            console.log("[Playlist] 接收到媒体项:", item);
            
            // 检查是否已存在相同媒体
            const existingItem = findExistingMedia(item);
            if (existingItem) {
                console.log("[Playlist] 媒体已存在，合并播放控制参数:", existingItem);
                // 合并播放控制参数并播放
                await handlePlayRequest({
                    ...existingItem,
                    startTime: item.startTime,
                    endTime: item.endTime,
                    originalUrl: item.originalUrl
                }, {
                    startTime: item.startTime,
                    endTime: item.endTime,
                    isLoop: item.startTime !== undefined && item.endTime !== undefined,
                    autoplay: true
                });
                return;
            }
            
            // 如果是新项目，添加到播放列表中
            const tab = tabs.find(t => t.id === activeTabId);
            if (!tab) return;
            
            tab.items = [...(tab.items || []), item];
            tabs = tabs;  // 触发Svelte更新
            
            // 自动播放新添加的项目
            await handlePlayRequest(item, {
                startTime: item.startTime,
                endTime: item.endTime,
                isLoop: item.startTime !== undefined && item.endTime !== undefined,
                autoplay: true
            });
            
        } catch (error) {
            console.error("[Playlist] 处理媒体项失败:", error);
            showMessage("添加媒体失败");
        }
    }

    /**
     * 查找已存在的相同媒体
     */
    function findExistingMedia(newItem: MediaItem): MediaItem | null {
        if (!activeTab?.items) return null;

        return activeTab.items.find(item => {
            // B站视频：比较BV号
            if (newItem.type === 'bilibili' && item.type === 'bilibili') {
                return item.bvid === newItem.bvid;
            }
            
            // 普通媒体：比较原始URL（忽略时间戳等参数）
            const cleanUrl = (url: string) => {
                try {
                    const urlObj = new URL(url);
                    return `${urlObj.protocol}//${urlObj.host}${urlObj.pathname}`;
                } catch {
                    return url.split('#')[0].split('?')[0];
                }
            };

            const originalUrl1 = cleanUrl(item.originalUrl || item.url);
            const originalUrl2 = cleanUrl(newItem.originalUrl || newItem.url);
            return originalUrl1 === originalUrl2;
        }) || null;
    }

    /**
     * 处理提交
     * 当用户点击添加按钮或按下回车键时触发
     */
    export async function handleSubmit(url: string, startTime?: number, endTime?: number) {
        if (!url) {
            showMessage('请输入媒体链接');
            return;
        }
        
        try {
            console.log("[Playlist] 处理提交:", { url, startTime, endTime });
            
            // 创建新的媒体项
            const newItem = await MediaManager.createMediaItem(url);
            if (!newItem) {
                showMessage('无法解析媒体文件');
                return;
            }

            // 添加时间参数
            if (startTime !== undefined) {
                newItem.startTime = startTime;
            }
            if (endTime !== undefined) {
                newItem.endTime = endTime;
                newItem.isLoop = true;  // 如果有结束时间，说明是循环片段
            }

            // 检查是否已存在
            const existingItem = findExistingMedia(newItem);
            if (existingItem) {
                // 如果已存在，使用现有项但更新时间参数
                const playItem = {
                    ...existingItem,
                    startTime: startTime,
                    endTime: endTime,
                    isLoop: endTime !== undefined
                };
                
                // 直接播放并传递时间参数
                await handlePlayRequest(playItem, {
                    startTime: startTime,
                    endTime: endTime,
                    isLoop: endTime !== undefined,
                    autoplay: true
                });
                return;
            }
            
            // 添加到当前标签页
            const tab = tabs.find(t => t.id === activeTabId);
            if (!tab) return;
            
            tab.items = [...(tab.items || []), newItem];
            tabs = tabs;  // 触发 Svelte 更新
            
            // 立即播放新添加的项目
            await handlePlayRequest(newItem, {
                startTime: startTime,
                endTime: endTime,
                isLoop: endTime !== undefined,
                autoplay: true
            });
            
        } catch (error) {
            console.error("[Playlist] 添加媒体失败:", error);
            showMessage("添加媒体失败");
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
                on:keydown={(e) => e.key === 'Enter' && handleSubmit(inputValue)}
            />
            {#if inputValue}
                <span class="clear-icon" on:click={() => inputValue = ''}>×</span>
            {/if}
        </div>
        <button 
            class="add-btn" 
            on:click={() => inputValue && handleSubmit(inputValue)}
        >
            添加
        </button>
    </div>
</div> 