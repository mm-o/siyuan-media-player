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

// 常量
export const EXT = {
    VIDEO: ['.mp4', '.webm', '.ogg', '.mov', '.m4v', '.mkv', '.avi', '.flv', '.wmv'],
    AUDIO: ['.mp3', '.wav', '.aac', '.m4a', '.flac', '.ogg'],
    SUBTITLE: ['.srt', '.vtt'], DANMAKU: ['.xml', '.ass'],
    get ALL() { return [...this.VIDEO, ...this.AUDIO]; },
    get SUPPORT() { return [...this.ALL, ...this.SUBTITLE, ...this.DANMAKU]; }
};
const REGEX = { BILI: /bilibili\.com\/video\/|\/BV[a-zA-Z0-9]+/, BV: /BV[a-zA-Z0-9]+/, ALIST: /\/#\//, TIME: /[?&]t=([^&]+)/, MEDIA: /\.(mp4|webm|avi|mkv|mov|flv|mp3|wav|ogg|flac)$/i, AUDIO: /\.(mp3|wav|ogg|flac|m4a)$/i };
const WS = window.siyuan.config.system.workspaceDir;

// 配置
const Config = {
    _c: null as any, _p: null as any,
    setPlugin(p: any) { this._p = p; },
    async get() { return this._c || (this._c = await this._p?.loadData?.('config.json') || { settings: {}, bilibiliLogin: undefined }); },
    clear() { this._c = null; }
};

// 媒体工具
export class MediaUtils {
    static fmt(s: number, o: any = {}): string {
        if (isNaN(s) || s < 0) return '0:00';
        const t = o.anchor || o.duration ? Math.round(s) : s, h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60);
        const ss = o.anchor || o.duration ? Math.floor(t % 60).toString().padStart(2, '0') : (t % 60).toFixed(1);
        return h > 0 ? `${h}:${m.toString().padStart(2, '0')}:${ss}` : `${m}:${ss}`;
    }

    static getCleanUrl(u: string): string { 
        if (!u) return '';
        if (REGEX.BILI.test(u)) {
            const bv = u.match(/BV[a-zA-Z0-9]+/), p = u.match(/[?&]p=(\d+)/);
            return bv ? `https://www.bilibili.com/video/${bv[0]}${p ? `?p=${p[1]}` : ''}` : u;
        }
        return u.replace(/([?&])t=[^&]+&?/, '$1').replace(/[?&]$/, '');
    }

    static getMediaInfo(u: string): { type: MediaType; source: MediaSource; path?: string } {
        if (!u) return { type: 'video', source: 'standard' };
        const isAudio = EXT.AUDIO.some(e => u.toLowerCase().split('?')[0].endsWith(e));
        const isBili = REGEX.BILI.test(u);
        if (isBili) return { type: 'bilibili', source: 'bilibili', path: u.match(REGEX.BV)?.[0] };
        if (REGEX.ALIST.test(u) || AListManager?.parsePathFromUrl?.(u)) return { type: isAudio ? 'audio' : 'video', source: 'alist', path: REGEX.ALIST.test(u) ? u.split('/#/')[1]?.split('?')[0] : AListManager?.parsePathFromUrl?.(u) };
        if (u.startsWith('file://')) return { type: isAudio ? 'audio' : 'video', source: 'local', path: u.substring(7) };
        return { type: isAudio ? 'audio' : 'video', source: 'standard' };
    }

    static getType = (u: string): MediaType => MediaUtils.getMediaInfo(u).type;
    static getTitle = (u: string): string => { try { return decodeURIComponent(u.split('/').pop()?.split('?')[0]?.split('.')[0] || '') || '未知'; } catch { return u.split(/[/\\]/).pop()?.split('.')[0] || '未知'; } };

    static parseTime(u: string): { mediaUrl: string; startTime?: number; endTime?: number } {
        const m = u.match(REGEX.TIME);
        if (!m) return { mediaUrl: u };
        const t = m[1], clean = MediaUtils.getCleanUrl(u);
        if (t.includes('-')) {
            const [s, e] = t.split('-').map(Number);
            return { mediaUrl: clean, startTime: isNaN(s) ? undefined : s, endTime: isNaN(e) ? undefined : e };
        }
        const time = Number(t);
        return { mediaUrl: clean, startTime: isNaN(time) ? undefined : time };
    }

    static isSameMedia(curr: any, media: string): boolean {
        if (!curr) return false;
        const currUrl = MediaUtils.getCleanUrl(curr.url || ''), mediaUrl = MediaUtils.getCleanUrl(media);
        if (currUrl === mediaUrl) return true;
        const info = MediaUtils.getMediaInfo(media);
        if (info.source === 'bilibili') {
            const bv = media.match(/BV[a-zA-Z0-9]+/)?.[0];
            if (!bv || !curr.bvid || bv.toUpperCase() !== curr.bvid.toUpperCase()) return false;
            try {
                const urlPart = parseInt(media.match(/[\?&]p=(\d+)/)?.[1] || '1', 10);
                const currPart = parseInt(curr.id?.match(/-p(\d+)$/)?.[1] || '1', 10);
                return urlPart === currPart;
            } catch { return true; }
        }
        return false;
    }

    static withTime = (u: string, t?: number, e?: number): string => t ? `${u}${u.includes('?') ? '&' : '?'}t=${e ? `${t.toFixed(1)}-${e.toFixed(1)}` : t.toFixed(1)}` : u;
    static getStandardUrl = (i: any, c?: any): string => !i ? '' : i.source === 'alist' && i.sourcePath && c?.settings?.alistConfig?.server ? `${c.settings.alistConfig.server}${i.sourcePath}` : i.type === 'bilibili' && i.bvid ? `https://www.bilibili.com/video/${i.bvid}${(p => p > 1 ? `?p=${p}` : '')(parseInt(i.id?.match(/-p(\d+)$/)?.[1] || '1', 10))}` : i.url || '';
    static toFile = (p?: string): string => !p ? '' : p.startsWith('http') || p.startsWith('file') ? p : `file://${p.split('/').map(encodeURIComponent).join('/')}`;
    static isSupportedMediaLink = (u: string): boolean => u ? REGEX.BILI.test(u) || EXT.ALL.some(e => u.split('?')[0].toLowerCase().endsWith(e)) || (u.startsWith('file://') && EXT.ALL.some(e => u.split('?')[0].toLowerCase().endsWith(e))) : false;

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

export const URLUtils = MediaUtils;
export const MediaDetector = MediaUtils;

// 工具
const id = () => `${Date.now().toString(36)}-${Math.random().toString(36).substr(2, 7)}`;
const safe = async (fn: Function, ...args: any[]) => { try { return await fn(...args) || { success: true, message: '操作成功' }; } catch (e: any) { return { success: false, message: e?.message || '操作失败' }; } };
const deleteRecords = (d: any, ids: string[]) => { const s = new Set(ids); d.keyValues.forEach(kv => kv.values && (kv.values = kv.values.filter(v => !s.has(v.blockID)))); d.views[0].table.rowIds = d.views[0].table.rowIds?.filter(id => !s.has(id)) || []; };

// 字段
const FIELD_DEFS = [
    { k: 'title', n: '媒体标题', t: 'block', i: '1f3ac', p: 1, g: (m: any) => m.title },
    { k: 'source', n: '来源', t: 'select', i: '1f4cd', o: [{ name: 'B站', color: '4' }, { name: '本地', color: '6' }, { name: 'AList', color: '3' }, { name: '普通', color: '8' }], g: (m: any) => m.source === 'alist' ? 'AList' : (m.url?.includes('bilibili.com') || m.bvid) ? 'B站' : (m.source === 'local' || m.url?.startsWith('file://')) ? '本地' : '普通' },
    { k: 'url', n: 'URL', t: 'url', i: '1f517', g: (m: any) => m.url },
    { k: 'artist', n: '艺术家', t: 'text', i: '1f3a8', g: (m: any) => m.artist || '' },
    { k: 'artistIcon', n: '艺术家头像', t: 'mAsset', i: '1f464', g: (m: any) => m.artistIcon?.startsWith('data:image/') ? '' : m.artistIcon || '' },
    { k: 'thumbnail', n: '封面图', t: 'mAsset', i: '1f5bc', g: (m: any) => m.thumbnail?.startsWith('data:image/') ? '' : m.thumbnail || '' },
    { k: 'playlist', n: '所在标签', t: 'mSelect', i: '1f4d1', o: [{ name: '默认', color: '1' }, { name: '收藏', color: '2' }], g: (m: any) => m.playlist ? [m.playlist] : ['默认'], e: (f: any) => ({ isFavorite: f?.mSelect?.some((t: any) => t.content === '收藏') || false }) },
    { k: 'path', n: '地址', t: 'select', i: '1f4cd', g: (m: any) => m.path || '' },
    { k: 'duration', n: '时长', t: 'text', i: '23f1', g: (m: any) => m.duration || '' },
    { k: 'type', n: '类型', t: 'select', i: '1f4c1', o: [{ name: '视频', color: '4' }, { name: '音频', color: '5' }, { name: '文件夹', color: '7' }], g: (m: any) => m.type || '视频', e: (f: any) => f?.mSelect?.[0]?.content === '音频' ? 'audio' : 'video' },
    { k: 'aid', n: 'aid', t: 'text', i: '1f194', g: (m: any) => m.aid || '' },
    { k: 'bvid', n: 'bvid', t: 'text', i: '1f4dd', g: (m: any) => m.bvid || '' },
    { k: 'cid', n: 'cid', t: 'text', i: '1f4c4', g: (m: any) => m.cid || '' },
    { k: 'pinned', n: '置顶', t: 'checkbox', i: '1f4cc', g: (m: any) => m.pinned || false, e: (f: any) => ({ isPinned: f?.checkbox?.checked || false }) },
    { k: 'created', n: '创建时间', t: 'date', i: '1f4c5', g: () => Date.now() }
];

// 字段操作
const F = {
    v: { 
        text: v => ({ text: { content: String(v || '') } }), 
        url: v => ({ url: { content: String(v || '') } }), 
        block: v => ({ block: { id: id(), icon: '', content: String(v), created: Date.now(), updated: Date.now() }, isDetached: true }), 
        select: v => ({ mSelect: [{ content: String(v), color: '' }] }), 
        mSelect: v => ({ mSelect: Array.isArray(v) ? v.map(i => ({ content: String(i), color: '' })) : [{ content: String(v), color: '' }] }), 
        mAsset: v => ({ mAsset: [{ type: 'image', name: '', content: String(v) }] }), 
        checkbox: v => ({ checkbox: { checked: !!v } }), 
        date: v => ({ date: { content: typeof v === 'number' ? v : Date.now(), isNotEmpty: true, hasEndDate: false, isNotTime: false, content2: 0, isNotEmpty2: false, formattedContent: '' } }) 
    },
    e: (f: any, t: string) => ({ url: f?.url?.content || '', text: f?.text?.content || '', mAsset: f?.mAsset?.[0]?.content || '', select: f?.mSelect?.[0]?.content || '', mSelect: f?.mSelect?.[0]?.content || '', checkbox: f?.checkbox?.checked || false, date: f?.date?.content || 0 })[t] || '',
    set: (d: any, m: any, b: string) => FIELD_DEFS.forEach(def => { 
        const c = col(d, def.n); 
        if (c && (def.g(m) || def.t === 'checkbox' || def.t === 'date')) { 
            c.values = c.values || []; 
            c.values.push({ id: id(), keyID: c.key.id, blockID: b, type: def.t, createdAt: Date.now(), updatedAt: Date.now(), ...F.v[def.t](def.g(m)) }); 
        } 
    }),
    get: (d: any, b: string) => FIELD_DEFS.reduce((r: any, def) => { 
        const f = d.keyValues?.find((kv: any) => kv.key.name === def.n)?.values?.find((v: any) => v.blockID === b); 
        const ex = def.e ? def.e(f) : F.e(f, def.t); 
        return typeof ex === 'object' ? { ...r, ...ex } : { ...r, [def.k]: ex }; 
    }, { id: b }),
    create: async (i: any, p: string, path = '') => ({ ...i, playlist: p, path, type: i.type === 'audio' ? '音频' : '视频', pinned: false })
};

const FIELDS = { 
    schema: FIELD_DEFS.map(d => ({ name: d.n, type: d.t, icon: d.i, pin: !!d.p })), 
    options: Object.fromEntries(FIELD_DEFS.filter(d => d.o).map(d => [d.n, d.o])), 
    map: Object.fromEntries(FIELD_DEFS.map(d => [d.k, d.n])) 
};

// 查询
const col = (d: any, n: string) => d.keyValues?.find((kv: any) => kv.key.name === n);
const rec = (d: any, t: string) => col(d, FIELDS.map.title)?.values?.find((v: any) => v.block?.content === t);
const val = (d: any, b: string, f: string) => col(d, f)?.values?.find((v: any) => v.blockID === b);

// 核心数据库类
export class MediaDB {
    async loadData(avId: string) { return JSON.parse(window.require('fs').readFileSync(`${WS}/data/storage/av/${avId}.json`, 'utf-8')); }
    async saveData(avId: string, data: any) { window.require('fs').writeFileSync(`${WS}/data/storage/av/${avId}.json`, JSON.stringify(data, null, 2)); await fetch('/api/ui/reloadAttributeView', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: avId }) }); }

    private async withData(dbBlockId: string, fn: (data: any, avId: string) => any) {
        return safe(async () => {
            const avId = await getAvIdByBlockId(dbBlockId);
            const data = await this.loadData(avId);
            const result = await fn(data, avId);
            if (result?.success !== false) await this.saveData(avId, data);
            return result || { success: true, message: '操作成功' };
        });
    }

    manageOption(d: any, c: string, o: string, a: 'ensure' | 'delete') {
        if (!o) return;
        const obj = col(d, c);
        if (!obj?.key) return;
        obj.key.options = obj.key.options || [];
        a === 'ensure' && !obj.key.options.some(opt => opt.name === o) ? obj.key.options.push({ name: o, color: String((obj.key.options.length % 8) + 1), desc: '' }) : a === 'delete' && (obj.key.options = obj.key.options.filter(opt => opt.name !== o));
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

    async crud(dbBlockId: string, op: string, params: any) {
        return this.withData(dbBlockId, (data) => {
            if (op === 'create') {
                const { media, allowDuplicate = false } = params;
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
                const { name } = params;
                if (name === '默认' || name === '收藏') return { success: false, message: '不能删除系统标签' };
                const tagColumn = col(data, FIELDS.map.playlist);
                this.manageOption(data, FIELDS.map.playlist, name, 'delete');
                const singleTagRecords = tagColumn?.values?.filter(v => v.mSelect?.some(tag => tag.content === name) && v.mSelect?.length === 1).map(v => v.blockID) || [];
                tagColumn?.values?.forEach(value => {
                    if (value.mSelect?.some(tag => tag.content === name)) {
                        value.mSelect = value.mSelect.filter(tag => tag.content !== name);
                        value.updatedAt = Date.now();
                    }
                });
                if (singleTagRecords.length) deleteRecords(data, singleTagRecords);
                return { success: true, message: `标签"${name}"已删除` };
            } else if (type === 'tagRename') {
                const { oldName, newName } = params;
                if (oldName === '默认' || oldName === '收藏') return { success: false, message: '不能重命名系统标签' };
                if (!newName?.trim()) return { success: false, message: '新标签名不能为空' };
                const tagColumn = col(data, FIELDS.map.playlist);
                if (tagColumn?.key?.options?.some(opt => opt.name === newName)) return { success: false, message: '标签名已存在' };
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

// 播放列表
export class PlaylistManager {
    private db = new MediaDB();
    private dbId: string | null = null;

    private async getDbId() {
        if (!this.dbId) {
            const config = await Config.get();
            this.dbId = config.settings?.playlistDb?.id;
            if (!this.dbId) throw new Error('未配置数据库');
        }
        return this.dbId;
    }

    async addMedia(url: string, options: any = {}): Promise<Result & { mediaItem?: MediaItem; isDuplicate?: boolean }> {
        const { playlist = '默认', checkDuplicate = true, autoPlay = false, startTime, endTime, currentItem, playerAPI } = options;
        const cleanUrl = MediaUtils.getCleanUrl(url);
        
        if (autoPlay && currentItem && MediaUtils.isSameMedia(currentItem, cleanUrl)) {
            setTimeout(() => {
                if (endTime !== undefined) playerAPI?.setLoopSegment(startTime, endTime);
                else if (startTime !== undefined) playerAPI?.seekTo(startTime);
            }, 100);
            return { success: true, message: '已跳转到指定时间', isDuplicate: false };
        }
        
        const item = await MediaManager.createMediaItem(cleanUrl);
        if (!item) return { success: false, message: '无法解析媒体链接' };
        
        const result = await this.db.crud(await this.getDbId(), 'create', { 
            media: await F.create(item, playlist, ''), 
            allowDuplicate: !checkDuplicate 
        });
        
        const mediaItem = result.isDuplicate ? result.existingItem : { ...item, startTime, endTime };
        
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

        const fs = window.require('fs'), pm = window.require('path'), fp = type === 'siyuan' ? pm.join(WS, 'data', path) : path, items: MediaItem[] = [], urls: string[] = [];
        const scan = (dir: string) => { 
            try { 
                fs.readdirSync(dir).forEach((file: string) => { 
                    const filePath = pm.join(dir, file); 
                    if (fs.statSync(filePath).isDirectory()) { 
                        scanOnly ? scan(filePath) : items.push({ 
                            id: `${type}-folder-${Date.now()}-${Math.random().toString(36).slice(2,5)}`, 
                            title: file, type: 'folder', url: '#', source: type, 
                            sourcePath: type === 'siyuan' ? pm.relative(pm.join(WS, 'data'), filePath).replace(/\\/g, '/') : filePath, 
                            is_dir: true 
                        } as MediaItem); 
                    } else if (REGEX.MEDIA.test(file)) { 
                        scanOnly ? urls.push(`file://${filePath.replace(/\\/g, '/')}`) : items.push({ 
                            id: `${type}-${Date.now()}-${Math.floor(Math.random() * 1000)}`, 
                            title: file, 
                            url: `file://${filePath.replace(/\\/g, '/')}`, 
                            type: REGEX.AUDIO.test(file) ? 'audio' : 'video', 
                            source: '本地', 
                            sourcePath: filePath 
                        } as MediaItem); 
                    } 
                }); 
            } catch (error) { console.error('扫描失败:', dir, error); } 
        };
        scan(fp);
        return scanOnly ? { urls, count: urls.length } : items;
    }

    private async op(type: string, params: any = {}) {
        const d = await this.getDbId();
        const [cat, action] = type.split('.');
        const ops: any = {
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
            'folder.browse': async () => ({ success: true, data: await this.processFolder(params.type, params.path || '', false) }),
            'source.addBiliFav': async () => { 
                const config = await Config.get(); 
                const { title, items } = await BilibiliParser.getFavoritesList(params.favId, config); 
                const name = params.favTitle || title; 
                await this.db.manage(d, 'ensureTag', { name }); 
                return this.addBatch((items || []).map((item: any) => `https://www.bilibili.com/video/${item.bvid}`), name, 'B站视频', false, params.favId, params.checkDuplicate !== false); 
            },
            'source.listBiliFavs': async () => { 
                const config = await Config.get(); 
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

    static createLinkClickHandler(context: any) {
        const handler = new MediaHandler(context);
        handler.setCurrentItem(context.currentItem);
        return handler.createLinkClickHandler();
    }
}

export const getAvIdByBlockId = async (blockId: string): Promise<string> => {
    const res = await fetch('/api/query/sql', { method: 'POST', body: JSON.stringify({ stmt: `SELECT markdown FROM blocks WHERE type='av' AND id='${blockId}'` }) }).then(r => r.json());
    const match = res.data?.[0]?.markdown?.match(/data-av-id="([^"]+)"/);
    if (match?.[1]) return match[1];
    throw new Error('未找到属性视图ID');
};

// 媒体处理
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

    constructor(context: any) {
        this.manager = new PlaylistManager();
        this.getConfig = context.getConfig;
        this.openTab = context.openTab;
        this.waitForElement = context.waitForElement;
        this.components = context.components;
        this.i18n = context.i18n;
        this.initPlayerAPI();
        this.registerEvents();
    }

    setCurrentItem(item: MediaItem | null) { this.currentItem = item; }

    private initPlayerAPI() {
        this.playerAPI = {
            seekTo: (t: number) => this.components.get('player')?.seekTo?.(t),
            getCurrentTime: () => this.components.get('player')?.getCurrentTime?.() || 0,
            getScreenshotDataURL: () => this.components.get('player')?.getScreenshotDataURL?.() || Promise.resolve(null),
            setPlayTime: (s: number, e?: number) => this.components.get('player')?.setPlayTime?.(s, e),
            setLoopSegment: (s: number, e: number) => this.components.get('player')?.setPlayTime?.(s, e),
            setLoop: (l: boolean, t?: number) => this.components.get('player')?.setLoop?.(l, t),
            updateConfig: (c: any) => this.components.get('player')?.updateConfig?.(c),
            getCurrentMedia: () => this.currentItem,
            pause: () => this.components.get('player')?.pause?.(),
            resume: () => this.components.get('player')?.resume?.(),
            play: (u: string, o: any) => this.components.get('player')?.play?.(u, o),
            
            playMediaItem: async (m: MediaItem) => {
                if (!m) return;
                try {
                    this.currentItem = m;
                    const { playMedia } = await import('./media');
                    await playMedia(m, this.playerAPI, this.getConfig(), 
                        (item) => {
                            this.currentItem = item;
                            window.dispatchEvent(new CustomEvent('siyuanMediaPlayerUpdate', { detail: { player: this.playerAPI, currentItem: this.currentItem } }));
                            if (this.pendingTime) {
                                setTimeout(() => {
                                    if (this.pendingTime.end) this.playerAPI.setLoopSegment(this.pendingTime.start, this.pendingTime.end);
                                    else if (this.pendingTime.start) this.playerAPI.seekTo(this.pendingTime.start);
                                    this.pendingTime = null;
                                }, 500);
                            }
                        }, 
                        this.i18n
                    );
                    if (m.startTime !== undefined && !this.pendingTime) {
                        const st = Number(m.startTime);
                        m.endTime !== undefined ? this.playerAPI.setPlayTime(st, Number(m.endTime)) : this.playerAPI.seekTo(st);
                    }
                } catch (error) {
                    console.error("播放媒体失败:", error);
                    const { showMessage } = await import('siyuan');
                    showMessage(this.i18n.player?.error?.playFailed || "播放失败");
                }
            },
            
            createTimestampLink: async (l = false, s?: number, e?: number, t?: string) => {
                if (!this.playerAPI || !this.currentItem) return null;
                const config = this.getConfig();
                const time = s ?? this.playerAPI.getCurrentTime();
                const loopEnd = l ? (e ?? time + 3) : e;
                const { link } = await import('./document');
                return link(this.currentItem, config, time, loopEnd, t);
            }
        };
    }

    private registerEvents() {
        const h = {
            'siyuanMediaPlayerUpdate': (e: CustomEvent<any>) => { const { currentItem } = e.detail; this.currentItem = currentItem; this.setCurrentItem(currentItem); },
            'addMediaToPlaylist': (e: CustomEvent<any>) => { this.handleAddToPlaylist(e.detail || {}); },
            'directMediaPlay': (e: CustomEvent<any>) => { const item = e.detail; if (item) { this.currentItem = item; this.setCurrentItem(item); this.handleDirectPlay(item); } },
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
                            window.dispatchEvent(new CustomEvent('loopSegmentResponse', { detail: { loopStartTime: this.loopStartTime } }));
                            break;
                        }
                        case 'mediaNotes': { const { mediaNotes } = await import('./document'); mediaNotes.create(this.currentItem, settings, this.playerAPI, this.i18n); break; }
                        case 'screenshot': { const { player } = await import('./document'); player.screenshot(this.playerAPI, this.currentItem, settings, this.i18n); break; }
                        case 'timestamp': { const { player } = await import('./document'); player.timestamp(this.playerAPI, this.currentItem, settings, this.i18n); break; }
                    }
                } catch (error) {
                    console.error(`${action} 操作失败:`, error);
                    const { showMessage } = await import('siyuan');
                    showMessage(this.i18n.controlBar?.[action]?.error || `${action} 操作失败`);
                }
            },
            'updatePlayerConfig': (e: CustomEvent) => { if (this.playerAPI?.updateConfig) this.playerAPI.updateConfig(e.detail); },
            'mediaPlayerTabChange': (e: CustomEvent) => {},
            'mediaEnded': (e: CustomEvent) => { if (e.detail?.loopPlaylist) { const pl = this.components.get('playlist'); if (pl?.playNext) pl.playNext(); } }
        };
        Object.entries(h).forEach(([e, handler]) => { const l = handler.bind(this) as EventListener; this.events.set(e, l); window.addEventListener(e, l); });
    }

    getPlayerAPI() { return this.playerAPI; }
    cleanup() { this.events.forEach((h, e) => window.removeEventListener(e, h)); this.events.clear(); this.currentItem = null; this.loopStartTime = null; this.pendingTime = null; }

    async handleDirectPlay(mediaItem: MediaItem): Promise<void> {
        this.openTab();
        setTimeout(async () => {
            if (!mediaItem) return;
            let playOptions = { ...mediaItem, type: mediaItem.type || 'video', startTime: mediaItem.startTime, endTime: mediaItem.endTime };
            if ((mediaItem.source === 'B站' || mediaItem.type === 'bilibili') && mediaItem.bvid && mediaItem.cid) {
                const config = this.getConfig();
                if (!config.bilibiliLogin?.userInfo?.mid) { showMessage('需要登录B站才能播放视频'); return; }
                try {
                    const { BilibiliParser } = await import('./bilibili');
                    const stream = await BilibiliParser.getProcessedVideoStream(mediaItem.bvid, mediaItem.cid, 0, config);
                    if (stream.dash) Object.assign(playOptions, { url: stream.dash.video?.[0]?.baseUrl || '', headers: stream.headers, type: 'bilibili-dash', biliDash: stream.dash, startTime: mediaItem.startTime, endTime: mediaItem.endTime });
                } catch (error) { console.error('获取B站视频流失败:', error); showMessage(`获取视频流失败: ${error.message || '未知错误'}`); return; }
            }
            this.currentItem = playOptions;
            window.dispatchEvent(new CustomEvent('playMediaItem', { detail: playOptions }));
            const pl = this.components.get('playlist');
            if (pl?.$set) pl.$set({ currentItem: playOptions });
        }, 300);
    }

    async handleAddToPlaylist(params: { url: string; autoPlay?: boolean; playlist?: string; checkDuplicate?: boolean }): Promise<void> {
        const pl = this.components.get('playlist');
        if (!pl?.addMedia) return;
        const { url, autoPlay = true, playlist: playlistName, checkDuplicate = true } = params;
        await pl.addMedia(url, { playlist: playlistName, checkDuplicate });
        if (autoPlay) this.openTab();
    }

    createLinkClickHandler() {
        return async (e: MouseEvent) => {
            const t = e.target as HTMLElement;
            if (!t.matches('span[data-type="a"]')) return;
            const urlStr = t.getAttribute('data-href');
            if (!urlStr || !MediaUtils.isSupportedMediaLink(urlStr)) return;
            e.preventDefault();
            e.stopPropagation();
            const config = this.getConfig();
            const playerType = e.ctrlKey ? PlayerType.BROWSER : config.settings.playerType;
            if (playerType === PlayerType.POT_PLAYER || playerType === PlayerType.BROWSER) {
                const error = await openWithExternalPlayer(urlStr, playerType, config.settings.playerPath);
                if (error) showMessage(error);
                return;
            }
            const { mediaUrl: cleanUrl, startTime, endTime } = MediaUtils.parseTime(urlStr);
            if (!document.querySelector('.media-player-tab')) {
                this.openTab();
                await this.waitForElement('.media-player-tab', 2000);
                await new Promise(resolve => setTimeout(resolve, 500));
            }
            const mediaInfo = MediaUtils.getMediaInfo(cleanUrl);
            if (mediaInfo.source === 'alist') {
                if (!await AListManager.initFromConfig(config)) { showMessage("未连接到AList服务器，请先在设置中配置AList"); return; }
                const result = await AListManager.handleAListMediaLink(cleanUrl, { startTime, endTime });
                if (result.success && result.mediaItem) {
                    result.mediaItem.startTime = startTime;
                    result.mediaItem.endTime = endTime;
                    await this.handleDirectPlay(result.mediaItem);
                    return;
                } else if (result.error) { showMessage(`处理AList媒体失败: ${result.error}`); return; }
            }
            const plc = this.components.get('playlist');
            const manager = (plc && typeof plc.addMedia === 'function') ? plc : this.manager;
            const result = await manager.addMedia(cleanUrl, { checkDuplicate: true, autoPlay: true, startTime, endTime, currentItem: this.currentItem, playerAPI: this.playerAPI });
            if (!result.success) showMessage(`播放失败: ${result.message || '未知错误'}`);
        };
    }
}

export const createPlaylistManager = () => new PlaylistManager();
export { Config }; 