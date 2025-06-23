import { MediaItem, MediaInfo, PlaylistConfig, PlayerType } from "./types";
import { BilibiliParser } from "./bilibili";
import { AListManager } from './alist';
import { imageToLocalAsset } from './document';
import { showMessage as showMsg } from 'siyuan';

// 常量
const VIDEO_EXTS = ['.mp4', '.webm', '.ogg', '.mov', '.m4v', '.mkv', '.avi', '.flv', '.wmv'];
const AUDIO_EXTS = ['.mp3', '.wav', '.aac', '.m4a', '.flac', '.ogg'];
const MEDIA_EXTS = [...VIDEO_EXTS, ...AUDIO_EXTS];
export const BILIBILI_REGEX = /bilibili\.com\/video\/|\/BV[a-zA-Z0-9]+/;
export const BV_REGEX = /BV[a-zA-Z0-9]+/;
export const TIME_REGEX = /[?&](?:amp;)?t=([^&]+)/;

export const DEFAULT_THUMBNAILS = {
    audio: '/plugins/siyuan-media-player/assets/images/audio.png',
    video: '/plugins/siyuan-media-player/assets/images/video.png',
    folder: '/plugins/siyuan-media-player/assets/images/folder.png'
};

export const EXT = { 
    VIDEO: VIDEO_EXTS, AUDIO: AUDIO_EXTS, MEDIA: MEDIA_EXTS, 
    SUPPORT: [...MEDIA_EXTS, '.srt', '.ass', '.vtt', '.xml'], ALL: MEDIA_EXTS 
};

// 类型检测工具函数 - 超级精简
export const detectMediaType = (urlOrFile: string): 'audio' | 'video' => 
    AUDIO_EXTS.some(ext => urlOrFile.toLowerCase().split('?')[0].endsWith(ext)) ? 'audio' : 'video';

/**
 * 媒体核心类 - 极简版
 */
export class Media {
    // 解析URL - 核心方法
    static parse(url: string) {
        if (!url) return { cleanUrl: '', type: 'video', source: 'standard' };
        
        // 时间和URL处理
        const timeMatch = url.match(TIME_REGEX);
        let startTime: number | undefined, endTime: number | undefined;
        if (timeMatch) {
            const timeStr = timeMatch[1];
            if (timeStr.includes('-')) {
                [startTime, endTime] = timeStr.split('-').map(Number).map(n => isNaN(n) ? undefined : n);
            } else {
                const time = Number(timeStr);
                startTime = isNaN(time) ? undefined : time;
            }
        }
        
        let cleanUrl = url.replace(/([?&])t=[^&]+&?/, '$1').replace(/[?&]$/, '');
        const mediaType = detectMediaType(url);
        
        // 来源判断
        if (BILIBILI_REGEX.test(url)) {
            const bvMatch = url.match(BV_REGEX);
            const pageMatch = url.match(/[?&]p=(\d+)/);
            cleanUrl = bvMatch ? `https://www.bilibili.com/video/${bvMatch[0]}${pageMatch ? `?p=${pageMatch[1]}` : ''}` : cleanUrl;
            return { cleanUrl, startTime, endTime, type: 'bilibili', source: 'bilibili', path: bvMatch?.[0] };
        }
        
        if (url.includes('/#/') || AListManager?.parsePathFromUrl?.(url)) {
            const path = url.includes('/#/') ? url.split('/#/')[1]?.split('?')[0] : AListManager?.parsePathFromUrl?.(url);
            return { cleanUrl, startTime, endTime, type: mediaType, source: 'alist', path };
        }
        
        if (url.startsWith('file://')) {
            return { cleanUrl, startTime, endTime, type: mediaType, source: 'local', path: url.substring(7) };
        }
        
        return { cleanUrl, startTime, endTime, type: mediaType, source: 'standard' };
    }

    // 时间格式化
    static fmt(seconds: number, options: any = {}): string {
        if (isNaN(seconds) || seconds < 0) return '0:00';
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = options.anchor || options.duration ? 
            Math.floor(seconds % 60).toString().padStart(2, '0') : (seconds % 60).toFixed(1);
        return hours > 0 ? `${hours}:${minutes.toString().padStart(2, '0')}:${secs}` : `${minutes}:${secs}`;
    }

    // 构建媒体项
    static createItem(options: any): any {
        return {
            id: options.id || `item-${Date.now()}`,
            title: options.title || this.getTitle(options.url || ''),
            url: options.url,
            type: ['bilibili-dash', 'bilibili'].includes(options.type) ? 'bilibili' : (options.type || 'video'),
            artist: options.artist || '', artistIcon: options.artistIcon || '',
            thumbnail: options.thumbnail || this.getThumbnail(options),
            duration: options.duration || '',
            ...(options.startTime !== undefined && { startTime: options.startTime }),
            ...(options.endTime !== undefined && { endTime: options.endTime }),
            ...(options.isLoop && { isLoop: options.isLoop }),
            ...(options.loopCount && { loopCount: options.loopCount }),
            ...(options.bvid && { bvid: options.bvid }),
            ...(options.cid && { cid: options.cid }),
            ...(options.source && { source: options.source }),
            ...(options.sourcePath && { sourcePath: options.sourcePath })
        };
    }

    // 内联工具方法
    static getTitle = (url: string): string => {
        try { return decodeURIComponent(url.split('/').pop()?.split('?')[0]?.split('.')[0] || '') || '未知'; } 
        catch { return url.split(/[/\\]/).pop()?.split('.')[0] || '未知'; }
    };

    static getThumbnail = (item: any): string => item?.thumbnail || 
        (item?.type === 'audio' ? DEFAULT_THUMBNAILS.audio : 
         item?.type === 'folder' || item?.is_dir ? DEFAULT_THUMBNAILS.folder : DEFAULT_THUMBNAILS.video);

    static addTime = (url: string, startTime: number, endTime?: number): string => {
        const timeParam = endTime !== undefined ? `${startTime.toFixed(1)}-${endTime.toFixed(1)}` : startTime.toFixed(1);
        return `${url}${url.includes('?') ? '&' : '?'}t=${timeParam}`;
    };

    static handleError = (error: any, context: string = ''): string => {
        const message = error instanceof Error ? error.message : String(error);
        console.error(`[player] ${context}失败:`, error);
        return message;
    };

    // 播放列表处理 - 合并原Playlist类功能
    static async processUrl(url: string): Promise<{ success: boolean; mediaItem?: MediaItem; error?: string }> {
        try {
            const parsed = this.parse(url);
            let mediaInfo: any = { title: this.getTitle(url), url: parsed.cleanUrl, type: parsed.type, source: parsed.source };
            
            // B站信息获取
            if (parsed.source === 'bilibili') {
                const videoInfo = await BilibiliParser.getVideoInfo(url);
                if (videoInfo) mediaInfo = { ...mediaInfo, ...videoInfo };
            }
            
            // 本地视频缩略图生成 - 超级精简版
            if (parsed.source === 'local' && parsed.type === 'video') {
                mediaInfo.thumbnail = await new Promise(r => {
                    const v = Object.assign(document.createElement('video'), { style: 'display:none', src: parsed.cleanUrl });
                    document.body.appendChild(v);
                    v.onloadedmetadata = () => v.currentTime = Math.min(5, v.duration / 2);
                    v.onseeked = async () => {
                        const c = Object.assign(document.createElement('canvas'), { width: v.videoWidth, height: v.videoHeight });
                        c.getContext('2d')?.drawImage(v, 0, 0, c.width, c.height);
                        document.body.removeChild(v);
                        r(await imageToLocalAsset(c.toDataURL('image/jpeg', 0.7)));
                    };
                    v.load();
                });
            }
            
            const mediaItem: MediaItem = {
                id: `media-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
                title: mediaInfo.title || '未知媒体', url: parsed.cleanUrl, type: mediaInfo.type || 'video',
                artist: mediaInfo.artist || '', artistIcon: mediaInfo.artistIcon || '',
                thumbnail: mediaInfo.thumbnail || '', duration: mediaInfo.duration || '', isPinned: false,
                ...(parsed.startTime !== undefined && { startTime: parsed.startTime }),
                ...(parsed.endTime !== undefined && { endTime: parsed.endTime }),
                ...(mediaInfo.aid && { aid: mediaInfo.aid }),
                ...(mediaInfo.bvid && { bvid: mediaInfo.bvid }),
                ...(mediaInfo.cid && { cid: mediaInfo.cid })
            };
            
            return { success: true, mediaItem };
        } catch (error) {
            return { success: false, error: this.handleError(error, 'URL处理') };
        }
    }

    // 批量处理
    static async processUrls(urls: string[]): Promise<{ success: boolean; mediaItems: MediaItem[]; errors: string[] }> {
        const results = await Promise.allSettled(urls.map(url => this.processUrl(url)));
        const mediaItems: MediaItem[] = [], errors: string[] = [];
        
        results.forEach((result, index) => {
            if (result.status === 'fulfilled' && result.value.success) {
                mediaItems.push(result.value.mediaItem!);
            } else {
                const error = result.status === 'rejected' ? result.reason?.message || '未知错误' : result.value.error || '处理失败';
                errors.push(`URL[${index}]: ${error}`);
            }
        });
        
        return { success: mediaItems.length > 0, mediaItems, errors };
    }

    // 查找支持文件
    static async findSupportFile(mediaUrl: string, exts: string[]): Promise<string | null> {
        if (!mediaUrl) return null;
        
        if (mediaUrl.startsWith('file://')) {
            const { pathname } = new URL(mediaUrl);
            const path = decodeURIComponent(pathname);
            const lastDotIndex = path.lastIndexOf('.');
            if (lastDotIndex === -1) return null;
            
            const dir = path.substring(0, path.lastIndexOf('/'));
            const basename = path.substring(path.lastIndexOf('/') + 1, lastDotIndex);
            
            for (const ext of exts) {
                const supportUrl = `file://${dir}/${encodeURIComponent(basename)}${ext}`;
                try {
                    const response = await fetch(supportUrl, { method: 'HEAD' });
                    if (response.ok) return supportUrl;
                } catch {}
            }
        } else if (AListManager.parsePathFromUrl(mediaUrl)) {
            const path = AListManager.parsePathFromUrl(mediaUrl);
            if (path) return AListManager.getSupportFileLink(path, exts);
        }
        return null;
    }

    // 兼容方法
    static getStandardUrl = (item: any, config: any): string => item?.url || '';
    static withTime = (url: string, startTime?: number, endTime?: number): string => 
        startTime ? this.addTime(url, startTime, endTime) : url;
}

/**
 * 播放器类 - 极简版
 */
export class Player {
    // 统一处理入口 - 合并所有场景
    static async handle(input: string | MediaItem, currentItem: any, config: any, isPlaylistItem = false): Promise<{
        action: 'play' | 'seek'; playableUrl?: string; startTime?: number; endTime?: number; mediaInfo?: any; error?: string;
    }> {
        try {
            // 处理输入 - 统一为URL
            let url: string;
            let mediaItem: MediaItem | undefined;
            
            if (typeof input === 'string') {
                url = input;
            } else {
                mediaItem = input;
                url = mediaItem.url;
                if (mediaItem.startTime !== undefined) {
                    const timeParam = mediaItem.endTime !== undefined ? 
                        `${mediaItem.startTime}-${mediaItem.endTime}` : String(mediaItem.startTime);
                    url += `${url.includes('?') ? '&' : '?'}t=${timeParam}`;
                }
            }
            
            const parsed = Media.parse(url);
            
            // 判断是否当前媒体
            if (this.isSameMedia(currentItem, parsed.cleanUrl)) {
                return { action: 'seek', startTime: parsed.startTime, endTime: parsed.endTime };
            }
            
            // 获取播放地址
            const playableUrl = await this.getPlayableUrl(parsed.cleanUrl, parsed, config);
            
            // 构建媒体信息
            const mediaInfo = isPlaylistItem && mediaItem ? {
                title: mediaItem.title, type: mediaItem.type, source: mediaItem.source || 'standard',
                artist: mediaItem.artist, artistIcon: mediaItem.artistIcon, thumbnail: mediaItem.thumbnail,
                duration: mediaItem.duration, aid: mediaItem.aid, bvid: mediaItem.bvid, cid: mediaItem.cid
            } : {
                title: Media.getTitle(parsed.cleanUrl), type: parsed.type, source: parsed.source
            };
            
            return { action: 'play', playableUrl, startTime: parsed.startTime, endTime: parsed.endTime, mediaInfo };
        } catch (error) {
            return { action: 'play', error: Media.handleError(error, '媒体处理') };
        }
    }

    // 简化的辅助方法
    static isSameMedia(currentItem: any, url: string): boolean {
        if (!currentItem?.url) return false;
        const current = Media.parse(currentItem.url);
        const new_ = Media.parse(url);
        if (current.cleanUrl === new_.cleanUrl) return true;
        
        // B站分P判断
        if (new_.source === 'bilibili' && currentItem.bvid) {
            const bvMatch = url.match(BV_REGEX);
            if (!bvMatch || bvMatch[0].toUpperCase() !== currentItem.bvid.toUpperCase()) return false;
            const urlPage = parseInt(url.match(/[\?&]p=(\d+)/)?.[1] || '1', 10);
            const currentPage = parseInt(currentItem.id?.match(/-p(\d+)$/)?.[1] || '1', 10);
            return urlPage === currentPage;
        }
        return false;
    }
    
    static async getPlayableUrl(url: string, parsed: any, config: any): Promise<string> {
        if (parsed.source === 'bilibili') {
            try {
                const bvMatch = url.match(BV_REGEX);
                if (!bvMatch) return url;
                const videoInfo = await BilibiliParser.getVideoInfo(url);
                if (!videoInfo?.cid) return url;
                const stream = await BilibiliParser.getProcessedVideoStream(bvMatch[0], videoInfo.cid, 0, config);
                return stream.dash?.video?.[0]?.baseUrl || url;
            } catch (error) {
                console.warn('获取B站播放地址失败:', error);
                return url;
            }
        }
        
        if (parsed.source === 'alist') {
            try {
                if (!parsed.path) throw new Error('AList路径为空');
                return await AListManager.getFileLink(parsed.path);
            } catch (error) {
                console.warn('获取AList播放地址失败:', error);
                throw error;
            }
        }
        
        return url;
    }
}

/**
 * 播放系统 - 极简版
 */
export async function openPlayer(mediaUrl: string, playerType: PlayerType, playerPath?: string): Promise<string | void> {
    try {
        const parsed = Media.parse(mediaUrl);
        
        if (playerType === PlayerType.BROWSER) {
            const urlWithTimestamp = parsed.startTime !== undefined ? 
                Media.addTime(parsed.cleanUrl, parsed.startTime) : parsed.cleanUrl;
            
            if (window.navigator.userAgent.includes('Electron')) {
                const { shell } = require('electron');
                await shell.openExternal(urlWithTimestamp);
            } else {
                window.open(urlWithTimestamp, '_blank');
            }
            return;
        }
        
        const cleanPath = playerPath?.replace(/^["']|["']$/g, '');
        if (!cleanPath) return "请在设置中配置播放器路径";
        
        const timeParam = parsed.startTime !== undefined ? ` /seek=${Media.fmt(parsed.startTime, {anchor: true})}` : '';
        const processedUrl = parsed.cleanUrl.startsWith('file://') ? 
            parsed.cleanUrl.substring(8).replace(/\//g, '\\') : parsed.cleanUrl;
        
        if (window.navigator.userAgent.includes('Electron')) {
            const { exec } = require('child_process');
            const os = require('os');
            if (os.platform() === 'win32') {
                exec(`"${cleanPath}" "${processedUrl}"${timeParam} /current`);
            } else if (os.platform() === 'darwin') {
                exec(`open -a "${cleanPath}" "${processedUrl}"`);
            }
        } else {
            await fetch('/api/system/execCommand', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ command: `"${cleanPath}" "${processedUrl}"${timeParam} /current` })
            });
        }
    } catch (error) {
        return `播放失败: ${Media.handleError(error, '外部播放器')}`;
    }
}

export async function play(options: any, player: any, config: any, setCurrentItem: (item: any) => void, i18n?: any): Promise<void> {
    if (!options?.url) {
        showMsg(i18n?.mediaPlayerTab?.play?.invalidOptions || "无效的播放选项");
        return;
    }

    try {
        const currentItem = Media.createItem(options);
        setCurrentItem(currentItem);
        
        if (config.settings.playerType !== PlayerType.BUILT_IN) {
            const error = await openPlayer(options.url, config.settings.playerType as PlayerType, config.settings.playerPath);
            if (error) showMsg(error);
            return;
        }

        let playUrl = options.url;
        if (options.source === 'alist' && options.sourcePath) {
            try {
                playUrl = await AListManager.getFileLink(options.sourcePath);
            } catch (error) {
                console.error('获取AList播放链接失败:', error);
                throw new Error('获取播放链接失败');
            }
        }

        await player.play(playUrl, {
            type: options.type || 'video', title: options.title || '未知视频',
            startTime: options.startTime, endTime: options.endTime, isLoop: options.isLoop,
            loopCount: options.loopCount, headers: options.headers, cid: options.cid, biliDash: options.biliDash
        });
    } catch (error) {
        await handleMediaError(error, options, player, config, i18n);
    }
}

export async function handleMediaError(error: any, currentItem: any, player: any, config: any, i18n?: any): Promise<void> {
    try {
        if (currentItem?.type === 'bilibili' && currentItem.bvid && currentItem.cid) {
            const streamInfo = await BilibiliParser.getProcessedVideoStream(currentItem.bvid, currentItem.cid, 120, config);
            if (player && streamInfo?.dash?.video?.length) {
                const videoUrl = streamInfo.dash.video[0].baseUrl;
                await player.play(videoUrl, {
                    headers: streamInfo.headers, title: currentItem.title, cid: currentItem.cid,
                    type: 'bilibili-dash', biliDash: streamInfo.dash
                });
                return;
            }
        }
        showMsg(i18n?.mediaPlayerTab?.play?.failMessage || 
            `播放失败: ${error instanceof Error ? error.message : String(error)}`);
    } catch (e) {
        console.error('处理媒体错误失败:', e);
        showMsg(i18n?.mediaPlayerTab?.stream?.playbackError || "媒体播放出错");
    }
}

export function registerGlobalPlayer(currentItem: any, player: any): void {
    if (typeof window === 'undefined') return;
    try {
        console.info('[player] 注册全局播放器对象, 当前媒体:', currentItem);
        (window as any).siyuanMediaPlayer = {
            player, currentItem,
            seekTo: (time: number) => {
                console.info('[player] 执行跳转:', time);
                return typeof player.seekTo === 'function' ? (player.seekTo(time), true) : false;
            },
            setLoopSegment: (start: number, end: number) => {
                console.info('[player] 设置循环片段:', start, end);
                return typeof player.setPlayTime === 'function' ? (player.setPlayTime(start, end), true) : false;
            },
            getCurrentMedia: () => currentItem,
            getCurrentTime: () => player.getCurrentTime?.() || 0
        };
    } catch (error) {
        console.error('[player] 注册全局播放器失败:', error);
    }
}

export function createLinkClickHandler(playerAPI: any, config: any, openTab: () => void, 
    waitForElement: (selector: string, timeout?: number) => Promise<Element | null>, i18n?: any): (e: MouseEvent) => Promise<void> {
    return async (e: MouseEvent) => {
        const target = e.target as HTMLElement;
        const urlStr = target.getAttribute('data-href');
        
        if (!target.matches('span[data-type="a"]') || !urlStr) return;
        
        const isBilibili = BILIBILI_REGEX.test(urlStr);
        const isMediaLink = MEDIA_EXTS.some(ext => urlStr.toLowerCase().split('?')[0].endsWith(ext));
        if (!isBilibili && !isMediaLink) return;
        
        e.preventDefault();
        e.stopPropagation();
        
        try {
            const playerType = e.ctrlKey ? PlayerType.BROWSER : config.settings.playerType;
            
            if (playerType === PlayerType.POT_PLAYER || playerType === PlayerType.BROWSER) {
                const error = await openPlayer(urlStr, playerType, config.settings.playerPath);
                if (error) showMsg(error);
                return;
            }
            
            if (!document.querySelector('.media-player-tab')) {
                openTab();
                await waitForElement('.media-player-tab', 2000);
                await new Promise(resolve => setTimeout(resolve, 500));
            }
            
            // AList处理
            let processedUrl = urlStr;
            const parsed = Media.parse(urlStr);
            if (parsed.source === 'alist') {
                if (!await AListManager.initFromConfig(config)) {
                    showMsg("未连接到AList服务器，请先在设置中配置AList");
                    return;
                }
                const result = await AListManager.handleAListMediaLink(urlStr, { startTime: parsed.startTime, endTime: parsed.endTime });
                if (result.success && result.mediaItem) {
                    result.mediaItem.startTime = parsed.startTime;
                    result.mediaItem.endTime = parsed.endTime;
                    processedUrl = result.mediaItem.url;
                } else if (result.error) {
                    showMsg(`处理AList媒体失败: ${result.error}`);
                    return;
                }
            }
            
            // 统一处理
            const result = await Player.handle(processedUrl, playerAPI.getCurrentMedia?.(), config);
            
            if (result.error) {
                showMsg(`播放失败: ${result.error}`);
                return;
            }
            
            if (result.action === 'seek') {
                if (result.startTime !== undefined) {
                    if (result.endTime !== undefined) {
                        playerAPI.setPlayTime?.(result.startTime, result.endTime);
                    } else {
                        playerAPI.seekTo?.(result.startTime);
                    }
                }
            } else {
                await play({
                    url: result.playableUrl!, title: result.mediaInfo?.title || '未知媒体',
                    type: result.mediaInfo?.type || 'video', startTime: result.startTime, endTime: result.endTime
                }, playerAPI, config, (item) => {
                    window.dispatchEvent(new CustomEvent('siyuanMediaPlayerUpdate', { 
                        detail: { player: playerAPI, currentItem: item }
                    }));
                }, i18n);
            }
        } catch (error) {
            console.error('[player] 链接点击处理失败:', error);
            showMsg(`播放失败: ${Media.handleError(error, '链接点击')}`);
        }
    };
} 