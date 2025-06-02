/**
 * 思源笔记文档工具模块
 * 处理文档、块、媒体笔记等操作
 */
import { showMessage } from "siyuan";
import type { MediaItem } from './types';
import * as api from '../api';
import { fmt, url } from './utils';

// 类型定义
type Block = {
    id?: string;
    root_id?: string;
    [key: string]: any;
};

type ReplacePattern = Record<string, string>;

// ===== 文档操作核心功能 =====
export const doc = {
    /**
     * 获取当前块ID
     */
    getBlockID: async (i18n?: any): Promise<string> => {
        const selection = window.getSelection();
        if (!selection?.focusNode) 
            throw new Error(i18n?.mediaPlayerTab?.block?.cursorNotFound || "未找到光标");

        let el = selection.focusNode as HTMLElement;
        while (el && !el.dataset?.nodeId) el = el.parentElement as HTMLElement;

        if (!el?.dataset.nodeId) 
            throw new Error(i18n?.mediaPlayerTab?.block?.targetBlockNotFound || "未找到目标块");
        
        return el.dataset.nodeId;
    },
    
    /**
     * 获取文档ID (通过块ID)
     */
    getDocID: async (blockId?: string, i18n?: any): Promise<string> => {
        try {
            const id = blockId || await doc.getBlockID(i18n);
            const block = await api.getBlockByID(id) as Block;
            return block?.root_id || block?.id?.split('/')[0] || '';
        } catch {
            throw new Error(i18n?.mediaPlayerTab?.block?.docIdNotFound || "无法获取文档ID");
        }
    },
    
    /**
     * 插入内容到文档
     */
    insert: async (content: string, config: any, i18n?: any): Promise<void> => {
        const insertMode = config?.settings?.insertMode || 'insertBlock';
        
        // 处理剪贴板模式
        if (insertMode === 'clipboard') {
            await navigator.clipboard.writeText(content);
            return showMessage(i18n?.mediaPlayerTab?.block?.copiedToClipboard || "已复制到剪贴板");
        }
        
        try {
            // 获取目标ID
            const blockId = await doc.getBlockID(i18n);
            const docId = insertMode.includes('Doc') ? await doc.getDocID(blockId, i18n) : null;
            const targetId = docId || blockId;
            
            // 执行块操作
            const method = insertMode.replace('Block', '').replace('Doc', '');
            await api[`${method}Block`]("markdown", content, 
                ...(method === 'insert' ? [undefined, undefined, targetId] : [targetId]));
        } catch {
            // 失败时复制到剪贴板
            await navigator.clipboard.writeText(content);
            showMessage(i18n?.mediaPlayerTab?.block?.insertFailed || "操作失败，已复制");
        }
    }
};

/**
 * 应用模板替换
 */
const applyTemplate = (template: string, replacements: ReplacePattern): string => 
    Object.entries(replacements).reduce(
        (text, [pattern, value]) => text.replace(new RegExp(pattern, 'g'), value),
        template
    );

// ===== 媒体链接和模板处理 =====
/**
 * 创建媒体链接
 */
export const link = async (
    item: MediaItem, 
    config: any, 
    time: number, 
    endTime?: number, 
    subtitle?: string
): Promise<string> => {
    if (!item) return '';
    
    try {
        const timeText = endTime 
            ? `${fmt(time, {anchor: true})}-${fmt(endTime, {anchor: true})}` 
            : fmt(time, {anchor: true});
        const baseUrl = url.getStandardUrl(item, config);
        
        // 应用模板替换
        let format = config?.settings?.linkFormat || "- [时间 字幕](链接)";
        format = format.replace(/!?\[截图\]\(截图\)/g, '').replace(/!?\[.*?\]\(截图\)/g, '').trim();
        
        // 替换模板变量
        return applyTemplate(format, {
            '时间|{{time}}': timeText,
            '字幕|{{subtitle}}': subtitle || '',
            '标题|{{title}}': item.title || '',
            '艺术家|{{artist}}': item.artist || '',
            '链接|{{url}}': url.withTime(baseUrl, time, endTime)
        });
    } catch {
        // 出错时返回最简格式
        return `- [${subtitle ? `${fmt(time, {anchor: true})} ${subtitle}` : fmt(time, {anchor: true})}](${item.url})`;
    }
};

// ===== 播放器工具 =====
export const player = {
    /**
     * 插入时间戳
     */
    timestamp: async (player: any, item: MediaItem, config: any, i18n?: any): Promise<void> => {
        if (!player || !item) return showMessage(i18n?.controlBar?.timestamp?.hint || "请先播放媒体");
        const result = await link(item, config, player.getCurrentTime());
        if (result) doc.insert(result, config, i18n);
    },

    /**
     * 创建循环片段
     */
    loop: async (player: any, item: MediaItem, config: any, i18n?: any, loopStart: number | null = null): Promise<number | null> => {
        if (!player || !item) {
            showMessage(i18n?.controlBar?.loopSegment?.hint || "请先播放媒体");
            return null;
        }
        
        const now = player.getCurrentTime();
        
        // 设置循环起点
        if (loopStart === null) return now;
        
        // 创建循环链接
        const result = await link(item, config, loopStart, now);
        if (result) await doc.insert(result, config, i18n);
        return null;
    },

    /**
     * 截图
     */
    screenshot: async (player: any, item: MediaItem, config: any, i18n?: any): Promise<void> => {
        if (!player) return showMessage(i18n?.controlBar?.screenshot?.hint || "请先播放媒体");

        try {
            // 获取并上传截图
            const imageUrl = await imageToLocalAsset(await player.getScreenshotDataURL());
            if (!imageUrl) throw new Error("截图上传失败");
            
            // 根据配置决定是否添加时间戳
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
    /**
     * 获取/保存首选笔记本ID
     */
    getPreferredId: (): string => localStorage.getItem('notebookId') || '',
    savePreferredId: (id: string): void => localStorage.setItem('notebookId', id),
    
    /**
     * 获取笔记本列表
     */
    getList: async (): Promise<any[]> => {
        try {
            const response = await api.lsNotebooks();
            return (response?.notebooks || []).filter((nb: any) => !nb.closed);
        } catch { return []; }
    },
    
    /**
     * 获取笔记本选项
     */
    getOptions: async (): Promise<{label: string, value: string}[]> => {
        const notebooks = await notebook.getList();
        return notebooks.map(nb => ({
            label: nb.name || "未命名笔记本",
            value: nb.id || ""
        }));
    },
    
    /**
     * 初始化设置项
     */
    initSettingItem: async (items: any[], selectedId: string = ''): Promise<{items: any[], selectedId: string}> => {
        try {
            const options = await notebook.getOptions();
            if (!options.length) return { items, selectedId };
            
            const index = items.findIndex(item => item.key === "targetNotebook");
            if (index === -1) return { items, selectedId };
            
            items[index].options = options;
            const validId = (!selectedId || !options.some(opt => opt.value === selectedId))
                ? options[0].value : selectedId;
            items[index].value = validId;
            
            return { items: [...items], selectedId: validId };
        } catch { return { items, selectedId }; }
    }
}; 

// ===== 媒体笔记工具 =====
export const mediaNotes = {
    /**
     * 创建媒体笔记
     */
    create: async (mediaItem: MediaItem, config: any, player: any, i18n?: any): Promise<void> => {
        try {
            // 准备笔记内容
            const standardUrl = url.getStandardUrl(mediaItem, config);
            const currentTime = player.getCurrentTime();
            const timeText = fmt(currentTime, {anchor: true});
            const thumbnailUrl = mediaItem.thumbnail ? await imageToLocalAsset(mediaItem.thumbnail) : '';
            
            // 获取模板并替换变量
            const template = config.settings.mediaNotesTemplate || 
                "# 标题的媒体笔记\n- 日期\n- 时长：时长\n- 艺术家：艺术家\n- 类型：类型\n- 链接：[链接](链接)\n- ![封面](封面)\n- 笔记内容：";
            
            // 替换模板变量
            const content = applyTemplate(template, {
                '标题|{{title}}': mediaItem.title || '未命名媒体',
                '时间|{{time}}': timeText,
                '艺术家|{{artist}}': mediaItem.artist || '',
                '链接|{{url}}': standardUrl,
                '时长|{{duration}}': mediaItem.duration || '',
                '封面|{{thumbnail}}': thumbnailUrl,
                '类型|{{type}}': mediaItem.type || 'video',
                'ID|{{id}}': mediaItem.id || '',
                '日期|{{date}}': new Date().toLocaleDateString(),
                '时间戳|{{timestamp}}': new Date().toISOString().replace('T', ' ').slice(0, 19)
            });
            
            try {
                // 尝试在当前文档插入块
                await api.insertBlock("markdown", content, undefined, undefined, await doc.getBlockID(i18n));
            } catch {
                // 创建新文档
                const notebookId = config.settings.targetNotebook || notebook.getPreferredId();
                const response = await fetch('/api/filetree/createDocWithMd', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({ 
                        notebook: notebookId, 
                        path: `/${mediaItem.title || '媒体笔记'}`, 
                        markdown: content 
                    })
                });
                
                const result = await response.json();
                if (result.code === 0) {
                    window.open(`siyuan://blocks/${result.data}`, '_blank');
                } else {
                    throw new Error(result.msg || "创建文档失败");
                }
            }
        } catch (error) {
            console.error("创建媒体笔记失败:", error);
            showMessage(i18n?.mediaPlayerTab?.mediaNotes?.createFailed || "创建媒体笔记失败");
            
            // 失败时尝试复制简单笔记到剪贴板
            try {
                await navigator.clipboard.writeText(
                    `# ${mediaItem.title || '媒体笔记'}\n- 时间：${fmt(player?.getCurrentTime?.() || 0, {anchor: true})}`
                );
                showMessage(i18n?.mediaPlayerTab?.mediaNotes?.copiedToClipboard || "已复制到剪贴板");
            } catch {}
        }
    }
}; /**
 * 将图片转换为思源笔记本地资源
 */
export const imageToLocalAsset = async (imageUrl: string): Promise<string> => {
    if (!imageUrl || 
        imageUrl === '/plugins/siyuan-media-player/thumbnails/default.svg' || 
        imageUrl.startsWith('/assets/')) return imageUrl;
    
    try {
        // 处理网络图片
        if (imageUrl.startsWith('http') || imageUrl.startsWith('//')) {
            const url = imageUrl.startsWith('//') ? `https:${imageUrl}` : imageUrl;
            
            // 尝试使用API直接获取
            try {
                const resp = await fetch('/api/asset/netImg', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ url })
                });
                
                const json = await resp.json();
                if (json.code === 0 && json.data) return json.data;
            } catch {}
            
            // 手动下载并上传
            return await uploadImageBlob(await (await fetch(url)).blob());
        }
        
        // 处理Base64图片
        else if (imageUrl.startsWith('data:image')) {
            const arr = imageUrl.split(',');
            const mime = arr[0].match(/:(.*?);/)?.[1] || 'image/png';
            const bstr = atob(arr[1]);
            const u8arr = new Uint8Array(bstr.length);
            
            for (let i = 0; i < bstr.length; i++) u8arr[i] = bstr.charCodeAt(i);
            
            return await uploadImageBlob(new Blob([u8arr], { type: mime }));
        }
    } catch (e) {
        console.warn('图片转换失败:', e);
    }
    
    return imageUrl;
};

/**
 * 上传图片Blob到思源笔记
 */
async function uploadImageBlob(blob: Blob): Promise<string> {
    const form = new FormData();
    form.append('file[]', new File(
        [blob], 
        `img_${Date.now()}.${blob.type.split('/')[1] || 'png'}`, 
        { type: blob.type }
    ));
    
    const result = await (await fetch('/api/asset/upload', { method: 'POST', body: form })).json();
    return result.code === 0 ? Object.values(result.data.succMap)[0] as string : '';
} 

