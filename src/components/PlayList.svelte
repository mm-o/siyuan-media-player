<script lang="ts">
    import { createEventDispatcher, onMount } from "svelte";
    import { showMessage, Menu } from "siyuan";
    // @ts-ignore
    import PanelNav from "./PanelNav.svelte";
    import type { MediaItem } from '../core/types';
    import { Media, EXT } from '../core/player';
    import { OpenListManager } from '../core/openlist';
    import { WebDAVManager } from '../core/webdav';
    import { BilibiliParser } from '../core/bilibili';

    export let className = '', hidden = false, i18n: any, activeTabId = 'playlist', currentItem: MediaItem | null = null, plugin: any;

    // ==================== 配置常量 ====================
    const VIEWS = ['detailed', 'compact', 'grid', 'grid-single'] as const;
    const ICONS = ['M3 3h18v18H3V3zm2 2v14h14V5H5zm2 2h10v2H7V7zm0 4h10v2H7v-2zm0 4h10v2H7v-2z', 'M3 5h18v2H3V5zm0 6h18v2H3v-2zm0 6h18v2H3v-2z', 'M3 3h8v8H3V3zm0 10h8v8H3v-8zm10 0h8v8h-8v-8zm0-10h8v8h-8V3z'];
    const FIELDS = { url: 'URL', duration: '时长', playlist: '所在标签', source: '来源', type: '类型', artist: '艺术家', thumbnail: '封面图', artistIcon: '艺术家头像', created: '创建时间' };
    const FIELD_DEFS = {
        source: { type: 'select', options: [['B站', '4'], ['本地', '6'], ['OpenList', '3'], ['WebDAV', '5']] },
        url: { type: 'url' }, artist: { type: 'text' }, artistIcon: { type: 'mAsset' }, thumbnail: { type: 'mAsset' },
        playlist: { type: 'mSelect', options: [['默认', '1']] }, duration: { type: 'text' },
        type: { type: 'select', options: [['视频', '4'], ['音频', '5']] }, created: { type: 'date' }
    };

    // ==================== 字段映射工具 ====================
    const mapField = (key: string, keyMap: any) => keyMap[FIELDS[key]] || Object.values(keyMap).find(k => k.name?.includes(FIELDS[key]) || FIELDS[key]?.includes(k.name));
    const extractValue = (value: any, key: string) => key === 'type' ? (value?.mSelect?.[0]?.content === '音频' ? 'audio' : 'video') : (value?.text?.content || value?.url?.content || value?.mSelect?.[0]?.content || value?.mAsset?.[0]?.content || value?.date?.content || '');

    // ==================== 核心工具 ====================
    const id = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
    const safe = (fn: Function) => async (...args: any[]) => { try { return await fn(...args); } catch (e: any) { showMessage(e?.message || "操作失败"); } };
    const cfg = async () => await plugin.loadData('config.json') || {};
    const dispatch = createEventDispatcher();

    // ==================== 统一状态 ====================
    let state = {
        tab: '目录', view: 'detailed' as typeof VIEWS[number], input: '', dbId: '', enabled: false,
        tags: ['目录', '默认'], items: [] as MediaItem[],
        folder: { type: '', path: '', connected: false },
        edit: '', add: '', exp: new Set<string>(), parts: {} as any, sel: null as MediaItem|null, refs: {} as any,
        drag: { item: -1, tag: '', target: '' }
    };

    // ==================== 视图状态保存 ====================
    const saveView = async () => { const c = await cfg(); c.settings.playlistView = { mode: state.view, tab: state.tab, expanded: [...state.exp] }; await plugin.saveData('config.json', c, 2); };
    const loadView = async () => { const v = (await cfg()).settings?.playlistView; if (v) { state.view = v.mode || 'detailed'; state.tab = v.tab || '目录'; state.exp = new Set(v.expanded || []); } };

    // ==================== 数据存储 ====================
    const api = async (path: string, data: any = {}) => fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) }).then(r => r.json());
    const getAvId = async (id: string) => { if (!id || !/^\d{14}-[a-z0-9]{7}$/.test(id)) throw new Error('请输入有效的数据库ID'); const fs = window.require('fs'), avPath = `${window.siyuan.config.system.workspaceDir}/data/storage/av/${id}.json`; if (fs.existsSync(avPath)) return id; const avId = (await api('/api/query/sql', { stmt: `SELECT markdown FROM blocks WHERE type='av' AND id='${id}'` })).data?.[0]?.markdown?.match(/data-av-id="([^"]+)"/)?.[1]; if (!avId) throw new Error('数据库配置无效'); return avId; };
    const loadLocal = async () => { try { return await plugin.loadData('playlist.json') || { tags: ['默认'], items: {} }; } catch { return { tags: ['默认'], items: {} }; } };
    const saveLocal = async (data) => { await plugin.saveData('playlist.json', data, 2); };

    const db = {
        getKeys: async (avId: string) => (await api('/api/av/getAttributeViewKeysByAvID', { avID: avId })).data || [],
        render: async (avId: string, viewId = '', page = 1, pageSize = -1) => (await api('/api/av/renderAttributeView', { id: avId, viewID: viewId, query: '', page, pageSize })).data || {},
        addKey: async (avId: string, keyID: string, keyName: string, keyType: string, keyIcon = '', previousKeyID = '') => api('/api/av/addAttributeViewKey', { avID: avId, keyID, keyName, keyType, keyIcon, previousKeyID }),
        removeKey: async (avId: string, keyID: string) => api('/api/av/removeAttributeViewKey', { avID: avId, keyID }),
        addRow: async (avId: string, values: any[]) => api('/api/av/appendAttributeViewDetachedBlocksWithValues', { avID: avId, blocksValues: [values] }),
        updateField: async (avId: string, rowId: string, keyId: string, value: any) => api('/api/av/setAttributeViewBlockAttr', { avID: avId, rowID: rowId, keyID: keyId, value }),
        removeRows: async (avId: string, rowIds: string[]) => api('/api/av/removeAttributeViewBlocks', { avID: avId, srcIDs: rowIds }),
        transaction: async (operations: any[], undoOperations: any[] = []) => api('/api/transactions', {
            transactions: [{ doOperations: operations, undoOperations }],
            session: crypto.randomUUID(), app: "qd1f", reqId: Date.now()
        }),
        deleteTagOption: async (avId: string, keyId: string, optionName: string, allOptions: any[]) => {
            if (!allOptions.some(opt => opt.name === optionName)) throw new Error('标签选项不存在');
            return db.transaction([
                { action: "removeAttrViewColOption", id: keyId, avID: avId, data: optionName },
                { action: "doUpdateUpdated", id: avId.replace(/-[^-]+$/, '-2vkgxt0'), data: new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14) }
            ], [{ action: "updateAttrViewColOptions", id: keyId, avID: avId, data: allOptions }]);
        },
        renameTagOption: async (avId: string, keyId: string, oldName: string, newName: string, allOptions: any[]) => {
            const oldOption = allOptions.find(opt => opt.name === oldName);
            if (!oldOption) throw new Error('原标签选项不存在');
            if (allOptions.some(opt => opt.name === newName && opt.name !== oldName)) throw new Error('新标签名称已存在');
            const data = { oldName, newName, newColor: oldOption.color || "1", newDesc: oldOption.desc || "" };
            return db.transaction([
                { action: "updateAttrViewColOption", id: keyId, avID: avId, data },
                { action: "doUpdateUpdated", id: avId.replace(/-[^-]+$/, '-2vkgxt0'), data: new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14) }
            ], [{ action: "updateAttrViewColOption", id: keyId, avID: avId, data: { ...data, oldName: newName, newName: oldName } }]);
        },
        sortItem: async (avId: string, rowId: string, previousRowId: string) => db.transaction([
            { action: "sortAttrViewRow", avID: avId, blockID: avId.replace(/-[^-]+$/, '-2vkgxt0'), id: rowId, previousID: previousRowId }
        ], [{ action: "sortAttrViewRow", avID: avId, blockID: avId.replace(/-[^-]+$/, '-2vkgxt0'), id: rowId, previousID: '' }]),
        sortTags: async (avId: string, keyId: string, sortedOptions: any[]) => db.transaction([
            { action: "updateAttrViewColOptions", id: keyId, avID: avId, data: sortedOptions }
        ], [{ action: "updateAttrViewColOptions", id: keyId, avID: avId, data: sortedOptions }]),
        updateFieldName: async (avId: string, keyId: string, newName: string, oldName: string, keyType: string) => db.transaction([
            { action: "updateAttrViewCol", id: keyId, avID: avId, name: newName, type: keyType }
        ], [{ action: "updateAttrViewCol", id: keyId, avID: avId, name: oldName, type: keyType }])
    };


    // ==================== 数据处理 ====================
    const ensureFieldOptions = async (avId: string, keyID: string, options: string[][]) => {
        const before = (await db.render(avId)).view?.rows?.length || 0;
        for (const [name, color] of options) await db.addRow(avId, [{ keyID, id: id(), blockID: '', type: 'mSelect', mSelect: [{ content: name, color }] }]);
        const after = (await db.render(avId)).view?.rows || [];
        if (after.length > before) await db.removeRows(avId, after.slice(before).map(r => r.id));
    };

    const createValue = (key: string, value: any, keyData?: any) => {
        const v = String(value), base = { keyID: keyData?.id, id: id(), blockID: '', type: keyData?.type || 'text' };
        const color = (name: string) => keyData?.options?.find(o => o.name === name)?.color || '1';
        const creators = {
            url: () => ({ ...base, type: 'url', url: { content: v } }),
            playlist: () => ({ ...base, type: 'mSelect', mSelect: Array.isArray(value) ? value.map(i => ({ content: String(i), color: color(String(i)) })) : [{ content: v, color: color(v) }] }),
            source: () => ({ ...base, type: 'select', mSelect: [{ content: v, color: color(v) }] }),
            type: () => ({ ...base, type: 'select', mSelect: [{ content: v, color: color(v) }] }),
            artistIcon: () => ({ ...base, type: 'mAsset', mAsset: [{ type: 'image', name: '', content: v }] }),
            thumbnail: () => ({ ...base, type: 'mAsset', mAsset: [{ type: 'image', name: '', content: v }] }),
            created: () => ({ ...base, type: 'date', date: { content: value, isNotEmpty: true, hasEndDate: false, isNotTime: false } })
        };
        return creators[key] || (() => ({ ...base, text: { content: v } }));
    };

    // ==================== 本地文件操作 ====================
    const localOp = async (action: string, params: any = {}) => {
        const data = await loadLocal();
        if (action === 'load') { state.tags = ['目录', ...data.tags]; state.items = state.tab === '目录' ? data.tags.map(t => ({ id: `dir-${t}`, title: t, type: 'folder', url: '#', source: 'directory', targetTabId: t, is_dir: true, thumbnail: Media.getThumbnail({ type: 'folder' }) })) : data.items[state.tab] || []; return; }
        const { media, playlist = '默认', title, tagName, title: moveTitle, newPlaylist, tagName: ensureTag } = params;
        if (action === 'add') { if (!data.items[playlist]) { data.items[playlist] = []; data.tags.push(playlist); } data.items[playlist].push({ ...media, id: `local-${Date.now()}`, source: media.source || (media.bvid || media.url?.includes('bilibili.com') ? 'bilibili' : media.url?.startsWith('file://') ? 'local' : 'standard') }); }
        else if (action === 'del') { if (tagName && data.items[tagName]) { delete data.items[tagName]; data.tags = data.tags.filter(t => t !== tagName); } else if (title && data.items[state.tab]) data.items[state.tab] = data.items[state.tab].filter(item => item.title !== title); }
        else if (action === 'move') { if (!data.items[newPlaylist]) { data.items[newPlaylist] = []; data.tags.push(newPlaylist); } Object.keys(data.items).forEach(tag => { const item = data.items[tag].find(i => i.title === moveTitle); if (item) { data.items[tag] = data.items[tag].filter(i => i.title !== moveTitle); data.items[newPlaylist].push(item); } }); }
        else if (action === 'ensure' && !data.tags.includes(ensureTag)) { data.tags.push(ensureTag); data.items[ensureTag] = []; }
        if (action !== 'load') await saveLocal(data);
    };

    // ==================== 数据操作 ====================
    const dataOp = async (action: string, params: any = {}) => {
        if (!state.enabled) return await localOp(action, params);
        const avId = await getAvId(state.dbId);

        switch (action) {
            case 'init':
                const keys = await db.getKeys(avId), existing = keys.map(k => k.name);
                await Promise.all(keys.filter(k => k.type === 'select' && !Object.values(FIELDS).includes(k.name) && k.name !== '标题' && k.name !== '主键').map(field => db.removeKey(avId, field.id)));
                const primaryKey = (await db.getKeys(avId)).find(k => k.name === '主键' || k.name === '标题');
                if (primaryKey && (primaryKey.name === '主键' || primaryKey.name === '标题')) {
                    await db.updateFieldName(avId, primaryKey.id, '媒体标题', primaryKey.name, primaryKey.type);
                }
                const updatedPrimaryKey = (await db.getKeys(avId)).find(k => k.name === '媒体标题');
                let previousKeyID = updatedPrimaryKey?.id || '';
                for (const key of ['url', 'duration', 'playlist', 'source', 'type', 'artist', 'thumbnail', 'artistIcon', 'created']) {
                    const name = FIELDS[key];
                    if (!existing.includes(name)) {
                        const fieldDef = FIELD_DEFS[key] || { type: 'text' }, keyID = id();
                        await db.addKey(avId, keyID, name, fieldDef.type, '', previousKeyID);
                        if (fieldDef.options) await ensureFieldOptions(avId, keyID, fieldDef.options);
                        previousKeyID = keyID;
                    }
                }
                break;

            case 'load':
                const loadData = await db.render(avId), loadKeys = await db.getKeys(avId), loadKeyMap = Object.fromEntries(loadKeys.map(k => [k.name, k]));
                const loadPlaylistKey = mapField('playlist', loadKeyMap), tags = [...(loadPlaylistKey?.options?.map(opt => opt.name) || []), '默认'].filter((t, i, a) => a.indexOf(t) === i);
                state.tags = ['目录', ...tags.filter(t => t !== '目录')];
                if (state.tab === '目录') {
                    state.items = tags.filter(t => t !== '目录').map(t => ({ id: `dir-${t}`, title: t, type: 'folder', url: '#', source: 'directory', targetTabId: t, is_dir: true, thumbnail: Media.getThumbnail({ type: 'folder' }) }));
                } else {
                    const rows = loadData.view?.rows || [], cards = loadData.view?.cards || [], primaryKeyId = loadKeyMap['主键']?.id || loadKeyMap['标题']?.id || loadKeyMap['媒体标题']?.id;
                    const dataItems = rows.length ? rows : cards;
                    state.items = dataItems.filter(item => {
                        const values = item.cells || item.values || [];
                        return values.find(c => c.value?.keyID === loadPlaylistKey?.id)?.value?.mSelect?.some?.(tag => tag.content === state.tab);
                    }).map(item => {
                        const values = item.cells || item.values || [], result: any = { id: item.id };
                        const titleValue = values.find(c => c.value?.keyID === primaryKeyId);
                        result.title = titleValue?.value?.block?.content || '未知标题';
                        Object.entries(FIELDS).forEach(([key]) => {
                            const field = mapField(key, loadKeyMap), cell = field ? values.find(c => c.value?.keyID === field.id) : null;
                            result[key] = cell ? extractValue(cell.value, key) : '';
                        });
                        return result;
                    });
                }
                return;

            case 'add':
                const { media, playlist = '默认', checkDup = true } = params;
                if (checkDup && media.url) {
                    const dbData = await db.render(avId), dupKeys = await db.getKeys(avId), dupKeyMap = Object.fromEntries(dupKeys.map(k => [k.name, k]));
                    const urlKey = mapField('url', dupKeyMap);
                    if (dbData.view?.rows?.find(row => row.cells?.find(c => c.value?.keyID === urlKey?.id)?.value?.url?.content === media.url)) { showMessage('媒体已存在'); return; }
                }
                const { imageToLocalAsset } = await import('../core/document');
                if (media.thumbnail) media.thumbnail = await imageToLocalAsset(media.thumbnail);
                if (media.artistIcon) media.artistIcon = await imageToLocalAsset(media.artistIcon);
                const addKeys = await db.getKeys(avId), addKeyMap = Object.fromEntries(addKeys.map(k => [k.name, k])), values = [];
                const addPrimaryKey = addKeyMap['主键'] || addKeyMap['标题'] || addKeyMap['媒体标题'];
                if (addPrimaryKey && media.title) values.push({ keyID: addPrimaryKey.id, id: id(), blockID: '', type: 'block', block: { id: id(), content: media.title, created: Date.now(), updated: Date.now() }, isDetached: true });
                Object.entries(FIELDS).forEach(([key]) => {
                    const keyData = mapField(key, addKeyMap);
                    if (!keyData) return;
                    let v = media[key];
                    if (key === 'source') v = media.source === 'openlist' ? 'OpenList' : media.source === 'webdav' ? 'WebDAV' : (media.url?.includes('bilibili.com') || media.bvid) ? 'B站' : (media.source === 'local' || media.url?.startsWith('file://')) ? '本地' : '普通';
                    else if (key === 'playlist') v = [playlist];
                    else if (key === 'type') v = media.type === 'audio' ? '音频' : '视频';
                    else if (key === 'created') v = Date.now();
                    if (v !== undefined && v !== null && v !== '') { const value = createValue(key, v, keyData)(); if (value) values.push(value); }
                });
                await db.addRow(avId, values);
                break;

            case 'del':
                const { title, tagName } = params, delData = await db.render(avId), delKeyMap = Object.fromEntries((await db.getKeys(avId)).map(k => [k.name, k]));
                let rowIds: string[] = [];
                if (tagName) {
                    const playlistKey = mapField('playlist', delKeyMap);
                    rowIds = delData.view?.rows?.filter(row => row.cells?.find(c => c.value?.keyID === playlistKey?.id)?.value?.mSelect?.some?.(tag => tag.content === tagName)).map(row => row.id) || [];
                } else if (title) {
                    const titleKeyId = delKeyMap['主键']?.id || delKeyMap['标题']?.id || delKeyMap['媒体标题']?.id;
                    const row = delData.view?.rows?.find(row => row.cells?.find(c => c.value?.keyID === titleKeyId)?.value?.block?.content === title);
                    rowIds = row ? [row.id] : [];
                }
                if (rowIds.length > 0) { await db.removeRows(avId, rowIds); showMessage(`删除了${rowIds.length}条记录`); }
                break;

            case 'move':
                const { title: moveTitle, newPlaylist } = params, data = await db.render(avId), keyMap = Object.fromEntries((await db.getKeys(avId)).map(k => [k.name, k]));
                const row = data.view?.rows?.find(r => r.cells?.find(c => c.value?.keyID === (keyMap['主键']?.id || keyMap['标题']?.id || keyMap['媒体标题']?.id))?.value?.block?.content === moveTitle);
                if (!row) throw new Error('未找到记录');
                await dataOp('ensure', { tagName: newPlaylist });
                const pk = mapField('playlist', keyMap), cell = row.cells?.find(c => c.value?.keyID === pk?.id);
                if (!cell) throw new Error('未找到播放列表字段');
                const cid = cell.value?.id || cell.id, color = pk?.options?.find(o => o.name === newPlaylist)?.color || '1';
                const cellOp = (mSelect) => ({ action: "updateAttrViewCell", id: cid, keyID: pk?.id, avID: avId, rowID: row.id, data: { type: "mSelect", id: cid, mSelect } });
                await db.transaction([cellOp([{ content: newPlaylist, color }]), { action: "doUpdateUpdated", id: avId.replace(/-[^-]+$/, '-2vkgxt0'), data: new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14) }], [cellOp(cell.value?.mSelect || [])]);
                showMessage(`已移动到"${newPlaylist}"`);
                break;

            case 'ensure':
                const { tagName: ensureTag, description: ensureDesc } = params, ensureKeys = await db.getKeys(avId), ensureKeyMap = Object.fromEntries(ensureKeys.map(k => [k.name, k]));
                const ensurePlaylistKey = mapField('playlist', ensureKeyMap);
                if (ensurePlaylistKey && !ensurePlaylistKey.options?.some(opt => opt.name === ensureTag)) {
                    const before = (await db.render(avId)).view?.rows?.length || 0;
                    await db.addRow(avId, [createValue('playlist', [ensureTag], ensurePlaylistKey)()]);
                    const after = (await db.render(avId)).view?.rows || [];
                    if (after.length > before) await db.removeRows(avId, after.slice(before).map(r => r.id));
                    if (ensureDesc) await db.transaction([
                        { action: "updateAttrViewColOption", id: ensurePlaylistKey.id, avID: avId, data: { newColor: "1", oldName: ensureTag, newName: ensureTag, newDesc: ensureDesc } },
                        { action: "doUpdateUpdated", id: avId.replace(/-[^-]+$/, '-2vkgxt0'), data: new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14) }
                    ], [{ action: "updateAttrViewColOption", id: ensurePlaylistKey.id, avID: avId, data: { newColor: "1", oldName: ensureTag, newName: ensureTag, newDesc: "" } }]);
                }
                break;

            case 'deleteTag':
                const { tagName: deleteTagName } = params;
                if (deleteTagName === '默认') { showMessage('不能删除默认标签'); return; }
                const deleteKeys = await db.getKeys(avId), deleteKeyMap = Object.fromEntries(deleteKeys.map(k => [k.name, k]));
                const deletePlaylistKey = mapField('playlist', deleteKeyMap);
                if (!deletePlaylistKey?.options) { showMessage('标签字段不存在'); return; }
                if (!deletePlaylistKey.options.some(opt => opt.name === deleteTagName)) { showMessage('标签选项不存在'); return; }
                const deleteTagData = await db.render(avId), mediaRowsWithTag = deleteTagData.view?.rows?.filter(row => row.cells?.find(c => c.value?.keyID === deletePlaylistKey.id)?.value?.mSelect?.some?.(tag => tag.content === deleteTagName)) || [];
                if (mediaRowsWithTag.length > 0) {
                    const mediaRowIds = mediaRowsWithTag.map(row => row.id);
                    await db.removeRows(avId, mediaRowIds);
                    showMessage(`删除了标签"${deleteTagName}"下的${mediaRowIds.length}条媒体记录`);
                }
                await db.deleteTagOption(avId, deletePlaylistKey.id, deleteTagName, deletePlaylistKey.options);
                showMessage(`已删除标签"${deleteTagName}"`);
                break;

            case 'renameTag':
                const { oldName, newName } = params;
                if (oldName === '默认') { showMessage('不能重命名默认标签'); return; }
                if (!newName?.trim()) { showMessage('新标签名不能为空'); return; }
                const renameKeys = await db.getKeys(avId), renameKeyMap = Object.fromEntries(renameKeys.map(k => [k.name, k]));
                const renamePlaylistKey = mapField('playlist', renameKeyMap);
                if (!renamePlaylistKey?.options) { showMessage('标签字段不存在'); return; }
                await db.renameTagOption(avId, renamePlaylistKey.id, oldName, newName.trim(), renamePlaylistKey.options);
                showMessage(`已将标签"${oldName}"重命名为"${newName}"`);
                break;

            case 'reorder':
                const { type, draggedItem } = params;
                if (type === 'items' && draggedItem) {
                    const reorderData = await db.render(avId), reorderKeyMap = Object.fromEntries((await db.getKeys(avId)).map(k => [k.name, k]));
                    const titleKeyId = reorderKeyMap['主键']?.id || reorderKeyMap['标题']?.id || reorderKeyMap['媒体标题']?.id;
                    const playlistKey = mapField('playlist', reorderKeyMap);
                    const draggedRow = reorderData.view?.rows?.find(row => {
                        const titleCell = row.cells?.find(c => c.value?.keyID === titleKeyId);
                        const playlistCell = row.cells?.find(c => c.value?.keyID === playlistKey?.id);
                        return titleCell?.value?.block?.content === draggedItem.title && playlistCell?.value?.mSelect?.some?.(tag => tag.content === state.tab);
                    });
                    if (!draggedRow) break;
                    const currentIndex = state.items.findIndex(item => item.title === draggedItem.title);
                    let previousRowId = '';
                    if (currentIndex > 0) {
                        const previousItem = state.items[currentIndex - 1];
                        const previousRow = reorderData.view?.rows?.find(row => {
                            const titleCell = row.cells?.find(c => c.value?.keyID === titleKeyId);
                            const playlistCell = row.cells?.find(c => c.value?.keyID === playlistKey?.id);
                            return titleCell?.value?.block?.content === previousItem.title && playlistCell?.value?.mSelect?.some?.(tag => tag.content === state.tab);
                        });
                        previousRowId = previousRow?.id || '';
                    }
                    await db.sortItem(avId, draggedRow.id, previousRowId);
                } else if (type === 'tags') {
                    const tagKeys = await db.getKeys(avId), tagKeyMap = Object.fromEntries(tagKeys.map(k => [k.name, k]));
                    const playlistKey = mapField('playlist', tagKeyMap);
                    if (!playlistKey?.options) break;
                    const sortedOptions = [], systemTags = ['默认', '目录'];
                    systemTags.forEach(tag => { const opt = playlistKey.options.find(o => o.name === tag); if (opt) sortedOptions.push(opt); });
                    state.tags.forEach(tag => { if (!systemTags.includes(tag)) { const opt = playlistKey.options.find(o => o.name === tag); if (opt) sortedOptions.push(opt); } });
                    playlistKey.options.forEach(opt => { if (!sortedOptions.find(o => o.name === opt.name)) sortedOptions.push(opt); });
                    await db.sortTags(avId, playlistKey.id, sortedOptions);
                }
                break;
        }

        if (['load', 'add', 'del', 'move', 'ensure', 'deleteTag', 'renameTag', 'reorder'].includes(action)) await dataOp('load');
    };

    // ==================== 核心业务 ====================
    const init = async () => {
        const config = await cfg();
        state.enabled = !!config.settings?.enableDatabase;
        await loadView();
        if (state.enabled) { state.dbId = config.settings?.playlistDb?.id; if (!state.dbId) throw new Error('请在设置-通用中输入数据库块Id用于配置播放列表数据库'); await dataOp('init'); }
        await load();
    };

    const load = () => dataOp('load');
    const add = async (url: string, playlist = '默认', checkDup = true) => {
        const result = await Media.getMediaInfo(url);
        if (!result.success || !result.mediaItem) throw new Error(result.error || '无法解析媒体链接');
        await dataOp('add', { media: result.mediaItem, playlist, checkDup });
        window.dispatchEvent(new CustomEvent('refreshPlaylist'));
    };
    const del = (title?: string, tagName?: string) => dataOp('del', { title, tagName });
    const move = (title: string, newPlaylist: string) => dataOp('move', { title, newPlaylist });
    const deleteTag = (tagName: string) => dataOp('deleteTag', { tagName });
    const renameTag = (oldName: string, newName: string) => dataOp('renameTag', { oldName, newName });


    // ==================== 文件浏览 ====================
    const browse = async (type: string, path = '') => {
        if (type === 'openlist') {
            const items = await OpenListManager.createMediaItemsFromDirectory(path || '/');
            state.folder = { type: 'openlist', path: path || '/', connected: true };
            if (state.tab === 'OpenList') state.items = Array.isArray(items) ? items : [];
        } else if (type === 'webdav') {
            const items = await WebDAVManager.createMediaItemsFromDirectory(path || '/');
            state.folder = { type: 'webdav', path: path || '/', connected: true };
            if (state.tab === 'WebDAV') state.items = Array.isArray(items) ? items : [];
        } else {
            if (!window.navigator.userAgent.includes('Electron')) throw new Error('此功能仅在桌面版可用');
            const fs = window.require('fs'), pathLib = window.require('path');
            const fullPath = type === 'siyuan' ? pathLib.join(window.siyuan.config.system.workspaceDir, 'data', path) : path;
            const items: any[] = [];
            try {
                fs.readdirSync(fullPath).forEach((file: string) => {
                    const filePath = pathLib.join(fullPath, file), stats = fs.statSync(filePath);
                    if (stats.isDirectory()) {
                        items.push({ id: `${type}-folder-${Date.now()}-${Math.random().toString(36).slice(2,5)}`, title: file, type: 'folder', url: '#', source: type, sourcePath: type === 'siyuan' ? pathLib.relative(pathLib.join(window.siyuan.config.system.workspaceDir, 'data'), filePath).replace(/\\/g, '/') : filePath, is_dir: true });
                    } else if (EXT.MEDIA.some(ext => file.toLowerCase().endsWith(ext))) {
                        const relativePath = type === 'siyuan' ? pathLib.relative(pathLib.join(window.siyuan.config.system.workspaceDir, 'data'), filePath).replace(/\\/g, '/') : filePath;
                        items.push({ id: `${type}-${Date.now()}-${Math.floor(Math.random() * 1000)}`, title: file, url: `file://${filePath.replace(/\\/g, '/')}`, originalUrl: type === 'siyuan' ? relativePath : undefined, type: EXT.AUDIO.includes(`.${file.toLowerCase().split('.').pop()}`) ? 'audio' : 'video', source: '本地', sourcePath: filePath });
                    }
                });
            } catch (error) { showMessage('扫描文件夹失败'); }
            state.folder = { type, path: path || '', connected: true };
            if ((type === 'siyuan' && state.tab === '思源空间') || type === 'folder') state.items = items;
        }
    };

    // ==================== UI控制 ====================
    $: paths = state.folder.path.split('/').filter(Boolean).map((p, i, arr) => ({ name: p, path: ((state.folder.type === 'openlist' || state.folder.type === 'webdav') ? '/' : '') + arr.slice(0, i + 1).join('/') }));
    $: items = state.items;
    $: hasDir = state.items.some(i => i?.is_dir);
    $: playing = (item: MediaItem) => currentItem?.id === item.id || currentItem?.id?.startsWith(`${item.id}-p`);
    $: selected = (item: MediaItem) => state.sel?.id === item.id;
    $: isGrid = state.view.includes('grid');
    $: isCompact = state.view === 'compact';

    const srcs = { 'bilibili': 'B站', 'local': '本地', 'standard': '普通', 'openlist': 'OpenList', 'webdav': 'WebDAV', 'directory': '标签', 'siyuan': '思源' };
    const tags = (item: MediaItem) => `<span class="meta-tag source" data-source="${item.source === 'directory' ? '标签' : item.source === 'siyuan' ? '思源' : srcs[item.source] || item.source}">${item.source === 'directory' ? '标签' : item.source === 'siyuan' ? '思源' : srcs[item.source] || item.source}</span><span class="meta-tag type" data-type="${item.type === 'audio' ? '音频' : item.type === 'folder' ? '文件夹' : '视频'}">${item.type === 'audio' ? '音频' : item.type === 'folder' ? '文件夹' : '视频'}</span>`;
    const map = (m: any, k: string) => m[k] || k;
    const tabs = { '目录': i18n?.playList?.tabs?.directory, '默认': i18n?.playList?.tabs?.default };
    const nextView = () => { state.view = VIEWS[(VIEWS.indexOf(state.view) + 1) % 4]; saveView(); };
    const setTab = async (tag: string) => { if (tag === state.tab) return; state.tab = tag; await load(); saveView(); if (tag === 'OpenList' && !state.items.length) await connect('openlist', 'OpenList', '/'); else if (tag === 'WebDAV' && !state.items.length) await connect('webdav', 'WebDAV', '/'); else if (tag === '思源空间' && !state.items.length) await browse('siyuan', ''); else if (!['OpenList', 'WebDAV', '思源空间'].includes(tag)) state.folder = { type: '', path: '', connected: false }; };
    const connect = async (type: string, tag: string, path = '') => { if (type === 'openlist' && (state.folder.type !== 'openlist' || !state.folder.connected) && !await OpenListManager.initFromConfig(await cfg())) { showMessage(i18n.playList?.errors?.openlistConnectionRequired || "请先配置OpenList连接"); return; } if (type === 'webdav' && (state.folder.type !== 'webdav' || !state.folder.connected) && !await WebDAVManager.initFromConfig(await cfg())) { showMessage(i18n.playList?.errors?.webdavConnectionRequired || "请先配置WebDAV连接"); return; } if (type === 'openlist') state.folder = { connected: true, type: 'openlist', path: '' }; if (type === 'webdav') state.folder = { connected: true, type: 'webdav', path: '' }; if (!state.tags.includes(tag)) { await dataOp('ensure', { tagName: tag }); await load(); } state.tab = tag; await browse(type, path); };

    // ==================== 媒体交互 ====================
    const click = safe(async (item: MediaItem) => {
        state.sel = item;
        if (item.source === 'directory') return setTab(item.title);
        if (item.is_dir) return play(item);
        const bvid = item.bvid || item.url?.match(/BV[a-zA-Z0-9]+/)?.[0];
        if (bvid && !state.parts[item.id]) state.parts[item.id] = await BilibiliParser.getVideoParts({ bvid }) || [];
        if (state.parts[item.id]?.length > 1) { state.exp = new Set(state.exp.has(item.id) ? [...state.exp].filter(id => id !== item.id) : [...state.exp, item.id]); saveView(); }
    });

    const play = safe(async (item: MediaItem, startTime?: number, endTime?: number) => {
        if (item.source === 'directory' && item.targetTabId) { state.tab = item.targetTabId; return load(); }
        if (item.is_dir) return browse(item.source === 'openlist' ? 'openlist' : item.source === 'webdav' ? 'webdav' : item.source === 'siyuan' ? 'siyuan' : 'folder', item.sourcePath || '');
        if (item.source === 'openlist' && item.sourcePath && !item.is_dir) return dispatch('play', await OpenListManager.createMediaItemFromPath(item.sourcePath));
        if (item.source === 'webdav' && item.sourcePath && !item.is_dir) return dispatch('play', await WebDAVManager.createMediaItemFromPath(item.sourcePath));

        const config = await cfg(), opts = { ...item, type: item.type || 'video', startTime, endTime };
        const bvid = item.bvid || item.url?.match(/BV[a-zA-Z0-9]+/)?.[0];
        if ((item.source === 'B站' || item.type === 'bilibili') && bvid) {
            if (!config.settings?.bilibiliLogin?.mid) return showMessage('需要登录B站才能播放视频');
            const cid = item.cid || (await BilibiliParser.getVideoParts({ bvid }))?.[0]?.cid;
            if (cid) {
                const blobUrl = await BilibiliParser.getProcessedVideoStream(bvid, cid, 0, config);
                Object.assign(opts, { url: blobUrl, originalUrl: item.originalUrl || item.url, type: 'video', bvid, cid });
            }
        }
        currentItem = item;
        dispatch('play', opts);
    });

    // ==================== 拖拽操作 ====================
    const dragStart = (type, i) => (state.drag = type === 'item' ? { item: i, tag: '', target: '' } : { item: -1, tag: i, target: '' });
    const dragEnter = (e, type, i) => (e.preventDefault(), type === 'item' && state.drag.item !== i && state.drag.item > -1 && ([state.items[state.drag.item], state.items[i]] = [state.items[i], state.items[state.drag.item]], state.drag.item = i), type === 'tag' && state.drag.item > -1 && (state.drag.target = i), type === 'tag' && state.drag.tag && state.drag.tag !== i && state.tags.splice(state.tags.indexOf(i), 0, state.tags.splice(state.tags.indexOf(state.drag.tag), 1)[0]));
    const dragEnd = async () => {
        if (state.drag.item > -1 && state.drag.target) {
            await move(state.items[state.drag.item].title, state.drag.target);
        } else if (state.drag.item > -1) {
            const draggedItem = state.items[state.drag.item];
            await dataOp('reorder', { type: 'items', draggedItem });
        } else if (state.drag.tag) {
            await dataOp('reorder', { type: 'tags' });
        }
        state.drag = { item: -1, tag: '', target: '' };
    };

    // ==================== 菜单操作 ====================
    const checkPro = (fn: Function) => async () => (await cfg())?.settings?.pro?.enabled ? fn() : showMessage("此功能需要Pro版本");
    const menus = {
        media: (item: any) => [["iconPlay", "播放", () => play(item)], ...(state.tags.filter(t => t !== state.tab && t !== '目录').length ? [["iconMove", "移动到", state.tags.filter(t => t !== state.tab && t !== '目录').map(t => [t, () => move(item.title, t)])]] : []), ["iconTrashcan", "删除", () => del(item.title)]],
        tab: (tag: any) => [...(tag === '默认' || tag === '目录' ? [] : [["iconEdit", "重命名", () => { state.edit = tag; setTimeout(() => state.refs.edit?.focus(), 0); }], ["iconRefresh", "刷新", () => refreshTag(tag)]]), ["iconClear", "清空", () => del(undefined, state.tab)], ...(tag === '默认' || tag === '目录' ? [] : [["iconTrashcan", "删除", () => delTag(tag)]])],
        add: (_, e: MouseEvent) => [["iconAdd", i18n.playList?.menu?.addNewTab || "添加新标签页", () => { state.add = 'tag'; setTimeout(() => state.refs.new?.focus(), 50); }], ["iconFolder", i18n.playList?.menu?.addLocalFolder || "添加本地文件夹", () => addFolder()], ["iconImage", i18n.playList?.menu?.addSiyuanAssets || "添加思源空间", () => connect('siyuan', '思源空间', '')], ["iconCloud", i18n.playList?.menu?.addOpenList || "浏览OpenList云盘", checkPro(() => connect('openlist', 'OpenList', '/'))], ["iconCloud", i18n.playList?.menu?.addWebDAV || "浏览WebDAV云盘", checkPro(() => connect('webdav', 'WebDAV', '/'))], ["iconHeart", i18n.playList?.menu?.addBilibiliFavorites || "添加B站收藏夹", checkPro(() => addBili(e))], ["iconTags", i18n.playList?.menu?.addBilibiliSeason || "添加B站合集", checkPro(() => { state.add = 'season'; setTimeout(() => state.refs.new?.focus(), 50); })]]
    };
    const menu = (e: MouseEvent, type: keyof typeof menus, target?: any) => { const m = new Menu(`${type}Menu`); menus[type](target, e).forEach(([icon, label, action]) => m.addItem(Array.isArray(action) ? { icon, label, submenu: action.map(([l, a]) => ({ label: l, click: a })) } : { icon, label, click: action })); m.open({ x: e.clientX, y: e.clientY }); };

    const batchAdd = async (items: any[], tagName: string, urlFn = (item: any) => item.url || `https://www.bilibili.com/video/${item.bvid}`) => {
        for (const item of items) try { await add(urlFn(item), tagName, false); } catch {}
    };

    const addFolder = async () => {
        if (!window.navigator.userAgent.includes('Electron')) return showMessage('此功能仅在桌面版可用');
        const { filePaths } = await window.require('@electron/remote').dialog.showOpenDialog({ properties: ['openDirectory', 'createDirectory'] });
        if (!filePaths?.[0]) return;
        const [folderPath, folderName] = [filePaths[0], filePaths[0].split(/[\\/]/).pop()];
        await dataOp('ensure', { tagName: folderName, description: folderPath });
        await browse('folder', folderPath);
        await batchAdd(state.items.filter(item => !item.is_dir), folderName);
    };

    const addBili = async (e: MouseEvent) => {
        const config = await cfg();
        if (!config?.settings?.bilibiliLogin?.mid) return showMessage('请先登录B站账号');
        const folders = await BilibiliParser.getUserFavoriteFolders(config);
        if (!folders?.length) return showMessage('未找到收藏夹');
        const menu = new Menu("biliFavs");
        folders.forEach(f => menu.addItem({ icon: "iconHeart", label: `${f.title} (${f.media_count})`, click: async () => {
            const { items } = await BilibiliParser.getFavoritesList(f.id.toString(), config);
            await dataOp('ensure', { tagName: f.title, description: f.id.toString() });
            await batchAdd(items || [], f.title);
        }}));
        menu.open({ x: e.clientX, y: e.clientY });
    };

    const addSeason = async (url: string) => {
        const config = await cfg();
        if (!config?.settings?.bilibiliLogin?.mid) return showMessage(i18n.playList?.error?.needBiliLoginForSeason || '请先登录B站账号');
        const info = await BilibiliParser.getVideoInfo(url) as any;
        if (!info?.seasonId) return showMessage(i18n.playList?.error?.notInSeason || '该视频不属于任何合集');
        const { items } = await BilibiliParser.getSeasonArchives(info.artistId, info.seasonId, config);
        await dataOp('ensure', { tagName: info.seasonTitle || '未命名合集', description: `${info.artistId}:${info.seasonId}` });
        await batchAdd(items || [], info.seasonTitle || '未命名合集');
    };

    // ==================== 其他功能 ====================
    const refreshTag = async (tagName: string) => {
        if (!state.enabled) return showMessage('请先启用数据库功能');
        const avId = await getAvId(state.dbId), keys = await db.getKeys(avId), keyMap = Object.fromEntries(keys.map(k => [k.name, k]));
        const option = mapField('playlist', keyMap)?.options?.find(opt => opt.name === tagName);
        if (!option?.desc) return showMessage('该标签无刷新信息');

        const [currentData, playlistKey, urlKey] = [await db.render(avId), mapField('playlist', keyMap), mapField('url', keyMap)];
        const currentItems = currentData.view?.rows?.filter(row =>
            row.cells?.find(c => c.value?.keyID === playlistKey?.id)?.value?.mSelect?.some?.(tag => tag.content === tagName)
        ).map(row => ({ id: row.id, url: row.cells?.find(c => c.value?.keyID === urlKey?.id)?.value?.url?.content || '' })) || [];

        const desc = option.desc;
        let newItems = [];

        if (desc.match(/^\d+$/)) {
            const config = await cfg();
            if (!config?.settings?.bilibiliLogin?.mid) return showMessage('请先登录B站账号');
            newItems = ((await BilibiliParser.getFavoritesList(desc, config)).items || []).map(item => `https://www.bilibili.com/video/${item.bvid}`);
        } else if (desc.includes(':')) {
            const [mid, seasonId] = desc.split(':');
            newItems = ((await BilibiliParser.getSeasonArchives(mid, seasonId, await cfg())).items || []).map(item => `https://www.bilibili.com/video/${item.bvid}`);
        } else if (desc.includes('/') || desc.includes('\\')) {
            if (!window.navigator.userAgent.includes('Electron')) return showMessage('此功能仅在桌面版可用');
            await browse('folder', desc);
            newItems = state.items.filter(item => !item.is_dir).map(item => item.url);
        } else return showMessage(i18n.playList?.error?.refreshTypeFailed || '无法识别的刷新类型');

        const [currentUrls, newUrls] = [new Set(currentItems.map(item => item.url)), new Set(newItems)];
        const [toDelete, toAdd] = [currentItems.filter(item => !newUrls.has(item.url)), newItems.filter(url => !currentUrls.has(url))];

        if (toDelete.length) await db.removeRows(avId, toDelete.map(item => item.id));
        let addCount = 0;
        for (const url of toAdd) try { await add(url, tagName, false); addCount++; } catch {}
        showMessage(i18n.playList?.message?.refreshTag?.replace('${name}', tagName).replace('${deleteCount}', toDelete.length).replace('${addCount}', addCount) || `已刷新"${tagName}"：删除${toDelete.length}项，新增${addCount}项`);
    };

    const delTag = async (tagName: string) => {
        if (tagName === '默认') { showMessage('不能删除系统标签'); return; }
        await deleteTag(tagName);
        if (state.tab === tagName) state.tab = '默认';
    };

    const input = (e: Event, type: 'tag' | 'add', old?: string) => { if (e instanceof KeyboardEvent && e.key !== 'Enter') return; const value = ((e.target as HTMLInputElement).value || '').trim(); if (!value) return (type === 'tag' ? state.edit = '' : state.add = ''); if (type === 'tag') { renameTag(old!, value); state.edit = ''; } else if (state.add === 'tag') { state.add = ''; dataOp('ensure', { tagName: value }); } else if (state.add === 'season') { state.add = ''; addSeason(value); } };

    export const playNext = safe(async () => {
        if (!state.items.length || !currentItem) return false;
        const config = await cfg();
        if (!config?.settings?.loopPlaylist) return false;

        const bvid = currentItem.bvid || currentItem.url?.match(/BV[a-zA-Z0-9]+/)?.[0];
        if (bvid) {
            const currentPage = parseInt(currentItem.id?.match(/-p(\d+)/)?.[1] || '1', 10);
            const parts = await BilibiliParser.getVideoParts({ bvid });
            const nextPart = parts?.find(pt => pt.page === currentPage + 1);
            if (nextPart || config.settings.loop) {
                const part = nextPart || parts?.find(pt => pt.page === 1);
                if (part) return (Object.assign(currentItem, { id: `${currentItem.id.split('-p')[0]}-p${part.page}`, title: `${currentItem.title.split(' - P')[0]}${part.page > 1 ? ` - P${part.page}${part.part ? ': ' + part.part : ''}` : ''}`, bvid, cid: String(part.cid) }), await play(currentItem), true);
            }
        }

        const currentIndex = state.items.findIndex(i => i.id === currentItem.id || i.url === currentItem.url);
        return currentIndex >= 0 ? (await play(state.items[(currentIndex + 1) % state.items.length]), true) : false;
    });

    const handleAdd = async () => {
        if (state.input.trim()) { try { await add(state.input.trim(), state.tab); state.input = ''; } catch {} }
        else { if (!window.navigator.userAgent.includes('Electron')) { showMessage("需要桌面版支持"); return; } const { filePaths } = await window.require('@electron/remote').dialog.showOpenDialog({ properties: ['openFile', 'multiSelections'], filters: [{ name: "媒体文件", extensions: EXT.MEDIA.map(ext => ext.slice(1)) }] }); if (filePaths?.length > 1) await batchAdd(filePaths.map(p => ({ url: `file://${p.replace(/\\/g, '/')}` })), state.tab); else if (filePaths?.length) try { await add(`file://${filePaths[0].replace(/\\/g, '/')}`, state.tab); } catch {} }
    };

    // ==================== 生命周期 ====================
    onMount(() => { safe(init)(); const handleDataUpdate = () => load(); const handleConfigUpdate = (ev: CustomEvent) => { if (ev.detail?.settings?.enableDatabase !== undefined || ev.detail?.settings?.playlistDb?.id) safe(init)(); }; window.addEventListener('playlist-data-updated', handleDataUpdate); window.addEventListener('configUpdated', handleConfigUpdate); return () => { window.removeEventListener('playlist-data-updated', handleDataUpdate); window.removeEventListener('configUpdated', handleConfigUpdate); }; });

    export { play };
</script>

<div class="playlist {className}" class:hidden>
    <!-- 统一导航 -->
    <PanelNav {activeTabId} {i18n}>
        <svelte:fragment slot="controls">
            <span class="playlist-count">{state.items.length} 项</span>
            <button class="view-mode-btn" on:click={nextView} title="视图">
                <svg viewBox="0 0 24 24" width="16" height="16"><path d={ICONS[VIEWS.indexOf(state.view) % 3]}/></svg>
            </button>
        </svelte:fragment>
    </PanelNav>
    
    <!-- 标签 -->
    <div class="playlist-tabs">
        {#each state.tags as tag, index (tag)}
            {#if state.edit === tag}
                <input bind:this={state.refs.edit} type="text" class="tab-input" value={tag} on:blur={e => input(e, 'tag', tag)} on:keydown={e => input(e, 'tag', tag)}>
            {:else}
                <button
                    class="tab"
                    class:active={state.tab === tag}
                    draggable={tag !== '目录' && tag !== '默认'}
                    on:click={() => setTab(tag)}
                    on:contextmenu|preventDefault={e => menu(e, 'tab', tag)}
                    on:dragstart={() => dragStart('tag', tag)}
                    on:dragover|preventDefault
                    on:dragenter={e => dragEnter(e, 'tag', tag)}
                    on:dragleave={e => state.drag.item !== -1 && (state.drag.target = '')}
                    on:dragend={dragEnd}
                >{map(tabs, tag)}</button>
            {/if}
        {/each}
        {#if state.add}
            <input bind:this={state.refs.new} type="text" class="tab-input" style="width:{state.add === 'season' ? '200px' : '100px'}" placeholder={state.add === 'season' ? (i18n.playList?.placeholder?.bilibiliSeason || 'B站合集视频链接') : (i18n.playList?.placeholder?.newTab || '新标签名')} on:blur={e => input(e, 'add')} on:keydown={e => input(e, 'add')}>
        {:else}
            <button class="tab tab-add" on:click|preventDefault|stopPropagation={e => menu(e, 'add')}>+</button>
        {/if}
    </div>
    
    <!-- 路径 -->
    {#if state.folder.type && (state.tab === 'OpenList' || state.tab === 'WebDAV' || state.tab === '思源空间') && (hasDir || paths.length)}
            <div class="openlist-path-nav">
        <button class="path-item" on:click={() => browse(state.folder.type, (state.folder.type === 'openlist' || state.folder.type === 'webdav') ? '/' : '')}>根目录</button>
            {#each paths as part, i}
                <span class="path-sep">/</span>
                <button class="path-item" on:click={() => browse(state.folder.type, ((state.folder.type === 'openlist' || state.folder.type === 'webdav') ? '/' : '') + paths.slice(0, i + 1).map(p => p.name).join('/'))}>{part.name}</button>
            {/each}
        </div>
    {/if}
    
    <!-- 内容 -->
    <div class="playlist-content" class:grid-view={isGrid}>
        {#if items.length}
            <div class="playlist-items" class:grid-single={state.view === 'grid-single'}>
                {#each items as item, index (item.id)}
                   <div class="playlist-item"
                        class:playing={playing(item)}
                        class:selected={selected(item)}
                        class:compact={isCompact}
                        class:grid={isGrid}
                        class:folder={item.is_dir}
                        draggable={!item.is_dir}
                        on:click={() => click(item)}
                        on:dblclick={() => play((item.bvid || item.url?.match(/BV[a-zA-Z0-9]+/)?.[0]) && state.parts[item.id]?.length > 1 ? {...item, bvid: item.bvid || item.url?.match(/BV[a-zA-Z0-9]+/)?.[0], cid: String(state.parts[item.id][0].cid)} : item)}
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
                        
                        {#if state.exp.has(item.id) && state.parts[item.id]?.length > 1}
                            <div class="item-parts" class:grid-parts={isGrid && state.view === 'grid'} class:single-parts={state.view === 'grid-single'}>
                                {#each state.parts[item.id] as part}
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
            <div class="playlist-empty">{!state.enabled ? '请先在设置中启用数据库功能' : !state.dbId ? '请在设置中配置播放列表数据库' : '当前标签暂无媒体项目'}</div>
        {/if}
    </div>
    
    <!-- 输入 -->
    <div class="playlist-footer">
        <input type="text" class="tab-input playlist-input" placeholder="输入链接或直接点击添加本地文件..." bind:value={state.input} on:keydown={e => e.key === 'Enter' && handleAdd()} style="padding-right: {state.input ? '25px' : '8px'}">
        {#if state.input}<span style="position:absolute;right:80px;cursor:pointer;color:#666" on:click={() => state.input = ''}>×</span>{/if}
        <button class="add-btn" on:click={handleAdd}>添加</button>
    </div>
</div>