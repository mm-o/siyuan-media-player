import { MediaItem, PlayerType } from "./types";
import { BilibiliParser } from "./bilibili";
import { AListManager } from './alist';
import { imageToLocalAsset } from './document';
import { showMessage } from 'siyuan';

/** 常量 */
const AUDIO_EXTS = ['.mp3', '.wav', '.aac', '.m4a', '.flac', '.ogg'];
const VIDEO_EXTS = ['.mp4', '.webm', '.ogg', '.mov', '.m4v', '.mkv', '.avi', '.flv', '.wmv'];
const MEDIA_EXTS = [...AUDIO_EXTS, ...VIDEO_EXTS];
const BILIBILI_REGEX = /bilibili\.com\/video\/|\/BV[a-zA-Z0-9]+/;
const BV_REGEX = /BV[a-zA-Z0-9]+/;
const TIME_REGEX = /[?&]t=([^&]+)/;

/** 导出常量和工具函数 */
export const EXT = { AUDIO: AUDIO_EXTS, VIDEO: VIDEO_EXTS, MEDIA: MEDIA_EXTS };
export const detectMediaType = (url: string) => AUDIO_EXTS.some(ext => url.toLowerCase().endsWith(ext)) ? 'audio' : 'video';

const isMedia = (url: string) => MEDIA_EXTS.some(ext => url.toLowerCase().split('?')[0].endsWith(ext));
const isBilibili = (url: string) => BILIBILI_REGEX.test(url);
const error = (msg: string, ctx = '') => { console.error(`[player] ${ctx}:`, msg); showMessage(msg); return msg; };

/** 媒体处理核心类 */
export class Media {
    /** 解析URL */
    static parse(url: string) {
        if (!url) return { url: '', type: 'video', source: 'standard' };

        // 提取时间参数
        const timeMatch = url.match(TIME_REGEX);
        let startTime: number | undefined, endTime: number | undefined;
        if (timeMatch) {
            const timeStr = timeMatch[1];
            if (timeStr.includes('-')) {
                [startTime, endTime] = timeStr.split('-').map(Number).filter(n => !isNaN(n));
            } else {
                const time = Number(timeStr);
                if (!isNaN(time)) startTime = time;
            }
        }

        // 清理URL
        const cleanUrl = url.replace(/[?&]t=[^&]+/, '').replace(/[?&]$/, '');
        const type = detectMediaType(url);

        // 判断来源
        if (isBilibili(url)) {
            const bv = url.match(BV_REGEX)?.[0];
            const page = url.match(/[?&]p=(\d+)/)?.[1];
            return {
                url: bv ? `https://www.bilibili.com/video/${bv}${page ? `?p=${page}` : ''}` : cleanUrl,
                type: 'bilibili', source: 'bilibili', bv, page, startTime, endTime
            };
        }

        if (url.includes('/#/')) {
            return { url: cleanUrl, type, source: 'alist', path: url.split('/#/')[1]?.split('?')[0], startTime, endTime };
        }

        if (url.startsWith('file://')) {
            return { url: cleanUrl, type, source: 'local', path: url.substring(7), startTime, endTime };
        }

        return { url: cleanUrl, type, source: 'standard', startTime, endTime };
    }

    /** 创建媒体项 */
    static create(data: any): MediaItem {
        return {
            id: data.id || `media-${Date.now()}`,
            title: data.title || this.getTitle(data.url),
            url: data.url,
            type: data.type || 'video',
            thumbnail: data.thumbnail || '',
            duration: data.duration || '',
            artist: data.artist || '',
            artistIcon: data.artistIcon || '',
            startTime: data.startTime,
            endTime: data.endTime,
            bvid: data.bv || data.bvid
        };
    }

    /** 获取标题 */
    static getTitle(url: string): string {
        try {
            return decodeURIComponent(url.split('/').pop()?.split('?')[0]?.split('.')[0] || '') || '未知';
        } catch {
            return url.split(/[/\\]/).pop()?.split('.')[0] || '未知';
        }
    }

    /** 时间格式化 */
    static fmt(seconds: number): string {
        if (isNaN(seconds) || seconds < 0) return '0:00';
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = Math.floor(seconds % 60);
        return h > 0 ? `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}` : `${m}:${s.toString().padStart(2, '0')}`;
    }

    /** 添加时间参数 */
    static withTime(url: string, start: number, end?: number): string {
        const time = end ? `${start}-${end}` : String(start);
        return `${url}${url.includes('?') ? '&' : '?'}t=${time}`;
    }

    /** 获取缩略图 */
    static getThumbnail(item: any): string {
        return item?.thumbnail ||
            (item?.type === 'audio' ? '/plugins/siyuan-media-player/assets/images/audio.png' :
             item?.type === 'folder' || item?.is_dir ? '/plugins/siyuan-media-player/assets/images/folder.png' :
             '/plugins/siyuan-media-player/assets/images/video.png');
    }

    /** 查找支持文件 */
    static async findSupportFile(mediaUrl: string, exts: string[]): Promise<string | null> {
        if (!mediaUrl || !mediaUrl.startsWith('file://')) return null;

        try {
            const path = decodeURIComponent(mediaUrl.substring(7));
            const lastDot = path.lastIndexOf('.');
            if (lastDot === -1) return null;

            const dir = path.substring(0, path.lastIndexOf('/'));
            const base = path.substring(path.lastIndexOf('/') + 1, lastDot);

            for (const ext of exts) {
                const supportUrl = `file://${dir}/${encodeURIComponent(base)}${ext}`;
                try {
                    const response = await fetch(supportUrl, { method: 'HEAD' });
                    if (response.ok) return supportUrl;
                } catch {}
            }
        } catch {}
        return null;
    }
    /** 处理URL */
    static async processUrl(url: string): Promise<{ success: boolean; mediaItem?: MediaItem; error?: string }> {
        try {
            const parsed = this.parse(url);
            let info: any = { title: this.getTitle(url), url: parsed.url, type: parsed.type };

            // B站信息获取
            if (parsed.source === 'bilibili' && parsed.bv) {
                try {
                    const biliInfo = await BilibiliParser.getVideoInfo(url);
                    if (biliInfo) info = { ...info, ...biliInfo };
                } catch (e) { console.warn('B站信息获取失败:', e); }
            }

            // 本地视频缩略图
            if (parsed.source === 'local' && parsed.type === 'video') {
                try {
                    info.thumbnail = await this.generateThumbnail(parsed.url);
                } catch (e) { console.warn('缩略图生成失败:', e); }
            }

            return { success: true, mediaItem: this.create({ ...info, ...parsed }) };
        } catch (e) {
            return { success: false, error: error(String(e), 'processUrl') };
        }
    }

    /** 生成缩略图 */
    private static generateThumbnail(url: string): Promise<string> {
        return new Promise(resolve => {
            const video = document.createElement('video');
            video.style.display = 'none';
            video.src = url;
            document.body.appendChild(video);
            video.onloadedmetadata = () => video.currentTime = Math.min(5, video.duration / 2);
            video.onseeked = async () => {
                const canvas = document.createElement('canvas');
                canvas.width = video.videoWidth;
                canvas.height = video.videoHeight;
                canvas.getContext('2d')?.drawImage(video, 0, 0);
                document.body.removeChild(video);
                resolve(await imageToLocalAsset(canvas.toDataURL('image/jpeg', 0.7)));
            };
            video.load();
        });
    }
}

/** 播放器核心类 */
export class Player {
    /** 判断是否同一媒体需要丝滑跳转 */
    static isSameMedia(currentItem: any, clickedItem: any, hadTab: boolean): boolean {
        return this.isSame(currentItem, clickedItem) && hadTab;
    }

    /** 判断是否同一媒体 */
    private static isSame(current: any, clicked: any): boolean {
        return current?.title?.trim() === clicked?.title?.trim() && current.title?.trim();
    }

    /** 获取播放URL */
    private static async getPlayUrl(parsed: any, config: any): Promise<string> {
        if (parsed.source === 'bilibili' && parsed.bv) {
            try {
                const info = await BilibiliParser.getVideoInfo(`https://www.bilibili.com/video/${parsed.bv}`) as any;
                if (info?.cid) {
                    const stream = await BilibiliParser.getProcessedVideoStream(parsed.bv, info.cid, 0, config);
                    return stream.dash?.video?.[0]?.baseUrl || parsed.url;
                }
            } catch (e) { console.warn('B站流获取失败:', e); }
        }

        if (parsed.source === 'alist' && parsed.path) {
            return await AListManager.getFileLink(parsed.path);
        }

        return parsed.url;
    }
}

/** 外部播放器 */
export async function openPlayer(url: string, type: PlayerType, path?: string): Promise<string | void> {
    try {
        const parsed = Media.parse(url);
        const playUrl = parsed.startTime ? Media.withTime(parsed.url, parsed.startTime) : parsed.url;

        if (type === PlayerType.BROWSER) {
            if (window.navigator.userAgent.includes('Electron')) {
                require('electron').shell.openExternal(playUrl);
            } else {
                window.open(playUrl, '_blank');
            }
            return;
        }

        if (!path) return "请配置播放器路径";

        const cleanPath = path.replace(/^["']|["']$/g, '');
        const timeParam = parsed.startTime ? ` /seek=${Media.fmt(parsed.startTime)}` : '';
        const fileUrl = parsed.url.startsWith('file://') ? parsed.url.substring(8).replace(/\//g, '\\') : parsed.url;
        const command = `"${cleanPath}" "${fileUrl}"${timeParam}`;

        if (window.navigator.userAgent.includes('Electron')) {
            require('child_process').exec(command);
        } else {
            await fetch('/api/system/execCommand', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ command })
            });
        }
    } catch (e) {
        return error(String(e), 'openPlayer');
    }
}

/** 播放媒体 */
export async function play(options: any, player: any, config: any, setItem: (item: any) => void): Promise<void> {
    if (!options?.url) { error('无效播放选项', 'play'); return; }

    try {
        const item = Media.create(options);
        setItem(item);

        // 外部播放器
        if (config.settings.playerType !== PlayerType.BUILT_IN) {
            const err = await openPlayer(options.url, config.settings.playerType, config.settings.playerPath);
            if (err) showMessage(err);
            return;
        }

        // 获取播放URL
        let playUrl = options.url;
        if (options.source === 'alist' && options.sourcePath) {
            playUrl = await AListManager.getFileLink(options.sourcePath);
        }

        // 播放
        await player.play(playUrl, {
            type: options.type || 'video',
            title: options.title || '未知',
            startTime: options.startTime,
            endTime: options.endTime
        });
    } catch (e) {
        error(String(e), 'play');
    }
}

/** 注册全局播放器 */
export function registerGlobalPlayer(currentItem: any, player: any): void {
    if (typeof window === 'undefined') return;
    try {
        (window as any).siyuanMediaPlayer = {
            player, currentItem,
            seekTo: (time: number) => typeof player.seekTo === 'function' ? (player.seekTo(time), true) : false,
            setLoopSegment: (start: number, end: number) => typeof player.setPlayTime === 'function' ? (player.setPlayTime(start, end), true) : false,
            getCurrentMedia: () => currentItem,
            getCurrentTime: () => player.getCurrentTime?.() || 0
        };
    } catch (e) {
        error(String(e), 'registerGlobalPlayer');
    }
}

/** 创建链接点击处理器 */
export function createLinkClickHandler(playerAPI: any, config: any, openTab: () => void, playlistPlay?: any): (e: MouseEvent) => Promise<void> {
    return async (e: MouseEvent) => {
        const target = e.target as HTMLElement;
        const url = target.getAttribute('data-href');

        if (!target.matches('span[data-type="a"]') || !url) return;
        if (!isBilibili(url) && !isMedia(url)) return;

        e.preventDefault();
        e.stopPropagation();

        try {
            const type = e.ctrlKey ? PlayerType.BROWSER : config.settings.playerType;

            // 外部播放器
            if (type === PlayerType.POT_PLAYER || type === PlayerType.BROWSER) {
                const err = await openPlayer(url, type, config.settings.playerPath);
                if (err) showMessage(err);
                return;
            }

            // 内置播放器
            const hasTab = !!document.querySelector('.media-player-tab');
            const parsed = Media.parse(url);
            const currentItem = playerAPI.getCurrentMedia?.();

            // 获取媒体信息
            const processResult = await Media.processUrl(url);
            const mediaItem = processResult.success && processResult.mediaItem ? processResult.mediaItem :
                             { title: Media.getTitle(parsed.url), type: parsed.type, url: parsed.url };

            // 判断是否同一媒体需要丝滑跳转
            if (Player.isSameMedia(currentItem, mediaItem, hasTab)) {
                if (parsed.endTime !== undefined) {
                    playerAPI.setPlayTime?.(parsed.startTime, parsed.endTime);
                } else {
                    playerAPI.seekTo?.(parsed.startTime);
                }
                console.log(`丝滑跳转: ${Media.fmt(parsed.startTime)}${parsed.endTime ? `-${Media.fmt(parsed.endTime)}` : ''}`);
                return;
            }

            // 打开tab并播放
            if (!hasTab) {
                openTab();
                await new Promise(resolve => setTimeout(resolve, 800));
            }

            // 使用播放列表的play函数
            if (playlistPlay) {
                await playlistPlay(mediaItem, parsed.startTime, parsed.endTime);
            }
        } catch (e) {
            error(String(e), 'linkClick');
        }
    };
}