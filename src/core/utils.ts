/**
 * 思源媒体播放器核心工具
 */
import { showMessage } from 'siyuan';
import type { MediaItem } from './types';
import * as api from '../api';
import { AListManager } from './alist';

// ===== 类型和常量 =====
type MediaType = 'video' | 'audio' | 'bilibili';
type MediaSource = 'bilibili' | 'alist' | 'local' | 'standard';
type Config = any;
type TimeOptions = { anchor?: boolean; duration?: boolean };
type InsertMode = 'insertBlock' | 'appendBlock' | 'prependBlock' | 'updateBlock' | 'prependDoc' | 'appendDoc' | 'clipboard';

// 媒体扩展和正则表达式
const EXT = {
    VIDEO: ['.mp4', '.webm', '.ogg', '.mov', '.m4v', '.mkv'],
    AUDIO: ['.mp3', '.wav', '.aac', '.m4a', '.flac'],
    get ALL() { return [...this.VIDEO, ...this.AUDIO]; }
};

const REGEX = {
    BILIBILI: /bilibili\.com\/video\/|\/BV[a-zA-Z0-9]+/,
    BV: /\/BV[a-zA-Z0-9]+/,
    ALIST: /\/#\//,
    TIME: /[?&]t=([^&]+)/,
    WINDOWS_PATH: /^[a-zA-Z]:\\/
};

// ===== 核心工具函数 =====
// 格式化时间
export const fmt = (sec: number, opts: TimeOptions = {}): string => {
    if (isNaN(sec) || sec < 0) return '0:00';
    
    const s = (opts.anchor || opts.duration) ? Math.round(sec) : sec;
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const ss = (opts.anchor || opts.duration) 
        ? Math.floor(s % 60).toString().padStart(2, '0')
        : (s % 60).toFixed(1);
    
    return h > 0 ? `${h}:${m.toString().padStart(2, '0')}:${ss}` : `${m}:${ss}`;
};

// URL工具集
export const url = {
    // 判断媒体类型并获取来源信息
    getMediaInfo: (u: string): { type: MediaType; source: MediaSource; path?: string } => {
        if (!u) return { type: 'video', source: 'standard' };
        
        const isAudio = EXT.AUDIO.some(ext => u.toLowerCase().endsWith(ext));
        // B站视频      
        if (REGEX.BILIBILI.test(u)) 
            return { type: 'bilibili', source: 'bilibili', path: u.match(REGEX.BV)?.[0].substring(1) };
          // AList媒体   
        if (REGEX.ALIST.test(u)) 
            return { type: isAudio ? 'audio' : 'video', source: 'alist', path: u.split('/#/')[1]?.split('?')[0] };
        const alistPath = AListManager?.parsePathFromUrl?.(u);
        if (alistPath) 
            return { type: isAudio ? 'audio' : 'video', source: 'alist', path: alistPath };
        // 本地文件     
        if (u.startsWith('file:///'))
            return { type: isAudio ? 'audio' : 'video', source: 'local', path: u.substring(8) };

        // 标准媒体
        return { type: isAudio ? 'audio' : 'video', source: 'standard' };
    },
    
    // 获取媒体类型
    type: (u: string): MediaType => url.getMediaInfo(u).type,
    
    // 转换为文件URL
    toFile: (path?: string): string => !path ? '' : path.startsWith('http') || path.startsWith('file') ? path :
        `file://${path.split('/').map(encodeURIComponent).join('/')}`,
    
    // 从URL提取标题
    title: (u: string): string => {
        try {
            return decodeURIComponent(u.split('/').pop()?.split('?')[0]?.split('.')[0] || '') || '未知';
        } catch {
            return u.split(/[/\\]/).pop()?.split('.')[0] || '未知';
        }
    },
    
    // 解析URL中的时间参数
    parseTime: (u: string): { mediaUrl: string; startTime?: number; endTime?: number } => {
        try {
            const match = u.match(REGEX.TIME);
            if (!match) return { mediaUrl: u };
            
            const timeParam = match[1];
            const cleanUrl = u.replace(/([?&])t=[^&]+&?/, '$1').replace(/[?&]$/,'');
            
            // 处理时间范围
            if (timeParam.includes('-')) {
                const [start, end] = timeParam.split('-').map(Number);
                return { mediaUrl: cleanUrl, startTime: isNaN(start) ? undefined : start, endTime: isNaN(end) ? undefined : end };
            }
            
            const time = Number(timeParam);
            return { mediaUrl: cleanUrl, startTime: isNaN(time) ? undefined : time };
        } catch {
            return { mediaUrl: u };
        }
    },
    
    // 添加时间戳到URL
    withTime: (u: string, time?: number, endTime?: number): string => {
        if (!time) return u;
        const timeValue = endTime ? `${time.toFixed(1)}-${endTime.toFixed(1)}` : time.toFixed(1);
        return `${u}${u.includes('?') ? '&' : '?'}t=${timeValue}`;
    },
    
    // 判断两个媒体是否相同
    isSameMedia: (curr: any, media: string): boolean => {
        if (!curr) return false;
        
        const mediaInfo = url.getMediaInfo(media);
        
        switch (mediaInfo.source) {
            case 'bilibili': {
                // 比较B站视频BV号
                const bv = media.match(/BV[a-zA-Z0-9]+/)?.[0];
                if (!bv || !curr.bvid || bv.toUpperCase() !== curr.bvid.toUpperCase()) return false;       
                // 比较分P
                try {
                    const urlPart = parseInt(media.match(/[\?&]p=(\d+)/)?.[1] || '1', 10);
                    const currPart = parseInt(curr.id?.match(/-p(\d+)/)?.[1] || '1', 10);
                    return urlPart === currPart;
                } catch {
                    return true;
                }
            }
            case 'alist':
                return curr.sourcePath && (media.split('/#/')[1]?.split('?')[0])?.length && 
                       curr.sourcePath.includes(media.split('/#/')[1]?.split('?')[0]);
            default:
                return url.parseTime(media).mediaUrl.split('?')[0] === (curr.url?.split('?')[0] || '');
        }
    },
    
    // 检测是否为支持的媒体链接
    isMedia: (u: string, config?: any): boolean => {
        if (!u) return false;
        const hasMediaExt = EXT.ALL.some(ext => u.toLowerCase().endsWith(ext));
        return hasMediaExt || REGEX.BILIBILI.test(u) || 
               (u.startsWith('file:///') && hasMediaExt) ||
               (config?.settings?.alistConfig?.server && u.includes(config.settings.alistConfig.server));
    },
    
    // 获取规范化的媒体URL
    getStandardUrl: (item: MediaItem, config?: Config): string => {
        if (!item) return '';
        
        if (item.source === 'alist' && item.sourcePath && config?.settings?.alistConfig?.server)
            return `${config.settings.alistConfig.server}${item.sourcePath}`;
        
        if (item.type === 'bilibili' && item.bvid) {
            const partMatch = item.id?.match(/-p(\d+)$/);
            const part = partMatch ? parseInt(partMatch[1], 10) : 1;
            return `https://www.bilibili.com/video/${item.bvid}${part > 1 ? `?p=${part}` : ''}`;
        }
        
        return item.url || '';
    }
};

// 简化的媒体链接检测
export const isSupportedMediaLink = (u: string): boolean => {
    if (!u) return false;
    const hasExt = EXT.ALL.some(ext => u.split('?')[0].toLowerCase().endsWith(ext));
    return (u.startsWith('file:///') && hasExt) || REGEX.BILIBILI.test(u) || hasExt;
};

// Pro功能管理
export const pro = {
    check: (config: Config) => !!config?.proEnabled,
    alert: (i18n?: any) => showMessage(i18n?.pro?.notEnabled || "此功能需要Pro版本")
};

// 文档工具
export const doc = {
    // 获取当前块ID
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
    
    // 获取文档ID (通过块ID)
    getDocID: async (i18n?: any, blockId?: string): Promise<string> => {
        try {
            const id = blockId || await doc.getBlockID(i18n);
            const block = await api.getBlockByID(id);
            const docId = (block as any)?.root_id || block?.id?.split('/')[0];
            if (!docId) throw new Error("无法获取文档ID");
            return docId;
        } catch (e) {
            throw new Error(i18n?.mediaPlayerTab?.block?.docIdNotFound || "无法获取文档ID");
        }
    },
    
    // 插入内容
    insert: async (content: string, config: Config, i18n?: any): Promise<void> => {
        try {
            const insertMode = config?.settings?.insertMode || 'insertBlock';
            
            // 处理剪贴板模式
            if (insertMode === 'clipboard') {
                await navigator.clipboard.writeText(content);
                showMessage(i18n?.mediaPlayerTab?.block?.copiedToClipboard || "已复制到剪贴板");
                return;
            }
            
            // 获取块ID和文档ID
            let blockId, docId;
            try {
                blockId = await doc.getBlockID(i18n);
                if (insertMode === 'prependDoc' || insertMode === 'appendDoc') {
                    docId = await doc.getDocID(i18n, blockId);
                }
            } catch (e) {
                // 如果无法获取ID，则复制到剪贴板
                await navigator.clipboard.writeText(content);
                showMessage(i18n?.mediaPlayerTab?.block?.noTarget || "无法获取目标，已复制");
                return;
            }
            
            // 执行块操作
            switch(insertMode) {
                case 'insertBlock': 
                    await api.insertBlock("markdown", content, undefined, undefined, blockId);
                    break;
                case 'appendBlock': 
                    await api.appendBlock("markdown", content, blockId);
                    break;
                case 'prependBlock':
                    await api.prependBlock("markdown", content, blockId);
                    break;
                case 'updateBlock': 
                    await api.updateBlock("markdown", content, blockId);
                    break;
                case 'prependDoc': 
                    await api.prependBlock("markdown", content, docId);
                    break;
                case 'appendDoc': 
                    await api.appendBlock("markdown", content, docId);
                    break;
            }
        } catch (error) {
            console.error("操作失败:", error);
            try {
                await navigator.clipboard.writeText(content);
                showMessage(i18n?.mediaPlayerTab?.block?.insertFailed || "操作失败，已复制");
            } catch {
                showMessage(i18n?.mediaPlayerTab?.block?.operationFailed || "操作失败");
            }
        }
    }
};

// 创建媒体链接
export const link = async (item: MediaItem, config: Config, time: number, endTime?: number, subtitle?: string): Promise<string> => {
    if (!item) return '';
    
    try {
        // 生成基础信息
        const timeText = endTime ? `${fmt(time, {anchor: true})}-${fmt(endTime, {anchor: true})}` : fmt(time, {anchor: true});
        const baseUrl = url.getStandardUrl(item, config);
        
        // 应用模板替换
        let format = config?.settings?.linkFormat || "- [时间 字幕](链接)";
        format = format.replace(/!?\[截图\]\(截图\)/g, '').replace(/!?\[.*?\]\(截图\)/g, '').trim();
        
        return format
            .replace(/时间|{{time}}/g, timeText)
            .replace(/字幕|{{subtitle}}/g, subtitle || '')
            .replace(/标题|{{title}}/g, item.title || '')
            .replace(/艺术家|{{artist}}/g, item.artist || '')
            .replace(/链接|{{url}}/g, url.withTime(baseUrl, time, endTime));
    } catch {
        // 出错时返回最简格式
        return `- [${subtitle ? `${fmt(time, {anchor: true})} ${subtitle}` : fmt(time, {anchor: true})}](${item.url})`;
    }
};

// 播放器工具
export const player = {
    // 插入时间戳
    timestamp: async (player: any, item: MediaItem, config: Config, i18n?: any): Promise<void> => {
        if (!player || !item) return showMessage(i18n?.controlBar?.timestamp?.hint || "请先播放媒体");
        const result = await link(item, config, player.getCurrentTime());
        if (result) doc.insert(result, config, i18n);
    },

    // 创建循环片段
    loop: async (player: any, item: MediaItem, config: Config, i18n?: any, loopStart: number | null = null): Promise<number | null> => {
        if (!player || !item) {
            showMessage(i18n?.controlBar?.loopSegment?.hint || "请先播放媒体");
            return null;
        }
        
        const now = player.getCurrentTime();
        
        // 设置循环起点
        if (loopStart === null) {
            return now;
        }
        
        // 创建循环链接
        const result = await link(item, config, loopStart, now);
        if (result) await doc.insert(result, config, i18n);
        return null;
    },

    // 截图
    screenshot: async (player: any, item: MediaItem, config: Config, i18n?: any): Promise<void> => {
        if (!player) return showMessage(i18n?.controlBar?.screenshot?.hint || "请先播放媒体");

        try {
            // 获取截图数据
            const dataUrl = await player.getScreenshotDataURL();
            if (!dataUrl) return showMessage(i18n?.mediaPlayerTab?.screenshot?.failHint || "截图失败");
            
            // 转换截图为本地资源
            const imageUrl = await imageToLocalAsset(dataUrl);
            if (!imageUrl) throw new Error("截图上传失败");
            
            // 获取当前时间和URL
            const currentTime = player.getCurrentTime();
            const timeText = fmt(currentTime, {anchor: true});
            const mediaUrl = url.withTime(url.getStandardUrl(item, config), currentTime);
            
            // 创建包含截图的Markdown
            const format = config?.settings?.linkFormat || "- [时间 字幕](链接)";
            const markdown = format.includes('截图')
                ? format
                    .replace(/时间|{{time}}/g, timeText)
                    .replace(/字幕|{{subtitle}}/g, '')
                    .replace(/标题|{{title}}/g, item.title || '')
                    .replace(/艺术家|{{artist}}/g, item.artist || '')
                    .replace(/链接|{{url}}/g, mediaUrl)
                    .replace(/截图|{{screenshot}}/g, imageUrl)
                : `- [${timeText}](${mediaUrl}) ![截图](${imageUrl})`;
                
            await doc.insert(markdown, config, i18n);
        } catch (error) {
            console.error("截图失败:", error);
            showMessage(i18n?.mediaPlayerTab?.screenshot?.errorHint || "截图保存失败");
        }
    }
};

// 笔记本管理工具
export const notebook = {
    // 获取笔记本列表
    getList: async (): Promise<any[]> => {
        try {
            const response = await api.lsNotebooks();
            return (response?.notebooks || []).filter((nb: any) => !nb.closed);
        } catch { return []; }
    },
    
    // 笔记本ID管理
    getPreferredId: (): string => localStorage.getItem('notebookId') || '',
    savePreferredId: (id: string): void => localStorage.setItem('notebookId', id),
    
    // 笔记本选项
    getOptions: async (): Promise<{label: string, value: string}[]> => {
        const notebooks = await notebook.getList();
        return notebooks.map(nb => ({
            label: nb.name || "未命名笔记本",
            value: nb.id || ""
        }));
    },
    
    // 初始化设置项
    initSettingItem: async (items: any[], selectedId: string = ''): Promise<{items: any[], selectedId: string}> => {
        try {
            const options = await notebook.getOptions();
            if (options.length === 0) return { items, selectedId };
            
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

// 将图片转换为思源笔记本地资源
export const imageToLocalAsset = async (imageUrl: string): Promise<string> => {
    if (!imageUrl || 
        imageUrl === '/plugins/siyuan-media-player/thumbnails/default.svg' || 
        imageUrl.startsWith('/assets/')) return imageUrl;
    
    try {
        // 处理网络图片
        if (imageUrl.startsWith('http') || imageUrl.startsWith('//')) {
            const url = imageUrl.startsWith('//') ? `https:${imageUrl}` : imageUrl;
            
            try {
                const resp = await fetch('/api/asset/netImg', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ url })
                });
                
                const json = await resp.json();
                if (json.code === 0 && json.data) return json.data;
            } catch {}
            
            const blob = await (await fetch(url)).blob();
            const form = new FormData();
            form.append('file[]', new File([blob], `img_${Date.now()}.${blob.type.split('/')[1] || 'jpg'}`, { type: blob.type }));
            
            const result = await (await fetch('/api/asset/upload', { method: 'POST', body: form })).json();
            if (result.code === 0) return Object.values(result.data.succMap)[0] as string;
        }
        
        // 处理Base64图片
        else if (imageUrl.startsWith('data:image')) {
            const arr = imageUrl.split(',');
            const mime = arr[0].match(/:(.*?);/)?.[1] || 'image/png';
            const bstr = atob(arr[1]);
            const u8arr = new Uint8Array(bstr.length);
            
            for (let i = 0; i < bstr.length; i++) u8arr[i] = bstr.charCodeAt(i);
            
            const form = new FormData();
            form.append('file[]', new File(
                [u8arr], 
                `img_${Date.now()}.${mime.split('/')[1] || 'png'}`, 
                { type: mime }
            ));
            
            const result = await (await fetch('/api/asset/upload', { method: 'POST', body: form })).json();
            if (result.code === 0) return Object.values(result.data.succMap)[0] as string;
        }
    } catch (e) {
        console.warn('图片转换失败:', e);
    }
    
    return imageUrl;
};

// 媒体笔记工具
export const mediaNotes = {
    create: async (mediaItem: MediaItem, config: any, player: any, i18n?: any): Promise<void> => {
        try {
            const standardUrl = url.getStandardUrl(mediaItem, config);
            const currentTime = player.getCurrentTime();
            const timeText = fmt(currentTime, {anchor: true});
            const thumbnailUrl = mediaItem.thumbnail ? await imageToLocalAsset(mediaItem.thumbnail) : '';
            
            let template = config.settings.mediaNotesTemplate || "# 标题的媒体笔记笔记\n- 日期\n- 时 长：时长\n- 艺 术 家：艺术家\n- 类 型：类型\n- 链 接：[链接](链接)\n- ![封面](封面)\n- 笔记内容：";
            
            const content = template
                .replace(/标题|{{title}}/g, mediaItem.title || '未命名媒体')
                .replace(/时间|{{time}}/g, timeText)
                .replace(/艺术家|{{artist}}/g, mediaItem.artist || '')
                .replace(/链接|{{url}}/g, standardUrl)
                .replace(/时长|{{duration}}/g, mediaItem.duration || '')
                .replace(/封面|{{thumbnail}}/g, thumbnailUrl)
                .replace(/类型|{{type}}/g, mediaItem.type || 'video')
                .replace(/ID|{{id}}/g, mediaItem.id || '')
                .replace(/日期|{{date}}/g, new Date().toLocaleDateString())
                .replace(/时间戳|{{timestamp}}/g, new Date().toISOString().replace('T', ' ').slice(0, 19));
            
            try {
                // 尝试在当前文档插入块
                await api.insertBlock("markdown", content, undefined, undefined, await doc.getBlockID(i18n));
            } catch (insertError) {
                // 创建新文档
                const notebookId = config.settings.targetNotebook || notebook.getPreferredId();
                const title = mediaItem.title || '媒体笔记';
                const response = await fetch('/api/filetree/createDocWithMd', {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify({
                        notebook: notebookId,
                        path: `/${title}`,
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
            
            try {
                const simpleNote = `# ${mediaItem.title || '媒体笔记'}\n- 时间：${fmt(player?.getCurrentTime?.() || 0, {anchor: true})}`;
                await navigator.clipboard.writeText(simpleNote);
                showMessage(i18n?.mediaPlayerTab?.mediaNotes?.copiedToClipboard || "已复制到剪贴板");
            } catch {}
        }
    }
};
