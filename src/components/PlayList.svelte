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
    export let className = '';
    export let hidden = false;
    
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

    // 点击计时器和最后点击的项目
    let clickTimer: number;
    let lastClickedItem: string | null = null;
    let lastClickTime = 0;
    
    /**
     * 处理媒体播放
     */
    async function handleMediaPlay(item: MediaItem) {
        try {
            // 1. 获取播放器配置
            const config = await configManager.getConfig();
            
            // 2. 准备播放参数
            let playOptions: {
                url: string;
                audioUrl?: string;
                headers?: any;
                startTime?: number;
                endTime?: number;
                isLoop?: boolean;
                title: string;
                originalUrl: string;  // 添加原始链接
                type: string;
            };
            
            // 3. 处理不同类型的媒体
            if (item.type === 'bilibili' && item.bvid && item.cid) {
                // B站视频：获取播放流
                const streamInfo = await BilibiliParser.getProcessedVideoStream(
                    item.bvid,
                    item.cid,
                    0,
                    config
                );
                
                playOptions = {
                    url: streamInfo.mpdUrl || streamInfo.video.url, // 优先使用MPD URL
                    headers: streamInfo.headers,
                    title: item.title,
                    originalUrl: item.originalUrl || item.url,  // 使用原始链接
                    type: streamInfo.mpdUrl ? 'bilibili-dash' : 'bilibili' // 设置正确的类型
                };
            } else {
                // 普通媒体：直接使用原始链接
                playOptions = {
                    url: item.url,
                    title: item.title,
                    originalUrl: item.originalUrl || item.url,  // 使用原始链接
                    type: item.type || 'video'  // 设置媒体类型
                };
            }
            
            // 4. 添加通用参数
            playOptions = {
                ...playOptions,
                startTime: item.startTime,
                endTime: item.endTime,
                isLoop: item.startTime !== undefined && item.endTime !== undefined
            };
            
            // 5. 触发播放事件
            dispatch('play', playOptions);
            
            // 6. 更新当前项
            currentItem = item;
            
        } catch (error) {
            console.error("[Playlist] 播放失败:", error);
            showMessage("播放失败，请重试");
        }
    }

    /**
     * 处理列表项点击
     */
    async function handleItemClick(item: MediaItem) {
        const now = Date.now();
        if (lastClickedItem === item.id && now - lastClickTime < 300) {
            // 双击播放
            await handleMediaPlay(item);
            // 重置点击状态
            lastClickedItem = null;
            lastClickTime = 0;
        } else {
            // 单击选择
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
     * 处理媒体添加
     */
    async function handleMediaAdd(url: string) {
        try {
            console.log("[PlayList] 开始解析链接:", url);
            // 1. 拆分链接
            const { mediaUrl, startTime, endTime } = parseMediaLink(url);
            console.log("[PlayList] 解析结果:", { mediaUrl, startTime, endTime });
            
            // 2. 检查是否已存在
            const existingItem = activeTab?.items?.find(item => item.url === mediaUrl);
            if (existingItem) {
                console.log("[PlayList] 使用已存在项:", existingItem);
                // 更新已存在项的时间参数
                const updatedItem = {
                    ...existingItem,
                    startTime,
                    endTime,
                    originalUrl: url
                };
                console.log("[PlayList] 更新后的媒体项:", updatedItem);
                // 存在则直接播放
                await handleMediaPlay(updatedItem);
                return;
            }
            
            // 3. 创建新媒体项
            const mediaItem = await MediaManager.createMediaItem(mediaUrl, {
                startTime,
                endTime,
                originalUrl: url
            });
            console.log("[PlayList] 创建新媒体项:", mediaItem);
            
            if (!mediaItem) {
                showMessage('无法解析媒体文件');
                return;
            }
            
            // 4. 添加到播放列表
            if (activeTab) {
                activeTab.items = [...(activeTab.items || []), mediaItem];
                await savePlaylists();
            }
            
            // 5. 播放新添加的媒体
            await handleMediaPlay(mediaItem);
            
        } catch (error) {
            console.error('[Playlist] 添加媒体失败:', error);
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
                click: () => itemActions.play(item)
            });
            
            menu.addItem({
                icon: "iconPin",
                label: item.isPinned ? "取消置顶" : "置顶",
                click: () => itemActions.togglePin(item)
            });
            
            menu.addItem({
                icon: "iconHeart",
                label: item.isFavorite ? "取消收藏" : "收藏",
                click: () => itemActions.toggleFavorite(item)
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
                    dispatch('play', {
                        url: item.url,
                        originalUrl: item.originalUrl || item.url,
                        startTime: item.startTime,
                        endTime: item.endTime,
                        isLoop: item.startTime !== undefined && item.endTime !== undefined,
                        type: item.type,
                        bvid: item.bvid,
                        title: item.title
                    });
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
        },

        async play(item: MediaItem) {
            await handleMediaPlay(item);
        }
    };

    /**
     * 处理外部链接传入的媒体项
     */
    export async function handleMediaItem(mediaItem: MediaItem) {
        try {
            // 1. 检查是否已存在
            const existingItem = activeTab?.items?.find(item => 
                item.url === mediaItem.url || item.originalUrl === mediaItem.originalUrl
            );

            if (existingItem) {
                // 如果已存在，直接播放
                await handleMediaPlay(existingItem);
                showMessage('媒体已在播放列表中，直接播放');
            } else {
                // 添加到当前标签页的播放列表中
                const tab = tabs.find(t => t.id === activeTabId);
                if (!tab) throw new Error('未找到活动标签页');

                tab.items = [...(tab.items || []), mediaItem];
                tabs = tabs;  // 触发 Svelte 更新

                // 播放新添加的媒体
                await handleMediaPlay(mediaItem);
                showMessage('已添加到播放列表并开始播放');
            }
        } catch (error) {
            console.error('[Playlist] 处理媒体项失败:', error);
            showMessage('处理媒体失败');
            throw error; // 向上传播错误
        }
    }

    /**
     * 添加媒体项到播放列表
     */
    export function addItem(item: MediaItem) {
        items = [...items, item];
        // 如果是第一个项目,自动播放
        if (items.length === 1) {
            handleMediaPlay(item);
        }
    }

    /**
     * 拆分链接，提取原始链接和时间标记
     */
    function parseMediaLink(url: string): {
        mediaUrl: string;
        startTime?: number;
        endTime?: number;
    } {
        try {
            const urlObj = new URL(url);
            const timeParam = urlObj.searchParams.get('t');
            
            // 移除时间参数得到原始链接
            urlObj.searchParams.delete('t');
            const mediaUrl = urlObj.toString();
            
            if (!timeParam) {
                console.log("[PlayList] 无时间参数:", { mediaUrl });
                return { mediaUrl };
            }
            
            // 检查是否是循环片段（包含-）
            if (timeParam.includes('-')) {
                const [start, end] = timeParam.split('-').map(Number);
                console.log("[PlayList] 解析循环片段:", { mediaUrl, start, end });
                return {
                    mediaUrl,
                    startTime: isNaN(start) ? undefined : start,
                    endTime: isNaN(end) ? undefined : end
                };
            } else {
                // 单个时间戳
                const time = Number(timeParam);
                console.log("[PlayList] 解析时间戳:", { mediaUrl, time });
                return {
                    mediaUrl,
                    startTime: isNaN(time) ? undefined : time
                };
            }
        } catch (error) {
            console.error("[PlayList] 解析链接失败:", error);
            return { mediaUrl: url };
        }
    }

    /**
     * 处理提交
     */
    export async function handleSubmit(externalUrl?: string) {
        const url = externalUrl || inputValue.trim();
        if (!url) {
            showMessage('请输入媒体链接');
            return;
        }
        
        await handleMediaAdd(url);
        
        // 清空输入框
        if (!externalUrl) {
            inputValue = '';
        }
    }

</script>

<div class="playlist {className}" class:hidden>
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
                        dispatch('play', {
                            url: '',
                            originalUrl: '',
                            startTime: 0,
                            endTime: 0,
                            isLoop: false,
                            type: '',
                            bvid: '',
                            title: ''
                        });
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
            添加
        </button>
    </div>
</div> 