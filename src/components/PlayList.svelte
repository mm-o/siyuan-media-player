<script lang="ts">
    // 从"svelte"中导入createEventDispatcher和onMount
    import { createEventDispatcher, onMount } from "svelte";
    // 从"siyuan"中导入showMessage
    import { showMessage } from "siyuan";
    // 从'../core/types'中导入MediaItem和PlaylistConfig类型
    import type { MediaItem, PlaylistConfig, MediaInfo } from '../core/types';
    // 从'../core/media'中导入MediaManager
    import { MediaManager } from '../core/media';
    // 从"siyuan"中导入Menu
    import { Menu } from "siyuan";
    // 从'../core/bilibili'中导入BilibiliParser
    import { BilibiliParser } from '../core/bilibili';
    // 从'../core/config'中导入ConfigManager类型
    import type { ConfigManager } from '../core/config';

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
    let newTabInput: HTMLInputElement;
    // B站视频分P状态
    let videoParts: Record<string, any[]> = {}; // 存储视频的分P信息，key为item.id
    let expandedItems: Set<string> = new Set(); // 存储展开的视频分P的item.id
    
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

    // 最后点击的项目
    let lastClickedItem: string | null = null;
    let lastClickTime = 0;
    
    // 添加输入模式状态
    let inputMode: 'normal' | 'localFolder' = 'normal';
    
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
            console.error("[Playlist] " + i18n.playList.error.playFailed, error);
            showMessage(i18n.playList.error.playRetry);
        }
    }

    /**
     * 播放指定分P
     */
    async function playVideoPart(item: MediaItem, partInfo: any) {
        if (!item.bvid) return;
        
        // 分p总是直接播放，因为它是小元素，单击就直接播放
        try {
            const partId = `${item.id}-p${partInfo.page}`;
            const partTitle = `${item.title.split(' - P')[0]} - P${partInfo.page}${partInfo.part ? ': ' + partInfo.part : ''}`;
            const partItem = {
                ...item,
                id: partId,
                title: partTitle,
                cid: String(partInfo.cid)
            };
            
            // 播放分P并设置当前播放项
            await handleMediaPlay(partItem);
            currentItem = partItem; // 确保设置当前播放项
        } catch (error) {
            console.error("播放分P失败", error);
        }
    }

    /**
     * 处理列表项点击
     */
    async function handleItemClick(item: MediaItem) {
        const now = Date.now();
        
        // 处理B站视频分P
        if (item.type === 'bilibili' && item.bvid) {
            // 只在展开/折叠时才加载分P列表
            const needToToggle = !videoParts[item.id] || videoParts[item.id]?.length > 1;
            
            if (needToToggle) {
                // 懒加载分P列表
                if (!videoParts[item.id]) {
                    try {
                        videoParts[item.id] = await BilibiliParser.getVideoPartsList({ bvid: item.bvid }) || [];
                    } catch (error) {
                        console.error("获取视频分P列表失败", error);
                    }
                }
                
                // 多个分P时切换展开/折叠
                if (videoParts[item.id]?.length > 1) {
                    expandedItems = new Set(expandedItems);
                    expandedItems.has(item.id) ? expandedItems.delete(item.id) : expandedItems.add(item.id);
                    return;
                }
            }
        }
        
        // 只在双击时执行播放操作
        if (lastClickedItem === item.id && now - lastClickTime < 300) {
            // 双击播放时设置当前播放项
            await handleMediaPlay(item);
            currentItem = item; // 确保设置当前播放项
            lastClickedItem = null;
            lastClickTime = 0;
        } else {
            // 单击仅记录点击状态，不执行任何操作
            lastClickedItem = item.id;
            lastClickTime = now;
            // 移除 dispatch('select', item); 调用，防止单击时选中项目
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
            items: tab.items && MediaManager.getMediaInfoFromItems(tab.items)
        }));
        configManager.updatePlaylists(playlistsToSave);
    }

    /**
     * 处理媒体添加
     */
    async function handleMediaAdd(url: string) {
        try {
            console.log("[PlayList] " + i18n.playList.log.parseLink, url);
            // 1. 拆分链接
            const { mediaUrl, startTime, endTime } = parseMediaLink(url);
            console.log("[PlayList] " + i18n.playList.log.parseResult, { mediaUrl, startTime, endTime });
            
            // 2. 检查是否已存在
            const existingItem = activeTab?.items?.find(item => item.url === mediaUrl);
            if (existingItem) {
                console.log("[PlayList] " + i18n.playList.log.usingExisting, existingItem);
                // 更新已存在项的时间参数
                const updatedItem = {
                    ...existingItem,
                    startTime,
                    endTime,
                    originalUrl: url
                };
                console.log("[PlayList] " + i18n.playList.log.updatedItem, updatedItem);
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
            console.log("[PlayList] " + i18n.playList.log.newMediaItem, mediaItem);
            
            if (!mediaItem) {
                showMessage(i18n.playList.error.cannotParse);
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
            console.error('[Playlist] ' + i18n.playList.error.addMediaFailed, error);
            showMessage(i18n.playList.error.addMediaFailed);
        }
    }

    /**
     * 标签操作
     */
    const tabActions = {
        add() {
            if (!isAddingTab) {
                isAddingTab = true;
                // 设置添加普通标签状态
                inputMode = 'normal';
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
                if (inputMode === 'normal') {
                    // 添加普通标签
                    tabs = [...tabs, {
                        id: `tab-${Date.now()}`,
                        name: newName,
                        items: []
                    }];
                } else if (inputMode === 'localFolder') {
                    // 处理本地文件夹路径
                    handleLocalFolder(newName);
                }
                
                // 清空输入框与状态
                isAddingTab = false;
            } else {
                // 空输入则取消添加标签
                isAddingTab = false;
            }
            
            input.value = '';
        },

        showContextMenu(event: MouseEvent, tab: PlaylistConfig) {
            // 创建右键菜单
            const menu = new Menu("tabContextMenu");
            
            // 仅对非固定标签显示编辑选项
            if (!tab.isFixed) {
                // 添加重命名项
                menu.addItem({
                    icon: "iconEdit",
                    label: i18n.playList.menu.rename,
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
                    label: i18n.playList.menu.delete,
                    click: () => {
                        // 从标签列表中移除当前标签
                        tabs = tabs.filter(t => t.id !== tab.id);
                        // 如果当前标签是激活的，设置默认标签为激活
                        if (activeTabId === tab.id) {
                            activeTabId = 'default';
                        }
                    }
                });
                
                menu.addSeparator();
            }
            
            // 为所有标签添加清空选项
            menu.addItem({
                icon: "iconClear",
                label: i18n.playList.menu.clear,
                click: () => {
                    // 清空标签内容
                    tabs = tabs.map(t => 
                        t.id === tab.id 
                        ? { ...t, items: [] }
                        : t
                    );
                    showMessage(i18n.playList.message.listCleared.replace('${name}', tab.name));
                }
            });
            
            // 打开右键菜单
            menu.open({ x: event.clientX, y: event.clientY });
        }
    };

    /**
     * 处理本地文件夹
     */
    async function handleLocalFolder(folderPath: string) {
        try {
            // 创建新标签
            const tabId = `folder-${Date.now()}`;
            const folderName = folderPath.split(/[/\\]/).pop() || i18n.playList.folder.defaultName;
            
            // 添加标签
            const newTab: PlaylistConfig = {
                id: tabId,
                name: folderName,
                items: []
            };
            tabs = [...tabs, newTab];
            activeTabId = tabId;
            
            // 1. 文件选择对话框选择文件夹
            try {
                // @ts-ignore
                const dirHandle = await window.showDirectoryPicker();
                await processDirectoryHandle(dirHandle, folderPath, tabId);
            } catch (error) {
                console.error(i18n.playList.error.selectFolderFailed, error);
                showMessage(i18n.playList.error.selectFolderFailed);
            }
        } catch (error) {
            console.error(i18n.playList.error.processLocalFolderFailed, error);
            showMessage(i18n.playList.error.processLocalFolderFailed);
        }
    }
    
    /**
     * 处理目录句柄
     */
    async function processDirectoryHandle(handle: any, basePath: string, tabId: string) {
        try {
            if (handle.kind !== 'directory') return;
            
            // 获取文件夹下的所有文件
            const entries = await handle.entries();
            // 创建媒体文件数组
            let addedCount = 0;
            
            // 处理每个文件
            for await (const [name, fileHandle] of entries) {
                if (fileHandle.kind === 'file') {
                    // 检查是否为媒体文件
                    const isMedia = /\.(mp4|webm|avi|mkv|mov|flv|mp3|wav|ogg|flac)$/i.test(name);
                    if (isMedia) {
                        const mediaPath = `file://${basePath}/${name}`;
                        await handleMediaAdd(mediaPath);
                        addedCount++;
                    }
                } else if (fileHandle.kind === 'directory') {
                    // 处理子文件夹
                    await processDirectoryHandle(fileHandle, `${basePath}/${name}`, tabId);
                }
            }
            
            showMessage(i18n.playList.message.folderAdded
                .replace('${name}', handle.name)
                .replace('${count}', addedCount.toString()));
        } catch (error) {
            console.error(i18n.playList.error.processDirectoryFailed, error);
            showMessage(i18n.playList.error.processDirectoryFailed);
        }
    }

    /**
     * 媒体项操作
     */
    const itemActions = {
        showContextMenu(event: MouseEvent, item: MediaItem) {
            const menu = new Menu("mediaItemMenu");
            
            menu.addItem({
                icon: "iconPlay",
                label: i18n.playList.menu.play,
                click: () => itemActions.play(item)
            });
            
            menu.addItem({
                icon: "iconPin",
                label: item.isPinned ? i18n.playList.menu.unpin : i18n.playList.menu.pin,
                click: () => itemActions.togglePin(item)
            });
            
            menu.addItem({
                icon: "iconHeart",
                label: item.isFavorite ? i18n.playList.menu.unfavorite : i18n.playList.menu.favorite,
                click: () => itemActions.toggleFavorite(item)
            });
            
            menu.addSeparator();
            
            menu.addItem({
                icon: "iconTrashcan",
                label: i18n.playList.menu.delete,
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
                showMessage(i18n.playList.message.existingItemPlay);
            } else {
                // 添加到当前标签页的播放列表中
                const tab = tabs.find(t => t.id === activeTabId);
                if (!tab) throw new Error(i18n.playList.error.noActiveTab);

                tab.items = [...(tab.items || []), mediaItem];
                tabs = tabs;  // 触发 Svelte 更新

                // 播放新添加的媒体
                await handleMediaPlay(mediaItem);
                showMessage(i18n.playList.message.addedAndPlay);
            }
        } catch (error) {
            console.error('[Playlist] ' + i18n.playList.error.processMediaItemFailed, error);
            showMessage(i18n.playList.error.processMediaFailed);
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
                console.log("[PlayList] " + i18n.playList.log.noTimeParam, { mediaUrl });
                return { mediaUrl };
            }
            
            // 检查是否是循环片段（包含-）
            if (timeParam.includes('-')) {
                const [start, end] = timeParam.split('-').map(Number);
                console.log("[PlayList] " + i18n.playList.log.parseLoopSegment, { mediaUrl, start, end });
                return {
                    mediaUrl,
                    startTime: isNaN(start) ? undefined : start,
                    endTime: isNaN(end) ? undefined : end
                };
            } else {
                // 单个时间戳
                const time = Number(timeParam);
                console.log("[PlayList] " + i18n.playList.log.parseTimestamp, { mediaUrl, time });
                return {
                    mediaUrl,
                    startTime: isNaN(time) ? undefined : time
                };
            }
        } catch (error) {
            console.error("[PlayList] " + i18n.playList.error.parseLinkFailed, error);
            return { mediaUrl: url };
        }
    }

    /**
     * 处理提交
     */
    export async function handleSubmit(externalUrl?: string) {
        const url = externalUrl || inputValue.trim();
        if (!url) {
            showMessage(i18n.playList.error.emptyUrl);
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
                    style="width: 100px; max-width: 100px;"
                    placeholder={inputMode === 'localFolder' ? i18n.playList.placeholder.folderPath : i18n.playList.placeholder.newTab}
                    on:blur={tabActions.save}
                    on:keydown={tabActions.save}
                />
            {:else}
                <button 
                    class="tab tab-add" 
                    on:click={tabActions.add}
                    on:contextmenu|preventDefault={(e) => {
                        const menu = new Menu("addTabMenu");
                        menu.addItem({
                            icon: "iconFolder",
                            label: i18n.playList.menu.addLocalFolder,
                            click: () => {
                                isAddingTab = true;
                                inputMode = 'localFolder';
                                setTimeout(() => newTabInput?.focus(), 0);
                            }
                        });
                        menu.addItem({
                            icon: "iconCloud",
                            label: i18n.playList.menu.addAliCloud,
                            click: () => {
                                // TODO: 实现添加阿里云盘功能
                            }
                        });
                        menu.addItem({
                            icon: "iconCloud",
                            label: i18n.playList.menu.addTianYiCloud,
                            click: () => {
                                // TODO: 实现添加天翼云盘功能
                            }
                        });
                        menu.addItem({
                            icon: "iconCloud",
                            label: i18n.playList.menu.addQuarkCloud,
                            click: () => {
                                // TODO: 实现添加夸克云盘功能
                            }
                        });
                        menu.addItem({
                            icon: "iconHeart",
                            label: i18n.playList.menu.addBilibiliFavorites,
                            click: () => {
                                // TODO: 实现添加B站收藏夹功能
                            }
                        });
                        menu.open({ x: e.clientX, y: e.clientY });
                    }}
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
                        class="playlist-item {currentItem?.id === item.id || currentItem?.id?.startsWith(`${item.id}-p`) ? 'playing' : ''}" 
                        on:click={() => handleItemClick(item)}
                        on:contextmenu|preventDefault={(e) => itemActions.showContextMenu(e, item)}
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
                        {#if expandedItems.has(item.id) && videoParts[item.id]?.length > 1}
                            <div class="item-parts">
                                {#each videoParts[item.id] as part}
                                    <button 
                                        class="part-item {currentItem?.id === `${item.id}-p${part.page}` ? 'playing' : ''}" 
                                        on:click|stopPropagation={() => playVideoPart(item, part)}
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