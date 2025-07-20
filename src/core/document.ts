// 思源笔记文档工具模块 - 处理文档、块、媒体笔记等操作
import { showMessage } from "siyuan";
import type { MediaItem } from './types';
import * as api from '../api';
import { Media } from './player';

// ===== 类型定义 =====
type Block = { id?: string; root_id?: string; [key: string]: any; };
type ReplacePattern = Record<string, string>;

// ===== 文档操作 =====
export const doc = {
    getBlockID: async (i18n?: any): Promise<string> => {
        try {
            const selection = window.getSelection();
            if (selection?.focusNode) {
                let el = selection.focusNode as HTMLElement;
                while (el && !el.dataset?.nodeId) el = el.parentElement as HTMLElement;
                if (el?.dataset.nodeId) return el.dataset.nodeId;
            }
        } catch {}
        return (window as any).__activeDocumentId || (() => { throw new Error(i18n?.mediaPlayerTab?.block?.cursorNotFound || "未找到光标"); })();
    },
    
    getDocID: async (blockId?: string, i18n?: any): Promise<string> => {
        try {
            const block = await api.getBlockByID(blockId || await doc.getBlockID(i18n)) as Block;
            return block?.root_id || block?.id?.split('/')[0] || '';
        } catch { throw new Error(i18n?.mediaPlayerTab?.block?.docIdNotFound || "无法获取文档ID"); }
    },
    
    insert: async (content: string, config: any, i18n?: any): Promise<string | null> => {
        const mode = config?.settings?.insertMode || 'insertBlock';
        if (mode === 'clipboard') {
            await navigator.clipboard.writeText(content);
            showMessage(i18n?.mediaPlayerTab?.block?.copiedToClipboard || "已复制到剪贴板");
            return null;
        }

        try {
            const blockId = await doc.getBlockID(i18n);
            const result = blockId === (window as any).__activeDocumentId
                ? await api.appendBlock("markdown", content, blockId)
                : await api[`${mode.replace('Block', '').replace('Doc', '')}Block`]("markdown", content, ...(mode === 'insertBlock' ? [undefined, undefined, mode.includes('Doc') ? await doc.getDocID(blockId, i18n) : blockId] : [mode.includes('Doc') ? await doc.getDocID(blockId, i18n) : blockId]));
            return result?.[0]?.doOperations?.[0]?.id || null;
        } catch {
            return (navigator.clipboard.writeText(content), showMessage(i18n?.mediaPlayerTab?.block?.insertFailed || "操作失败，已复制"), null);
        }
    }
};

// ===== 工具函数 =====
// 模板替换
const applyTemplate = (template: string, replacements: ReplacePattern): string =>
    Object.entries(replacements).reduce((text, [pattern, value]) => text.replace(new RegExp(pattern, 'g'), value), template);

// 获取媒体项的链接URL - 统一URL获取逻辑
const getMediaUrl = (item: MediaItem): string => {
    // B站分P视频特殊处理
    if (item.bvid && item.id?.includes('-p')) {
        const page = item.id.match(/-p(\d+)/)?.[1];
        return `https://www.bilibili.com/video/${item.bvid}${page && page !== '1' ? `?p=${page}` : ''}`;
    }
    // 优先使用原始URL（WebDAV、B站等）
    if (item.originalUrl) return item.originalUrl;
    return item.url;
};

// 时间参数处理
export const addTime = (url: string, startTime: number, endTime?: number): string => {
    const timeParam = endTime !== undefined ? `${startTime.toFixed(1)}-${endTime.toFixed(1)}` : startTime.toFixed(1);
    return `${url}${url.includes('?') ? '&' : '?'}t=${timeParam}`;
};

export const withTime = (url: string, startTime?: number, endTime?: number): string =>
    startTime ? addTime(url, startTime, endTime) : url;

// ===== 媒体链接生成 =====
// 创建媒体链接 - 统一链接生成逻辑
export const link = async (item: MediaItem, config: any, time: number, endTime?: number, subtitle?: string): Promise<string> => {
    if (!item) return '';
    try {
        const timeText = endTime ? `${Media.fmt(time)}-${Media.fmt(endTime)}` : Media.fmt(time), baseUrl = getMediaUrl(item);
        const format = (config?.settings?.linkFormat || "- [时间 字幕](链接)").replace(/!?\[截图\]\(截图\)/g, '').replace(/!?\[.*?\]\(截图\)/g, '').trim();
        return applyTemplate(format, { '时间|{{time}}': timeText, '字幕|{{subtitle}}': subtitle || '', '标题|{{title}}': item.title || '', '艺术家|{{artist}}': item.artist || '', '链接|{{url}}': withTime(baseUrl, time, endTime) });
    } catch {
        return `- [${subtitle ? `${Media.fmt(time)} ${subtitle}` : Media.fmt(time)}](${item.url})`;
    }
};
// ===== 刷新机制 =====
const refresh = () => window.dispatchEvent(new CustomEvent('refreshNotesFilter'));

// ===== 自定义属性设置 =====
const setAttrs = async (blockId: string, type: string, item: MediaItem, time?: number, endTime?: number, screenshot?: string) => {
    if (!blockId) return;
    const baseUrl = getMediaUrl(item);
    const website = item.source || 'local';
    const attrs: Record<string, string> = { 'custom-media': type, 'custom-url': baseUrl };

    if (type === 'timestamp') {
        attrs['custom-url'] = withTime(baseUrl, time);
        attrs['custom-timestamp'] = Media.fmt(time);
        attrs['custom-thumbnail'] = item.thumbnail ? await imageToLocalAsset(item.thumbnail) : '';
    } else if (type === 'loop') {
        attrs['custom-url'] = withTime(baseUrl, time, endTime);
        attrs['custom-loop'] = `${time?.toFixed(1) || ''}-${endTime?.toFixed(1) || ''}`;
        attrs['custom-thumbnail'] = item.thumbnail ? await imageToLocalAsset(item.thumbnail) : '';
    } else if (type === 'screenshot') {
        attrs['custom-url'] = withTime(baseUrl, time);
        attrs['custom-screenshot'] = screenshot || '';
    } else if (type === 'mediacard') {
        attrs['custom-url'] = withTime(baseUrl, time);
        attrs['custom-timestamp'] = Media.fmt(time);
        attrs['custom-screenshot'] = screenshot || '';
        attrs['custom-website'] = website;
    } else if (type === 'medianote') {
        attrs['custom-thumbnail'] = item.thumbnail ? await imageToLocalAsset(item.thumbnail) : '';
    }

    api.setBlockAttrs(blockId, attrs).then(refresh).catch(() => {});
};

// ===== 播放器工具 =====
export const player = {
    timestamp: async (player: any, item: MediaItem, config: any, i18n?: any) => {
        if (!player || !item) return showMessage(i18n?.controlBar?.timestamp?.hint || "请先播放媒体");
        const time = player.getCurrentTime(), result = await link(item, config, time);
        result && setAttrs(await doc.insert(result, config, i18n), 'timestamp', item, time);
    },

    loop: async (player: any, item: MediaItem, config: any, i18n?: any, loopStart: number | null = null) => {
        if (!player || !item) return (showMessage(i18n?.controlBar?.loopSegment?.hint || "请先播放媒体"), null);
        const now = player.getCurrentTime();
        if (loopStart === null) return now;
        const result = await link(item, config, loopStart, now);
        result && setAttrs(await doc.insert(result, config, i18n), 'loop', item, loopStart, now);
        return null;
    },

    screenshot: async (player: any, item: MediaItem, config: any, i18n?: any) => {
        if (!player) return showMessage(i18n?.controlBar?.screenshot?.hint || "请先播放媒体");
        try {
            const imageUrl = await imageToLocalAsset(await player.getScreenshotDataURL());
            if (!imageUrl) throw new Error("截图上传失败");
            const time = player.getCurrentTime(), withTime = config?.settings?.screenshotWithTimestamp;
            if (withTime) {
                const blockId = await doc.insert(`${await link(item, config, time)}\n\n  ![截图](${imageUrl})`, config, i18n);
                blockId && (setAttrs(blockId, 'mediacard', item, time, undefined, imageUrl),
                api.getChildBlocks(blockId).then(blocks => (blocks?.[0] && setAttrs(blocks[0].id, 'timestamp', item, time), blocks?.[1] && setAttrs(blocks[1].id, 'screenshot', item, time, undefined, imageUrl))));
            } else setAttrs(await doc.insert(`![截图](${imageUrl})`, config, i18n), 'screenshot', item, time, undefined, imageUrl);
        } catch { showMessage(i18n?.mediaPlayerTab?.screenshot?.errorHint || "截图保存失败"); }
    }
};

// ===== 笔记本管理 =====
export const notebook = {
    getPreferredId: (): string => localStorage.getItem('notebookId') || '',
    savePreferredId: (id: string): void => localStorage.setItem('notebookId', id),
    getList: async (): Promise<any[]> => {
        try { return (await api.lsNotebooks())?.notebooks?.filter((nb: any) => !nb.closed) || []; } catch { return []; }
    },
    getOptions: async (): Promise<{label: string, value: string}[]> => {
        return (await notebook.getList()).map(nb => ({label: nb.name || "未命名笔记本", value: nb.id || ""}));
    },
    initSettingItem: async (items: any[], selectedId: string = ''): Promise<{items: any[], selectedId: string}> => {
        try {
            const options = await notebook.getOptions();
            if (!options.length) return {items, selectedId};
            const index = items.findIndex(item => item.key === "targetNotebook");
            if (index === -1) return {items, selectedId};
            items[index].options = options;
            const validId = (!selectedId || !options.some(opt => opt.value === selectedId)) ? options[0].value : selectedId;
            items[index].value = validId;
            return {items: [...items], selectedId: validId};
        } catch { return {items, selectedId}; }
    },

    // 文档搜索 - 极简版
    searchAndUpdate: async (searchKey: string, state: any, saveConfig?: any) => {
        if (!searchKey.trim()) return {success: false};
        try {
            const results = await api.searchDocs(searchKey.trim());
            if (results?.length) {
                const doc = results[0];
                Object.assign(state, {
                    notebook: { id: doc.box, name: '' },
                    parentDoc: { id: doc.path?.split('/').pop()?.replace('.sy', '') || doc.id, path: doc.path?.replace('.sy', '') || '', name: doc.hPath || '无标题' }
                });
                if (saveConfig?.getConfig && saveConfig?.saveConfig) {
                    const cfg = await saveConfig.getConfig();
                    cfg.settings = state;
                    await saveConfig.saveConfig(cfg);
                }
                return {success: true, docs: results};
            }
        } catch {}
        return {success: false};
    }
}; 



// ===== 媒体笔记 =====
export const mediaNotes = {
    // 创建媒体笔记并自动添加到笔记面板
    create: async (item: MediaItem, config: any, player: any, i18n?: any, plugin?: any): Promise<string | null> => {
        const content = applyTemplate(config.settings.mediaNotesTemplate || "# 标题的媒体笔记\n- 日期\n- 时长：时长\n- 艺术家：艺术家\n- 类型：类型\n- 链接：[链接](链接)\n- ![封面](封面)\n- 笔记内容：", {
            '标题|{{title}}': item.title || '未命名媒体', '时间|{{time}}': Media.fmt(player.getCurrentTime()), '艺术家|{{artist}}': item.artist || '', '链接|{{url}}': getMediaUrl(item),
            '时长|{{duration}}': item.duration || '', '封面|{{thumbnail}}': item.thumbnail ? await imageToLocalAsset(item.thumbnail) : '', '类型|{{type}}': item.type || 'video',
            'ID|{{id}}': item.id || '', '日期|{{date}}': new Date().toLocaleDateString(), '时间戳|{{timestamp}}': new Date().toISOString().replace('T', ' ').slice(0, 19)
        });

        let docId: string | null = null;
        try {
            docId = await doc.getBlockID(i18n);
            await api.insertBlock("markdown", content, undefined, undefined, docId);
        } catch {
            const { notebook, parentDoc } = config.settings;
            const targetNotebook = notebook?.id || notebook.getPreferredId();
            if (!targetNotebook) throw new Error("请在设置中配置目标笔记本");
            const fileName = `${new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14)}-${Math.random().toString(36).slice(2, 9)}`;
            const result = await api.createDoc(targetNotebook, parentDoc?.path ? `${parentDoc.path}/${fileName}.sy` : `/${fileName}.sy`, item.title || '媒体笔记', content);
            if (!result?.id) throw new Error("创建文档失败");
            docId = result.id;
        }

        // 设置媒体笔记自定义属性
        if (docId) {
            const thumbnail = item.thumbnail ? await imageToLocalAsset(item.thumbnail) : '';
            api.setBlockAttrs(docId, { 'custom-media': 'medianote', 'custom-url': getMediaUrl(item), 'custom-thumbnail': thumbnail }).catch(() => {});
        }

        // 自动添加到笔记面板
        if (docId && plugin) try {
            const cfg = await plugin.loadData('config.json') || {}, notes = { notesTabs: [], activeNoteTab: '', ...(cfg.notes || {}) };
            if (!notes.notesTabs.some((tab: any) => tab.blockId === docId)) {
                const newTab = { id: Date.now().toString(), name: (item.title || '媒体笔记').slice(0, 4), blockId: docId, createTime: Date.now(), isDocument: true };
                notes.notesTabs.push(newTab), notes.activeNoteTab = newTab.id, cfg.notes = notes;
                await plugin.saveData('config.json', cfg, 2), window.dispatchEvent(new CustomEvent('configUpdated', { detail: cfg }));
            }
        } catch {}
        return docId;
    }
};

// ===== 图片处理 =====
// 图片转本地资源 - 统一处理
export const imageToLocalAsset = async (imageUrl: string): Promise<string> => {
    if (!imageUrl || imageUrl.startsWith('/assets/')) return imageUrl;

    try {
        const form = new FormData();
        let file: File;

        if (imageUrl.startsWith('http') || imageUrl.startsWith('//')) {
            const url = imageUrl.startsWith('//') ? `https:${imageUrl}` : imageUrl, blob = await (await fetch(url)).blob();
            file = new File([blob], `img_${Date.now()}.${blob.type.split('/')[1] || 'png'}`, {type: blob.type});
        } else if (imageUrl.startsWith('data:image')) {
            const [header, data] = imageUrl.split(','), mime = header.match(/:(.*?);/)?.[1] || 'image/png', bytes = atob(data);
            const array = new Uint8Array(bytes.length);
            for (let i = 0; i < bytes.length; i++) array[i] = bytes.charCodeAt(i);
            file = new File([new Blob([array], {type: mime})], `img_${Date.now()}.${mime.split('/')[1] || 'png'}`, {type: mime});
        } else return imageUrl;

        form.append('file[]', file);
        const result = await (await fetch('/api/asset/upload', {method: 'POST', body: form})).json();
        return result.code === 0 ? Object.values(result.data.succMap)[0] as string : '';
    } catch { return imageUrl; }
};

