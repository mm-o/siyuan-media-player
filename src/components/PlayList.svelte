<script lang="ts">
    import { createEventDispatcher, onMount } from "svelte";
    import { showMessage } from "siyuan";
    import type { MediaItem, PlaylistConfig } from '../core/types';
    import { MediaManager } from '../core/media';
    import { BilibiliParser, parseBiliUrl } from '../core/bilibili';
    import type { ConfigManager } from '../core/config';
    import { url } from '../core/utils';
    import { AListManager } from '../core/alist';
    import PlayListTabs from './playlist/PlayListTabs.svelte';
    import PlayListItem from './playlist/PlayListItem.svelte';
    import PlayListFooter from './playlist/PlayListFooter.svelte';

    export let items: MediaItem[] = [];
    export let currentItem: MediaItem | null = null;
    export let configManager: ConfigManager;
    export let className = '', hidden = false, i18n: any;
    export let allTabs = [], activeTabId = 'playlist';
    
    let tabs: PlaylistConfig[] = [];
    let playlistTabId = 'default';
    let viewMode: 'detailed' | 'compact' | 'grid' | 'grid-single' = 'detailed';
    let sortBy = 0;
    
    $: playlistTab = tabs.find(tab => tab.id === playlistTabId);
    $: activeTab = playlistTab;
    $: itemCount = activeTab?.items?.length || 0;
    $: sortedItems = playlistTab?.items && sortBy ? 
        [...playlistTab.items].sort((a, b) => 
            a.isPinned !== b.isPinned ? (a.isPinned ? -1 : 1) : 
            sortBy === 1 ? a.title.localeCompare(b.title) :
            sortBy === 2 ? (b.id?.split('-').pop() || '0').localeCompare(a.id?.split('-').pop() || '0') :
            (a.type || '').localeCompare(b.type || '')
        ) : playlistTab?.items || [];
    
    const dispatch = createEventDispatcher();
    const DIRECTORY_TAB_ID = 'directory';
    
    function changePanelTab(tabId) {
        if (tabId === activeTabId) return;
        window.dispatchEvent(new CustomEvent('mediaPlayerTabChange', { detail: { tabId } }));
    }

    async function playOrAddMediaItem(mediaItem: MediaItem, autoPlay = true) {
        let existingItem = findExistingItem(mediaItem.url, mediaItem.bvid);
        if (existingItem) {
            Object.assign(existingItem, { ...mediaItem });
            autoPlay && await playMedia(existingItem);
            showMessage(i18n.playList.message.existingItemPlay);
        } else {
            playlistTab.items = [...(playlistTab.items || []), mediaItem];
            tabs = [...tabs];
            autoPlay && await playMedia(mediaItem);
            showMessage(i18n.playList.message.added);
        }
    }

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
                }
            }
            
            currentItem = item;
            dispatch('play', playOptions);
        } catch (error) {
            console.error("播放失败:", error);
            showMessage(i18n.playList.error.playRetry);
        }
    }
    
    async function loadAListDirectory(path: string) {
        if (!path) return;
        try {
            let alistTab = tabs.find(t => t.id.startsWith('alist-')) || (() => {
                const id = `alist-main-${Date.now()}`;
                tabs = [...tabs, {id, name: 'AList', items: [], isFixed: true}];
                return tabs[tabs.length - 1];
            })();
            
            alistTab.path = path;
            alistTab.sourceType = 'alist';
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

    onMount(async () => {
        MediaManager.cleanupCache();
        try { await AListManager.initFromConfig(await configManager.getConfig()); } catch {}
        await loadPlaylists();
        
        const handleTabActivate = (e: any) => e.detail?.tabId && (activeTabId = e.detail.tabId);
        window.addEventListener('mediaPlayerTabActivate', handleTabActivate);
        return () => window.removeEventListener('mediaPlayerTabActivate', handleTabActivate);
    });

    $: tabs.length > 0 && savePlaylists();

    async function loadPlaylists() {
        const config = await configManager.load();
        tabs = await Promise.all(
            config.playlists.map(async tab => ({
                ...tab,
                items: await MediaManager.createMediaItems(tab.items || [])
            }))
        );
        
        if (!tabs.find(tab => tab.id === DIRECTORY_TAB_ID)) {
            tabs = [
                { id: DIRECTORY_TAB_ID, name: i18n.playList.directory?.title || '目录', isFixed: true, items: [] },
                ...tabs
            ];
        } else {
            tabs = tabs.map(tab => tab.id === DIRECTORY_TAB_ID && tab.isFixed ? 
                { ...tab, name: i18n.playList.directory?.title || '目录' } : tab);
        }
    }

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

    function findExistingItem(mediaUrl, bvid) {
        if (!playlistTab?.items?.length) return;
        return bvid ? 
            playlistTab.items.find(i => i.bvid === bvid) : 
            playlistTab.items.find(i => (i.url?.split('?')[0] || '') === url.parseTime(mediaUrl).mediaUrl.split('?')[0]);
    }
    
    async function updateBiliPart(item: MediaItem, bvid: string, p: number) {
        try {
            const parts = await BilibiliParser.getVideoParts({ bvid });
            const currentPart = parts.find(part => part.page === p);
            
            if (currentPart) {
                const baseId = item.id.split('-p')[0];
                item.id = `${baseId}-p${p}`;
                item.title = p > 1 ? 
                    `${item.title.split(' - P')[0]} - P${p}${currentPart.part ? ': ' + currentPart.part : ''}` : 
                    item.title.split(' - P')[0];
                item.cid = String(currentPart.cid);
            }
        } catch {}
    }

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

    export async function handleMediaItem(mediaItem: MediaItem) {
        await playOrAddMediaItem(mediaItem, true);
    }

    function handleMediaItemAction(event: CustomEvent) {
        const action = event.type;
        const { item } = event.detail;
        
        if (action === 'play' || action === 'playPart') {
            playMedia(item);
        } else if (action === 'togglePin' && playlistTab?.items) {
            const updatedItems = playlistTab.items.map(i => i.id === item.id ? { ...i, isPinned: !i.isPinned } : i);
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
            
            playlistTab.items = playlistTab.items.map(i => i.id === item.id ? { ...i, isFavorite: !i.isFavorite } : i);
            tabs = [...tabs];
            savePlaylists();
        } else if (action === 'remove' && playlistTab) {
            playlistTab.items = playlistTab.items.filter(i => i.id !== item.id);
            
            if (item.isFavorite) {
                const favTab = tabs.find(t => t.id === 'favorites');
                favTab && (favTab.items = favTab.items.filter(i => i.id !== item.id));
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

    const handleTabChange = e => playlistTabId = e.detail.tabId;
    const handleTabsUpdate = e => tabs = e.detail.tabs;
    const handleReload = () => loadPlaylists();
    
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
                    if (autoPlay) setTimeout(() => handleMediaAdd(mediaUrl, true, options), 100);
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
            currentBvid && currentP && mediaItem.type === 'bilibili' && await updateBiliPart(mediaItem, currentBvid, currentP);
            await playOrAddMediaItem(mediaItem, autoPlay);
        } catch {
            showMessage(i18n.playList.error.addMediaFailed);
        }
    }

    const handleAddMedia = (e) => handleMediaAdd(e.detail.url, e.detail.options?.autoPlay !== false, e.detail.options);
    
    export const addItem = (item: MediaItem) => items = [...items, item];
    export const addMedia = (url: string, options?: {autoPlay?: boolean}) => handleMediaAdd(url, options?.autoPlay !== false);

    function toggleViewMode() {
        const modes = ['detailed', 'compact', 'grid', 'grid-single'] as const;
        viewMode = modes[(modes.indexOf(viewMode) + 1) % modes.length];
    }
</script>

<div class="playlist {className}" class:hidden>
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
            <button class="view-mode-btn" on:click={toggleViewMode} title={i18n.playList.viewMode[viewMode]}>
                <svg viewBox="0 0 24 24" width="16" height="16" class={"view-" + viewMode}><path /></svg>
            </button>
        </div>
    </div>
    
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
    
    {#if playlistTab?.id?.startsWith('alist-') && (playlistTab?.path || playlistTab?.alistPath)}
        <div class="alist-path-nav">
            <button class="path-item" on:click={() => loadAListDirectory('/')}>{i18n.playList.directory?.root || "根目录"}</button>
            {#each (playlistTab.alistPathParts || []) as part}
                <span class="path-sep">/</span>
                <button class="path-item" on:click={() => loadAListDirectory(part.path)}>{part.name}</button>
            {/each}
        </div>
    {/if}
    
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
            <div class="playlist-empty">{i18n.playList.empty}</div>
        {/if}
    </div>
    
    <PlayListFooter {i18n} on:addMedia={handleAddMedia} />
</div>