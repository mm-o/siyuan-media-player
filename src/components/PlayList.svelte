<script lang="ts">
    import { createEventDispatcher, onMount } from "svelte";
    import { showMessage, Menu } from "siyuan";
    import type { MediaItem } from '../core/types';
    import { Media, EXT } from '../core/player';
    import { AListManager } from '../core/alist';
    import { BilibiliParser } from '../core/bilibili';

    export let className = '', hidden = false, i18n: any, activeTabId = 'playlist', currentItem: MediaItem | null = null, plugin: any;

    // ==================== 常量配置 ====================
    const VIEWS = ['detailed', 'compact', 'grid', 'grid-single'] as const;
    const ICONS = ['M3 3h18v18H3V3zm2 2v14h14V5H5zm2 2h10v2H7V7zm0 4h10v2H7v-2zm0 4h10v2H7v-2z', 'M3 5h18v2H3V5zm0 6h18v2H3v-2zm0 6h18v2H3v-2z', 'M3 3h8v8H3V3zm0 10h8v8H3v-8zm10 0h8v8h-8v-8zm0-10h8v8h-8V3z'];
    const FIELDS = { title: '媒体标题', source: '来源', url: 'URL', artist: '艺术家', artistIcon: '艺术家头像', thumbnail: '封面图', playlist: '所在标签', duration: '时长', type: '类型', created: '创建时间' };
    const FIELD_DEFS = {
        title: { type: 'block', pin: true },
        source: { type: 'select', options: [['B站', '4'], ['本地', '6'], ['AList', '3']] },
        url: { type: 'url' },
        artist: { type: 'text' },
        artistIcon: { type: 'mAsset' },
        thumbnail: { type: 'mAsset' },
        playlist: { type: 'mSelect', options: [['默认', '1']] },
        duration: { type: 'text' },
        type: { type: 'select', options: [['视频', '4'], ['音频', '5']] },
        created: { type: 'date' }
    };

    // ==================== 工具函数 ====================
    const id = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
    const safe = (fn: Function) => async (...args: any[]) => { try { return await fn(...args); } catch (e: any) { showMessage(e?.message || "操作失败"); } };
    const cfg = async () => await plugin.loadData('config.json') || {};
    const dispatch = createEventDispatcher();

    // ==================== 状态管理 ====================
    let s = { tab: '目录', view: 'detailed' as typeof VIEWS[number], input: '', dbId: '' };
    let d = { tags: ['目录', '默认'], items: [] as MediaItem[], folder: { type: '', path: '', connected: false } };
    let ui = { edit: '', add: false, exp: new Set<string>(), parts: {} as any, sel: null as MediaItem|null, refs: {} as any };
    let drag = { item: -1, tag: '', target: '' };

    // ==================== 数据库操作 ====================
    const getAvId = async (blockId: string) => (await fetch('/api/query/sql', { method: 'POST', body: JSON.stringify({ stmt: `SELECT markdown FROM blocks WHERE type='av' AND id='${blockId}'` }) }).then(r => r.json())).data?.[0]?.markdown?.match(/data-av-id="([^"]+)"/)?.[1] || (() => { throw new Error('未找到属性视图ID'); })();
    const loadDb = async (avId: string) => JSON.parse(window.require('fs').readFileSync(`${window.siyuan.config.system.workspaceDir}/data/storage/av/${avId}.json`, 'utf-8'));
    const saveDb = async (avId: string, data: any) => (window.require('fs').writeFileSync(`${window.siyuan.config.system.workspaceDir}/data/storage/av/${avId}.json`, JSON.stringify(data, null, 2)), fetch('/api/ui/reloadAttributeView', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: avId }) }).catch(() => {}));
    const col = (data: any, name: string) => data.keyValues?.find((kv: any) => kv.key.name === name);
    const field = (data: any, name: string, id: string) => col(data, name)?.values?.find((v: any) => v.blockID === id);
    const record = (data: any, title: string) => col(data, FIELDS.title)?.values?.find((v: any) => v.block?.content === title);

    // 字段值创建器
    const createFieldValue = (key: string, value: any) => {
        const creators = {
            title: (v: any) => ({ block: { id: id(), icon: '', content: String(v), created: Date.now(), updated: Date.now() }, isDetached: true }),
            url: (v: any) => ({ url: { content: String(v) } }),
            playlist: (v: any) => ({ mSelect: Array.isArray(v) ? v.map(i => ({ content: String(i), color: '' })) : [{ content: String(v), color: '' }] }),
            source: (v: any) => ({ mSelect: [{ content: String(v), color: '' }] }),
            type: (v: any) => ({ mSelect: [{ content: String(v), color: '' }] }),
            artistIcon: (v: any) => ({ mAsset: [{ type: 'image', name: '', content: String(v) }] }),
            thumbnail: (v: any) => ({ mAsset: [{ type: 'image', name: '', content: String(v) }] }),
            created: (v: any) => ({ date: { content: v, isNotEmpty: true, hasEndDate: false, isNotTime: false, content2: 0, isNotEmpty2: false, formattedContent: '' } }),
            default: (v: any) => ({ text: { content: String(v) } })
        };
        return creators[key] || creators.default;
    };

    // ==================== 数据库操作核心 ====================
    const dbOp = async (action: string, params: any = {}) => {
        const avId = await getAvId(s.dbId);
        const data = await loadDb(avId);

        switch (action) {
            case 'init':
                data.keyValues = data.keyValues?.filter(kv => Object.values(FIELDS).includes(kv.key.name)) || [];
                data.views = data.views || [{ table: { columns: [], rowIds: [] } }];
                Object.entries(FIELDS).forEach(([key, name]) => {
                    if (!col(data, name)) {
                        const keyId = id();
                        const fieldDef = FIELD_DEFS[key] || { type: 'text' };
                        const k: any = { id: keyId, name, type: fieldDef.type, icon: '', desc: '', numberFormat: '', template: '' };
                        if (fieldDef.options) k.options = fieldDef.options.map(([n, c]) => ({ name: n, color: c, desc: '' }));
                        data.keyValues.push({ key: k });
                        data.views[0].table.columns[fieldDef.pin ? 'unshift' : 'push']({ id: keyId, wrap: false, hidden: false, pin: !!fieldDef.pin, width: '' });
                    }
                });
                s.view = data.views[0].view || 'detailed';
                break;

            case 'load':
                const playlistCol = col(data, FIELDS.playlist);
                const tags = [...(playlistCol?.key?.options?.map(opt => opt.name) || []), '默认'].filter((t, i, a) => a.indexOf(t) === i);
                d.tags = ['目录', ...tags.filter(t => t !== '目录')];

                if (s.tab === '目录') {
                    d.items = tags.filter(t => t !== '目录').map(t => ({ id: `dir-${t}`, title: t, type: 'folder', url: '#', source: 'directory', targetTabId: t, is_dir: true, thumbnail: Media.getThumbnail({ type: 'folder' }) }));
                } else {
                    const titleCol = col(data, FIELDS.title);
                    if (!titleCol?.values) { d.items = []; return; }
                    const blockIds = new Set(playlistCol?.values?.filter(v => v.mSelect?.some(tag => tag.content === s.tab)).map(r => r.blockID) || []);
                    d.items = (data.views[0].table.rowIds || []).filter(id => blockIds.has(id)).map(id => {
                        const item: any = { id };
                        Object.entries(FIELDS).forEach(([key, name]) => {
                            const f = field(data, name, id);
                            if (key === 'type') item[key] = f?.mSelect?.[0]?.content === '音频' ? 'audio' : 'video';
                            else if (key === 'title') item[key] = f?.block?.content || '未知标题';
                            else item[key] = f?.text?.content || f?.url?.content || f?.mSelect?.[0]?.content || f?.mAsset?.[0]?.content || f?.date?.content || '';
                        });
                        return item;
                    });
                }
                return;

            case 'add':
                const { media, playlist = '默认', checkDup = true } = params;
                if (checkDup && media.url) {
                    const dup = col(data, FIELDS.url)?.values?.find(v => v.url?.content === media.url);
                    if (dup) { showMessage('媒体已存在'); return; }
                }
                const blockId = id();
                data.views[0].table.rowIds = data.views[0].table.rowIds || [];
                data.views[0].table.rowIds.push(blockId);
                Object.entries(FIELDS).forEach(([key, name]) => {
                    const c = col(data, name);
                    if (!c) return;
                    let v = media[key];
                    if (key === 'title') v = media.title;
                    else if (key === 'source') v = media.source === 'alist' ? 'AList' : (media.url?.includes('bilibili.com') || media.bvid) ? 'B站' : (media.source === 'local' || media.url?.startsWith('file://')) ? '本地' : '普通';
                    else if (key === 'playlist') v = [playlist];
                    else if (key === 'type') v = media.type === 'audio' ? '音频' : '视频';
                    else if (key === 'created') v = Date.now();

                    if (v !== undefined && v !== null && v !== '') {
                        c.values = c.values || [];
                        const val = createFieldValue(key)(v);
                        c.values.push({ id: id(), keyID: c.key.id, blockID: blockId, type: c.key.type, createdAt: Date.now(), updatedAt: Date.now(), ...val });
                    }
                });
                showMessage('添加成功');
                break;

            case 'del':
                const { title, tagName } = params;
                let blockIds: string[] = [];
                if (tagName) blockIds = col(data, FIELDS.playlist)?.values?.filter(v => v.mSelect?.some(tag => tag.content === tagName)).map(r => r.blockID) || [];
                else if (title) { const r = record(data, title); blockIds = r ? [r.blockID] : []; }
                if (!blockIds.length) throw new Error('未找到记录');
                const blockIdSet = new Set(blockIds);
                data.keyValues.forEach((kv: any) => { if (kv.values) kv.values = kv.values.filter((v: any) => !blockIdSet.has(v.blockID)); });
                data.views[0].table.rowIds = data.views[0].table.rowIds?.filter((id: string) => !blockIdSet.has(id)) || [];
                showMessage(`删除了${blockIds.length}条记录`);
                break;

            case 'move':
                const { title: moveTitle, newPlaylist } = params;
                const rec = record(data, moveTitle);
                if (!rec) throw new Error('未找到记录');
                await dbOp('ensure', { tagName: newPlaylist });
                const playlistCol2 = col(data, FIELDS.playlist);
                const f = playlistCol2?.values?.find(v => v.blockID === rec.blockID);
                if (f) { f.mSelect = [{ content: newPlaylist, color: '' }]; f.updatedAt = Date.now(); }
                else if (playlistCol2) { playlistCol2.values = playlistCol2.values || []; playlistCol2.values.push({ id: id(), keyID: playlistCol2.key.id, blockID: rec.blockID, type: 'mSelect', createdAt: Date.now(), updatedAt: Date.now(), mSelect: [{ content: newPlaylist, color: '' }] }); }
                showMessage(`已移动到"${newPlaylist}"`);
                break;

            case 'ensure':
                const { tagName: ensureTag } = params;
                const playlistCol3 = col(data, FIELDS.playlist);
                if (!playlistCol3?.key) return;
                playlistCol3.key.options = playlistCol3.key.options || [];
                if (!playlistCol3.key.options.some(opt => opt.name === ensureTag)) {
                    playlistCol3.key.options.push({ name: ensureTag, color: String((playlistCol3.key.options.length % 8) + 1), desc: '' });
                }
                break;

            case 'setView':
                data.views[0].view = params.view;
                break;

            case 'reorder':
                if (params.type === 'items') data.views[0].table.rowIds = d.items.map(i => i.id);
                else if (params.type === 'tags') {
                    const playlistCol4 = col(data, FIELDS.playlist);
                    if (playlistCol4?.key?.options) playlistCol4.key.options = d.tags.filter(t => t !== '目录').map(tagName => playlistCol4.key.options.find(opt => opt.name === tagName)).filter(Boolean);
                }
                break;
        }

        await saveDb(avId, data);
        if (['load', 'add', 'del', 'move'].includes(action)) await dbOp('load');
    };

    // ==================== 核心业务操作 ====================
    const init = async () => {
        const config = await cfg();
        s.dbId = config.settings?.playlistDb?.id;
        if (!s.dbId) throw new Error('未配置数据库');
        await dbOp('init');
        await load();
    };

    const load = () => dbOp('load');
    const add = async (url: string, playlist = '默认', checkDup = true) => {
        const result = await Media.processUrl(url);
        if (!result.success || !result.mediaItem) throw new Error(result.error || '无法解析媒体链接');
        await dbOp('add', { media: result.mediaItem, playlist, checkDup });
        window.dispatchEvent(new CustomEvent('refreshPlaylist'));
    };
    const del = (title?: string, tagName?: string) => dbOp('del', { title, tagName });
    const move = (title: string, newPlaylist: string) => dbOp('move', { title, newPlaylist });
    const ensure = (tagName: string) => dbOp('ensure', { tagName });

    // ==================== 文件夹浏览 ====================
    const browse = async (type: string, path = '') => {
        if (type === 'alist') {
            const items = await AListManager.createMediaItemsFromDirectory(path || '/');
            d.folder = { type: 'alist', path: path || '/', connected: true };
            if (s.tab === 'AList') d.items = Array.isArray(items) ? items : [];
        } else {
            if (!window.navigator.userAgent.includes('Electron')) throw new Error('此功能仅在桌面版可用');
            const fs = window.require('fs'), pathLib = window.require('path');
            const fullPath = type === 'siyuan' ? pathLib.join(window.siyuan.config.system.workspaceDir, 'data', path) : path;
            const items: any[] = [];

            try {
                fs.readdirSync(fullPath).forEach((file: string) => {
                    const filePath = pathLib.join(fullPath, file);
                    const stats = fs.statSync(filePath);

                    if (stats.isDirectory()) {
                        items.push({ id: `${type}-folder-${Date.now()}-${Math.random().toString(36).slice(2,5)}`, title: file, type: 'folder', url: '#', source: type, sourcePath: type === 'siyuan' ? pathLib.relative(pathLib.join(window.siyuan.config.system.workspaceDir, 'data'), filePath).replace(/\\/g, '/') : filePath, is_dir: true });
                    } else if (EXT.MEDIA.some(ext => file.toLowerCase().endsWith(ext))) {
                        items.push({ id: `${type}-${Date.now()}-${Math.floor(Math.random() * 1000)}`, title: file, url: `file://${filePath.replace(/\\/g, '/')}`, type: EXT.AUDIO.includes(`.${file.toLowerCase().split('.').pop()}`) ? 'audio' : 'video', source: '本地', sourcePath: filePath });
                    }
                });
            } catch (error) { console.error('扫描文件夹失败:', fullPath, error); }

            d.folder = { type, path: path || '', connected: true };
            if ((type === 'siyuan' && s.tab === '思源空间') || type === 'folder') d.items = items;
        }
    };

    // ==================== UI状态和交互 ====================
    $: paths = d.folder.path.split('/').filter(Boolean).map((p, i, arr) => ({ name: p, path: (d.folder.type === 'alist' ? '/' : '') + arr.slice(0, i + 1).join('/') }));
    $: items = d.items;
    $: hasDir = d.items.some(i => i?.is_dir);
    $: playing = (item: MediaItem) => currentItem?.id === item.id || currentItem?.id?.startsWith(`${item.id}-p`);
    $: selected = (item: MediaItem) => ui.sel?.id === item.id;
    $: isGrid = s.view.includes('grid');
    $: isCompact = s.view === 'compact';

    const map = (m: any, k: string) => m[k] || k;
    const tabs = { '目录': i18n?.playList?.tabs?.directory, '默认': i18n?.playList?.tabs?.default };
    const srcs = { 'B站': i18n?.playList?.sources?.bilibili, '本地': i18n?.playList?.sources?.local, '普通': i18n?.playList?.sources?.general, 'AList': i18n?.playList?.sources?.alist };

    const tags = (item: MediaItem) => `<span class="meta-tag source" data-source="${item.source}">${item.source === 'directory' ? '标签' : item.source === 'siyuan' ? '思源' : map(srcs, item.source)}</span><span class="meta-tag type" data-type="${item.type === 'audio' ? '音频' : item.type === 'folder' ? '文件夹' : '视频'}">${item.type === 'audio' ? '音频' : item.type === 'folder' ? '文件夹' : '视频'}</span>`;
    const nextView = () => (s.view = VIEWS[(VIEWS.indexOf(s.view) + 1) % 4], dbOp('setView', { view: s.view }));
    const setTab = async (tag: string) => { if (tag === s.tab) return; s.tab = tag; await load(); if (tag === 'AList' && !d.items.length) await connect('alist', 'AList', '/'); else if (tag === '思源空间' && !d.items.length) await browse('siyuan', ''); else if (!['AList', '思源空间'].includes(tag)) d.folder = { type: '', path: '', connected: false }; };
    const connect = async (type: string, tag: string, path = '') => { if (type === 'alist' && !d.folder.connected && !await AListManager.initFromConfig(await cfg())) { showMessage("请先配置AList连接"); return; } if (type === 'alist') d.folder = { connected: true, type: 'alist', path: '' }; if (!d.tags.includes(tag)) { await ensure(tag); await load(); } s.tab = tag; await browse(type, path); };

    // ==================== 播放和交互 ====================
    const click = safe(async (item: MediaItem) => {
        ui.sel = item;
        if (item.source === 'directory') return setTab(item.title);
        if (item.is_dir) return play(item);
        const bvid = item.bvid || item.url?.match(/BV[a-zA-Z0-9]+/)?.[0];
        if (bvid && !ui.parts[item.id]) ui.parts[item.id] = await BilibiliParser.getVideoParts({ bvid }) || [];
        if (ui.parts[item.id]?.length > 1) ui.exp = new Set(ui.exp.has(item.id) ? [...ui.exp].filter(id => id !== item.id) : [...ui.exp, item.id]);
    });

    const play = safe(async (item: MediaItem, startTime?: number, endTime?: number) => {
        if (item.source === 'directory' && item.targetTabId) { s.tab = item.targetTabId; return load(); }
        if (item.is_dir) return browse(item.source === 'alist' ? 'alist' : item.source === 'siyuan' ? 'siyuan' : 'folder', item.sourcePath || '');
        if (item.source === 'alist' && item.sourcePath && !item.is_dir) return dispatch('play', await AListManager.createMediaItemFromPath(item.sourcePath));

        const config = await cfg();
        const opts = { ...item, type: item.type || 'video', startTime, endTime };

        // B站视频处理 - 确保bvid和cid传递
        const bvid = item.bvid || item.url?.match(/BV[a-zA-Z0-9]+/)?.[0];
        if ((item.source === 'B站' || item.type === 'bilibili') && bvid) {
            if (!config.settings?.bilibiliLogin?.mid) return showMessage('需要登录B站才能播放视频');
            const cid = item.cid || (await BilibiliParser.getVideoParts({ bvid }))?.[0]?.cid;
            if (cid) {
                Object.assign(opts, { bvid, cid });
                const stream = await BilibiliParser.getProcessedVideoStream(bvid, cid, 0, config);
                if (stream.dash) Object.assign(opts, { url: stream.dash.video?.[0]?.baseUrl || '', headers: stream.headers, type: 'bilibili-dash', biliDash: stream.dash });
            }
        }

        currentItem = item;
        dispatch('play', opts);
    });

    // 拖拽操作
    const dragStart = (type, i) => (drag = type === 'item' ? { item: i, tag: '', target: '' } : { item: -1, tag: i, target: '' });
    const dragEnter = (e, type, i) => (e.preventDefault(), type === 'item' && drag.item !== i && drag.item > -1 && ([d.items[drag.item], d.items[i]] = [d.items[i], d.items[drag.item]], drag.item = i), type === 'tag' && drag.item > -1 && (drag.target = i), type === 'tag' && drag.tag && drag.tag !== i && d.tags.splice(d.tags.indexOf(i), 0, d.tags.splice(d.tags.indexOf(drag.tag), 1)[0]));
    const dragEnd = async () => { if (drag.item > -1 && drag.target) await move(d.items[drag.item].title, drag.target); else if (drag.item > -1) await dbOp('reorder', { type: 'items' }); else if (drag.tag) await dbOp('reorder', { type: 'tags' }); drag = { item: -1, tag: '', target: '' }; };

    // ==================== 菜单和批量操作 ====================
    const checkPro = (fn: Function) => async () => (await cfg())?.settings?.pro?.enabled ? fn() : showMessage("此功能需要Pro版本");
    const menus = {
        media: (item: any) => [["iconPlay", "播放", () => play(item)], ...(d.tags.filter(t => t !== s.tab && t !== '目录').length ? [["iconMove", "移动到", d.tags.filter(t => t !== s.tab && t !== '目录').map(t => [t, () => move(item.title, t)])]] : []), ["iconTrashcan", "删除", () => del(item.title)]],
        tab: (tag: any) => [...(tag === '默认' || tag === '目录' ? [] : [["iconEdit", "重命名", () => (ui.edit = tag, setTimeout(() => ui.refs.edit?.focus(), 0))]]), ["iconClear", "清空", () => del(undefined, s.tab)], ...(tag === '默认' || tag === '目录' ? [] : [["iconTrashcan", "删除", () => delTag(tag)]])],
        add: (_, e: MouseEvent) => [["iconAdd", "添加新标签页", () => (ui.add = true, setTimeout(() => ui.refs.new?.focus(), 0))], ["iconFolder", "添加本地文件夹", () => addFolder()], ["iconImage", "添加思源空间", () => connect('siyuan', '思源空间', '')], ["iconCloud", "浏览AList云盘", checkPro(() => connect('alist', 'AList', '/'))], ["iconHeart", "添加B站收藏夹", checkPro(() => addBili(e))]]
    };
    const menu = (e: MouseEvent, type: keyof typeof menus, target?: any) => { const m = new Menu(`${type}Menu`); menus[type](target, e).forEach(([icon, label, action]) => m.addItem(Array.isArray(action) ? { icon, label, submenu: action.map(([l, a]) => ({ label: l, click: a })) } : { icon, label, click: action })); m.open({ x: e.clientX, y: e.clientY }); };

    const addFolder = async () => {
        if (!window.navigator.userAgent.includes('Electron')) { showMessage('此功能仅在桌面版可用'); return; }
        const { filePaths } = await window.require('@electron/remote').dialog.showOpenDialog({ properties: ['openDirectory', 'createDirectory'] });
        if (!filePaths?.[0]) return;
        const folderPath = filePaths[0], folderName = folderPath.split(/[\\/]/).pop();
        await ensure(folderName);
        await browse('folder', folderPath);
        const mediaFiles = d.items.filter(item => !item.is_dir);
        for (const item of mediaFiles) { try { await add(item.url, folderName, false); } catch (error) { console.error('添加媒体失败:', item.url, error); } }
        showMessage(`已添加${mediaFiles.length}个媒体文件到"${folderName}"`);
    };

    const addBili = async (e: MouseEvent) => {
        const config = await cfg();
        if (!config?.settings?.bilibiliLogin?.mid) { showMessage('请先登录B站账号'); return; }
        const folders = await BilibiliParser.getUserFavoriteFolders(config);
        if (!folders?.length) { showMessage('未找到收藏夹'); return; }
        const menu = new Menu("biliFavs");
        folders.forEach(f => { menu.addItem({ icon: "iconHeart", label: `${f.title} (${f.media_count})`, click: async () => { const { title, items } = await BilibiliParser.getFavoritesList(f.id.toString(), config); const tagName = f.title; await ensure(tagName); for (const item of items || []) { try { await add(`https://www.bilibili.com/video/${item.bvid}`, tagName, false); } catch (error) { console.error('添加B站视频失败:', item.bvid, error); } } showMessage(`已添加${items?.length || 0}个B站视频到"${tagName}"`); } }); });
        menu.open({ x: e.clientX, y: e.clientY });
    };

    // ==================== 标签管理 ====================
    const delTag = async (tagName: string) => { if (tagName === '默认') { showMessage('不能删除系统标签'); return; } const avId = await getAvId(s.dbId); const data = await loadDb(avId); const playlistCol = col(data, FIELDS.playlist); if (playlistCol?.key?.options) playlistCol.key.options = playlistCol.key.options.filter(opt => opt.name !== tagName); const singleTagRecords = playlistCol?.values?.filter(v => v.mSelect?.some(tag => tag.content === tagName) && v.mSelect?.length === 1).map(v => v.blockID) || []; playlistCol?.values?.forEach(value => { if (value.mSelect?.some(tag => tag.content === tagName)) { value.mSelect = value.mSelect.filter(tag => tag.content !== tagName); value.updatedAt = Date.now(); } }); if (singleTagRecords.length) { const blockIdSet = new Set(singleTagRecords); data.keyValues.forEach((kv: any) => { if (kv.values) kv.values = kv.values.filter((v: any) => !blockIdSet.has(v.blockID)); }); data.views[0].table.rowIds = data.views[0].table.rowIds?.filter((id: string) => !blockIdSet.has(id)) || []; } await saveDb(avId, data); if (s.tab === tagName) s.tab = '默认'; await load(); showMessage(`标签"${tagName}"已删除`); };
    const renameTag = async (oldName: string, newName: string) => { if (oldName === '默认' || !newName?.trim()) { showMessage(oldName === '默认' ? '不能重命名系统标签' : '新标签名不能为空'); return; } const avId = await getAvId(s.dbId); const data = await loadDb(avId); const playlistCol = col(data, FIELDS.playlist); if (playlistCol?.key?.options?.some(opt => opt.name === newName)) { showMessage('标签名已存在'); return; } playlistCol?.values?.forEach(value => { if (value.mSelect?.some(tag => tag.content === oldName)) { value.mSelect = value.mSelect.map(tag => tag.content === oldName ? { ...tag, content: newName } : tag); value.updatedAt = Date.now(); } }); const option = playlistCol?.key?.options?.find(opt => opt.name === oldName); if (option) option.name = newName; await saveDb(avId, data); if (s.tab === oldName) s.tab = newName; await load(); showMessage(`标签已重命名为"${newName}"`); };
    const input = (e: Event, type: 'tag' | 'add', old?: string) => { if (e instanceof KeyboardEvent && e.key !== 'Enter') return; const value = ((e.target as HTMLInputElement).value || '').trim(); if (!value) return (type === 'tag' ? ui.edit = '' : ui.add = false); type === 'tag' ? (renameTag(old!, value), ui.edit = '') : (ensure(value), ui.add = false); };

    // ==================== 播放控制和其他功能 ====================
    export const playNext = safe(async () => {
        if (!d.items.length || !currentItem) return false;

        // B站分P视频处理
        const bvid = currentItem.bvid || currentItem.url?.match(/BV[a-zA-Z0-9]+/)?.[0];
        if (bvid) {
            const currentPage = parseInt(currentItem.id?.match(/-p(\d+)/)?.[1] || '1', 10);
            const parts = await BilibiliParser.getVideoParts({ bvid });
            const nextPart = parts?.find(pt => pt.page === currentPage + 1);

            if (nextPart || (await cfg())?.settings?.loop) {
                const item = { ...currentItem };
                const part = nextPart || parts?.find(pt => pt.page === 1);

                if (part) {
                    Object.assign(item, { id: `${item.id.split('-p')[0]}-p${part.page}`, title: `${item.title.split(' - P')[0]}${part.page > 1 ? ` - P${part.page}${part.part ? ': ' + part.part : ''}` : ''}`, bvid, cid: String(part.cid) });
                    await play(item);
                    return true;
                }
            }
        }

        // 播放列表下一个
        const currentIndex = d.items.findIndex(i => i.id === currentItem.id || i.url === currentItem.url);
        if (currentIndex >= 0) { await play(d.items[(currentIndex + 1) % d.items.length]); return true; }
        return false;
    });

    const handleAdd = async () => {
        if (s.input.trim()) { try { await add(s.input.trim(), s.tab); s.input = ''; } catch (error) { console.error('添加媒体失败:', error); } }
        else { if (!window.navigator.userAgent.includes('Electron')) { showMessage("需要桌面版支持"); return; } const { filePaths } = await window.require('@electron/remote').dialog.showOpenDialog({ properties: ['openFile', 'multiSelections'], filters: [{ name: "媒体文件", extensions: EXT.MEDIA.map(ext => ext.slice(1)) }] }); if (filePaths?.length) { for (const filePath of filePaths) { try { await add(`file://${filePath.replace(/\\/g, '/')}`, s.tab); } catch (error) { console.error('添加本地文件失败:', filePath, error); } } } }
    };

    // ==================== 生命周期 ====================
    onMount(() => { safe(init)(); const handleDataUpdate = () => load(); const handleConfigUpdate = (ev: CustomEvent) => { if (ev.detail?.settings?.playlistDb?.id) safe(init)(); }; window.addEventListener('playlist-data-updated', handleDataUpdate); window.addEventListener('configUpdated', handleConfigUpdate); return () => { window.removeEventListener('playlist-data-updated', handleDataUpdate); window.removeEventListener('configUpdated', handleConfigUpdate); }; });

    // ==================== 导出API ====================
    export { play };
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
            <button class="view-mode-btn" on:click={nextView} title="视图">
                <svg viewBox="0 0 24 24" width="16" height="16"><path d={ICONS[VIEWS.indexOf(s.view) % 3]}/></svg>
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
                        on:dblclick={() => play((item.bvid || item.url?.match(/BV[a-zA-Z0-9]+/)?.[0]) && ui.parts[item.id]?.length > 1 ? {...item, bvid: item.bvid || item.url?.match(/BV[a-zA-Z0-9]+/)?.[0], cid: String(ui.parts[item.id][0].cid)} : item)}
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
                                            on:click|stopPropagation={() => play({...item, id: `${item.id}-p${part.page}`, title: `${item.title.split(' - P')[0]} - P${part.page}${part.part ? ': ' + part.part : ''}`, bvid: item.bvid || item.url?.match(/BV[a-zA-Z0-9]+/)?.[0], cid: String(part.cid)})}
                                            title={part.part || `P${part.page}`}>{part.page}</button>
                                {/each}
                            </div>
                        {/if}
                    </div>
                {/each}
            </div>
        {:else}
            <div class="playlist-empty">{s.dbId ? '当前标签暂无媒体项目' : '请先在设置中配置播放列表数据库'}</div>
        {/if}
    </div>
    
    <!-- 输入 -->
    <div class="playlist-footer">
        <input type="text" class="tab-input playlist-input" placeholder="输入链接或直接点击添加本地文件..." bind:value={s.input} on:keydown={e => e.key === 'Enter' && handleAdd()} style="padding-right: {s.input ? '25px' : '8px'}">
        {#if s.input}<span style="position:absolute;right:80px;cursor:pointer;color:#666" on:click={() => s.input = ''}>×</span>{/if}
        <button class="add-btn" on:click={handleAdd}>添加</button>
    </div>
</div>