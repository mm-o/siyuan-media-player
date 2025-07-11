// 思源笔记文档工具模块 - 处理文档、块、媒体笔记等操作
import { showMessage, openTab } from "siyuan";
import type { MediaItem } from './types';
import * as api from '../api';
import { Media } from './player';

// ===== 类型定义 =====
type Block = { id?: string; root_id?: string; [key: string]: any; };
type ReplacePattern = Record<string, string>;

// ===== 文档操作 =====
export const doc = {
    getBlockID: async (i18n?: any): Promise<string> => {
        const selection = window.getSelection();
        if (!selection?.focusNode) throw new Error(i18n?.mediaPlayerTab?.block?.cursorNotFound || "未找到光标");
        let el = selection.focusNode as HTMLElement;
        while (el && !el.dataset?.nodeId) el = el.parentElement as HTMLElement;
        if (!el?.dataset.nodeId) throw new Error(i18n?.mediaPlayerTab?.block?.targetBlockNotFound || "未找到目标块");
        return el.dataset.nodeId;
    },
    
    getDocID: async (blockId?: string, i18n?: any): Promise<string> => {
        try {
            const block = await api.getBlockByID(blockId || await doc.getBlockID(i18n)) as Block;
            return block?.root_id || block?.id?.split('/')[0] || '';
        } catch { throw new Error(i18n?.mediaPlayerTab?.block?.docIdNotFound || "无法获取文档ID"); }
    },
    
    insert: async (content: string, config: any, i18n?: any): Promise<void> => {
        const mode = config?.settings?.insertMode || 'insertBlock';
        if (mode === 'clipboard') {
            await navigator.clipboard.writeText(content);
            return showMessage(i18n?.mediaPlayerTab?.block?.copiedToClipboard || "已复制到剪贴板");
        }
        
        try {
            const blockId = await doc.getBlockID(i18n);
            const targetId = mode.includes('Doc') ? await doc.getDocID(blockId, i18n) : blockId;
            const method = mode.replace('Block', '').replace('Doc', '');
            await api[`${method}Block`]("markdown", content, ...(method === 'insert' ? [undefined, undefined, targetId] : [targetId]));
        } catch {
            await navigator.clipboard.writeText(content);
            showMessage(i18n?.mediaPlayerTab?.block?.insertFailed || "操作失败，已复制");
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
        const timeText = endTime ? `${Media.fmt(time)}-${Media.fmt(endTime)}` : Media.fmt(time);
        const baseUrl = getMediaUrl(item);

        // 清理格式模板
        let format = config?.settings?.linkFormat || "- [时间 字幕](链接)";
        format = format.replace(/!?\[截图\]\(截图\)/g, '').replace(/!?\[.*?\]\(截图\)/g, '').trim();

        return applyTemplate(format, {
            '时间|{{time}}': timeText,
            '字幕|{{subtitle}}': subtitle || '',
            '标题|{{title}}': item.title || '',
            '艺术家|{{artist}}': item.artist || '',
            '链接|{{url}}': withTime(baseUrl, time, endTime)
        });
    } catch {
        return `- [${subtitle ? `${Media.fmt(time)} ${subtitle}` : Media.fmt(time)}](${item.url})`;
    }
};

// ===== 播放器工具 =====
export const player = {
    // 插入时间戳
    timestamp: async (player: any, item: MediaItem, config: any, i18n?: any): Promise<void> => {
        if (!player || !item) return showMessage(i18n?.controlBar?.timestamp?.hint || "请先播放媒体");
        const result = await link(item, config, player.getCurrentTime());
        if (result) doc.insert(result, config, i18n);
    },

    // 创建循环片段
    loop: async (player: any, item: MediaItem, config: any, i18n?: any, loopStart: number | null = null): Promise<number | null> => {
        if (!player || !item) {
            showMessage(i18n?.controlBar?.loopSegment?.hint || "请先播放媒体");
            return null;
        }

        const now = player.getCurrentTime();
        if (loopStart === null) return now; // 设置循环起点

        // 创建循环链接
        const result = await link(item, config, loopStart, now);
        if (result) await doc.insert(result, config, i18n);
        return null;
    },

    // 截图
    screenshot: async (player: any, item: MediaItem, config: any, i18n?: any): Promise<void> => {
        if (!player) return showMessage(i18n?.controlBar?.screenshot?.hint || "请先播放媒体");

        try {
            const imageUrl = await imageToLocalAsset(await player.getScreenshotDataURL());
            if (!imageUrl) throw new Error("截图上传失败");

            const markdown = config?.settings?.screenshotWithTimestamp ?
                `${await link(item, config, player.getCurrentTime())}\n\n  ![截图](${imageUrl})` :
                `![截图](${imageUrl})`;

            await doc.insert(markdown, config, i18n);
        } catch (error) {
            console.error("截图失败:", error);
            showMessage(i18n?.mediaPlayerTab?.screenshot?.errorHint || "截图保存失败");
        }
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
    }
}; 



// ===== 媒体笔记 =====
export const mediaNotes = {
    // 创建媒体笔记
    create: async (mediaItem: MediaItem, config: any, player: any, i18n?: any, app?: any): Promise<void> => {
        try {
            const content = applyTemplate(config.settings.mediaNotesTemplate ||
                "# 标题的媒体笔记\n- 日期\n- 时长：时长\n- 艺术家：艺术家\n- 类型：类型\n- 链接：[链接](链接)\n- ![封面](封面)\n- 笔记内容：", {
                '标题|{{title}}': mediaItem.title || '未命名媒体',
                '时间|{{time}}': Media.fmt(player.getCurrentTime()),
                '艺术家|{{artist}}': mediaItem.artist || '',
                '链接|{{url}}': getMediaUrl(mediaItem),
                '时长|{{duration}}': mediaItem.duration || '',
                '封面|{{thumbnail}}': mediaItem.thumbnail ? await imageToLocalAsset(mediaItem.thumbnail) : '',
                '类型|{{type}}': mediaItem.type || 'video',
                'ID|{{id}}': mediaItem.id || '',
                '日期|{{date}}': new Date().toLocaleDateString(),
                '时间戳|{{timestamp}}': new Date().toISOString().replace('T', ' ').slice(0, 19)
            });

            try {
                await api.insertBlock("markdown", content, undefined, undefined, await doc.getBlockID(i18n));
            } catch {
                const targetNotebook = config.settings.targetNotebook?.id || notebook.getPreferredId();
                if (!targetNotebook) throw new Error("请在设置中配置目标笔记本");

                const result = await (await fetch('/api/filetree/createDocWithMd', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({
                        notebook: targetNotebook,
                        path: `/${mediaItem.title || '媒体笔记'}`,
                        markdown: content
                    })
                })).json();

                if (result.code === 0) {
                    openTab({ app, doc: { id: result.data }, position: 'right' });
                } else {
                    throw new Error(result.msg || "创建文档失败");
                }
            }
        } catch (error) {
            console.error("创建媒体笔记失败:", error);
            showMessage(i18n?.mediaPlayerTab?.mediaNotes?.createFailed || "创建媒体笔记失败");
            try {
                await navigator.clipboard.writeText(`# ${mediaItem.title || '媒体笔记'}\n- 时间：${Media.fmt(player?.getCurrentTime?.() || 0)}`);
                showMessage(i18n?.mediaPlayerTab?.mediaNotes?.copiedToClipboard || "已复制到剪贴板");
            } catch {}
        }
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
            // 网络图片
            const url = imageUrl.startsWith('//') ? `https:${imageUrl}` : imageUrl;
            const blob = await (await fetch(url)).blob();
            const ext = blob.type.split('/')[1] || 'png';
            file = new File([blob], `img_${Date.now()}.${ext}`, {type: blob.type});
        } else if (imageUrl.startsWith('data:image')) {
            // Base64图片
            const [header, data] = imageUrl.split(',');
            const mime = header.match(/:(.*?);/)?.[1] || 'image/png';
            const bytes = atob(data);
            const array = new Uint8Array(bytes.length);
            for (let i = 0; i < bytes.length; i++) array[i] = bytes.charCodeAt(i);
            const ext = mime.split('/')[1] || 'png';
            file = new File([new Blob([array], {type: mime})], `img_${Date.now()}.${ext}`, {type: mime});
        } else {
            return imageUrl;
        }

        form.append('file[]', file);
        const result = await (await fetch('/api/asset/upload', {method: 'POST', body: form})).json();
        return result.code === 0 ? Object.values(result.data.succMap)[0] as string : '';
    } catch (e) {
        console.warn('图片转换失败:', e);
        return imageUrl;
    }
};

