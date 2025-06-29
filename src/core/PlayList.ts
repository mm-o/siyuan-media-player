import type { MediaItem } from "./types";
import { Media, EXT, detectMediaType } from './player';
import { BilibiliParser } from './bilibili';
import { AListManager } from './alist';
import { showMessage } from 'siyuan';

// 核心类型定义
type Result = { success: boolean; message: string; data?: any };
interface ViewData { tags: string[]; items: MediaItem[]; activeTag: string; stats: { total: number; pinned: number; }; }

/**
 * 统一工具类 - 配置/ID/数据操作
 */
class Utils {
    private static config: any = null;
    private static plugin: any = null;
    
    // 配置管理
    static setPlugin = (p: any) => this.plugin = p;
    static getConfig = async () => this.config ||= await this.plugin?.loadData?.('config.json') || { settings: {} };
    static clearConfig = () => this.config = null;
    
    // 通用工具 - 缩短方法名
    static id = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
    static safe = async (fn: Function, ...args: any[]) => {
        try { return await fn(...args) || { success: true, message: '操作成功' }; }
        catch (e: any) { return { success: false, message: e?.message || '操作失败' }; }
    };
    static emit = (e: string, d?: any) => window.dispatchEvent(new CustomEvent(e, d ? { detail: d } : undefined));
    
    // 数据操作 - 简化名称
    static del = (data: any, ids: string[]) => {
        const s = new Set(ids);
        data.keyValues.forEach((kv: any) => kv.values && (kv.values = kv.values.filter((v: any) => !s.has(v.blockID))));
        data.views[0].table.rowIds = data.views[0].table.rowIds?.filter((id: string) => !s.has(id)) || [];
    };
    static col = (data: any, name: string) => data.keyValues?.find((kv: any) => kv.key.name === name);
    static rec = (data: any, title: string) => Utils.col(data, '媒体标题')?.values?.find((v: any) => v.block?.content === title);
    static field = (data: any, name: string, id: string) => data.keyValues?.find((kv: any) => kv.key.name === name)?.values?.find((v: any) => v.blockID === id);
}

/**
 * 字段管理器 - 统一字段定义和操作
 */
class FieldManager {
    // 字段定义 - 压缩格式
    private static fields = [
        { k: 'title', n: '媒体标题', t: 'block', i: '1f3ac', p: 1 },
        { k: 'source', n: '来源', t: 'select', i: '1f4cd', o: [['B站', '4'], ['本地', '6'], ['AList', '3'], ['普通', '8']] },
        { k: 'url', n: 'URL', t: 'url', i: '1f517' },
        { k: 'artist', n: '艺术家', t: 'text', i: '1f3a8' },
        { k: 'artistIcon', n: '艺术家头像', t: 'mAsset', i: '1f464' },
        { k: 'thumbnail', n: '封面图', t: 'mAsset', i: '1f5bc' },
        { k: 'playlist', n: '所在标签', t: 'mSelect', i: '1f4d1', o: [['默认', '1']] },
        { k: 'duration', n: '时长', t: 'text', i: '23f1' },
        { k: 'type', n: '类型', t: 'select', i: '1f4c1', o: [['视频', '4'], ['音频', '5'], ['文件夹', '7']] },
        { k: 'bvid', n: 'bvid', t: 'text', i: '1f4dd' },
        { k: 'created', n: '创建时间', t: 'date', i: '1f4c5' }
    ];
    
    // 快捷访问
    static schema = () => this.fields.map(f => ({ name: f.n, type: f.t, icon: f.i, pin: !!f.p }));
    static options = () => Object.fromEntries(this.fields.filter(f => f.o).map(f => [f.n, f.o!.map(o => ({ name: o[0], color: o[1] }))]));
    static map = () => Object.fromEntries(this.fields.map(f => [f.k, f.n]));
    
    // 值处理 - 合并创建和提取
    static val = (type: string, value: any, extract = false): any => {
        const ops = {
            text: extract ? (f: any) => f?.text?.content || '' : (v: any) => ({ text: { content: String(v || '') } }),
            url: extract ? (f: any) => f?.url?.content || '' : (v: any) => ({ url: { content: String(v || '') } }),
            block: extract ? (f: any) => f?.block?.content || '' : (v: any) => ({ block: { id: Utils.id(), icon: '', content: String(v), created: Date.now(), updated: Date.now() }, isDetached: true }),
            select: extract ? (f: any) => f?.mSelect?.[0]?.content || '' : (v: any) => ({ mSelect: [{ content: String(v), color: '' }] }),
            mSelect: extract ? (f: any) => f?.mSelect?.[0]?.content || '' : (v: any) => ({ mSelect: Array.isArray(v) ? v.map(i => ({ content: String(i), color: '' })) : [{ content: String(v), color: '' }] }),
            mAsset: extract ? (f: any) => f?.mAsset?.[0]?.content || '' : (v: any) => ({ mAsset: [{ type: 'image', name: '', content: String(v) }] }),
            checkbox: extract ? (f: any) => f?.checkbox?.checked || false : (v: any) => ({ checkbox: { checked: !!v } }),
            date: extract ? (f: any) => f?.date?.content || 0 : (v: any) => ({ date: { content: typeof v === 'number' ? v : Date.now(), isNotEmpty: true, hasEndDate: false, isNotTime: false, content2: 0, isNotEmpty2: false, formattedContent: '' } })
        };
        return ops[type] ? ops[type](value) : ops.text(value);
    };
    
    // 数据转换 - 优化版本
    static set = (data: any, media: any, blockId: string) => {
        this.fields.forEach(({ k, n, t }) => {
            const col = Utils.col(data, n);
            if (!col) return;
            
            let v = media[k] || '';
            if (k === 'title') v = media.title;
            else if (k === 'source') v = media.source === 'alist' ? 'AList' : (media.url?.includes('bilibili.com') || media.bvid) ? 'B站' : (media.source === 'local' || media.url?.startsWith('file://')) ? '本地' : '普通';
            else if (k === 'playlist') v = media.playlist ? [media.playlist] : ['默认'];
            else if (k === 'type') v = media.type === 'audio' ? '音频' : '视频';
            else if (k === 'created') v = Date.now();
            
            if (v || t === 'date') {
                col.values = col.values || [];
                col.values.push({ id: Utils.id(), keyID: col.key.id, blockID: blockId, type: t, createdAt: Date.now(), updatedAt: Date.now(), ...this.val(t, v) });
            }
        });
    };
    
    static get = (data: any, blockId: string): MediaItem => {
        const result: any = { id: blockId };
        this.fields.forEach(({ k, n, t }) => {
            const field = Utils.field(data, n, blockId);
            if (k === 'type') result[k] = this.val(t, field, true) === '音频' ? 'audio' : 'video';
            else result[k] = this.val(t, field, true);
        });
        return result as MediaItem;
    };
}

/**
 * 数据库类 - 极简版
 */
export class MediaDB {
    private path = (id: string) => `${window.siyuan.config.system.workspaceDir}/data/storage/av/${id}.json`;
    
    load = async (id: string) => JSON.parse(window.require('fs').readFileSync(this.path(id), 'utf-8'));
    save = async (id: string, data: any) => {
        window.require('fs').writeFileSync(this.path(id), JSON.stringify(data, null, 2));
        try { await fetch('/api/ui/reloadAttributeView', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) }); } catch {}
    };
    
    // 统一操作入口
    do = async (dbId: string, fn: (data: any) => any) => Utils.safe(async () => {
        const avId = await getAvId(dbId), data = await this.load(avId), result = await fn(data);
        if (result?.success !== false) await this.save(avId, data); 
        return result || { success: true, message: '操作成功' }; 
    });
    
    // 核心操作 - 简化版
    op = async (dbId: string, action: string, params: any) => this.do(dbId, (data) => {
        const { media, allowDuplicate, title, updates, tagName, name, oldName, newName, field } = params;
        
        switch (action) {
            case 'create': {
                // 检查重复
                if (!allowDuplicate && media.url) {
                    const dup = Utils.col(data, FieldManager.map().url)?.values?.find(v => v.url?.content === media.url);
                    if (dup) {
                        const titleVal = Utils.col(data, FieldManager.map().title)?.values?.find(v => v.blockID === dup.blockID);
                        return { success: true, message: '媒体已存在', isDuplicate: true, existingItem: { ...FieldManager.get(data, dup.blockID), title: titleVal?.block?.content || '未知标题', url: dup.url?.content || '' } };
                    }
                }
                // 创建新媒体
                const blockId = Utils.id();
                data.views[0].table.rowIds = data.views[0].table.rowIds || [];
                data.views[0].table.rowIds.push(blockId);
                FieldManager.set(data, media, blockId);
                return { success: true, message: '添加成功', isDuplicate: false };
            }
            
            case 'update': {
                const record = Utils.rec(data, title);
                if (!record) return { success: false, message: '未找到记录' };
                
                if (updates.removeTag) {
                    const tagField = Utils.field(data, FieldManager.map().playlist, record.blockID);
                    if (tagField?.mSelect) {
                        tagField.mSelect = tagField.mSelect.filter(tag => tag.content !== updates.removeTag);
                        if (tagField.mSelect.length === 0) {
                            Utils.del(data, [record.blockID]);
                            return { success: true, message: '已删除媒体' };
                        } else {
                            tagField.updatedAt = Date.now();
                            return { success: true, message: `已从"${updates.removeTag}"中移除` };
                        }
                    }
                }
                
                Object.entries(updates).forEach(([key, value]) => {
                    if (value === undefined) return;
                    const fieldName = FieldManager.map()[key];
                    const column = Utils.col(data, fieldName);
                    const field = FieldManager.schema().find(f => f.name === fieldName);
                    if (!column || !field) return;
                    
                    const processedValue = key === 'playlist' ? [value] : value;
                    column.values = column.values || [];
                    const existing = column.values.find(v => v.blockID === record.blockID);
                    if (existing) {
                        existing.updatedAt = Date.now();
                        Object.assign(existing, { id: Utils.id(), keyID: column.key.id, blockID: record.blockID, type: field.type, createdAt: Date.now(), updatedAt: Date.now(), ...FieldManager.val(field.type, processedValue) });
                    } else if (processedValue !== false && (processedValue || field.type === 'checkbox')) {
                        column.values.push({ id: Utils.id(), keyID: column.key.id, blockID: record.blockID, type: field.type, createdAt: Date.now(), updatedAt: Date.now(), ...FieldManager.val(field.type, processedValue) });
                    }
                });
                return { success: true, message: '更新成功' };
            }
            
            case 'delete': {
                let blockIds: string[] = [];
                if (tagName) blockIds = Utils.col(data, FieldManager.map().playlist)?.values?.filter(v => v.mSelect?.some(tag => tag.content === tagName)).map(r => r.blockID) || [];
                else if (title) { const r = Utils.rec(data, title); blockIds = r ? [r.blockID] : []; }
                if (!blockIds.length) return { success: false, message: title ? '未找到记录' : '参数错误' };
                Utils.del(data, blockIds);
                return { success: true, message: `删除了${blockIds.length}条记录` };
            }
            

            
            case 'ensureTag': {
                const colName = FieldManager.map().playlist;
                const optName = name;
                if (!optName) return;
                const col = Utils.col(data, colName);
                if (!col?.key) return;
                col.key.options = col.key.options || [];
                if (!col.key.options.some(opt => opt.name === optName)) {
                    col.key.options.push({ name: optName, color: String((col.key.options.length % 8) + 1), desc: '' });
                }
                return { success: true, message: '已确保' };
            }
            
            case 'tagDelete': {
                if (name === '默认') return { success: false, message: '不能删除系统标签' };
                const tagCol = Utils.col(data, FieldManager.map().playlist);
                // 删除选项
                if (tagCol?.key?.options) tagCol.key.options = tagCol.key.options.filter(opt => opt.name !== name);
                // 删除只有此标签的记录
                const singleTagRecords = tagCol?.values?.filter(v => v.mSelect?.some(tag => tag.content === name) && v.mSelect?.length === 1).map(v => v.blockID) || [];
                // 从其他记录中移除此标签
                tagCol?.values?.forEach(value => {
                    if (value.mSelect?.some(tag => tag.content === name)) {
                        value.mSelect = value.mSelect.filter(tag => tag.content !== name);
                        value.updatedAt = Date.now();
                    }
                });
                if (singleTagRecords.length) Utils.del(data, singleTagRecords);
                return { success: true, message: `标签"${name}"已删除` };
            }
            
            case 'tagRename': {
                if (oldName === '默认') return { success: false, message: '不能重命名系统标签' };
                if (!newName?.trim()) return { success: false, message: '新标签名不能为空' };
                const tagCol = Utils.col(data, FieldManager.map().playlist);
                if (tagCol?.key?.options?.some(opt => opt.name === newName)) return { success: false, message: '标签名已存在' };
                // 更新记录中的标签名
                tagCol?.values?.forEach(value => {
                    if (value.mSelect?.some(tag => tag.content === oldName)) {
                        value.mSelect = value.mSelect.map(tag => tag.content === oldName ? { ...tag, content: newName } : tag);
                        value.updatedAt = Date.now();
                    }
                });
                // 更新选项中的标签名
                const option = tagCol?.key?.options?.find(opt => opt.name === oldName);
                if (option) option.name = newName;
                return { success: true, message: `标签已重命名为"${newName}"` };
            }
            
            default:
                return { success: false, message: `未知操作: ${action}` };
        }
    });
    
    // 初始化 - 精简版
    init = async (dbId: string) => this.do(dbId, (data) => {
        data.keyValues = data.keyValues?.filter(kv => FieldManager.schema().some(s => s.name === kv.key.name)) || [];
        data.views = data.views || [{ table: { columns: [], rowIds: [] } }];
        
        const stats = { created: 0, updated: 0 };
        const options = FieldManager.options();
        
        FieldManager.schema().forEach(schema => {
            const existing = Utils.col(data, schema.name);
            if (existing) {
                if (existing.key.type !== schema.type) {
                    existing.key.type = schema.type;
                    stats.updated++;
                }
            } else {
                const keyId = Utils.id();
                const key: any = { id: keyId, name: schema.name, type: schema.type, icon: schema.icon, desc: '', numberFormat: '', template: '' };
                if (options[schema.name]) key.options = options[schema.name];
                data.keyValues.push({ key });
                data.views[0].table.columns[schema.pin ? 'unshift' : 'push']({ id: keyId, wrap: false, hidden: false, pin: !!schema.pin, width: '' });
                stats.created++;
            }
        });
        
        return { success: true, message: `初始化完成：创建${stats.created}列，更新${stats.updated}列` };
    });
}

/**
 * 播放列表管理器 - 极简版
 */
export class PlaylistManager {
    private db = new MediaDB();
    private dbId: string | null = null;

    private getId = async () => this.dbId ||= (await Utils.getConfig()).settings?.playlistDb?.id || (() => { throw new Error('未配置数据库'); })();

    // 添加媒体 - 优化版
    async addMedia(url: string, opts: any = {}): Promise<Result & { mediaItem?: MediaItem; isDuplicate?: boolean }> {
        try {
            const { playlist = '默认', checkDuplicate = true } = opts;
            const result = await Media.processUrl(url);
            if (!result.success || !result.mediaItem) return { success: false, message: result.error || '无法解析媒体链接' };
            
            const mediaItem = result.mediaItem;
            const dbResult = await this.db.op(await this.getId(), 'create', { media: { ...mediaItem, playlist }, allowDuplicate: !checkDuplicate });
            
            if (dbResult.success) {
                await this.refresh();
                Utils.emit('refreshPlaylist');
            }
            
            return { ...dbResult, mediaItem: dbResult.isDuplicate ? dbResult.existingItem : mediaItem, isDuplicate: dbResult.isDuplicate || false };
        } catch (error) {
            return { success: false, message: `添加失败: ${error instanceof Error ? error.message : '未知错误'}` };
        }
    }
    
    // 批量添加 - 简化版
    private batch = async (sources: any[], tag: string, type: string, isItems = false, check = true): Promise<Result> => {
        const dbId = await this.getId();
        let count = 0, dups = 0;
        
        for (const src of sources) {
            const item = isItems ? src : (await Media.processUrl(src)).mediaItem;
            if (item) { 
                const result = await this.db.op(dbId, 'create', { media: { ...item, playlist: tag }, allowDuplicate: !check });
                result.isDuplicate ? dups++ : count++;
            }
        }
        return { success: true, message: dups > 0 ? `已添加${count}个${type}到"${tag}"，跳过${dups}个重复项` : `已添加${count}个${type}到"${tag}"` };
    };
    
    // 文件夹处理 - 压缩版
    private folder = async (type: string, path = '', scan = false): Promise<any> => {
        if (type === 'alist') return scan ? [] : await AListManager.createMediaItemsFromDirectory(path || '/');
        if (!window.navigator.userAgent.includes('Electron')) throw new Error('此功能仅在桌面版可用');
        
        const fs = window.require('fs'), pm = window.require('path');
        const fp = type === 'siyuan' ? pm.join(window.siyuan.config.system.workspaceDir, 'data', path) : path;
        const items: any[] = [], urls: string[] = [];
        
        const scanDir = (dir: string) => {
            try {
                fs.readdirSync(dir).forEach((file: string) => {
                    const filePath = pm.join(dir, file);
                    if (fs.statSync(filePath).isDirectory()) {
                        if (scan) scanDir(filePath);
                        else items.push({ id: `${type}-folder-${Date.now()}-${Math.random().toString(36).slice(2,5)}`, title: file, type: 'folder', url: '#', source: type, sourcePath: type === 'siyuan' ? pm.relative(pm.join(window.siyuan.config.system.workspaceDir, 'data'), filePath).replace(/\\/g, '/') : filePath, is_dir: true });
                    } else if (EXT.MEDIA.some(ext => file.toLowerCase().endsWith(ext))) {
                        if (scan) urls.push(`file://${filePath.replace(/\\/g, '/')}`);
                        else items.push({ id: `${type}-${Date.now()}-${Math.floor(Math.random() * 1000)}`, title: file, url: `file://${filePath.replace(/\\/g, '/')}`, type: detectMediaType(file), source: '本地', sourcePath: filePath });
                    }
                });
                } catch (error) { console.error('扫描失败:', dir, error); } 
        };
        
        scanDir(fp);
        return scan ? { urls, count: urls.length } : items;
    };
    
    // 统一操作 - 极简版
    async operation(type: string, params: any = {}): Promise<Result & { needsRefresh?: boolean }> {
        const d = await this.getId();
        const refresh = !['list', 'browse', 'get'].some(op => type.includes(op));
        
        const ops: { [key: string]: () => Promise<Result> } = {
            'media.add': async () => { await this.db.op(d, 'ensureTag', { name: params.playlist || '默认' }); return this.addMedia(params.url, params); },
            'media.delete': () => this.db.op(d, 'delete', { title: params.title, tagName: params.tagName }),
            'media.move': async () => { await this.db.op(d, 'ensureTag', { name: params.newPlaylist }); return this.db.op(d, 'update', { title: params.title, updates: { playlist: params.newPlaylist } }); },

            'media.removeFromTag': () => this.db.op(d, 'update', { title: params.title, updates: { removeTag: params.tagName } }),
            'media.reorder': () => this.db.do(d, (data) => (data.views[0].table.rowIds = params.itemIds)),
            'tag.reorder': () => this.db.do(d, (data) => { const c = Utils.col(data, FieldManager.map().playlist); if (c?.key?.options) c.key.options = params.tagOrder.map(t => c.key.options.find(o => o.name === t)).filter(Boolean); }),
            'tag.add': () => this.db.op(d, 'ensureTag', { name: params.name }),
            'tag.delete': () => this.db.op(d, 'tagDelete', { name: params.name }),
            'tag.rename': () => this.db.op(d, 'tagRename', { oldName: params.oldName, newName: params.newName }),
            'view.set': () => this.db.do(d, (data) => (data.views[0].view = params.view)),
            'view.get': async () => ({ success: true, message: '获取视图成功', data: (await this.db.load(await getAvId(d))).views[0].view || 'detailed' }),
        'folder.add': async () => { 
            if (!window.navigator.userAgent.includes('Electron')) return { success: false, message: '此功能仅在桌面版可用' }; 
                const path = params.isSiyuan ? window.require('path').join(window.siyuan.config.system.workspaceDir, 'data') : (await window.require('@electron/remote').dialog.showOpenDialog({ properties: ['openDirectory', 'createDirectory'] })).filePaths?.[0];
            if (!path) return { success: false, message: '未选择文件夹' }; 
            const name = params.isSiyuan ? "思源空间" : path.split(/[\\/]/).pop(); 
                await this.db.op(d, 'ensureTag', { name });
                return this.batch((await this.folder(params.isSiyuan ? 'siyuan' : 'folder', path, true)).urls, name, '媒体文件', false, params.checkDuplicate !== false);
            },
            'folder.browse': async () => ({ success: true, message: '获取文件夹成功', data: await this.folder(params.type, params.path || '', false) }),
            'source.addBiliFav': async () => {
                const config = await Utils.getConfig();
                const { title, items } = await BilibiliParser.getFavoritesList(params.favId, config);
                const name = params.favTitle || title;
                await this.db.op(d, 'ensureTag', { name });
                return this.batch((items || []).map((item: any) => `https://www.bilibili.com/video/${item.bvid}`), name, 'B站视频', false, params.checkDuplicate !== false);
            },
            'source.listBiliFavs': async () => {
                const config = await Utils.getConfig();
                if (!config?.settings?.bilibiliLogin?.mid) return { success: false, message: '请先登录B站账号' };
                const folders = await BilibiliParser.getUserFavoriteFolders(config);
                return folders?.length ? { success: true, message: '获取收藏夹列表成功', data: folders } : { success: false, message: '未找到收藏夹' };
            }
        };
        
        const result = ops[type] ? await ops[type]() : { success: false, message: `未知操作: ${type}` };
        if (refresh && result.success) await this.refresh();
        return { ...result, needsRefresh: refresh && result.success };
    }
    
    // 获取视图数据 - 优化版
    async getViewData(tag = '默认'): Promise<ViewData> {
        const data = await this.db.load(await getAvId(await this.getId()));
        const tagCol = Utils.col(data, FieldManager.map().playlist);
        const tags = [...(tagCol?.key?.options?.map(opt => opt.name) || []), '默认'].filter((t, i, a) => a.indexOf(t) === i);
        const activeTag = tags.includes(tag) ? tag : tags[0] || '默认';
        const titleCol = Utils.col(data, FieldManager.map().title);
        
        if (!titleCol?.values) return { tags, items: [], activeTag, stats: { total: 0, pinned: 0 } };
        
        const blockIds = new Set((tagCol?.values?.filter(v => v.mSelect?.some(tag => tag.content === activeTag)) || []).map(r => r.blockID));
        const items = (data.views[0].table.rowIds || []).filter(id => blockIds.has(id)).map(id => ({ ...FieldManager.get(data, id), title: titleCol?.values?.find(v => v.blockID === id)?.block?.content || '未知标题' } as MediaItem));
        
        return { tags, items, activeTag, stats: { total: items.length, pinned: 0 } };
    }
    
    // 刷新数据 - 简化版
    private refresh = async (): Promise<void> => {
        try { await fetch('/api/ui/reloadAttributeView', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: await getAvId(await this.getId()) }) }); } catch {}
        Utils.emit('playlist-data-updated', { timestamp: Date.now() });
    };
}

// 获取属性视图ID - 简化版
const getAvId = async (blockId: string): Promise<string> => {
    const res = await fetch('/api/query/sql', { method: 'POST', body: JSON.stringify({ stmt: `SELECT markdown FROM blocks WHERE type='av' AND id='${blockId}'` }) }).then(r => r.json());
    const match = res.data?.[0]?.markdown?.match(/data-av-id="([^"]+)"/);
    return match?.[1] || (() => { throw new Error('未找到属性视图ID'); })();
};

// 兼容导出
export const getAvIdByBlockId = getAvId;
export { Utils };