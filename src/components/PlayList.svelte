<script lang="ts">
    import { createEventDispatcher, onMount } from "svelte";
    import { showMessage, Menu } from "siyuan";
    import type { MediaItem } from '../core/types';
    import { createPlaylistManager } from '../core/PlayList';
    import { getThumbnailUrl } from '../core/media';
    import { AListManager } from '../core/alist';
    import { BilibiliParser } from '../core/bilibili';

    export let className = '', hidden = false, i18n: any, activeTabId = 'playlist';
    export let currentItem: MediaItem | null = null;
    
    // 状态极简
    let activeTab = '目录', viewMode: 'detailed' | 'compact' | 'grid' | 'grid-single' = 'detailed', sortBy = 0, playlistManager: any = null, inputValue = '';
    let viewData = { tags: ['目录', '默认'], items: [] as MediaItem[], stats: { total: 0, pinned: 0, favorite: 0 }, folder: { type: '', path: '', connected: false } };
    let ui = { editTag: '', adding: false, expandedItems: new Set<string>(), videoParts: {} as { [key: string]: any[] }, selectedItem: null as MediaItem | null };
    let refs: { new?: HTMLInputElement, edit?: HTMLInputElement } = {};
    
    // 计算属性极简
    $: itemCount = viewData.items.length;
    $: pathParts = viewData.folder.path.split('/').filter(Boolean).map((part, i, arr) => ({ name: part, path: (viewData.folder.type === 'alist' ? '/' : '') + arr.slice(0, i + 1).join('/') }));
    $: sortedItems = !sortBy ? viewData.items : [...viewData.items].sort((a, b) => a.isPinned !== b.isPinned ? (a.isPinned ? -1 : 1) : [() => 0, (a, b) => a.title.localeCompare(b.title), (a, b) => (b.id?.split('-').pop() || '0').localeCompare(a.id?.split('-').pop() || '0'), (a, b) => (a.type || '').localeCompare(b.type || '')][sortBy](a, b));
    $: isPlaying = (item: MediaItem) => currentItem?.id === item.id || currentItem?.id?.startsWith(`${item.id}-p`);
    $: isSelected = (item: MediaItem) => ui.selectedItem?.id === item.id;
    
    const dispatch = createEventDispatcher();
    const safe = (fn: Function, msg = i18n?.playList?.errors?.operationFailed || "操作失败") => async (...args: any[]) => { try { return await fn(...args); } catch (error) { console.error(error); showMessage(error?.message || msg); } };
    
    // 配置管理
    const workspace = window.siyuan.config.system.workspaceDir;
    const getConfig = () => {
        try { return JSON.parse(window.require('fs').readFileSync(`${workspace}/data/storage/petal/siyuan-media-player/config.json`, 'utf-8')); }
        catch { return { settings: {}, bilibiliLogin: undefined }; }
    };

    // 国际化辅助函数
    const getTabName = (tab: string) => { const tabMap = { '目录': i18n?.playList?.tabs?.directory || '目录', '默认': i18n?.playList?.tabs?.default || '默认', '收藏': i18n?.playList?.tabs?.favorites || '收藏' }; return tabMap[tab] || tab; };
    const getSourceName = (source: string) => { const sourceMap = { 'B站': i18n?.playList?.sources?.bilibili || 'B站', '本地': i18n?.playList?.sources?.local || '本地', '普通': i18n?.playList?.sources?.general || '普通', 'AList': i18n?.playList?.sources?.alist || 'AList' }; return sourceMap[source] || source; };
    
    // 初始化
    const init = safe(async () => { playlistManager = createPlaylistManager(); await loadData(); }, i18n?.playList?.errors?.initFailed || "初始化失败");

    // 数据加载
    const loadData = safe(async () => {
        if (!playlistManager) return;
        const data = await playlistManager.getViewData(activeTab);
        const baseTags = ['目录', ...data.tags.filter(t => t !== '目录')];
        viewData = activeTab === '目录' ? { ...viewData, tags: baseTags, items: data.tags.filter(t => t !== '目录').map(tag => ({ id: `directory-${tag}`, title: tag, type: 'folder', url: '#', source: 'directory', targetTabId: tag, is_dir: true, thumbnail: getThumbnailUrl({ type: 'folder' }) } as MediaItem)), stats: { total: data.tags.length - 1, pinned: 0, favorite: 0 } } : { ...viewData, ...data, tags: baseTags };
    }, i18n?.playList?.errors?.loadDataFailed || "加载数据失败");

    // 文件夹浏览
    const browseFolder = safe(async (type: string, path = '') => {
        const result = await playlistManager.operation('folder.browse', { type, path });
        if (result.success) {
            viewData.folder = { type, path: path || (type === 'alist' ? '/' : ''), connected: true };
            const tabMap = { alist: 'AList', siyuan: '思源空间' };
            if (activeTab === tabMap[type] || activeTab === type) {
                viewData = { ...viewData, items: result.data, stats: { total: result.data.length, pinned: 0, favorite: 0 } };
            }
        }
    }, i18n?.playList?.errors?.getFolderListFailed || "获取文件列表失败");

    // 连接管理
    const ensureTabAndBrowse = async (type: string, tagName: string, path = '') => {
        if (type === 'alist' && !(viewData.folder.connected && viewData.folder.type === 'alist')) {
            const connected = await AListManager.initFromConfig(getConfig());
            if (!connected) return showMessage(i18n?.playList?.errors?.alistConnectionRequired || "请先配置AList连接");
            viewData.folder = { connected: true, type: 'alist', path: '' };
        }
        if (!viewData.tags.includes(tagName)) { await exec('tag.add', { name: tagName }); await loadData(); }
        activeTab = tagName;
        await browseFolder(type, path);
    };

    // 点击处理
    const handleClick = safe(async (item: MediaItem) => {
        ui.selectedItem = item;
        if (item.source === 'directory') { setTab(item.title); return; }
        if (item.is_dir) { await playMedia(item); return; }
        if (item.bvid) {
            if (!ui.videoParts[item.id]) ui.videoParts[item.id] = await BilibiliParser.getVideoParts({ bvid: item.bvid }) || [];
            if (ui.videoParts[item.id]?.length > 1) {
                ui.expandedItems.has(item.id) ? ui.expandedItems.delete(item.id) : ui.expandedItems.add(item.id);
                ui.expandedItems = new Set(ui.expandedItems);
            }
        }
    }, i18n?.playList?.errors?.selectionFailed || "选择失败");

    // 播放媒体
    const playMedia = safe(async (item: MediaItem) => {
        if (item.source === 'directory' && item.targetTabId) { activeTab = item.targetTabId; await loadData(); return; }
        if (item.is_dir && item.source) { await browseFolder({ alist: 'alist', siyuan: 'siyuan', folder: 'folder' }[item.source] || item.source, item.sourcePath); return; }
        if (item.source === 'alist' && item.sourcePath && !item.is_dir) { dispatch('play', await AListManager.createMediaItemFromPath(item.sourcePath)); return; }
            
            const config = getConfig();
            const playOptions = { ...item, type: item.type || 'video' };
            
        if ((item.source === 'B站' || item.type === 'bilibili') && item.bvid && item.cid) {
            if (!config.bilibiliLogin?.userInfo?.mid) return showMessage(i18n?.playList?.errors?.biliLoginRequired || '需要登录B站才能播放视频');
                const streamInfo = await BilibiliParser.getProcessedVideoStream(item.bvid, item.cid, 0, config);
            if (streamInfo.dash) Object.assign(playOptions, { url: streamInfo.dash.video?.[0]?.baseUrl || '', headers: streamInfo.headers, type: 'bilibili-dash', biliDash: streamInfo.dash });
            }
            
            currentItem = item;
            dispatch('play', playOptions);
    }, i18n?.playList?.errors?.playFailed || "播放失败");

    // 执行器
    const exec = safe(async (action: string, params: any = {}) => {
        if (!playlistManager) return;
        if (action === 'play' || action === 'playPart') { await playMedia(params); return; }
        
        const result = await playlistManager.operation(action, params);
        if (result?.message) showMessage(result.message);
        if (result?.needsRefresh) {
            if (action === 'tag.delete' && activeTab === params.name) activeTab = '默认';
            if (action === 'tag.rename' && activeTab === params.oldName) activeTab = params.newName;
            await loadData();
        }
        if (action === 'media.add' && result?.success) inputValue = '';
    });

    // 文件选择
    const selectFiles = safe(async () => {
        if (!window.navigator.userAgent.includes('Electron')) return showMessage(i18n?.playList?.errors?.desktopRequired || "需要桌面版支持");
        const { filePaths } = await window.require('@electron/remote').dialog.showOpenDialog({ properties: ['openFile', 'multiSelections'], filters: [{ name: i18n?.playList?.dialog?.mediaFiles || "媒体文件", extensions: ['mp3', 'wav', 'ogg', 'm4a', 'flac', 'mp4', 'webm', 'mkv', 'avi', 'mov'] }] });
        if (!filePaths?.length) return;
        const results = await Promise.allSettled(filePaths.map(path => exec('media.add', { url: `file://${path.replace(/\\/g, '/')}`, playlist: activeTab })));
        const count = results.filter(r => r.status === 'fulfilled').length;
        if (count) showMessage(i18n?.playList?.messages?.filesAdded?.replace('${count}', count) || `已添加${count}个文件`);
    }, i18n?.playList?.errors?.fileSelectionFailed || "文件选择失败");

    // 菜单系统
    const checkPro = (fn: Function) => async () => { const config = getConfig(); return config?.settings?.pro?.enabled ? fn() : showMessage(i18n?.pro?.notEnabled || "此功能需要Pro版本"); };
    const menus = {
        media: (item: any) => [["iconPlay", i18n?.playList?.menu?.play || "播放", () => exec('play', item)], ["iconPin", item.isPinned ? (i18n?.playList?.menu?.unpin || "取消置顶") : (i18n?.playList?.menu?.pin || "置顶"), () => exec('media.toggle', { title: item.title, field: 'pinned' })], ["iconHeart", item.isFavorite ? (i18n?.playList?.menu?.unfavorite || "取消收藏") : (i18n?.playList?.menu?.favorite || "收藏"), () => exec('media.toggle', { title: item.title, field: 'favorite' })], ...(viewData.tags.filter(tag => tag !== activeTab).length ? [["iconMove", i18n?.playList?.menu?.moveTo || "移动到", viewData.tags.filter(tag => tag !== activeTab).map(tag => [tag, () => exec('media.move', { title: item.title, newPlaylist: tag })])]] : []), ["iconTrashcan", i18n?.playList?.menu?.delete || "删除", () => exec('media.removeFromTag', { title: item.title, tagName: activeTab })]],
        tab: (tag: any) => { const isSystem = ['默认', '收藏'].includes(tag); return [...(!isSystem ? [["iconEdit", i18n?.playList?.menu?.rename || "重命名", () => { ui.editTag = tag; setTimeout(() => refs.edit?.focus(), 0); }]] : []), ["iconClear", i18n?.playList?.menu?.clear || "清空", () => exec('media.delete', { tagName: activeTab })], ...(!isSystem ? [["iconTrashcan", i18n?.playList?.menu?.delete || "删除", () => exec('tag.delete', { name: tag })]] : [])]; },
        add: (_, e: MouseEvent) => [["iconAdd", i18n?.playList?.menu?.addNewTab || "添加新标签页", () => { ui.adding = true; setTimeout(() => refs.new?.focus(), 0); }], ["iconFolder", i18n?.playList?.menu?.addLocalFolder || "添加本地文件夹", () => exec('folder.add', { isSiyuan: false })], ["iconImage", i18n?.playList?.menu?.addSiyuanAssets || "添加思源空间", () => ensureTabAndBrowse('siyuan', '思源空间', '')], ["iconCloud", i18n?.playList?.menu?.addAList || "浏览AList云盘", checkPro(() => ensureTabAndBrowse('alist', 'AList', '/'))], ["iconHeart", i18n?.playList?.menu?.addBilibiliFavorites || "添加B站收藏夹", checkPro(async () => { const result = await playlistManager.operation('source.listBiliFavs'); if (!result?.success || !result.data) return; const menu = new Menu("biliFavs"); result.data.forEach(folder => menu.addItem({ icon: "iconHeart", label: `${folder.title} (${folder.media_count})`, click: () => exec('source.addBiliFav', { favId: folder.id.toString(), favTitle: folder.title }) })); menu.open({ x: e.clientX, y: e.clientY }); })]]
    };

    const showMenu = (e: MouseEvent, type: keyof typeof menus, target?: any) => {
        const menu = new Menu(`${type}Menu`);
        menus[type](target, e).forEach(([icon, label, action]) => Array.isArray(action) ? menu.addItem({ icon, label, submenu: action.map(([l, a]) => ({ label: l, click: a })) }) : menu.addItem({ icon, label, click: action }));
        menu.open({ x: e.clientX, y: e.clientY });
    };

    // 输入处理
    const handleInput = (e: Event, type: 'tag' | 'add', oldName?: string) => {
        if (e instanceof KeyboardEvent && e.key !== 'Enter') return;
        const input = e.target as HTMLInputElement, value = input.value.trim();
        if (type === 'tag') { if (value && value !== oldName) exec('tag.rename', { oldName, newName: value }); ui.editTag = ''; } 
        else { if (value) exec('tag.add', { name: value }); ui.adding = false; input.value = ''; }
    };

    // 标签切换
    const setTab = async (tagName: string) => {
        if (tagName === activeTab) return;
        activeTab = tagName; await loadData();
        const autoLoad = { 'AList': () => ensureTabAndBrowse('alist', 'AList', '/'), '思源空间': () => browseFolder('siyuan', '') };
        if (autoLoad[tagName] && !viewData.items.length) await autoLoad[tagName]();
        if (!autoLoad[tagName]) viewData.folder = { type: '', path: '', connected: false };
    };

    // 分P更新
    const updateBiliPart = safe(async (item: MediaItem, bvid: string, p: number) => {
        const parts = await BilibiliParser.getVideoParts({ bvid }), currentPart = parts?.find(part => part.page === p);
            if (currentPart) {
                const baseId = item.id.split('-p')[0];
                item.id = `${baseId}-p${p}`;
            item.title = p > 1 ? `${item.title.split(' - P')[0]} - P${p}${currentPart.part ? ': ' + currentPart.part : ''}` : item.title.split(' - P')[0];
                item.cid = String(currentPart.cid);
            }
    }, i18n?.playList?.errors?.updatePartFailed || "更新分P失败");

    // 播放下一个
    export const playNext = safe(async () => {
        if (!viewData.items.length || !currentItem) return false;
        if ((currentItem.source === 'B站' || currentItem.type === 'bilibili') && currentItem.bvid) {
            const currPart = parseInt(currentItem.id?.match(/-p(\d+)/)?.[1] || '1', 10);
                const parts = await BilibiliParser.getVideoParts({ bvid: currentItem.bvid });
                if (!parts?.length) return false;
                const nextPart = parts.find(p => p.page === currPart + 1);
                const config = getConfig();
                if (nextPart || config?.settings?.loop) {
                    const nextItem = { ...currentItem };
                    await updateBiliPart(nextItem, currentItem.bvid, nextPart ? currPart + 1 : 1);
                    await playMedia(nextItem);
                    return true;
            }
            return false;
        }
        const idx = viewData.items.findIndex(i => i.id === currentItem.id || i.url === currentItem.url);
        if (idx >= 0) { await playMedia(viewData.items[(idx + 1) % viewData.items.length]); return true; }
        return false;
    }, i18n?.playList?.errors?.playNextFailed || "播放下一个失败");

    // 导出函数
    export const handleMediaItem = safe(async (mediaItem: MediaItem) => await playMedia(mediaItem), i18n?.playList?.errors?.handleMediaItemFailed || "处理媒体项失败");

    // 事件处理
    const handleKeydown = (e: KeyboardEvent) => e.key === 'Enter' && (inputValue.trim() ? exec('media.add', { url: inputValue.trim(), playlist: activeTab }) : selectFiles());
    const changeTab = (tabId: string) => tabId !== activeTabId && window.dispatchEvent(new CustomEvent('mediaPlayerTabChange', { detail: { tabId } }));
    const toggleView = () => viewMode = (['detailed', 'compact', 'grid', 'grid-single'] as const)[((['detailed', 'compact', 'grid', 'grid-single'] as const).indexOf(viewMode) + 1) % 4];

    onMount(() => { init(); const handleUpdate = () => loadData(); window.addEventListener('playlist-data-updated', handleUpdate); return () => window.removeEventListener('playlist-data-updated', handleUpdate); });
</script>

<div class="playlist {className}" class:hidden>
    <!-- 头部导航 -->
    <div class="playlist-header">
        <div class="panel-nav">
            {#each [['playlist', i18n.playList?.title || "列表"], ['assistant', i18n.assistant?.title || "助手"], ['settings', i18n.setting?.title || "设置"]] as [id, title]}
                <h3 class:active={activeTabId === id} on:click={() => changeTab(id)}>{title}</h3>
            {/each}
        </div>
        <div class="header-controls">
            <span class="playlist-count">{itemCount} {i18n?.playList?.ui?.itemCount || "项"}</span>
            <button class="view-mode-btn" on:click={() => sortBy = (sortBy + 1) % 4} title={[i18n?.playList?.sortMode?.[0] || "默认排序", i18n?.playList?.sortMode?.[1] || "按名称排序", i18n?.playList?.sortMode?.[2] || "按时间排序", i18n?.playList?.sortMode?.[3] || "按类型排序"][sortBy]}>
                <svg viewBox="0 0 24 24" width="16" height="16"><path d="M3 18h6v-2H3v2zM3 6v2h18V6H3zm0 7h12v-2H3v2z" /></svg>
            </button>
            <button class="view-mode-btn" on:click={toggleView} title={i18n?.playList?.ui?.viewMode || "视图模式"}>
                <svg viewBox="0 0 24 24" width="16" height="16"><path d={viewMode === 'detailed' ? 'M3 3h18v18H3V3zm2 2v14h14V5H5zm2 2h10v2H7V7zm0 4h10v2H7v-2zm0 4h10v2H7v-2z' : viewMode === 'compact' ? 'M3 5h18v2H3V5zm0 6h18v2H3v-2zm0 6h18v2H3v-2z' : 'M3 3h8v8H3V3zm0 10h8v8H3v-8zm10 0h8v8h-8v-8zm0-10h8v8h-8V3z'} /></svg>
            </button>
        </div>
    </div>
    
    <!-- 标签栏 -->
    <div class="playlist-tabs">
        {#each viewData.tags as tag (tag)}
            {#if ui.editTag === tag}
                <input bind:this={refs.edit} type="text" class="tab-input" value={tag} on:blur={(e) => handleInput(e, 'tag', tag)} on:keydown={(e) => handleInput(e, 'tag', tag)}/>
            {:else}
                <button class="tab" class:active={activeTab === tag} on:click={() => setTab(tag)} on:contextmenu|preventDefault={(e) => showMenu(e, 'tab', tag)}>{getTabName(tag)}</button>
            {/if}
        {/each}
        {#if ui.adding}
                            <input bind:this={refs.new} type="text" class="tab-input" style="width:100px" placeholder={i18n?.playList?.ui?.newTabPlaceholder || "新标签名"} on:blur={(e) => handleInput(e, 'add')} on:keydown={(e) => handleInput(e, 'add')}/>
        {:else}
            <button class="tab tab-add" on:click|preventDefault|stopPropagation={(e) => showMenu(e, 'add')}>+</button>
        {/if}
    </div>
    
    <!-- 文件夹导航条 -->
    {#if viewData.folder.type && (activeTab === 'AList' || activeTab === '思源空间') && (viewData.items.some(item => item.is_dir) || pathParts.length)}
        <div class="alist-path-nav">
                            <button class="path-item" on:click={() => browseFolder(viewData.folder.type, viewData.folder.type === 'alist' ? '/' : '')}>{i18n?.playList?.ui?.rootDirectory || "根目录"}</button>
            {#each pathParts as part, i}
                <span class="path-sep">/</span>
                <button class="path-item" on:click={() => browseFolder(viewData.folder.type, pathParts.slice(0, i + 1).map(p => p.name).join(viewData.folder.type === 'alist' ? '/' : '/'))}>{part.name}</button>
            {/each}
        </div>
    {/if}
    
    <!-- 内容区 -->
    <div class="playlist-content" class:grid-view={viewMode === 'grid' || viewMode === 'grid-single'}>
        {#if sortedItems.length}
            <div class="playlist-items" class:grid-single={viewMode === 'grid-single'}>
                {#each sortedItems as item (item.id)}
                   <div class="playlist-item" class:playing={isPlaying(item)} class:selected={isSelected(item)} class:compact={viewMode === 'compact'} class:grid={viewMode === 'grid' || viewMode === 'grid-single'} class:folder={item.is_dir} on:click={() => handleClick(item)} on:dblclick={() => exec('play', item.bvid && ui.videoParts[item.id]?.length > 1 ? {...item, cid: String(ui.videoParts[item.id][0].cid)} : item)} on:contextmenu|preventDefault={(e) => showMenu(e, 'media', item)}>
                        {#if viewMode === 'grid' || viewMode === 'grid-single'}
                            <div class="item-thumbnail">
                                <img src={getThumbnailUrl(item)} alt={item.title} loading="lazy"/>
                                {#if item.duration}<div class="duration">{item.duration}</div>{/if}
                                <div class="item-title" title={item.title}>{item.title}</div>
                            </div>
                        {:else if viewMode === 'compact'}
                            <div class="item-title" title={item.title}>{item.title}</div>
                        {:else}
                            <div class="item-content">
                                <div class="item-thumbnail">
                                    <img src={getThumbnailUrl(item)} alt={item.title} loading="lazy"/>
                                    {#if item.duration}<div class="duration">{item.duration}</div>{/if}
                                </div>
                                <div class="item-info">
                                    <div class="item-title" title={item.title}>{item.title}</div>
                                    <div class="item-meta">
                                        {#if item.artist}
                                            <div class="item-artist">
                                                {#if item.artistIcon}<img class="artist-icon" src={item.artistIcon} alt={item.artist} loading="lazy"/>{/if}
                                                <span>{item.artist}</span>
                                            </div>
                                        {/if}
                                        <span class="meta-tag source" data-source={item.source}>{item.source === 'directory' ? (i18n?.playList?.labels?.tag || '标签') : item.source === 'siyuan' ? (i18n?.playList?.labels?.siyuan || '思源') : getSourceName(item.source)}</span>
                                        <span class="meta-tag type" data-type={item.type === 'audio' ? '音频' : item.type === 'folder' ? '文件夹' : '视频'}>{item.type === 'audio' ? (i18n?.playList?.labels?.audio || '音频') : item.type === 'folder' ? (i18n?.playList?.labels?.folder || '文件夹') : (i18n?.playList?.labels?.video || '视频')}</span>
                                    </div>
                                    {#if item.url}
                                        <div class="item-url" title={item.url}><a href={item.url} target="_blank" rel="noopener noreferrer" on:click|stopPropagation>{item.url}</a></div>
                                    {/if}
                                </div>
                            </div>
                        {/if}
                        
                        <!-- B站分P列表 -->
                        {#if ui.expandedItems.has(item.id) && ui.videoParts[item.id]?.length > 1}
                            <div class="item-parts" class:grid-parts={viewMode === 'grid'} class:single-parts={viewMode === 'grid-single'}>
                                {#each ui.videoParts[item.id] as part}
                                    <button class="part-item {currentItem?.id === `${item.id}-p${part.page}` ? 'playing' : ''}" on:click|stopPropagation={() => exec('playPart', {...item, id: `${item.id}-p${part.page}`, title: `${item.title.split(' - P')[0]} - P${part.page}${part.part ? ': ' + part.part : ''}`, cid: String(part.cid)})} title={part.part || `P${part.page}`}>{part.page}</button>
                                {/each}
                            </div>
                        {/if}
                    </div>
                {/each}
            </div>
        {:else}
            <div class="playlist-empty">{playlistManager ? (i18n?.playList?.ui?.emptyStateNoItems || '当前标签暂无媒体项目') : (i18n?.playList?.ui?.emptyStateNoDatabase || '请先在设置中配置播放列表数据库')}</div>
        {/if}
    </div>
    
    <!-- 底部输入 -->
    <div class="playlist-footer">
        <input type="text" class="tab-input playlist-input" placeholder={i18n?.playList?.ui?.mediaLinkPlaceholder || "输入链接或直接点击添加本地文件..."} bind:value={inputValue} on:keydown={handleKeydown}/>
        {#if inputValue}<span class="clear-icon" on:click={() => inputValue = ''}>×</span>{/if}
        <button class="add-btn" on:click={() => inputValue.trim() ? exec('media.add', { url: inputValue.trim(), playlist: activeTab }) : selectFiles()}>{i18n?.playList?.ui?.addButton || "添加"}</button>
    </div>
</div>



