import type { MediaItem } from "./types";
import { MediaManager, openWithExternalPlayer } from './media';
import { BilibiliParser } from './bilibili';
import { AListManager } from './alist';
import { showMessage } from 'siyuan';
import { PlayerType } from './types';

type Result = { success: boolean; message: string; data?: any };
type MediaType = 'video' | 'audio' | 'bilibili';
type MediaSource = 'bilibili' | 'alist' | 'local' | 'standard';
interface ViewData { tags: string[]; items: MediaItem[]; activeTag: string; stats: { total: number; pinned: number; favorite: number; }; }

// 常量定义
export const EXT = {
    VIDEO: ['.mp4', '.webm', '.ogg', '.mov', '.m4v', '.mkv', '.avi', '.flv', '.wmv'],
    AUDIO: ['.mp3', '.wav', '.aac', '.m4a', '.flac', '.ogg'],
    SUBTITLE: ['.srt', '.vtt'], DANMAKU: ['.xml', '.ass'],
    get ALL() { return [...this.VIDEO, ...this.AUDIO]; },
    get SUPPORT() { return [...this.ALL, ...this.SUBTITLE, ...this.DANMAKU]; }
};
const REGEX = { BILI: /bilibili\.com\/video\/|\/BV[a-zA-Z0-9]+/, BV: /BV[a-zA-Z0-9]+/, ALIST: /\/#\//, TIME: /[?&]t=([^&]+)/, MEDIA: /\.(mp4|webm|avi|mkv|mov|flv|mp3|wav|ogg|flac)$/i, AUDIO: /\.(mp3|wav|ogg|flac|m4a)$/i };
const WS = window.siyuan.config.system.workspaceDir;

// 配置管理器
const Config = {
    _cache: null as any,
    get() { 
        if (!this._cache) this._cache = JSON.parse(window.require('fs').readFileSync(`${WS}/data/storage/petal/siyuan-media-player/config.json`, 'utf-8')); 
        return this._cache; 
    },
    clear() { this._cache = null; }
};

// 媒体工具类 - 合并URL处理和媒体检测
export class MediaUtils {
    static fmt(sec: number, opts: { anchor?: boolean; duration?: boolean } = {}): string {
        if (isNaN(sec) || sec < 0) return '0:00';
        const s = (opts.anchor || opts.duration) ? Math.round(sec) : sec;
        const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
        const ss = (opts.anchor || opts.duration) ? Math.floor(s % 60).toString().padStart(2, '0') : (s % 60).toFixed(1);
        return h > 0 ? `${h}:${m.toString().padStart(2, '0')}:${ss}` : `${m}:${ss}`;
    }

    static getCleanUrl(u: string): string { 
        if (!u) return '';
        // B站链接特殊处理：保留BV号和p参数，移除其他参数
        if (REGEX.BILI.test(u)) {
            const bvMatch = u.match(/BV[a-zA-Z0-9]+/);
            const pMatch = u.match(/[?&]p=(\d+)/);
            if (bvMatch) {
                const baseUrl = `https://www.bilibili.com/video/${bvMatch[0]}`;
                return pMatch ? `${baseUrl}?p=${pMatch[1]}` : baseUrl;
            }
        }
        // 其他链接：移除时间参数
        return u.replace(/([?&])t=[^&]+&?/, '$1').replace(/[?&]$/, '');
    }

    static getMediaInfo(u: string): { type: MediaType; source: MediaSource; path?: string } {
        if (!u) return { type: 'video', source: 'standard' };
        const isAudio = EXT.AUDIO.some(ext => u.toLowerCase().split('?')[0].endsWith(ext));
        const isBili = REGEX.BILI.test(u);
        const type = isBili ? 'bilibili' : isAudio ? 'audio' : 'video';
        if (isBili) return { type: 'bilibili', source: 'bilibili', path: u.match(REGEX.BV)?.[0] };
        if (REGEX.ALIST.test(u) || AListManager?.parsePathFromUrl?.(u)) return { type, source: 'alist', path: REGEX.ALIST.test(u) ? u.split('/#/')[1]?.split('?')[0] : AListManager?.parsePathFromUrl?.(u) };
        if (u.startsWith('file://')) return { type, source: 'local', path: u.substring(7) };
        return { type, source: 'standard' };
    }

    static getType = (u: string): MediaType => MediaUtils.getMediaInfo(u).type;
    static getTitle = (u: string): string => { try { return decodeURIComponent(u.split('/').pop()?.split('?')[0]?.split('.')[0] || '') || '未知'; } catch { return u.split(/[/\\]/).pop()?.split('.')[0] || '未知'; } };

    static parseTime(u: string): { mediaUrl: string; startTime?: number; endTime?: number } {
        const match = u.match(REGEX.TIME);
        if (!match) return { mediaUrl: u };
        const timeParam = match[1], cleanUrl = MediaUtils.getCleanUrl(u);
        if (timeParam.includes('-')) {
            const [start, end] = timeParam.split('-').map(Number);
            return { mediaUrl: cleanUrl, startTime: isNaN(start) ? undefined : start, endTime: isNaN(end) ? undefined : end };
        }
        const time = Number(timeParam);
        return { mediaUrl: cleanUrl, startTime: isNaN(time) ? undefined : time };
    }

    static isSameMedia(curr: any, media: string): boolean {
        if (!curr) return false;
        const currCleanUrl = MediaUtils.getCleanUrl(curr.url || ''), mediaCleanUrl = MediaUtils.getCleanUrl(media);
        if (currCleanUrl === mediaCleanUrl) return true;
        const mediaInfo = MediaUtils.getMediaInfo(media);
        if (mediaInfo.source === 'bilibili') {
            const bv = media.match(/BV[a-zA-Z0-9]+/)?.[0];
            if (!bv || !curr.bvid || bv.toUpperCase() !== curr.bvid.toUpperCase()) return false;
            try {
                const urlPart = parseInt(media.match(/[\?&]p=(\d+)/)?.[1] || '1', 10), currPart = parseInt(curr.id?.match(/-p(\d+)$/)?.[1] || '1', 10);
                return urlPart === currPart;
            } catch { return true; }
        }
        return false;
    }

    static withTime = (u: string, time?: number, endTime?: number): string => time ? `${u}${u.includes('?') ? '&' : '?'}t=${endTime ? `${time.toFixed(1)}-${endTime.toFixed(1)}` : time.toFixed(1)}` : u;
    static getStandardUrl = (item: any, config?: any): string => !item ? '' : item.source === 'alist' && item.sourcePath && config?.settings?.alistConfig?.server ? `${config.settings.alistConfig.server}${item.sourcePath}` : item.type === 'bilibili' && item.bvid ? `https://www.bilibili.com/video/${item.bvid}${(p => p > 1 ? `?p=${p}` : '')(parseInt(item.id?.match(/-p(\d+)$/)?.[1] || '1', 10))}` : item.url || '';
    static toFile = (path?: string): string => !path ? '' : path.startsWith('http') || path.startsWith('file') ? path : `file://${path.split('/').map(encodeURIComponent).join('/')}`;
    static isSupportedMediaLink = (u: string): boolean => u ? REGEX.BILI.test(u) || EXT.ALL.some(ext => u.split('?')[0].toLowerCase().endsWith(ext)) || (u.startsWith('file://') && EXT.ALL.some(ext => u.split('?')[0].toLowerCase().endsWith(ext))) : false;

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

// 兼容性导出
export const URLUtils = MediaUtils;
export const MediaDetector = MediaUtils;

// 工具函数
const id = () => `${Date.now().toString(36)}-${Math.random().toString(36).substr(2, 7)}`;
const safe = async (fn: Function, ...args: any[]) => { try { return await fn(...args) || { success: true, message: '操作成功' }; } catch (error: any) { return { success: false, message: error?.message || '操作失败' }; } };
const deleteRecords = (data: any, blockIds: string[]) => { const deleteSet = new Set(blockIds); data.keyValues.forEach(kv => kv.values && (kv.values = kv.values.filter(v => !deleteSet.has(v.blockID)))); data.views[0].table.rowIds = data.views[0].table.rowIds?.filter(id => !deleteSet.has(id)) || []; };

// 字段定义
const FIELD_DEFS = [
    { k: 'title', n: '媒体标题', t: 'block', i: '1f3ac', p: 1, get: (m: any) => m.title },
    { k: 'source', n: '来源', t: 'select', i: '1f4cd', opts: [{ name: 'B站', color: '4' }, { name: '本地', color: '6' }, { name: 'AList', color: '3' }, { name: '普通', color: '8' }], get: (m: any) => m.source === 'alist' ? 'AList' : (m.url?.includes('bilibili.com') || m.bvid) ? 'B站' : (m.source === 'local' || m.url?.startsWith('file://')) ? '本地' : '普通' },
    { k: 'url', n: 'URL', t: 'url', i: '1f517', get: (m: any) => m.url },
    { k: 'artist', n: '艺术家', t: 'text', i: '1f3a8', get: (m: any) => m.artist || '' },
    { k: 'artistIcon', n: '艺术家头像', t: 'mAsset', i: '1f464', get: (m: any) => m.artistIcon?.startsWith('data:image/') ? '' : m.artistIcon || '' },
    { k: 'thumbnail', n: '封面图', t: 'mAsset', i: '1f5bc', get: (m: any) => m.thumbnail?.startsWith('data:image/') ? '' : m.thumbnail || '' },
    { k: 'playlist', n: '所在标签', t: 'mSelect', i: '1f4d1', opts: [{ name: '默认', color: '1' }, { name: '收藏', color: '2' }], get: (m: any) => m.playlist ? [m.playlist] : ['默认'], ext: (f: any) => ({ isFavorite: f?.mSelect?.some((t: any) => t.content === '收藏') || false }) },
    { k: 'path', n: '地址', t: 'select', i: '1f4cd', get: (m: any) => m.path || '' },
    { k: 'duration', n: '时长', t: 'text', i: '23f1', get: (m: any) => m.duration || '' },
    { k: 'type', n: '类型', t: 'select', i: '1f4c1', opts: [{ name: '视频', color: '4' }, { name: '音频', color: '5' }, { name: '文件夹', color: '7' }], get: (m: any) => m.type || '视频', ext: (f: any) => f?.mSelect?.[0]?.content === '音频' ? 'audio' : 'video' },
    { k: 'aid', n: 'aid', t: 'text', i: '1f194', get: (m: any) => m.aid || '' },
    { k: 'bvid', n: 'bvid', t: 'text', i: '1f4dd', get: (m: any) => m.bvid || '' },
    { k: 'cid', n: 'cid', t: 'text', i: '1f4c4', get: (m: any) => m.cid || '' },
    { k: 'pinned', n: '置顶', t: 'checkbox', i: '1f4cc', get: (m: any) => m.pinned || false, ext: (f: any) => ({ isPinned: f?.checkbox?.checked || false }) },
    { k: 'created', n: '创建时间', t: 'date', i: '1f4c5', get: () => Date.now() }
];

// 配置驱动
const F = {
    v: { text: v => ({ text: { content: String(v || '') } }), url: v => ({ url: { content: String(v || '') } }), block: v => ({ block: { id: id(), icon: '', content: String(v), created: Date.now(), updated: Date.now() }, isDetached: true }), select: v => ({ mSelect: [{ content: String(v), color: '' }] }), mSelect: v => ({ mSelect: Array.isArray(v) ? v.map(item => ({ content: String(item), color: '' })) : [{ content: String(v), color: '' }] }), mAsset: v => ({ mAsset: [{ type: 'image', name: '', content: String(v) }] }), checkbox: v => ({ checkbox: { checked: !!v } }), date: v => ({ date: { content: typeof v === 'number' ? v : Date.now(), isNotEmpty: true, hasEndDate: false, isNotTime: false, content2: 0, isNotEmpty2: false, formattedContent: '' } }) },
    e: (field: any, type: string) => ({ url: field?.url?.content || '', text: field?.text?.content || '', mAsset: field?.mAsset?.[0]?.content || '', select: field?.mSelect?.[0]?.content || '', mSelect: field?.mSelect?.[0]?.content || '', checkbox: field?.checkbox?.checked || false, date: field?.date?.content || 0 })[type] || '',
    set: (data: any, media: any, blockId: string) => FIELD_DEFS.forEach(def => { const column = col(data, def.n); if (column && (def.get(media) || def.t === 'checkbox' || def.t === 'date')) { column.values = column.values || []; column.values.push({ id: id(), keyID: column.key.id, blockID: blockId, type: def.t, createdAt: Date.now(), updatedAt: Date.now(), ...F.v[def.t](def.get(media)) }); } }),
    get: (data: any, blockId: string) => FIELD_DEFS.reduce((r: any, def) => { const field = data.keyValues?.find((kv: any) => kv.key.name === def.n)?.values?.find((v: any) => v.blockID === blockId); const extracted = def.ext ? def.ext(field) : F.e(field, def.t); return typeof extracted === 'object' ? { ...r, ...extracted } : { ...r, [def.k]: extracted }; }, { id: blockId }),
    create: async (item: any, playlist: string, path = '') => ({ ...item, playlist, path, type: item.type === 'audio' ? '音频' : '视频', pinned: false })
};

const FIELDS = { schema: FIELD_DEFS.map(d => ({ name: d.n, type: d.t, icon: d.i, pin: !!d.p })), options: Object.fromEntries(FIELD_DEFS.filter(d => d.opts).map(d => [d.n, d.opts])), map: Object.fromEntries(FIELD_DEFS.map(d => [d.k, d.n])) };

// 数据查询器
const col = (d: any, n: string) => d.keyValues?.find((kv: any) => kv.key.name === n);
const rec = (d: any, t: string) => col(d, FIELDS.map.title)?.values?.find((v: any) => v.block?.content === t);
const val = (d: any, b: string, f: string) => col(d, f)?.values?.find((v: any) => v.blockID === b);

// 核心数据库类
export class MediaDB {

    async loadData(avId: string) {
        return JSON.parse(window.require('fs').readFileSync(`${WS}/data/storage/av/${avId}.json`, 'utf-8'));
    }

    async saveData(avId: string, data: any) {
        window.require('fs').writeFileSync(`${WS}/data/storage/av/${avId}.json`, JSON.stringify(data, null, 2));
        await fetch('/api/ui/reloadAttributeView', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: avId }) });
    }

    private async withData(dbBlockId: string, fn: (data: any, avId: string) => any) {
        return safe(async () => {
            const avId = await getAvIdByBlockId(dbBlockId);
            const data = await this.loadData(avId);
            const result = await fn(data, avId);
            if (result?.success !== false) await this.saveData(avId, data);
            return result || { success: true, message: '操作成功' };
        });
    }



    // 选项管理
    manageOption(data: any, column: string, option: string, action: 'ensure' | 'delete') {
        if (!option) return;
        const colObj = col(data, column);
        if (!colObj?.key) return;
        colObj.key.options = colObj.key.options || [];
        action === 'ensure' && !colObj.key.options.some(opt => opt.name === option) ? colObj.key.options.push({ name: option, color: String((colObj.key.options.length % 8) + 1), desc: '' }) : action === 'delete' && (colObj.key.options = colObj.key.options.filter(opt => opt.name !== option));
    }

    async init(dbBlockId: string) {
        return this.withData(dbBlockId, (data) => {
            data.keyValues = data.keyValues?.filter(kv => FIELDS.schema.some(s => s.name === kv.key.name)) || [];
            data.views = data.views || [{ table: { columns: [], rowIds: [] } }];

            let stats = { created: 0, updated: 0 };
            FIELDS.schema.forEach(schema => {
                const existing = col(data, schema.name);
                if (existing) {
                    if (existing.key.type !== schema.type) { existing.key.type = schema.type; stats.updated++; }
                } else {
                    const keyId = id();
                    const key: any = { id: keyId, name: schema.name, type: schema.type, icon: schema.icon, desc: '', numberFormat: '', template: '' };
                    if (FIELDS.options[schema.name]) key.options = FIELDS.options[schema.name];
                    
                    data.keyValues.push({ key });
                    data.views[0].table.columns[schema.pin ? 'unshift' : 'push']({ id: keyId, wrap: false, hidden: false, pin: !!schema.pin, width: '' });
                    stats.created++;
                }
            });
            return { success: true, message: `初始化完成：创建${stats.created}列，更新${stats.updated}列` };
        });
    }

    //CRUD操作
    async crud(dbBlockId: string, op: string, params: any) {
        return this.withData(dbBlockId, (data) => {
            if (op === 'create') {
                const { media, allowDuplicate = false } = params;
                
                // 查重检测
                if (!allowDuplicate && media.url) {
                    const cleanUrl = MediaUtils.getCleanUrl(media.url);
                    const duplicate = col(data, FIELDS.map.url)?.values?.find(v => MediaUtils.getCleanUrl(v.url?.content || '') === cleanUrl);
                    if (duplicate) {
                        const titleValue = col(data, FIELDS.map.title)?.values?.find(v => v.blockID === duplicate.blockID);
                        return { success: true, message: '媒体已存在', isDuplicate: true, existingItem: { ...F.get(data, duplicate.blockID), title: titleValue?.block?.content || '未知标题', url: duplicate.url?.content || '' } };
                    }
                }
                
                const blockId = id();
                data.views[0].table.rowIds = data.views[0].table.rowIds || [];
                data.views[0].table.rowIds.push(blockId);
                F.set(data, media, blockId);
                return { success: true, message: '添加成功', isDuplicate: false };
            } 
            else if (op === 'update') {
            const { title, updates } = params;
                const record = rec(data, title);
            if (!record) return { success: false, message: '未找到记录' };

            if (updates.removeTag) {
                const tagValue = val(data, record.blockID, FIELDS.map.playlist);
                if (tagValue?.mSelect) {
                    tagValue.mSelect = tagValue.mSelect.filter(tag => tag.content !== updates.removeTag);
                    if (tagValue.mSelect.length === 0) { deleteRecords(data, [record.blockID]); return { success: true, message: '已删除媒体' }; }
                    tagValue.updatedAt = Date.now();
                }
                return { success: true, message: `已从"${updates.removeTag}"中移除` };
            }

                Object.entries(updates).forEach(([key, value]) => {
                if (value === undefined) return;
                    const fieldName = FIELDS.map[key];
                    if (!fieldName) return;

                    const column = col(data, fieldName);
                    const field = FIELDS.schema.find(f => f.name === fieldName);
                    if (!column || !field) return;

                    const processedValue = key === 'playlist' ? [value] : value;
                column.values = column.values || [];
                const existing = column.values.find(v => v.blockID === record.blockID);

                if (existing) {
                    existing.updatedAt = Date.now();
                        Object.assign(existing, { id: id(), keyID: column.key.id, blockID: record.blockID, type: field.type, createdAt: Date.now(), updatedAt: Date.now(), ...F.v[field.type](processedValue) });
                    } else if (processedValue !== false && (processedValue || field.type === 'checkbox')) {
                        column.values.push({ id: id(), keyID: column.key.id, blockID: record.blockID, type: field.type, createdAt: Date.now(), updatedAt: Date.now(), ...F.v[field.type](processedValue) });
                }
            });
        }
            else if (op === 'delete') {
                const { title, tagName } = params;
                const blockIds = tagName ? col(data, FIELDS.map.playlist)?.values?.filter(v => v.mSelect?.some(tag => tag.content === tagName)).map(r => r.blockID) || [] : title ? (r => r ? [r.blockID] : null)(rec(data, title)) : null;
                if (!blockIds) return { success: false, message: title ? '未找到记录' : '参数错误' };
                deleteRecords(data, blockIds);
                return { success: true, message: `删除了${blockIds.length}条记录` };
            }
            return { success: true, message: `${op}成功` };
        });
    }

    // 标签和选项操作
    async manage(dbBlockId: string, type: string, params: any) {
        return this.withData(dbBlockId, (data) => {
            if (type === 'ensureTag') {
                this.manageOption(data, FIELDS.map.playlist, params.name, 'ensure');
            } else if (type === 'ensurePath') {
                this.manageOption(data, FIELDS.map.path, params.path, 'ensure');
            } else if (type === 'toggle') {
                const { title, field } = params;
                const record = rec(data, title);
                if (!record) return { success: false, message: '未找到媒体' };
                
                if (field === 'favorite') {
                    let tagValue = val(data, record.blockID, FIELDS.map.playlist);
                    if (!tagValue) {
                        const tagCol = col(data, FIELDS.map.playlist);
                        tagCol.values = tagCol.values || [];
                        tagValue = { id: id(), keyID: tagCol.key.id, blockID: record.blockID, type: 'mSelect', createdAt: Date.now(), updatedAt: Date.now(), ...F.v.mSelect(['默认']) };
                        tagCol.values.push(tagValue);
                    }
                    const hasFavorite = tagValue.mSelect?.some(t => t.content === '收藏');
                    
                    if (hasFavorite) {
                        tagValue.mSelect = tagValue.mSelect?.filter(t => t.content !== '收藏') || [];
                        if (tagValue.mSelect.length === 0) tagValue.mSelect = [{ content: '默认', color: '' }];
                    } else {
                        tagValue.mSelect = tagValue.mSelect || [];
                        tagValue.mSelect.push({ content: '收藏', color: '' });
                    }
                    tagValue.updatedAt = Date.now();
                } else {
                    let fieldValue = val(data, record.blockID, FIELDS.map.pinned);
                    const checked = !fieldValue?.checkbox?.checked;
                    const fieldCol = col(data, FIELDS.map.pinned);
                    
                    if (fieldValue) {
                        fieldValue.checkbox.checked = checked;
                        fieldValue.updatedAt = Date.now();
                    } else {
                        fieldCol.values = fieldCol.values || [];
                        fieldCol.values.push({ id: id(), keyID: fieldCol.key.id, blockID: record.blockID, type: 'checkbox', createdAt: Date.now(), updatedAt: Date.now(), ...F.v.checkbox(checked) });
                    }
                }
            } else if (type === 'tagDelete') {
                // 标签删除
                const { name } = params;
                if (name === '默认' || name === '收藏') return { success: false, message: '不能删除系统标签' };
                
                const tagColumn = col(data, FIELDS.map.playlist);
                this.manageOption(data, FIELDS.map.playlist, name, 'delete');
                const singleTagRecords = tagColumn?.values?.filter(v => 
                    v.mSelect?.some(tag => tag.content === name) && v.mSelect?.length === 1
                ).map(v => v.blockID) || [];
                
                tagColumn?.values?.forEach(value => {
                    if (value.mSelect?.some(tag => tag.content === name)) {
                        value.mSelect = value.mSelect.filter(tag => tag.content !== name);
                        value.updatedAt = Date.now();
                    }
                });
                
                if (singleTagRecords.length) deleteRecords(data, singleTagRecords);
                return { success: true, message: `标签"${name}"已删除` };
            } else if (type === 'tagRename') {
                // 标签重命名
                const { oldName, newName } = params;
                if (oldName === '默认' || oldName === '收藏') return { success: false, message: '不能重命名系统标签' };
                if (!newName?.trim()) return { success: false, message: '新标签名不能为空' };
                
                const tagColumn = col(data, FIELDS.map.playlist);
                if (tagColumn?.key?.options?.some(opt => opt.name === newName)) {
                    return { success: false, message: '标签名已存在' };
                }
                
                tagColumn?.values?.forEach(value => {
                    if (value.mSelect?.some(tag => tag.content === oldName)) {
                        value.mSelect = value.mSelect.map(tag => tag.content === oldName ? { ...tag, content: newName } : tag);
                        value.updatedAt = Date.now();
                    }
                });
                const option = tagColumn?.key?.options?.find(opt => opt.name === oldName);
                if (option) option.name = newName;
                
                return { success: true, message: `标签已重命名为"${newName}"` };
            }
            return { success: true, message: '操作成功' };
        });
    }
}

// 播放列表管理器
export class PlaylistManager {
    private db = new MediaDB();
    private dbId: string | null = null;

    private async getDbId() {
        if (!this.dbId) {
            this.dbId = Config.get().settings?.playlistDb?.id;
            if (!this.dbId) throw new Error('未配置数据库');
        }
        return this.dbId;
    }

    // 统一的添加和播放方法
    async addMedia(url: string, options: {
        playlist?: string;
        checkDuplicate?: boolean;
        autoPlay?: boolean;
        startTime?: number;
        endTime?: number;
        currentItem?: any;
        playerAPI?: any;
    } = {}): Promise<Result & { mediaItem?: MediaItem; isDuplicate?: boolean }> {
        const { playlist = '默认', checkDuplicate = true, autoPlay = false, startTime, endTime, currentItem, playerAPI } = options;
        const cleanUrl = MediaUtils.getCleanUrl(url);
        
        // 同媒体跳转优化
        if (autoPlay && currentItem && MediaUtils.isSameMedia(currentItem, cleanUrl)) {
            setTimeout(() => {
                if (endTime !== undefined) playerAPI?.setLoopSegment(startTime, endTime);
                else if (startTime !== undefined) playerAPI?.seekTo(startTime);
            }, 100);
            return { success: true, message: '已跳转到指定时间', isDuplicate: false };
        }
        
        // 创建并添加媒体项
        const item = await MediaManager.createMediaItem(cleanUrl);
        if (!item) return { success: false, message: '无法解析媒体链接' };
        
        const result = await this.db.crud(await this.getDbId(), 'create', { 
            media: await F.create(item, playlist, ''), 
            allowDuplicate: !checkDuplicate 
        });
        
        const mediaItem = result.isDuplicate ? result.existingItem : {
            ...item,
            startTime,
            endTime
        };
        
        // 自动播放和刷新
        if (autoPlay && mediaItem) window.dispatchEvent(new CustomEvent('directMediaPlay', { detail: mediaItem }));
        window.dispatchEvent(new CustomEvent('refreshPlaylist'));
        await this.refreshData();
        
        return { ...result, mediaItem, isDuplicate: result.isDuplicate || false };
    }

    private async addBatch(sources: any[], tagName: string, sourceType: string, isMediaItems = false, sourcePath = '', checkDuplicate = true): Promise<Result> {
        const dbId = await this.getDbId();
        let count = 0, duplicates = 0;
        
        if (sourcePath) {
            const data = await this.db.loadData(await getAvIdByBlockId(dbId));
            this.db.manageOption(data, FIELDS.map.path, sourcePath, 'ensure');
            await this.db.saveData(await getAvIdByBlockId(dbId), data);
        }
        
        for (const source of sources) {
            const item = isMediaItems ? source : await MediaManager.createMediaItem(source);
            if (item) {
                const result = await this.db.crud(dbId, 'create', { 
                    media: await F.create(item, tagName, sourcePath),
                    allowDuplicate: !checkDuplicate 
                });
                result.isDuplicate ? duplicates++ : count++;
            }
        }
        
        return { success: true, message: duplicates > 0 ? `已添加${count}个${sourceType}到"${tagName}"，跳过${duplicates}个重复项` : `已添加${count}个${sourceType}到"${tagName}"` };
    }

    private async processFolder(type: string, path: string = '', scanOnly = false): Promise<any> {
        if (type === 'alist') return scanOnly ? [] : await AListManager.createMediaItemsFromDirectory(path || '/');
        if (!window.navigator.userAgent.includes('Electron')) throw new Error('此功能仅在桌面版可用');

        const fs = window.require('fs'), pathModule = window.require('path'), fullPath = type === 'siyuan' ? pathModule.join(WS, 'data', path) : path, items: MediaItem[] = [], urls: string[] = [];

        const scan = (dir: string) => { try { fs.readdirSync(dir).forEach((file: string) => { const filePath = pathModule.join(dir, file); 
            if (fs.statSync(filePath).isDirectory()) { scanOnly ? scan(filePath) : items.push({ id: `${type}-folder-${Date.now()}-${Math.random().toString(36).slice(2,5)}`, title: file, type: 'folder', url: '#', source: type, sourcePath: type === 'siyuan' ? pathModule.relative(pathModule.join(WS, 'data'), filePath).replace(/\\/g, '/') : filePath, is_dir: true } as MediaItem); } 
            else if (REGEX.MEDIA.test(file)) { scanOnly ? urls.push(`file://${filePath.replace(/\\/g, '/')}`) : items.push({ id: `${type}-${Date.now()}-${Math.floor(Math.random() * 1000)}`, title: file, url: `file://${filePath.replace(/\\/g, '/')}`, type: REGEX.AUDIO.test(file) ? 'audio' : 'video', source: '本地', sourcePath: filePath } as MediaItem); } }); } catch (error) { console.error('扫描失败:', dir, error); } };

        scan(fullPath);
        return scanOnly ? { urls, count: urls.length } : items;
    }

    private async op(type: string, params: any = {}) {
        const d = await this.getDbId();
        const [cat, action] = type.split('.');
        const ops = {
            'media.add': async () => { await this.db.manage(d, 'ensureTag', { name: params.playlist || '默认' }); return this.addMedia(params.url, { playlist: params.playlist, checkDuplicate: params.checkDuplicate !== false, autoPlay: params.autoPlay || false }); },
            'media.delete': () => params.tagName && !params.title ? this.db.crud(d, 'delete', { tagName: params.tagName }) : params.tagName && params.tagName !== '默认' ? this.db.crud(d, 'update', { title: params.title, updates: { removeTag: params.tagName } }) : this.db.crud(d, 'delete', { title: params.title }),
            'media.move': async () => { await this.db.manage(d, 'ensureTag', { name: params.newPlaylist }); return this.db.crud(d, 'update', { title: params.title, updates: { playlist: params.newPlaylist } }); },
            'media.toggle': () => this.db.manage(d, 'toggle', { title: params.title, field: params.field }),
            'media.removeFromTag': () => this.db.crud(d, 'update', { title: params.title, updates: { removeTag: params.tagName } }),
            'tag.add': async () => { await this.db.manage(d, 'ensureTag', { name: params.name }); return { success: true, message: `标签"${params.name}"添加成功` }; },
            'tag.delete': () => this.db.manage(d, 'tagDelete', params),
            'tag.rename': () => this.db.manage(d, 'tagRename', params),
            'folder.add': async () => { 
                if (!window.navigator.userAgent.includes('Electron')) return { success: false, message: '此功能仅在桌面版可用' }; 
                const path = params.isSiyuan ? window.require('path').join(WS, 'data') : (await window.require('@electron/remote').dialog.showOpenDialog({ properties: ['openDirectory', 'createDirectory'] })).filePaths?.[0]; 
                if (!path) return { success: false, message: '未选择文件夹' }; 
                const name = params.isSiyuan ? "思源空间" : path.split(/[\\/]/).pop(); 
                await this.db.manage(d, 'ensureTag', { name }); 
                return this.addBatch((await this.processFolder(params.isSiyuan ? 'siyuan' : 'folder', path, true)).urls, name, '媒体文件', false, path, params.checkDuplicate !== false); 
            },
            'folder.browse': () => ({ success: true, data: this.processFolder(params.type, params.path || '', false) }),
            'source.addBiliFav': async () => { 
                const config = Config.get(); 
                const { title, items } = await BilibiliParser.getFavoritesList(params.favId, config); 
                const name = params.favTitle || title; 
                await this.db.manage(d, 'ensureTag', { name }); 
                return this.addBatch((items || []).map((item: any) => `https://www.bilibili.com/video/${item.bvid}`), name, 'B站视频', false, params.favId, params.checkDuplicate !== false); 
            },
            'source.listBiliFavs': async () => { 
                const config = Config.get(); 
                return !config?.bilibiliLogin?.userInfo?.mid ? { success: false, message: '请先登录B站账号' } : (folders => folders?.length ? { success: true, message: '获取收藏夹列表成功', data: folders } : { success: false, message: '未找到收藏夹' })(await BilibiliParser.getUserFavoriteFolders(config)); 
            }
        };
        return ops[type] ? await ops[type]() : { success: false, message: `未知操作: ${type}` };
    }

    async operation(type: string, params: any = {}): Promise<Result & { needsRefresh?: boolean }> {
        const result = await this.op(type, params);
        if (result.success && !type.includes('list') && !type.includes('browse')) {
            await this.refreshData();
            return { ...result, needsRefresh: true };
        }
        return { ...result, needsRefresh: false };
    }

    async getViewData(tagName: string = '默认'): Promise<ViewData> {
        const data = await this.db.loadData(await getAvIdByBlockId(await this.getDbId()));
        const tagColumn = col(data, FIELDS.map.playlist);
        const tags = Array.from(new Set([...(tagColumn?.key?.options?.map(opt => opt.name) || []), ...Array.from(new Set(tagColumn?.values?.flatMap(v => v.mSelect?.map(tag => tag.content) || []) || [])), '默认', '收藏']));
        const activeTag = tags.includes(tagName) ? tagName : tags[0] || '默认';
        const titleColumn = col(data, FIELDS.map.title);
        if (!titleColumn?.values) return { tags, items: [], activeTag, stats: { total: 0, pinned: 0, favorite: 0 } };
        const blockIds = new Set((tagColumn?.values?.filter(v => v.mSelect?.some(tag => tag.content === activeTag)) || []).map(r => r.blockID));
        const items = titleColumn.values.filter(v => blockIds.has(v.blockID)).map(titleValue => ({ ...F.get(data, titleValue.blockID), title: titleValue.block?.content || '未知标题' } as MediaItem));
        return { tags, items, activeTag, stats: { total: items.length, pinned: items.filter(item => item.isPinned).length, favorite: items.filter(item => item.isFavorite).length } };
    }

    async refreshData(): Promise<void> {
        await fetch('/api/ui/reloadAttributeView', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: await getAvIdByBlockId(await this.getDbId()) }) });
        window.dispatchEvent(new CustomEvent('playlist-data-updated', { detail: { timestamp: Date.now() } }));
    }

        /**
     * 创建链接点击处理器 - 使用统一的MediaHandler
     */
    static createLinkClickHandler(context: { 
        getConfig: () => any; 
        playerAPI: any; 
        currentItem: MediaItem | null; 
        openTab: () => void; 
        waitForElement: (selector: string, timeout?: number) => Promise<Element | null>; 
        components: Map<string, any>; 
        i18n: any;
    }) {
        const handler = new MediaHandler(context);
        handler.setCurrentItem(context.currentItem);
        return handler.createLinkClickHandler();
    }
}

export const getAvIdByBlockId = async (blockId: string): Promise<string> => {
    const res = await fetch('/api/query/sql', {
        method: 'POST',
        body: JSON.stringify({ stmt: `SELECT markdown FROM blocks WHERE type='av' AND id='${blockId}'` })
    }).then(r => r.json());
    const match = res.data?.[0]?.markdown?.match(/data-av-id="([^"]+)"/);
    if (match?.[1]) return match[1];
    throw new Error('未找到属性视图ID');
};

// 统一媒体处理器
export class MediaHandler {
    private manager: PlaylistManager;
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

    constructor(context: {
        getConfig: () => any;
        playerAPI?: any;
        openTab: () => void;
        waitForElement: (selector: string, timeout?: number) => Promise<Element | null>;
        components: Map<string, any>;
        i18n: any;
    }) {
        this.manager = new PlaylistManager();
        this.getConfig = context.getConfig;
        this.openTab = context.openTab;
        this.waitForElement = context.waitForElement;
        this.components = context.components;
        this.i18n = context.i18n;
        
        // 初始化播放器API和事件系统
        this.initPlayerAPI();
        this.registerEvents();
    }

    setCurrentItem(item: MediaItem | null) {
        this.currentItem = item;
    }

    // 初始化播放器API
    private initPlayerAPI() {
        this.playerAPI = {
            seekTo: (time: number) => this.components.get('player')?.seekTo?.(time),
            getCurrentTime: () => this.components.get('player')?.getCurrentTime?.() || 0,
            getScreenshotDataURL: () => this.components.get('player')?.getScreenshotDataURL?.() || Promise.resolve(null),
            setPlayTime: (start: number, end?: number) => this.components.get('player')?.setPlayTime?.(start, end),
            setLoopSegment: (start: number, end: number) => this.components.get('player')?.setPlayTime?.(start, end),
            setLoop: (isLoop: boolean, loopTimes?: number) => this.components.get('player')?.setLoop?.(isLoop, loopTimes),
            updateConfig: (newConfig: any) => this.components.get('player')?.updateConfig?.(newConfig),
            getCurrentMedia: () => this.currentItem,
            pause: () => this.components.get('player')?.pause?.(),
            resume: () => this.components.get('player')?.resume?.(),
            play: (url: string, options: any) => this.components.get('player')?.play?.(url, options),
            
            playMediaItem: async (mediaItem: MediaItem) => {
                if (!mediaItem) return;
                
                try {
                    this.currentItem = mediaItem;
                    
                    const { playMedia } = await import('./media');
                    await playMedia(
                        mediaItem, 
                        this.playerAPI, 
                        this.getConfig(), 
                        (item) => {
                            this.currentItem = item;
                            window.dispatchEvent(new CustomEvent('siyuanMediaPlayerUpdate', {
                                detail: { player: this.playerAPI, currentItem: this.currentItem }
                            }));
                            
                            // 应用待处理的时间
                            if (this.pendingTime) {
                                setTimeout(() => {
                                    if (this.pendingTime.end) {
                                        this.playerAPI.setLoopSegment(this.pendingTime.start, this.pendingTime.end);
                                    } else if (this.pendingTime.start) {
                                        this.playerAPI.seekTo(this.pendingTime.start);
                                    }
                                    this.pendingTime = null;
                                }, 500);
                            }
                        }, 
                        this.i18n
                    );
                    
                    // 设置时间戳和循环片段
                    if (mediaItem.startTime !== undefined && !this.pendingTime) {
                        const startTime = Number(mediaItem.startTime);
                        if (mediaItem.endTime !== undefined) {
                            this.playerAPI.setPlayTime(startTime, Number(mediaItem.endTime));
                        } else {
                            this.playerAPI.seekTo(startTime);
                        }
                    }
                } catch (error) {
                    console.error("播放媒体失败:", error);
                    const { showMessage } = await import('siyuan');
                    showMessage(this.i18n.player?.error?.playFailed || "播放失败");
                }
            },
            
            createTimestampLink: async (isLoop = false, startTime?: number, endTime?: number, subtitleText?: string) => {
                if (!this.playerAPI || !this.currentItem) return null;
                
                const config = this.getConfig();
                const time = startTime ?? this.playerAPI.getCurrentTime();
                const loopEnd = isLoop ? (endTime ?? time + 3) : endTime;
                
                const { link } = await import('./document');
                return link(this.currentItem, config, time, loopEnd, subtitleText);
            }
        };
    }

    // 注册事件处理器
    private registerEvents() {
        // 全局事件处理
        const handlers = {
            'siyuanMediaPlayerUpdate': (e: CustomEvent<any>) => {
                const { currentItem } = e.detail;
                this.currentItem = currentItem;
                this.setCurrentItem(currentItem);
            },
            
            'addMediaToPlaylist': (e: CustomEvent<any>) => {
                this.handleAddToPlaylist(e.detail || {});
            },
            
            'directMediaPlay': (e: CustomEvent<any>) => {
                const item = e.detail;
                if (item) {
                    this.currentItem = item;
                    this.setCurrentItem(item);
                    this.handleDirectPlay(item);
                }
            },
            
            'playMediaItem': (e: CustomEvent) => this.playerAPI.playMediaItem(e.detail),
            
            'mediaPlayerAction': async (e: CustomEvent<any>) => {
                const { action, loopStartTime } = e.detail;
                if (!this.components.get('player') || !this.currentItem) return;
                
                try {
                    const settings = this.getConfig();
                    
                    switch (action) {
                        case 'loopSegment': {
                            const currentTime = this.playerAPI.getCurrentTime();
                            if (loopStartTime !== null && currentTime > loopStartTime) {
                                this.playerAPI.createTimestampLink(true, loopStartTime, currentTime)
                                    .then(async link => {
                                        if (link) {
                                            const { doc } = await import('./document');
                                            doc.insert(link, settings, this.i18n);
                                            const { showMessage } = await import('siyuan');
                                            showMessage(this.i18n.loopSegment?.insertSuccess || "循环片段链接已插入");
                                        }
                                    });
                                this.loopStartTime = null;
                            } else {
                                this.loopStartTime = currentTime;
                            }
                            
                            window.dispatchEvent(new CustomEvent('loopSegmentResponse', {
                                detail: { loopStartTime: this.loopStartTime }
                            }));
                            break;
                        }
                        case 'mediaNotes': {
                            const { mediaNotes } = await import('./document');
                            mediaNotes.create(this.currentItem, settings, this.playerAPI, this.i18n);
                            break;
                        }
                        case 'screenshot': {
                            const { player: playerUtils } = await import('./document');
                            playerUtils.screenshot(this.playerAPI, this.currentItem, settings, this.i18n);
                            break;
                        }
                        case 'timestamp': {
                            const { player: playerUtils } = await import('./document');
                            playerUtils.timestamp(this.playerAPI, this.currentItem, settings, this.i18n);
                            break;
                        }
                    }
                } catch (error) {
                    console.error(`${action} 操作失败:`, error);
                    const { showMessage } = await import('siyuan');
                    showMessage(this.i18n.controlBar?.[action]?.error || `${action} 操作失败`);
                }
            },
            
            'updatePlayerConfig': (e: CustomEvent) => {
                if (this.playerAPI?.updateConfig) {
                    this.playerAPI.updateConfig(e.detail);
                }
            },
            
            'mediaPlayerTabChange': (e: CustomEvent) => {
                // 这个事件需要在主插件中处理UI相关逻辑
                // 这里只做基础处理
            },
            
            'mediaEnded': (e: CustomEvent) => {
                if (e.detail?.loopPlaylist) {
                    const playlist = this.components.get('playlist');
                    if (playlist?.playNext) playlist.playNext();
                }
            },
            
            'reloadUserScripts': () => {
                // 这个事件需要在主插件中处理
            }
        };
        
        // 注册全局事件
        Object.entries(handlers).forEach(([event, handler]) => {
            const listener = handler.bind(this) as EventListener;
            this.events.set(event, listener);
            window.addEventListener(event, listener);
        });
    }

    // 获取播放器API
    getPlayerAPI() {
        return this.playerAPI;
    }

    // 清理资源
    cleanup() {
        // 清理事件监听器
        this.events.forEach((handler, event) => window.removeEventListener(event, handler));
        this.events.clear();
        
        // 清理状态
        this.currentItem = null;
        this.loopStartTime = null;
        this.pendingTime = null;
    }

    // 统一的直接播放处理
    async handleDirectPlay(mediaItem: MediaItem): Promise<void> {
        this.openTab();
        
        setTimeout(async () => {
            if (!mediaItem) return;
            
            // 处理B站视频流获取，确保保留时间参数
            let playOptions = { 
                ...mediaItem, 
                type: mediaItem.type || 'video',
                startTime: mediaItem.startTime,
                endTime: mediaItem.endTime
            };
            
            if ((mediaItem.source === 'B站' || mediaItem.type === 'bilibili') && mediaItem.bvid && mediaItem.cid) {
                const config = this.getConfig();
                if (!config.bilibiliLogin?.userInfo?.mid) {
                    showMessage('需要登录B站才能播放视频');
                    return;
                }
                
                try {
                    const { BilibiliParser } = await import('./bilibili');
                    const streamInfo = await BilibiliParser.getProcessedVideoStream(mediaItem.bvid, mediaItem.cid, 0, config);
                    if (streamInfo.dash) {
                        Object.assign(playOptions, { 
                            url: streamInfo.dash.video?.[0]?.baseUrl || '', 
                            headers: streamInfo.headers, 
                            type: 'bilibili-dash', 
                            biliDash: streamInfo.dash,
                            startTime: mediaItem.startTime,
                            endTime: mediaItem.endTime
                        });
                    }
                } catch (error) {
                    console.error('获取B站视频流失败:', error);
                    showMessage(`获取视频流失败: ${error.message || '未知错误'}`);
                    return;
                }
            }
            
            this.currentItem = playOptions;
            window.dispatchEvent(new CustomEvent('playMediaItem', { detail: playOptions }));
            
            const playlist = this.components.get('playlist');
            if (playlist?.$set) playlist.$set({ currentItem: playOptions });
        }, 300);
    }

    // 添加到播放列表处理
    async handleAddToPlaylist(params: { url: string; autoPlay?: boolean; playlist?: string; checkDuplicate?: boolean }): Promise<void> {
        const playlist = this.components.get('playlist');
        if (!playlist?.addMedia) return;
        
        const { url, autoPlay = true, playlist: playlistName, checkDuplicate = true } = params;
        await playlist.addMedia(url, { playlist: playlistName, checkDuplicate });
        
        if (autoPlay) this.openTab();
    }

    // 链接点击处理
    createLinkClickHandler() {
        return async (e: MouseEvent) => {
            const target = e.target as HTMLElement;
            if (!target.matches('span[data-type="a"]')) return;
            
            const urlStr = target.getAttribute('data-href');
            if (!urlStr || !MediaUtils.isSupportedMediaLink(urlStr)) return;
            
            e.preventDefault();
            e.stopPropagation();
            
            const config = this.getConfig();
            const playerType = e.ctrlKey ? PlayerType.BROWSER : config.settings.playerType;
            
            // 外部播放器处理
            if (playerType === PlayerType.POT_PLAYER || playerType === PlayerType.BROWSER) {
                const error = await openWithExternalPlayer(urlStr, playerType, config.settings.playerPath);
                if (error) showMessage(error);
                return;
            }
            
            const { mediaUrl: cleanUrl, startTime, endTime } = MediaUtils.parseTime(urlStr);
            
            // 确保播放器标签打开
            if (!document.querySelector('.media-player-tab')) {
                this.openTab();
                await this.waitForElement('.media-player-tab', 2000);
                await new Promise(resolve => setTimeout(resolve, 500));
            }
            
            // 特殊媒体处理
            const mediaInfo = MediaUtils.getMediaInfo(cleanUrl);
            if (mediaInfo.source === 'alist') {
                if (!await AListManager.initFromConfig(config)) {
                    showMessage("未连接到AList服务器，请先在设置中配置AList");
                    return;
                }
                
                const result = await AListManager.handleAListMediaLink(cleanUrl, { startTime, endTime });
                if (result.success && result.mediaItem) {
                    result.mediaItem.startTime = startTime;
                    result.mediaItem.endTime = endTime;
                    await this.handleDirectPlay(result.mediaItem);
                    return;
                } else if (result.error) {
                    showMessage(`处理AList媒体失败: ${result.error}`);
                    return;
                }
            }
            
            // 统一添加和播放
            const playlistComponent = this.components.get('playlist');
            const manager = (playlistComponent && typeof playlistComponent.addMedia === 'function') 
                ? playlistComponent 
                : this.manager;
            const result = await manager.addMedia(cleanUrl, {
                checkDuplicate: true,
                autoPlay: true,
                startTime,
                endTime,
                currentItem: this.currentItem,
                playerAPI: this.playerAPI
            });
            
            if (!result.success) showMessage(`播放失败: ${result.message || '未知错误'}`);
        };
    }
}

export const createPlaylistManager = () => new PlaylistManager(); 