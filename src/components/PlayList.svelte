<script lang="ts">
    import { createEventDispatcher, onMount } from "svelte";
    import { showMessage, Menu } from "siyuan";
    import type { MediaItem } from '../core/types';
    import { PlaylistManager, Utils } from '../core/PlayList';
    import { Media, EXT } from '../core/player';
    import { AListManager } from '../core/alist';
    import { BilibiliParser } from '../core/bilibili';

    export let className = '', hidden = false, i18n: any, activeTabId = 'playlist', currentItem: MediaItem | null = null, plugin: any;
    
    // 极简状态
    const views = ['detailed', 'compact', 'grid', 'grid-single'] as const, icons = ['M3 3h18v18H3V3zm2 2v14h14V5H5zm2 2h10v2H7V7zm0 4h10v2H7v-2zm0 4h10v2H7v-2z', 'M3 5h18v2H3V5zm0 6h18v2H3v-2zm0 6h18v2H3v-2z', 'M3 3h8v8H3V3zm0 10h8v8H3v-8zm10 0h8v8h-8v-8zm0-10h8v8h-8V3z'];
    const getStore = (k: string, def = '') => localStorage.getItem(`media-player-${k}`) || def;
    let s = { tab: '目录', view: 'detailed' as typeof views[number], sort: +getStore('sort', '0'), input: '', mgr: null as any };
    let d = { tags: ['目录', '默认'], items: [] as MediaItem[], folder: { type: '', path: '', connected: false } };
    let ui = { edit: '', add: false, exp: new Set<string>(), parts: {} as any, sel: null as MediaItem|null, refs: {} as any };
    
    // 拖拽状态 - 极简版
    let drag = { item: -1, tag: '', target: '' };
    
    // 计算属性
    $: paths = d.folder.path.split('/').filter(Boolean).map((p, i, arr) => ({ name: p, path: (d.folder.type === 'alist' ? '/' : '') + arr.slice(0, i + 1).join('/') }));
    $: items = !s.sort ? d.items : [...d.items].sort((a, b) => 
        a.isPinned !== b.isPinned ? (a.isPinned ? -1 : 1) : 
        [0, (a, b) => a.title.localeCompare(b.title), (a, b) => (b.id?.split('-').pop() || '0').localeCompare(a.id?.split('-').pop() || '0'), (a, b) => (a.type || '').localeCompare(b.type || '')][s.sort]);
    $: hasDir = d.items.some(i => i?.is_dir);
    $: playing = (item: MediaItem) => currentItem?.id === item.id || currentItem?.id?.startsWith(`${item.id}-p`);
    $: selected = (item: MediaItem) => ui.sel?.id === item.id;
    $: isGrid = s.view.includes('grid');
    $: isCompact = s.view === 'compact';
    $: isDetailed = s.view === 'detailed';
    
    const dispatch = createEventDispatcher();
    const safe = (fn: Function) => async (...args: any[]) => { try { return await fn(...args); } catch (e: any) { showMessage(e?.message || "操作失败"); } };
    const cfg = async () => await plugin.loadData('config.json') || {};
    const map = (m: any, k: string) => m[k] || k;
    const tabs = { '目录': i18n?.playList?.tabs?.directory, '默认': i18n?.playList?.tabs?.default };
    const srcs = { 'B站': i18n?.playList?.sources?.bilibili, '本地': i18n?.playList?.sources?.local, '普通': i18n?.playList?.sources?.general, 'AList': i18n?.playList?.sources?.alist };
    
    // 视图&标签渲染
    const tags = (item: MediaItem) => `<span class="meta-tag source" data-source="${item.source}">${item.source === 'directory' ? '标签' : item.source === 'siyuan' ? '思源' : map(srcs, item.source)}</span><span class="meta-tag type" data-type="${item.type === 'audio' ? '音频' : item.type === 'folder' ? '文件夹' : '视频'}">${item.type === 'audio' ? '音频' : item.type === 'folder' ? '文件夹' : '视频'}</span>`;
    const setStore = (k: string, v: any) => localStorage.setItem(`media-player-${k}`, v), nextView = () => (s.view = views[(views.indexOf(s.view) + 1) % 4], exec('view.set', { view: s.view }));
    
    // 拖拽处理 - 一体化极简
    const dragStart = (type, i) => (drag = type === 'item' ? { item: i, tag: '', target: '' } : { item: -1, tag: i, target: '' });
    const dragEnter = (e, type, i) => (e.preventDefault(), 
        type === 'item' && drag.item !== i && drag.item > -1 && ([d.items[drag.item], d.items[i]] = [d.items[i], d.items[drag.item]], drag.item = i),
        type === 'tag' && drag.item > -1 && (drag.target = i),
        type === 'tag' && drag.tag && drag.tag !== i && d.tags.splice(d.tags.indexOf(i), 0, d.tags.splice(d.tags.indexOf(drag.tag), 1)[0]));
    const dragEnd = () => ((drag.item > -1 && drag.target ? exec('media.move', { title: d.items[drag.item].title, newPlaylist: drag.target }) : 
        drag.item > -1 ? exec('media.reorder', { tagName: s.tab, itemIds: d.items.map(i => i.id) }) : 
        drag.tag ? exec('tag.reorder', { tagOrder: d.tags }) : Promise.resolve()).then(() => load()), drag = { item: -1, tag: '', target: '' });

    // 初始化
    const init = safe(async () => { 
        Utils.setPlugin(plugin);
        s.mgr = new PlaylistManager(); 
        await load(); 
        s.view = (await s.mgr.operation('view.get')).data || 'detailed'; 
    });
    const load = safe(async () => {
        if (!s.mgr) return;
        const res = await s.mgr.getViewData(s.tab);
        d = s.tab === '目录' ? 
            { tags: ['目录', ...res.tags.filter(t => t !== '目录')], items: res.tags.filter(t => t !== '目录').map(t => ({ id: `dir-${t}`, title: t, type: 'folder', url: '#', source: 'directory', targetTabId: t, is_dir: true, thumbnail: Media.getThumbnail({ type: 'folder' }) })), folder: d.folder } : 
            { tags: ['目录', ...res.tags.filter(t => t !== '目录')], items: res.items || [], folder: d.folder };
    });

    // 文件夹
    const browse = safe(async (type: string, path = '') => {
        const res = await s.mgr.operation('folder.browse', { type, path });
        if (res?.success && res.data) {
            d.folder = { type, path: path || (type === 'alist' ? '/' : ''), connected: true };
            const items = await res.data;
            if (s.tab === { alist: 'AList', siyuan: '思源空间' }[type] || s.tab === type) 
                d.items = Array.isArray(items) ? items : [];
        }
    });

    const ensure = async (type: string, tag: string, path = '') => {
        if (type === 'alist' && !d.folder.connected && !await AListManager.initFromConfig(await cfg())) 
            return showMessage("请先配置AList连接");
        if (type === 'alist') d.folder = { connected: true, type: 'alist', path: '' };
        if (!d.tags.includes(tag)) { await exec('tag.add', { name: tag }); await load(); }
        s.tab = tag; await browse(type, path);
    };
    
    const setTab = async (tag: string) => {
        if (tag === s.tab) return;
        s.tab = tag; await load();
        const auto = { 'AList': () => ensure('alist', 'AList', '/'), '思源空间': () => browse('siyuan', '') };
        if (auto[tag] && !d.items.length) await auto[tag]();
        if (!auto[tag]) d.folder = { type: '', path: '', connected: false };
    };

    // 播放
    const click = safe(async (item: MediaItem) => {
        ui.sel = item;
        if (item.source === 'directory') return setTab(item.title);
        if (item.is_dir) return play(item);
        if (item.bvid && !ui.parts[item.id]) ui.parts[item.id] = await BilibiliParser.getVideoParts({ bvid: item.bvid }) || [];
        if (ui.parts[item.id]?.length > 1) ui.exp = new Set(ui.exp.has(item.id) ? [...ui.exp].filter(id => id !== item.id) : [...ui.exp, item.id]);
    });

    const play = safe(async (item: MediaItem) => {
        if (item.source === 'directory' && item.targetTabId) return (s.tab = item.targetTabId, load());
        if (item.is_dir) return browse(item.source === 'alist' ? 'alist' : item.source === 'siyuan' ? 'siyuan' : 'folder', item.sourcePath || '');
        if (item.source === 'alist' && item.sourcePath && !item.is_dir) return dispatch('play', await AListManager.createMediaItemFromPath(item.sourcePath));
        
        const config = await cfg(), opts = { ...item, type: item.type || 'video' };
        if ((item.source === 'B站' || item.type === 'bilibili') && item.bvid && item.cid) {
            if (!config.settings?.bilibiliLogin?.mid) return showMessage('需要登录B站才能播放视频');
            const stream = await BilibiliParser.getProcessedVideoStream(item.bvid, item.cid, 0, config);
            if (stream.dash) Object.assign(opts, { url: stream.dash.video?.[0]?.baseUrl || '', headers: stream.headers, type: 'bilibili-dash', biliDash: stream.dash });
        }
        currentItem = item; dispatch('play', opts);
    });

    // 执行器
    const exec = safe(async (action: string, params: any = {}) => {
        if (!s.mgr) return;
        if (['play', 'playPart'].includes(action)) return play(params);
        
        const res = await s.mgr.operation(action, params);
        if (res?.needsRefresh) {
            if (action === 'tag.delete' && s.tab === params.name) s.tab = '默认';
            if (action === 'tag.rename' && s.tab === params.oldName) s.tab = params.newName;
            await load();
        }
        if (action === 'media.add' && res?.success) s.input = '';
    });

    // 菜单
    const checkPro = (fn: Function) => async () => (await cfg())?.settings?.pro?.enabled ? fn() : showMessage("此功能需要Pro版本");
    const menus = {
        media: (item: any) => [
            ["iconPlay", "播放", () => exec('play', item)], 
            ["iconPin", item.isPinned ? "取消置顶" : "置顶", () => exec('media.toggle', { title: item.title, field: 'pinned' })], 
            ...(d.tags.filter(t => t !== s.tab).length ? [["iconMove", "移动到", d.tags.filter(t => t !== s.tab).map(t => [t, () => exec('media.move', { title: item.title, newPlaylist: t })])]] : []), 
            ["iconTrashcan", "删除", () => exec('media.removeFromTag', { title: item.title, tagName: s.tab })]
        ],
        tab: (tag: any) => [
            ...(tag === '默认' ? [] : [["iconEdit", "重命名", () => (ui.edit = tag, setTimeout(() => ui.refs.edit?.focus(), 0))]]), 
            ["iconClear", "清空", () => exec('media.delete', { tagName: s.tab })], 
            ...(tag === '默认' ? [] : [["iconTrashcan", "删除", () => exec('tag.delete', { name: tag })]])
        ],
        add: (_, e: MouseEvent) => [
            ["iconAdd", "添加新标签页", () => { ui.add = true; setTimeout(() => ui.refs.new?.focus(), 0); }], 
            ["iconFolder", "添加本地文件夹", () => exec('folder.add', { isSiyuan: false })], 
            ["iconImage", "添加思源空间", () => ensure('siyuan', '思源空间', '')], 
            ["iconCloud", "浏览AList云盘", checkPro(() => ensure('alist', 'AList', '/'))], 
            ["iconHeart", "添加B站收藏夹", checkPro(async () => {
                const res = await s.mgr.operation('source.listBiliFavs');
                if (!res?.success || !res.data) return;
                const menu = new Menu("biliFavs");
                res.data.forEach(f => menu.addItem({ icon: "iconHeart", label: `${f.title} (${f.media_count})`, click: () => exec('source.addBiliFav', { favId: f.id.toString(), favTitle: f.title }) }));
                menu.open({ x: e.clientX, y: e.clientY });
            })]
        ]
    };

    const menu = (e: MouseEvent, type: keyof typeof menus, target?: any) => {
        const m = new Menu(`${type}Menu`);
        menus[type](target, e).forEach(([icon, label, action]) => 
            m.addItem(Array.isArray(action) ? { icon, label, submenu: action.map(([l, a]) => ({ label: l, click: a })) } : { icon, label, click: action })
        );
        m.open({ x: e.clientX, y: e.clientY });
    };

    // 输入
    const input = (e: Event, type: 'tag' | 'add', old?: string) => {
        if (e instanceof KeyboardEvent && e.key !== 'Enter') return;
        const v = ((e.target as HTMLInputElement).value || '').trim();
        if (!v) return (type === 'tag' ? ui.edit = '' : ui.add = false);
        type === 'tag' ? (exec('tag.rename', { oldName: old, newName: v }), ui.edit = '') : (exec('tag.add', { name: v }), ui.add = false);
    };

    // 播放下一个
    export const playNext = safe(async () => {
        if (!d.items.length || !currentItem) return false;
        if (currentItem.bvid) {
            const p = parseInt(currentItem.id?.match(/-p(\d+)/)?.[1] || '1', 10);
            const parts = await BilibiliParser.getVideoParts({ bvid: currentItem.bvid });
            const next = parts?.find(pt => pt.page === p + 1);
            if (next || (await cfg())?.settings?.loop) {
                const item = { ...currentItem };
                const part = next || parts?.find(pt => pt.page === 1);
                if (part) Object.assign(item, {
                    id: `${item.id.split('-p')[0]}-p${part.page}`,
                    title: `${item.title.split(' - P')[0]}${part.page > 1 ? ` - P${part.page}${part.part ? ': ' + part.part : ''}` : ''}`,
                    cid: String(part.cid)
                });
                return await play(item), true;
            }
        }
        const idx = d.items.findIndex(i => i.id === currentItem.id || i.url === currentItem.url);
        return idx >= 0 ? (await play(d.items[(idx + 1) % d.items.length]), true) : false;
    });

    onMount(() => { 
        init();
        ['playlist-data-updated', 'configUpdated'].forEach(e => 
            window.addEventListener(e, e === 'playlist-data-updated' ? load : 
                (ev: CustomEvent) => ev.detail?.settings?.playlistDb?.id && (Utils.clearConfig(), s.mgr = new PlaylistManager(), init()))
        );
        return () => ['playlist-data-updated', 'configUpdated'].forEach(e => window.removeEventListener(e, () => {}));
    });
</script>



<div class="playlist {className}" class:hidden>
    <!-- 头部 -->
    <div class="playlist-header">
        <div class="panel-nav">
            {#each [['playlist', i18n.playList?.title || "列表"], ['assistant', i18n.assistant?.title || "助手"], ['settings', i18n.setting?.title || "设置"]] as [id, title]}
                <h3 class:active={activeTabId === id} on:click={() => id !== activeTabId && window.dispatchEvent(new CustomEvent('mediaPlayerTabChange', { detail: { tabId: id } }))}>{title}</h3>
            {/each}
        </div>
        <div class="header-controls">
            <span class="playlist-count">{d.items.length} 项</span>
            <button class="view-mode-btn" on:click={() => (s.sort = (s.sort + 1) % 4, setStore('sort', s.sort))} title={["默认", "名称", "时间", "类型"][s.sort] + "排序"}>
                <svg viewBox="0 0 24 24" width="16" height="16"><path d="M3 18h6v-2H3v2zM3 6v2h18V6H3zm0 7h12v-2H3v2z"/></svg>
            </button>
            <button class="view-mode-btn" on:click={nextView} title="视图">
                <svg viewBox="0 0 24 24" width="16" height="16"><path d={icons[views.indexOf(s.view) % 3]}/></svg>
            </button>
        </div>
    </div>
    
    <!-- 标签 -->
    <div class="playlist-tabs">
        {#each d.tags as tag, index (tag)}
            {#if ui.edit === tag}
                <input bind:this={ui.refs.edit} type="text" class="tab-input" value={tag} on:blur={e => input(e, 'tag', tag)} on:keydown={e => input(e, 'tag', tag)}>
            {:else}
                <button 
                    class="tab" 
                    class:active={s.tab === tag} 
                    draggable={tag !== '目录' && tag !== '默认'}
                    on:click={() => setTab(tag)} 
                    on:contextmenu|preventDefault={e => menu(e, 'tab', tag)}
                    on:dragstart={() => dragStart('tag', tag)}
                    on:dragover|preventDefault
                    on:dragenter={e => dragEnter(e, 'tag', tag)}
                    on:dragleave={e => drag.item !== -1 && (drag.target = '')}
                    on:dragend={dragEnd}
                >{map(tabs, tag)}</button>
            {/if}
        {/each}
        {#if ui.add}
            <input bind:this={ui.refs.new} type="text" class="tab-input" style="width:100px" placeholder="新标签名" on:blur={e => input(e, 'add')} on:keydown={e => input(e, 'add')}>
        {:else}
            <button class="tab tab-add" on:click|preventDefault|stopPropagation={e => menu(e, 'add')}>+</button>
        {/if}
    </div>
    
    <!-- 路径 -->
    {#if d.folder.type && (s.tab === 'AList' || s.tab === '思源空间') && (hasDir || paths.length)}
        <div class="alist-path-nav">
            <button class="path-item" on:click={() => browse(d.folder.type, d.folder.type === 'alist' ? '/' : '')}>根目录</button>
            {#each paths as part, i}
                <span class="path-sep">/</span>
                <button class="path-item" on:click={() => browse(d.folder.type, (d.folder.type === 'alist' ? '/' : '') + paths.slice(0, i + 1).map(p => p.name).join('/'))}>{part.name}</button>
            {/each}
        </div>
    {/if}
    
    <!-- 内容 -->
    <div class="playlist-content" class:grid-view={isGrid}>
        {#if items.length}
            <div class="playlist-items" class:grid-single={s.view === 'grid-single'}>
                {#each items as item, index (item.id)}
                   <div class="playlist-item" 
                        class:playing={playing(item)} 
                        class:selected={selected(item)} 
                        class:compact={isCompact} 
                        class:grid={isGrid} 
                        class:folder={item.is_dir}
                        draggable={!item.is_dir}
                        on:click={() => click(item)} 
                        on:dblclick={() => exec('play', item.bvid && ui.parts[item.id]?.length > 1 ? {...item, cid: String(ui.parts[item.id][0].cid)} : item)} 
                        on:contextmenu|preventDefault={e => menu(e, 'media', item)}
                        on:dragstart={() => dragStart('item', index)}
                        on:dragover|preventDefault
                        on:dragenter={e => dragEnter(e, 'item', index)}
                        on:dragend={dragEnd}>
                        
                        <!-- 极简视图 -->
                        {#if isCompact}
                            <div class="item-title" title={item.title}>{item.title}</div>
                            <div class="item-tags">{@html tags(item)}</div>
                        {:else if isGrid}
                            <div class="item-thumbnail">
                                <img src={Media.getThumbnail(item)} alt={item.title} loading="lazy">
                                <div class="grid-tags">{@html tags(item)}</div>
                                {#if item.duration}<div class="duration">{item.duration}</div>{/if}
                                <div class="item-title" title={item.title}>{item.title}</div>
                            </div>
                        {:else}
                            <div class="item-content">
                                <div class="item-thumbnail">
                                    <img src={Media.getThumbnail(item)} alt={item.title} loading="lazy">
                                    {#if item.duration}<div class="duration">{item.duration}</div>{/if}
                                </div>
                                <div class="item-info">
                                    <div class="item-title" title={item.title}>{item.title}</div>
                                    <div class="item-meta">
                                        {#if item.artist}<div class="item-artist">{#if item.artistIcon}<img class="artist-icon" src={item.artistIcon} alt={item.artist} loading="lazy">{/if}<span>{item.artist}</span></div>{/if}
                                        {@html tags(item)}
                                    </div>
                                    {#if item.url}<div class="item-url" title={item.url}><a href={item.url} target="_blank" rel="noopener noreferrer" on:click|stopPropagation>{item.url}</a></div>{/if}
                                </div>
                            </div>
                        {/if}
                        
                        {#if ui.exp.has(item.id) && ui.parts[item.id]?.length > 1}
                            <div class="item-parts" class:grid-parts={isGrid && s.view === 'grid'} class:single-parts={s.view === 'grid-single'}>
                                {#each ui.parts[item.id] as part}
                                    <button class="part-item {currentItem?.id === `${item.id}-p${part.page}` ? 'playing' : ''}" 
                                            on:click|stopPropagation={() => exec('playPart', {...item, id: `${item.id}-p${part.page}`, title: `${item.title.split(' - P')[0]} - P${part.page}${part.part ? ': ' + part.part : ''}`, cid: String(part.cid)})} 
                                            title={part.part || `P${part.page}`}>{part.page}</button>
                                {/each}
                            </div>
                        {/if}
                    </div>
                {/each}
            </div>
        {:else}
            <div class="playlist-empty">{s.mgr ? '当前标签暂无媒体项目' : '请先在设置中配置播放列表数据库'}</div>
        {/if}
    </div>
    
    <!-- 输入 -->
    <div class="playlist-footer">
        <input type="text" class="tab-input playlist-input" placeholder="输入链接或直接点击添加本地文件..." bind:value={s.input} on:keydown={e => e.key === 'Enter' && (s.input.trim() ? exec('media.add', { url: s.input.trim(), playlist: s.tab }) : (async () => {
            if (!window.navigator.userAgent.includes('Electron')) return showMessage("需要桌面版支持");
            const { filePaths } = await window.require('@electron/remote').dialog.showOpenDialog({ properties: ['openFile', 'multiSelections'], filters: [{ name: "媒体文件", extensions: EXT.MEDIA.map(ext => ext.slice(1)) }] });
            if (filePaths?.length) await Promise.all(filePaths.map(path => exec('media.add', { url: `file://${path.replace(/\\/g, '/')}`, playlist: s.tab })));
        })())}>
        {#if s.input}<span class="clear-icon" on:click={() => s.input = ''}>×</span>{/if}
        <button class="add-btn" on:click={() => s.input.trim() ? exec('media.add', { url: s.input.trim(), playlist: s.tab }) : (async () => {
            if (!window.navigator.userAgent.includes('Electron')) return showMessage("需要桌面版支持");
            const { filePaths } = await window.require('@electron/remote').dialog.showOpenDialog({ properties: ['openFile', 'multiSelections'], filters: [{ name: "媒体文件", extensions: EXT.MEDIA.map(ext => ext.slice(1)) }] });
            if (filePaths?.length) await Promise.all(filePaths.map(path => exec('media.add', { url: `file://${path.replace(/\\/g, '/')}`, playlist: s.tab })));
        })()}>添加</button>
    </div>
</div>



