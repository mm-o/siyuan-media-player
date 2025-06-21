import type { MediaItem } from "./types";
import { MediaManager, openWithExternalPlayer } from './media';
import { BilibiliParser } from './bilibili';
import { AListManager } from './alist';
import { showMessage } from 'siyuan';
import { PlayerType } from './types';

type Result = { success: boolean; message: string; data?: any };
type MediaType = 'video' | 'audio' | 'bilibili';
type MediaSource = 'bilibili' | 'alist' | 'local' | 'standard';
interface ViewData { tags: string[]; items: MediaItem[]; activeTag: string; stats: { total: number; pinned: number; }; }

// 常量系统
const C = {
    E: { V: ['.mp4', '.webm', '.ogg', '.mov', '.m4v', '.mkv', '.avi', '.flv', '.wmv'], 
         A: ['.mp3', '.wav', '.aac', '.m4a', '.flac', '.ogg'], 
         get ALL() { return [...this.V, ...this.A]; }, 
         get MEDIA() { return this.ALL; }, 
         get SUPPORT() { return [...this.ALL, '.srt', '.ass', '.vtt', '.xml']; } },
    R: { B: /bilibili\.com\/video\/|\/BV[a-zA-Z0-9]+/, BV: /BV[a-zA-Z0-9]+/, T: /[?&]t=([^&]+)/, 
         M: /\.(mp4|webm|avi|mkv|mov|flv|mp3|wav|ogg|flac)$/i, A: /\.(mp3|wav|ogg|flac|m4a)$/i },
    W: window.siyuan.config.system.workspaceDir
};

// 配置
const Config = {
    _c: null as any, _p: null as any, setPlugin: (p: any) => Config._p = p, get: async () => Config._c || (Config._c = await Config._p?.loadData?.('config.json') || { settings: {} }), clear: () => Config._c = null
};

// MediaUtils
export class MediaUtils {
    static fmt = (s: number, o: any = {}): string => isNaN(s) || s < 0 ? '0:00' : 
        ((t, h, m, ss) => h > 0 ? `${h}:${m.toString().padStart(2, '0')}:${ss}` : `${m}:${ss}`)
        (o.anchor || o.duration ? Math.round(s) : s, ~~(s / 3600), ~~((s % 3600) / 60), o.anchor || o.duration ? ~~(s % 60).toString().padStart(2, '0') : (s % 60).toFixed(1));

    static getCleanUrl = (u: string): string => !u ? '' : 
        C.R.B.test(u) ? 
            ((bv, p) => bv ? `https://www.bilibili.com/video/${bv[0]}${p ? `?p=${p[1]}` : ''}` : u)(u.match(/BV[a-zA-Z0-9]+/), u.match(/[?&]p=(\d+)/)) : 
            u.replace(/([?&])t=[^&]+&?/, '$1').replace(/[?&]$/, '');

    static getMediaInfo = (u: string): { type: MediaType; source: MediaSource; path?: string } => !u ? { type: 'video', source: 'standard' } : 
        ((a, b) => b ? { type: 'bilibili', source: 'bilibili', path: u.match(C.R.BV)?.[0] } : 
            u.includes('/#/') || AListManager?.parsePathFromUrl?.(u) ? { type: a ? 'audio' : 'video', source: 'alist', path: u.includes('/#/') ? u.split('/#/')[1]?.split('?')[0] : AListManager?.parsePathFromUrl?.(u) } : 
            u.startsWith('file://') ? { type: a ? 'audio' : 'video', source: 'local', path: u.substring(7) } : 
            { type: a ? 'audio' : 'video', source: 'standard' })
        (C.E.A.some(e => u.toLowerCase().split('?')[0].endsWith(e)), C.R.B.test(u));


    static getTitle = (u: string): string => { try { return decodeURIComponent(u.split('/').pop()?.split('?')[0]?.split('.')[0] || '') || '未知'; } catch { return u.split(/[/\\]/).pop()?.split('.')[0] || '未知'; } };

    static parseTime = (u: string): { mediaUrl: string; startTime?: number; endTime?: number } => 
        ((match) => {
            const clean = MediaUtils.getCleanUrl(u);
            if (!match) return { mediaUrl: u };
            const t = match[1];
            return t.includes('-') ? 
                ((s, e) => ({ mediaUrl: clean, startTime: isNaN(s) ? undefined : s, endTime: isNaN(e) ? undefined : e }))(...t.split('-').map(Number)) : 
                ((time) => ({ mediaUrl: clean, startTime: isNaN(time) ? undefined : time }))(Number(t));
        })(u.match(C.R.T));

    static isSameMedia = (curr: any, media: string): boolean => !curr ? false : 
        ((currUrl, mediaUrl, info) => currUrl === mediaUrl ? true : 
            info.source === 'bilibili' ? 
                ((bv) => !bv || !curr.bvid || bv.toUpperCase() !== curr.bvid.toUpperCase() ? false : 
                    ((urlPart, currPart) => urlPart === currPart)(parseInt(media.match(/[\?&]p=(\d+)/)?.[1] || '1', 10), parseInt(curr.id?.match(/-p(\d+)$/)?.[1] || '1', 10)))(media.match(/BV[a-zA-Z0-9]+/)?.[0]) : 
                false)
        (MediaUtils.getCleanUrl(curr.url || ''), MediaUtils.getCleanUrl(media), MediaUtils.getMediaInfo(media));

    static withTime = (u: string, t?: number, e?: number): string => t ? `${u}${u.includes('?') ? '&' : '?'}t=${e ? `${t.toFixed(1)}-${e.toFixed(1)}` : t.toFixed(1)}` : u;
    static getStandardUrl = (i: any, c?: any): string => !i ? '' : 
        i.source === 'alist' && i.sourcePath && c?.settings?.alistConfig?.server ? 
            `${c.settings.alistConfig.server}${i.sourcePath}` : 
        i.type === 'bilibili' && i.bvid ? 
            `https://www.bilibili.com/video/${i.bvid}${((p) => p > 1 ? `?p=${p}` : '')(parseInt(i.id?.match(/-p(\d+)$/)?.[1] || '1', 10))}` : 
            i.url || '';
    static toFile = (p?: string): string => !p || p.startsWith('http') || p.startsWith('file') ? p || '' : `file://${p.split('/').map(encodeURIComponent).join('/')}`;
    static isSupportedMediaLink = (u: string): boolean => u && (C.R.B.test(u) || C.E.ALL.some(e => u.split('?')[0].toLowerCase().endsWith(e)));

    static async findMediaSupportFile(mediaUrl: string, exts: string[]): Promise<string | null> {
        if (!mediaUrl) return null;
        if (mediaUrl.startsWith('file://')) {
            const { pathname } = new URL(mediaUrl), path = decodeURIComponent(pathname), idx = path.lastIndexOf('.');
            if (idx === -1) return null;
            const dir = path.substring(0, path.lastIndexOf('/')), base = path.substring(path.lastIndexOf('/') + 1, idx);
            for (const ext of exts) { 
                const url = `file://${dir}/${encodeURIComponent(base)}${ext}`; 
                try { if ((await fetch(url, {method: 'HEAD'})).ok) return url; } catch {} 
            }
        } else if (AListManager.parsePathFromUrl(mediaUrl)) {
            const path = AListManager.parsePathFromUrl(mediaUrl);
            if (path) return AListManager.getSupportFileLink(path, exts);
        }
        return null;
    }
}

// 工具和字段定义
const U = {
    id: () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`,
    safe: async (fn: Function, ...args: any[]) => { try { return await fn(...args) || { success: true, message: '操作成功' }; } catch (e: any) { return { success: false, message: e?.message || '操作失败' }; } },
    del: (d: any, ids: string[]) => ((s) => (d.keyValues.forEach(kv => kv.values && (kv.values = kv.values.filter(v => !s.has(v.blockID)))), d.views[0].table.rowIds = d.views[0].table.rowIds?.filter(id => !s.has(id)) || []))(new Set(ids)),
    col: (d: any, n: string) => d.keyValues?.find((kv: any) => kv.key.name === n), rec: (d: any, t: string) => U.col(d, F.map.title)?.values?.find((v: any) => v.block?.content === t), val: (d: any, b: string, f: string) => U.findField(d, f, b), findField: (d: any, fieldName: string, blockId: string) => d.keyValues?.find((kv: any) => kv.key.name === fieldName)?.values?.find((v: any) => v.blockID === blockId), emit: (eventName: string, detail?: any) => window.dispatchEvent(new CustomEvent(eventName, detail ? { detail } : undefined))
};

// 字段定义数组
const FD = [['title', '媒体标题', 'block', '1f3ac', 1], ['source', '来源', 'select', '1f4cd', 0, [['B站', '4'], ['本地', '6'], ['AList', '3'], ['普通', '8']]], ['url', 'URL', 'url', '1f517'], ['artist', '艺术家', 'text', '1f3a8'], ['artistIcon', '艺术家头像', 'mAsset', '1f464'], ['thumbnail', '封面图', 'mAsset', '1f5bc'], ['playlist', '所在标签', 'mSelect', '1f4d1', 0, [['默认', '1']]], ['path', '地址', 'select', '1f4cd'], ['duration', '时长', 'text', '23f1'], ['type', '类型', 'select', '1f4c1', 0, [['视频', '4'], ['音频', '5'], ['文件夹', '7']]], ['aid', 'aid', 'text', '1f194'], ['bvid', 'bvid', 'text', '1f4dd'], ['cid', 'cid', 'text', '1f4c4'], ['pinned', '置顶', 'checkbox', '1f4cc'], ['created', '创建时间', 'date', '1f4c5']];

const F = {
    map: Object.fromEntries(FD.map(f => [f[0], f[1]])),
    schema: FD.map(f => ({ name: f[1], type: f[2], icon: f[3], pin: !!f[4] })),
    options: Object.fromEntries(FD.filter(f => f[5]).map(f => [f[1], f[5].map(o => ({ name: o[0], color: o[1] }))])),
    v: { text: v => ({ text: { content: String(v || '') } }), url: v => ({ url: { content: String(v || '') } }), block: v => ({ block: { id: U.id(), icon: '', content: String(v), created: Date.now(), updated: Date.now() }, isDetached: true }), select: v => ({ mSelect: [{ content: String(v), color: '' }] }), mSelect: v => ({ mSelect: Array.isArray(v) ? v.map(i => ({ content: String(i), color: '' })) : [{ content: String(v), color: '' }] }), mAsset: v => ({ mAsset: [{ type: 'image', name: '', content: String(v) }] }), checkbox: v => ({ checkbox: { checked: !!v } }), date: v => ({ date: { content: typeof v === 'number' ? v : Date.now(), isNotEmpty: true, hasEndDate: false, isNotTime: false, content2: 0, isNotEmpty2: false, formattedContent: '' } }) },
    e: (f: any, t: string) => (t === 'checkbox' ? f?.checkbox?.checked || false : 
        t === 'date' ? f?.date?.content || 0 : 
        t === 'mAsset' ? f?.mAsset?.[0]?.content || '' : 
        (t === 'select' || t === 'mSelect') ? f?.mSelect?.[0]?.content || '' : 
        f?.[t]?.content || ''),
    set: (d: any, m: any, b: string) => FD.forEach(([k, n, t]) => 
        ((c, v) => c && (v || t === 'checkbox' || t === 'date') && 
            (c.values = c.values || [], c.values.push({ id: U.id(), keyID: c.key.id, blockID: b, type: t, createdAt: Date.now(), updatedAt: Date.now(), ...F.v[t](v) })))
        (U.col(d, n), k === 'title' ? m.title : 
            k === 'source' ? (m.source === 'alist' ? 'AList' : (m.url?.includes('bilibili.com') || m.bvid) ? 'B站' : (m.source === 'local' || m.url?.startsWith('file://')) ? '本地' : '普通') : 
            k === 'playlist' ? (m.playlist ? [m.playlist] : ['默认']) : 
            k === 'type' ? (m.type === 'audio' ? '音频' : '视频') : 
            k === 'created' ? Date.now() : m[k] || '')),
    get: (d: any, b: string) => FD.reduce((r: any, [k, n, t]) => 
        ((f, ex) => typeof ex === 'object' ? { ...r, ...ex } : { ...r, [k]: ex })
        (U.findField(d, n, b), 
            k === 'type' ? (U.findField(d, n, b)?.mSelect?.[0]?.content === '音频' ? 'audio' : 'video') : 
            k === 'pinned' ? { isPinned: U.findField(d, n, b)?.checkbox?.checked || false } : 
            F.e(U.findField(d, n, b), t)), 
        { id: b }),

};

// 核心数据库类
export class MediaDB {
    private getPath = (avId: string) => `${C.W}/data/storage/av/${avId}.json`;
    load = async (avId: string) => JSON.parse(window.require('fs').readFileSync(this.getPath(avId), 'utf-8'));
    save = async (avId: string, data: any) => { 
        window.require('fs').writeFileSync(this.getPath(avId), JSON.stringify(data, null, 2)); 
        await fetch('/api/ui/reloadAttributeView', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: avId }) }); 
    };
    withData = async (dbBlockId: string, fn: (data: any, avId: string) => any) => U.safe(async () => { 
        const avId = await getAvIdByBlockId(dbBlockId), data = await this.load(avId), result = await fn(data, avId); 
        if (result?.success !== false) await this.save(avId, data); 
        return result || { success: true, message: '操作成功' }; 
    });
    opt = (d: any, c: string, o: string, a: 'ensure' | 'delete') => o && 
        ((obj) => obj?.key && (obj.key.options = obj.key.options || [], 
            a === 'ensure' && !obj.key.options.some(opt => opt.name === o) ? 
                obj.key.options.push({ name: o, color: String((obj.key.options.length % 8) + 1), desc: '' }) : 
                a === 'delete' && (obj.key.options = obj.key.options.filter(opt => opt.name !== o))))
        (U.col(d, c));
    init = async (dbBlockId: string) => this.withData(dbBlockId, (data) => (
        data.keyValues = data.keyValues?.filter(kv => F.schema.some(s => s.name === kv.key.name)) || [], 
        data.views = data.views || [{ table: { columns: [], rowIds: [] } }], 
        ((stats) => (F.schema.forEach(schema => 
            ((existing, keyId, key) => existing ? 
                (existing.key.type !== schema.type && (existing.key.type = schema.type, stats.updated++)) : 
                (key = { id: keyId, name: schema.name, type: schema.type, icon: schema.icon, desc: '', numberFormat: '', template: '' }, 
                F.options[schema.name] && (key.options = F.options[schema.name]), 
                data.keyValues.push({ key }), 
                data.views[0].table.columns[schema.pin ? 'unshift' : 'push']({ id: keyId, wrap: false, hidden: false, pin: !!schema.pin, width: '' }), 
                stats.created++))(U.col(data, schema.name), U.id())), 
            { success: true, message: `初始化完成：创建${stats.created}列，更新${stats.updated}列` }))({ created: 0, updated: 0 })));

    crud = async (dbBlockId: string, op: string, params: any) => this.withData(dbBlockId, (data) => {
        const operations = {
            create: () => 
                ((media, allowDuplicate, cleanUrl, duplicate, blockId) => 
                    !allowDuplicate && media.url && (cleanUrl = MediaUtils.getCleanUrl(media.url), duplicate = U.col(data, F.map.url)?.values?.find(v => MediaUtils.getCleanUrl(v.url?.content || '') === cleanUrl)) ? 
                        ((titleValue) => ({ success: true, message: '媒体已存在', isDuplicate: true, existingItem: { ...F.get(data, duplicate.blockID), title: titleValue?.block?.content || '未知标题', url: duplicate.url?.content || '' } }))
                        (U.col(data, F.map.title)?.values?.find(v => v.blockID === duplicate.blockID)) : 
                        (blockId = U.id(), data.views[0].table.rowIds = data.views[0].table.rowIds || [], data.views[0].table.rowIds.push(blockId), F.set(data, media, blockId), { success: true, message: '添加成功', isDuplicate: false }))
                (params.media, params.allowDuplicate),
            update: () => 
                ((title, updates, record, tagValue) => !record ? { success: false, message: '未找到记录' } : 
                    updates.removeTag ? 
                        (tagValue = U.val(data, record.blockID, F.map.playlist), tagValue?.mSelect && 
                            (tagValue.mSelect = tagValue.mSelect.filter(tag => tag.content !== updates.removeTag), 
                                tagValue.mSelect.length === 0 ? 
                                    (U.del(data, [record.blockID]), { success: true, message: '已删除媒体' }) : 
                                    (tagValue.updatedAt = Date.now(), { success: true, message: `已从"${updates.removeTag}"中移除` }))) : 
                        (Object.entries(updates).forEach(([key, value]) => value !== undefined && 
                            ((fieldName, column, field, processedValue, existing) => column && field && 
                                (processedValue = key === 'playlist' ? [value] : value, column.values = column.values || [], existing = column.values.find(v => v.blockID === record.blockID), 
                                    existing ? 
                                        (existing.updatedAt = Date.now(), Object.assign(existing, { id: U.id(), keyID: column.key.id, blockID: record.blockID, type: field.type, createdAt: Date.now(), updatedAt: Date.now(), ...F.v[field.type](processedValue) })) : 
                                        (processedValue !== false && (processedValue || field.type === 'checkbox')) && column.values.push({ id: U.id(), keyID: column.key.id, blockID: record.blockID, type: field.type, createdAt: Date.now(), updatedAt: Date.now(), ...F.v[field.type](processedValue) })))
                            (F.map[key], U.col(data, F.map[key]), F.schema.find(f => f.name === F.map[key]))), undefined))
                (params.title, params.updates, U.rec(data, params.title)),
            delete: () => 
                ((title, tagName, blockIds) => 
                    !(blockIds = tagName ? 
                        U.col(data, F.map.playlist)?.values?.filter(v => v.mSelect?.some(tag => tag.content === tagName)).map(r => r.blockID) || [] : 
                        title ? ((r) => r ? [r.blockID] : null)(U.rec(data, title)) : null) ? 
                    { success: false, message: title ? '未找到记录' : '参数错误' } : 
                    (U.del(data, blockIds), { success: true, message: `删除了${blockIds.length}条记录` }))
                (params.title, params.tagName)
        };
        return operations[op] ? operations[op]() : { success: true, message: `${op}成功` };
    });

    manage = async (dbBlockId: string, type: string, params: any) => this.withData(dbBlockId, (data) => {
        const operations = {
        ensureTag: () => this.opt(data, F.map.playlist, params.name, 'ensure'),
        ensurePath: () => this.opt(data, F.map.path, params.path, 'ensure'),
            toggle: () => 
                ((title, field, record) => !record ? { success: false, message: '未找到媒体' } : 
                    field === 'pinned' ? 
                        ((fieldValue) => fieldValue ? 
                            (fieldValue.checkbox.checked = !fieldValue?.checkbox?.checked, fieldValue.updatedAt = Date.now()) : 
                            ((fieldCol) => (fieldCol = U.col(data, F.map.pinned), fieldCol.values = fieldCol.values || [], 
                                fieldCol.values.push({ id: U.id(), keyID: fieldCol.key.id, blockID: record.blockID, type: 'checkbox', createdAt: Date.now(), updatedAt: Date.now(), ...F.v.checkbox(true) }))))()
                        (U.val(data, record.blockID, F.map.pinned)) : 
                        { success: false, message: '不支持的操作' })
                (params.title, params.field, U.rec(data, params.title)),
            tagDelete: () => 
                ((name, tagColumn, singleTagRecords) => 
                    name === '默认' ? 
                        { success: false, message: '不能删除系统标签' } : 
                        (tagColumn = U.col(data, F.map.playlist), 
                            this.opt(data, F.map.playlist, name, 'delete'), 
                            singleTagRecords = tagColumn?.values?.filter(v => v.mSelect?.some(tag => tag.content === name) && v.mSelect?.length === 1).map(v => v.blockID) || [], 
                            tagColumn?.values?.forEach(value => value.mSelect?.some(tag => tag.content === name) && 
                                (value.mSelect = value.mSelect.filter(tag => tag.content !== name), value.updatedAt = Date.now())), 
                            singleTagRecords.length && U.del(data, singleTagRecords), 
                            { success: true, message: `标签"${name}"已删除` }))
                (params.name),
            tagRename: () => 
                ((oldName, newName, tagColumn, option) => 
                    oldName === '默认' ? 
                        { success: false, message: '不能重命名系统标签' } : 
                    !newName?.trim() ? 
                        { success: false, message: '新标签名不能为空' } : 
                    (tagColumn = U.col(data, F.map.playlist), tagColumn?.key?.options?.some(opt => opt.name === newName)) ? 
                        { success: false, message: '标签名已存在' } : 
                        (tagColumn?.values?.forEach(value => value.mSelect?.some(tag => tag.content === oldName) && 
                            (value.mSelect = value.mSelect.map(tag => tag.content === oldName ? { ...tag, content: newName } : tag), value.updatedAt = Date.now())), 
                            option = tagColumn?.key?.options?.find(opt => opt.name === oldName), 
                            option && (option.name = newName), 
                            { success: true, message: `标签已重命名为"${newName}"` }))
                (params.oldName, params.newName)
        };
        return operations[type] ? operations[type]() : { success: true, message: '操作成功' };
    });
}

// 播放列表
export class PlaylistManager {
    private db = new MediaDB();
    private dbId: string | null = null;

    private getDbId = async () => this.dbId || (this.dbId = (await Config.get()).settings?.playlistDb?.id) || (() => { throw new Error('未配置数据库'); })();

    async addMedia(url: string, options: any = {}): Promise<Result & { mediaItem?: MediaItem; isDuplicate?: boolean }> {
        const { playlist = '默认', checkDuplicate = true, autoPlay = false, startTime, endTime, currentItem, playerAPI } = options, cleanUrl = MediaUtils.getCleanUrl(url);
        
        if (autoPlay && currentItem && MediaUtils.isSameMedia(currentItem, cleanUrl)) return setTimeout(() => endTime !== undefined ? playerAPI?.setLoopSegment(startTime, endTime) : startTime !== undefined && playerAPI?.seekTo(startTime), 100), { success: true, message: '已跳转到指定时间', isDuplicate: false };
        
        const item = await MediaManager.createMediaItem(cleanUrl);
        if (!item) return { success: false, message: '无法解析媒体链接' };
        
        const result = await this.db.crud(await this.getDbId(), 'create', { media: { ...item, playlist, path: '', type: item.type === 'audio' ? '音频' : '视频', pinned: false }, allowDuplicate: !checkDuplicate }), mediaItem = result.isDuplicate ? result.existingItem : { ...item, startTime, endTime };
        
        return autoPlay && mediaItem && U.emit('directMediaPlay', mediaItem), U.emit('refreshPlaylist'), await this.refreshData(), { ...result, mediaItem, isDuplicate: result.isDuplicate || false };
    }

    private addBatch = async (sources: any[], tagName: string, sourceType: string, isMediaItems = false, sourcePath = '', checkDuplicate = true): Promise<Result> => { 
        const dbId = await this.getDbId(); 
        let count = 0, duplicates = 0; 
        if (sourcePath) { 
            const data = await this.db.load(await getAvIdByBlockId(dbId)); 
            this.db.opt(data, F.map.path, sourcePath, 'ensure'); 
            await this.db.save(await getAvIdByBlockId(dbId), data); 
        } 
        for (const source of sources) { 
            const item = isMediaItems ? source : await MediaManager.createMediaItem(source); 
            if (item) { 
                const result = await this.db.crud(dbId, 'create', { media: { ...item, playlist: tagName, path: sourcePath, type: item.type === 'audio' ? '音频' : '视频', pinned: false }, allowDuplicate: !checkDuplicate }); 
                result.isDuplicate ? duplicates++ : count++; 
            } 
        } 
        return { success: true, message: duplicates > 0 ? `已添加${count}个${sourceType}到"${tagName}"，跳过${duplicates}个重复项` : `已添加${count}个${sourceType}到"${tagName}"` }; 
    };

    private processFolder = async (type: string, path = '', scanOnly = false): Promise<any> => 
        type === 'alist' ? 
            scanOnly ? [] : await AListManager.createMediaItemsFromDirectory(path || '/') : 
        !window.navigator.userAgent.includes('Electron') ? 
            (() => { throw new Error('此功能仅在桌面版可用'); })() : 
        ((fs, pm, fp, items, urls, scan) => (
            scan = (dir: string) => { 
                try { 
                    fs.readdirSync(dir).forEach((file: string) => 
                        ((filePath) => fs.statSync(filePath).isDirectory() ? 
                            scanOnly ? scan(filePath) : 
                                items.push({ id: `${type}-folder-${Date.now()}-${Math.random().toString(36).slice(2,5)}`, title: file, type: 'folder', url: '#', source: type, sourcePath: type === 'siyuan' ? pm.relative(pm.join(C.W, 'data'), filePath).replace(/\\/g, '/') : filePath, is_dir: true } as MediaItem) : 
                            C.R.M.test(file) && (scanOnly ? urls.push(`file://${filePath.replace(/\\/g, '/')}`) : 
                                items.push({ id: `${type}-${Date.now()}-${Math.floor(Math.random() * 1000)}`, title: file, url: `file://${filePath.replace(/\\/g, '/')}`, type: C.R.A.test(file) ? 'audio' : 'video', source: '本地', sourcePath: filePath } as MediaItem)))
                        (pm.join(dir, file))); 
                } catch (error) { console.error('扫描失败:', dir, error); } 
            }, 
            scan(fp), scanOnly ? { urls, count: urls.length } : items))
        (window.require('fs'), window.require('path'), type === 'siyuan' ? window.require('path').join(C.W, 'data', path) : path, [], []);

    private op = async (type: string, params: any = {}) => { const d = await this.getDbId(); const ops = {
        'media.add': async () => (await this.db.manage(d, 'ensureTag', { name: params.playlist || '默认' }), this.addMedia(params.url, { playlist: params.playlist, checkDuplicate: params.checkDuplicate !== false, autoPlay: params.autoPlay || false })),
        'media.delete': () => params.tagName && !params.title ? this.db.crud(d, 'delete', { tagName: params.tagName }) : params.tagName && params.tagName !== '默认' ? this.db.crud(d, 'update', { title: params.title, updates: { removeTag: params.tagName } }) : this.db.crud(d, 'delete', { title: params.title }),
        'media.move': async () => (await this.db.manage(d, 'ensureTag', { name: params.newPlaylist }), this.db.crud(d, 'update', { title: params.title, updates: { playlist: params.newPlaylist } })),
        'media.toggle': () => this.db.manage(d, 'toggle', { title: params.title, field: params.field }),
        'media.removeFromTag': () => this.db.crud(d, 'update', { title: params.title, updates: { removeTag: params.tagName } }),
        'media.reorder': () => this.db.withData(d, (data) => (data.views[0].table.rowIds = params.itemIds)),
        'tag.reorder': () => this.db.withData(d, (data) => ((c) => c?.key?.options && (c.key.options = params.tagOrder.map(t => c.key.options.find(o => o.name === t)).filter(Boolean)))(U.col(data, F.map.playlist))),
        'tag.add': async () => (await this.db.manage(d, 'ensureTag', { name: params.name })),
        'tag.delete': () => this.db.manage(d, 'tagDelete', params),
        'tag.rename': () => this.db.manage(d, 'tagRename', params),
        'view.set': () => this.db.withData(d, (data) => (data.views[0].view = params.view)),
        'view.get': async () => ({ success: true, data: (await this.db.load(await getAvIdByBlockId(d))).views[0].view || 'detailed' }),
        'folder.add': async () => { 
            if (!window.navigator.userAgent.includes('Electron')) return { success: false, message: '此功能仅在桌面版可用' }; 
            const path = params.isSiyuan ? window.require('path').join(C.W, 'data') : (await window.require('@electron/remote').dialog.showOpenDialog({ properties: ['openDirectory', 'createDirectory'] })).filePaths?.[0]; 
            if (!path) return { success: false, message: '未选择文件夹' }; 
            const name = params.isSiyuan ? "思源空间" : path.split(/[\\/]/).pop(); 
            await this.db.manage(d, 'ensureTag', { name }); 
            return this.addBatch((await this.processFolder(params.isSiyuan ? 'siyuan' : 'folder', path, true)).urls, name, '媒体文件', false, path, params.checkDuplicate !== false); 
        },
        'folder.browse': async () => ({ success: true, data: await this.processFolder(params.type, params.path || '', false) }),
        'source.addBiliFav': async () => 
            ((config, { title, items }, name) => (
                name = params.favTitle || title, 
                this.db.manage(d, 'ensureTag', { name }), 
                this.addBatch((items || []).map((item: any) => `https://www.bilibili.com/video/${item.bvid}`), name, 'B站视频', false, params.favId, params.checkDuplicate !== false)))
            (await Config.get(), await BilibiliParser.getFavoritesList(params.favId, await Config.get())),
        'source.listBiliFavs': async () => 
            ((config, folders) => !config?.settings?.bilibiliLogin?.mid ? 
                { success: false, message: '请先登录B站账号' } : 
                folders?.length ? 
                    { success: true, message: '获取收藏夹列表成功', data: folders } : 
                    { success: false, message: '未找到收藏夹' })
            (await Config.get(), await BilibiliParser.getUserFavoriteFolders(await Config.get()))
    }; 
    return ops[type] ? await ops[type]() : { success: false, message: `未知操作: ${type}` }; 
};

    operation = async (type: string, params: any = {}): Promise<Result & { needsRefresh?: boolean }> => 
        ((result) => result.success && !type.includes('list') && !type.includes('browse') ? 
            (this.refreshData(), { ...result, needsRefresh: true }) : 
            { ...result, needsRefresh: false })
        (await this.op(type, params));

    getViewData = async (tagName = '默认'): Promise<ViewData> => 
        ((data, tagColumn, tags, activeTag, titleColumn, blockIds, items) => (
            tagColumn = U.col(data, F.map.playlist), 
            tags = [...(tagColumn?.key?.options?.map(opt => opt.name) || []), '默认'].filter((t, i, a) => a.indexOf(t) === i), 
            activeTag = tags.includes(tagName) ? tagName : tags[0] || '默认', 
            titleColumn = U.col(data, F.map.title), 
            !titleColumn?.values ? 
                { tags, items: [], activeTag, stats: { total: 0, pinned: 0 } } : 
                (blockIds = new Set((tagColumn?.values?.filter(v => v.mSelect?.some(tag => tag.content === activeTag)) || []).map(r => r.blockID)), 
                    items = (data.views[0].table.rowIds || []).filter(id => blockIds.has(id)).map(id => ({ ...F.get(data, id), title: titleColumn?.values?.find(v => v.blockID === id)?.block?.content || '未知标题' } as MediaItem)), 
                    { tags, items, activeTag, stats: { total: items.length, pinned: items.filter(item => item.isPinned).length } })))
        (await this.db.load(await getAvIdByBlockId(await this.getDbId())));

    refreshData = async (): Promise<void> => (
        await fetch('/api/ui/reloadAttributeView', { 
            method: 'POST', 
            headers: { 'Content-Type': 'application/json' }, 
            body: JSON.stringify({ id: await getAvIdByBlockId(await this.getDbId()) }) 
        }), 
        U.emit('playlist-data-updated', { timestamp: Date.now() }));

    static createLinkClickHandler = (context: any) => 
        ((handler) => (
            handler.setCurrentItem(context.currentItem), 
            handler.createLinkClickHandler()))
        (new MediaHandler(context));
}

export const getAvIdByBlockId = async (blockId: string): Promise<string> => {
    const res = await fetch('/api/query/sql', { method: 'POST', body: JSON.stringify({ stmt: `SELECT markdown FROM blocks WHERE type='av' AND id='${blockId}'` }) }).then(r => r.json());
    const match = res.data?.[0]?.markdown?.match(/data-av-id="([^"]+)"/);
    return match?.[1] || (() => { throw new Error('未找到属性视图ID'); })();
};

// 媒体处理
export class MediaHandler {
    private manager = new PlaylistManager();
    private getConfig: () => any;
    private playerAPI: any;
    private currentItem: MediaItem | null = null;
    private openTab: () => void;
    private waitForElement: (selector: string, timeout?: number) => Promise<Element | null>;
    private components: Map<string, any>;
    private events = new Map<string, EventListener>();
    private loopStartTime: number = null;
    private pendingTime: {start?: number, end?: number} | null = null;
    private i18n: any;

    constructor(context: any) {
        Object.assign(this, { getConfig: context.getConfig, openTab: context.openTab, waitForElement: context.waitForElement, components: context.components, i18n: context.i18n });
        this.initPlayerAPI();
        this.registerEvents();
    }

    setCurrentItem = (item: MediaItem | null) => this.currentItem = item;

    private initPlayerAPI() {
        this.playerAPI = {
            seekTo: (t: number) => this.components.get('player')?.seekTo?.(t),
            getCurrentTime: () => this.components.get('player')?.getCurrentTime?.() || 0,
            getScreenshotDataURL: () => this.components.get('player')?.getScreenshotDataURL?.() || Promise.resolve(null),
            setPlayTime: (s: number, e?: number) => this.components.get('player')?.setPlayTime?.(s, e),
            setLoopSegment: (s: number, e: number) => this.playerAPI.setPlayTime(s, e),
            setLoop: (l: boolean, t?: number) => this.components.get('player')?.setLoop?.(l, t),
            updateConfig: (c: any) => this.components.get('player')?.updateConfig?.(c),
            getCurrentMedia: () => this.currentItem,
            pause: () => this.components.get('player')?.pause?.(),
            resume: () => this.components.get('player')?.resume?.(),
            play: (u: string, o: any) => this.components.get('player')?.play?.(u, o),
            
            playMediaItem: async (m: MediaItem) => m && (this.currentItem = m, 
                (async () => { 
                    try { 
                        const { playMedia } = await import('./media'); 
                        await playMedia(m, this.playerAPI, await this.getConfig(), 
                            (item) => (this.currentItem = item, 
                                U.emit('siyuanMediaPlayerUpdate', { player: this.playerAPI, currentItem: this.currentItem }), 
                                this.pendingTime && setTimeout(() => (
                                    this.pendingTime.end ? 
                                        this.playerAPI.setLoopSegment(this.pendingTime.start, this.pendingTime.end) : 
                                        this.pendingTime.start && this.playerAPI.seekTo(this.pendingTime.start), 
                                    this.pendingTime = null), 500)), 
                            this.i18n); 
                        m.startTime !== undefined && !this.pendingTime && 
                            (m.endTime !== undefined ? 
                                this.playerAPI.setPlayTime(Number(m.startTime), Number(m.endTime)) : 
                                this.playerAPI.seekTo(Number(m.startTime))); 
                    } catch (error) { 
                        console.error("播放媒体失败:", error); 
                        const { showMessage } = await import('siyuan'); 
                        showMessage(this.i18n.player?.error?.playFailed || "播放失败"); 
                    } 
                })()),
            
            createTimestampLink: async (l = false, s?: number, e?: number, t?: string) => { 
                if (!this.playerAPI || !this.currentItem) return null; 
                const config = await this.getConfig(); 
                const time = s ?? this.playerAPI.getCurrentTime(); 
                const loopEnd = l ? (e ?? time + 3) : e; 
                const { link } = await import('./document'); 
                return link(this.currentItem, config, time, loopEnd, t); 
            }
        };
    }

    private registerEvents() {
        Object.entries({
            'siyuanMediaPlayerUpdate': (e: CustomEvent<any>) => (this.currentItem = e.detail.currentItem, this.setCurrentItem(e.detail.currentItem)),
            'addMediaToPlaylist': (e: CustomEvent<any>) => this.handleAddToPlaylist(e.detail || {}),
            'directMediaPlay': (e: CustomEvent<any>) => e.detail && (this.currentItem = e.detail, this.setCurrentItem(e.detail), this.handleDirectPlay(e.detail)),
            'playMediaItem': (e: CustomEvent) => this.playerAPI.playMediaItem(e.detail),
            'mediaPlayerAction': async (e: CustomEvent<any>) => { 
                const { action, loopStartTime } = e.detail; 
                if (!this.components.get('player') || !this.currentItem) return; 
                try { 
                    const settings = await this.getConfig(); 
                    switch (action) { 
                        case 'loopSegment': { 
                            const currentTime = this.playerAPI.getCurrentTime(); 
                            if (loopStartTime !== null && currentTime > loopStartTime) { 
                                this.playerAPI.createTimestampLink(true, loopStartTime, currentTime).then(async link => { 
                                    if (link) { 
                                        const { doc } = await import('./document'); 
                                        doc.insert(link, settings, this.i18n); 
                                        showMessage(this.i18n.loopSegment?.insertSuccess || "循环片段链接已插入"); 
                                    } 
                                }); 
                                this.loopStartTime = null; 
                            } else { 
                                this.loopStartTime = currentTime; 
                            } 
                            U.emit('loopSegmentResponse', { loopStartTime: this.loopStartTime }); 
                            break; 
                        } 
                        case 'mediaNotes': { 
                            const { mediaNotes } = await import('./document'); 
                            mediaNotes.create(this.currentItem, settings, this.playerAPI, this.i18n); 
                            break; 
                        } 
                        case 'screenshot': { 
                            const { player } = await import('./document'); 
                            player.screenshot(this.playerAPI, this.currentItem, settings, this.i18n); 
                            break; 
                        } 
                        case 'timestamp': { 
                            const { player } = await import('./document'); 
                            player.timestamp(this.playerAPI, this.currentItem, settings, this.i18n); 
                            break; 
                        } 
                    } 
                } catch (error) { 
                    console.error(`${action} 操作失败:`, error); 
                    showMessage(this.i18n.controlBar?.[action]?.error || `${action} 操作失败`); 
                } 
            },
            'updatePlayerConfig': (e: CustomEvent) => this.playerAPI?.updateConfig?.(e.detail),
            'mediaPlayerTabChange': (e: CustomEvent) => {},
            'mediaEnded': (e: CustomEvent) => e.detail?.loopPlaylist && ((pl) => pl?.playNext?.())(this.components.get('playlist'))
        }).forEach(([e, handler]) => ((l) => (this.events.set(e, l), window.addEventListener(e, l)))(handler.bind(this) as EventListener));
    }

    getPlayerAPI = () => this.playerAPI;
    cleanup = () => (
        this.events.forEach((h, e) => window.removeEventListener(e, h)), 
        this.events.clear(), 
        this.currentItem = null, 
        this.loopStartTime = null, 
        this.pendingTime = null);

    handleDirectPlay = async (mediaItem: MediaItem): Promise<void> => { 
        this.openTab(); 
        setTimeout(async () => { 
            if (!mediaItem) return; 
            const playOptions = { ...mediaItem, type: mediaItem.type || 'video', startTime: mediaItem.startTime, endTime: mediaItem.endTime }; 
            const config = await this.getConfig(); 
            if ((mediaItem.source === 'B站' || mediaItem.type === 'bilibili') && mediaItem.bvid && mediaItem.cid) { 
                if (!config.settings?.bilibiliLogin?.mid) { 
                    showMessage('需要登录B站才能播放视频'); 
                    return; 
                } 
                try { 
                    const stream = await BilibiliParser.getProcessedVideoStream(mediaItem.bvid, mediaItem.cid, 0, config); 
                    if (stream.dash) Object.assign(playOptions, { url: stream.dash.video?.[0]?.baseUrl || '', headers: stream.headers, type: 'bilibili-dash', biliDash: stream.dash, startTime: mediaItem.startTime, endTime: mediaItem.endTime }); 
                } catch (error) { 
                    console.error('获取B站视频流失败:', error); 
                    showMessage(`获取视频流失败: ${error.message || '未知错误'}`); 
                    return; 
                } 
            } 
            this.currentItem = playOptions; 
            U.emit('playMediaItem', playOptions); 
            const pl = this.components.get('playlist'); 
            if (pl?.$set) pl.$set({ currentItem: playOptions }); 
        }, 300); 
    };

    handleAddToPlaylist = async (params: { url: string; autoPlay?: boolean; playlist?: string; checkDuplicate?: boolean }): Promise<void> => 
        ((pl) => pl?.addMedia && 
            (pl.addMedia(params.url, { playlist: params.playlist, checkDuplicate: params.checkDuplicate }), 
                params.autoPlay !== false && this.openTab()))
        (this.components.get('playlist'));

    createLinkClickHandler = () => async (e: MouseEvent) => 
        ((t, urlStr) => t.matches('span[data-type="a"]') && urlStr && MediaUtils.isSupportedMediaLink(urlStr) && 
            (e.preventDefault(), e.stopPropagation(), 
                (async () => { 
                    const config = await this.getConfig(), playerType = e.ctrlKey ? PlayerType.BROWSER : config.settings.playerType; 
                    if (playerType === PlayerType.POT_PLAYER || playerType === PlayerType.BROWSER) { 
                        const error = await openWithExternalPlayer(urlStr, playerType, config.settings.playerPath); 
                        return error && showMessage(error); 
                    } 
                    const { mediaUrl: cleanUrl, startTime, endTime } = MediaUtils.parseTime(urlStr); 
                    !document.querySelector('.media-player-tab') && 
                        (this.openTab(), await this.waitForElement('.media-player-tab', 2000), await new Promise(resolve => setTimeout(resolve, 500))); 
                    const mediaInfo = MediaUtils.getMediaInfo(cleanUrl); 
                    if (mediaInfo.source === 'alist') { 
                        if (!await AListManager.initFromConfig(config)) return showMessage("未连接到AList服务器，请先在设置中配置AList"); 
                        const result = await AListManager.handleAListMediaLink(cleanUrl, { startTime, endTime }); 
                        if (result.success && result.mediaItem) return result.mediaItem.startTime = startTime, result.mediaItem.endTime = endTime, this.handleDirectPlay(result.mediaItem); 
                        if (result.error) return showMessage(`处理AList媒体失败: ${result.error}`); 
                    } 
                    const plc = this.components.get('playlist'), manager = plc && typeof plc.addMedia === 'function' ? plc : this.manager, 
                        result = await manager.addMedia(cleanUrl, { checkDuplicate: true, autoPlay: true, startTime, endTime, currentItem: this.currentItem, playerAPI: this.playerAPI }); 
                    !result.success && showMessage(`播放失败: ${result.message || '未知错误'}`); 
                })()))
        (e.target as HTMLElement, (e.target as HTMLElement).getAttribute('data-href'));
}


export { Config };
export const EXT = { VIDEO: C.E.V, AUDIO: C.E.A, MEDIA: C.E.ALL, SUPPORT: C.E.SUPPORT, ALL: C.E.ALL }; 