import { MediaItem, MediaInfo, PlaylistConfig, PlayerType } from "./types";
import { BilibiliParser } from "./bilibili";
import { MediaUtils } from './PlayList';
import { AListManager } from './alist';
import { imageToLocalAsset } from './document';

// 常量
const CACHE_PREFIX = 'media_info_';
const CACHE_EXPIRY = 24 * 60 * 60 * 1000; // 24小时
const MAX_RETRIES = 2;
const LOAD_TIMEOUT = 15000; // 15秒

// 默认缩略图 - 统一PNG资源路径
export const DEFAULT_THUMBNAILS = {
    audio: '/plugins/siyuan-media-player/assets/images/audio.png',
    video: '/plugins/siyuan-media-player/assets/images/video.png',
    folder: '/plugins/siyuan-media-player/assets/images/folder.png'
};

/**
 * 获取媒体项的缩略图URL - 统一fallback逻辑
 */
export const getThumbnailUrl = (item: MediaItem | any): string => {
    if (item?.thumbnail) return item.thumbnail;
    if (item?.type === 'audio') return DEFAULT_THUMBNAILS.audio;
    if (item?.type === 'folder' || item?.is_dir) return DEFAULT_THUMBNAILS.folder;
    return DEFAULT_THUMBNAILS.video;
};

/**
 * 媒体资源管理器
 */
export class MediaManager {
    // 缓存操作
    private static getCachedInfo(url: string): MediaInfo | null {
        try {
            const cached = localStorage.getItem(`${CACHE_PREFIX}${url}`);
            if (!cached) return null;
            
            const { timestamp, info } = JSON.parse(cached);
            if (Date.now() - timestamp > CACHE_EXPIRY) {
                localStorage.removeItem(`${CACHE_PREFIX}${url}`);
                return null;
            }
            
            return info;
        } catch {
            return null;
        }
    }
    
    private static cacheInfo(url: string, info: MediaInfo | null): void {
        if (!info) return;
        try {
            localStorage.setItem(`${CACHE_PREFIX}${url}`, JSON.stringify({
                timestamp: Date.now(), info
            }));
        } catch (e) {
            console.warn('缓存媒体信息失败:', e);
        }
    }

    static cleanupCache(): void {
        try {
            const now = Date.now();
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (!key?.startsWith(CACHE_PREFIX)) continue;
                
                try {
                    const data = JSON.parse(localStorage.getItem(key) || '');
                    if (now - data.timestamp > CACHE_EXPIRY) {
                        localStorage.removeItem(key);
                    }
                } catch {
                    localStorage.removeItem(key);
                }
            }
        } catch (e) {
            console.warn('清理缓存失败:', e);
        }
    }

    // 媒体信息获取
    private static async getMediaInfoFromElement(mediaUrl: string, retryCount = 0): Promise<MediaInfo> {
        return new Promise((resolve) => {
            const fileUrl = MediaUtils.toFile(mediaUrl);
            const type = MediaUtils.getMediaInfo(mediaUrl).type;
            const mediaEl = document.createElement(type === 'audio' ? 'audio' : 'video');
            mediaEl.style.display = 'none';
            document.body.appendChild(mediaEl);

            let timeoutId: number;
            
            // 基本信息（用于超时或错误情况）
            const basicInfo = {
                id: '',
                title: MediaUtils.getTitle(mediaUrl),
                duration: '00:00',
                thumbnail: type === 'audio' ? DEFAULT_THUMBNAILS.audio : '',
                artist: '',
                artistIcon: '',
                url: fileUrl,
                type: type
            };

            const cleanup = () => {
                clearTimeout(timeoutId);
                mediaEl.removeEventListener('loadedmetadata', handleMetadata);
                mediaEl.removeEventListener('error', handleError);
                mediaEl.parentNode?.removeChild(mediaEl);
            };

            const handleMetadata = async () => {
                const duration = MediaUtils.fmt(mediaEl.duration);
                let thumbnail = '';
                
                if (mediaEl instanceof HTMLVideoElement) {
                    try {
                        mediaEl.currentTime = Math.min(5, mediaEl.duration / 2);
                        await new Promise(resolve => {
                            mediaEl.addEventListener('seeked', function onSeeked() {
                                mediaEl.removeEventListener('seeked', onSeeked);
                                resolve(null);
                            });
                        });
                        
                        const canvas = document.createElement('canvas');
                        canvas.width = mediaEl.videoWidth;
                        canvas.height = mediaEl.videoHeight;
                        canvas.getContext('2d')?.drawImage(mediaEl, 0, 0, canvas.width, canvas.height);
                        const base64Thumbnail = canvas.toDataURL('image/jpeg', 0.7);
                        
                        // 立即转换base64为本地资源，避免存储大量base64字符串
                        thumbnail = await imageToLocalAsset(base64Thumbnail);
                    } catch {}
                }

                cleanup();
                resolve({...basicInfo, duration, thumbnail});
            };

            const handleError = () => {
                cleanup();
                resolve(retryCount < MAX_RETRIES 
                    ? this.getMediaInfoFromElement(mediaUrl, retryCount + 1) 
                    : basicInfo);
            };

            timeoutId = window.setTimeout(() => {
                cleanup();
                resolve(retryCount < MAX_RETRIES 
                    ? this.getMediaInfoFromElement(mediaUrl, retryCount + 1) 
                    : basicInfo);
            }, LOAD_TIMEOUT);

            mediaEl.addEventListener('loadedmetadata', handleMetadata);
            mediaEl.addEventListener('error', handleError);
            mediaEl.src = fileUrl;
            mediaEl.load();
        });
    }

    // 媒体项管理
    static async createMediaItem(mediaUrl: string, savedInfo?: { aid?: string; bvid?: string; cid?: string }): Promise<MediaItem | null> {
        try {
            // 解析并移除时间戳
            const { mediaUrl: clean, startTime, endTime } = MediaUtils.parseTime(mediaUrl);
            
            const fileUrl = MediaUtils.toFile(clean);
            const isBili = fileUrl.includes('bilibili.com');
            const type = MediaUtils.getMediaInfo(fileUrl).type;
                
            // 获取媒体信息
            let info = this.getCachedInfo(fileUrl) || 
                (isBili ? await BilibiliParser.getVideoInfo(fileUrl) 
                      : await this.getMediaInfoFromElement(clean));
                
            // 合并信息并缓存
            if (!info) return null;
            if (savedInfo) info = { ...info, ...savedInfo };
            
            // 处理遗留的base64缩略图，转换为本地资源
            if (info.thumbnail && info.thumbnail.startsWith('data:image/')) {
                try {
                    info.thumbnail = await imageToLocalAsset(info.thumbnail);
                } catch (e) {
                    console.warn('转换base64缩略图失败，使用默认缩略图:', e);
                    info.thumbnail = type === 'audio' ? DEFAULT_THUMBNAILS.audio : '';
                }
            }
            
            this.cacheInfo(fileUrl, info);
            
            // 创建媒体项
            return {
                id: `media-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
                title: info.title,
                artist: info.artist || '',
                artistIcon: info.artistIcon || '',
                duration: info.duration,
                thumbnail: info.thumbnail || (type === 'audio' ? DEFAULT_THUMBNAILS.audio : ''),
                url: fileUrl,
                type,
                isPinned: false,
                ...(startTime !== undefined && { startTime }),
                ...(endTime !== undefined && { endTime }),
                ...(info.aid && { aid: info.aid }),
                ...(info.bvid && { bvid: info.bvid }),
                ...(info.cid && { cid: info.cid })
            };
        } catch (e) {
            console.error('创建媒体项失败:', e);
            return null;
        }
    }

    static getMediaInfoFromItems(items: MediaItem[]): PlaylistConfig['items'] {
        return items.map(item => ({
            id: item.id,
            title: item.title,
            url: item.url,
            type: item.type,
            ...(item.aid && { aid: item.aid }),
            ...(item.bvid && { bvid: item.bvid }),
            ...(item.cid && { cid: item.cid })
        }));
    }

    static async createMediaItems(items: PlaylistConfig['items']): Promise<MediaItem[]> {
        const results = await Promise.all(items.map(item => this.createMediaItem(item.url, item)));
        return results.filter(Boolean) as MediaItem[];
    }
}

/**
 * 播放媒体处理相关函数
 */

// 通用工具函数
const showMsg = (msg: string) => {
    const { showMessage } = require('siyuan');
    showMessage(msg);
};

// 统一播放器对象注册
export function registerGlobalPlayer(currentItem: any, player: any): void {
    if (typeof window === 'undefined') return;
    
    try {
        console.info('[media] 注册全局播放器对象, 当前媒体:', currentItem);
        
    (window as any).siyuanMediaPlayer = {
            player,
        currentItem,
            seekTo: (time: number) => {
                console.info('[media] 执行跳转:', time);
                if (typeof player.seekTo === 'function') {
                    player.seekTo(time);
                    return true;
                }
                return false;
            },
            setLoopSegment: (start: number, end: number) => {
                console.info('[media] 设置循环片段:', start, end);
                if (typeof player.setPlayTime === 'function') {
                    player.setPlayTime(start, end);
                    return true;
                }
                return false;
            },
            getCurrentMedia: () => currentItem,
            getCurrentTime: () => player.getCurrentTime?.() || 0
        };
    } catch (error) {
        console.error('[media] 注册全局播放器失败:', error);
    }
}

// 从选项构建媒体项
export function createMediaItemFromOptions(options: any): any {
    return {
        id: options.id || `item-${Date.now()}`,
        title: options.title || '未知媒体',
        url: options.url,
        type: ['bilibili-dash', 'bilibili'].includes(options.type) ? 'bilibili' : 'video',
        artist: options.artist || '',
        artistIcon: options.artistIcon || '',
        thumbnail: options.thumbnail || '',
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

// 使用外部播放器打开媒体 - 合并PotPlayer和浏览器逻辑
export async function openWithExternalPlayer(
    mediaUrl: string, 
    playerType: PlayerType, 
    playerPath?: string
): Promise<string | void> {
    try {
        const { mediaUrl: parsedUrl, startTime } = MediaUtils.parseTime(mediaUrl);
        
        // 浏览器打开
        if (playerType === PlayerType.BROWSER) {
            const urlWithTimestamp = startTime !== undefined ? MediaUtils.withTime(parsedUrl, startTime) : parsedUrl;
            
            if (window.navigator.userAgent.includes('Electron')) {
                const { shell } = require('electron');
                await shell.openExternal(urlWithTimestamp);
            } else {
                window.open(urlWithTimestamp, '_blank');
            }
            return;
        }
        
        // PotPlayer打开
        const cleanPath = playerPath?.replace(/^["']|["']$/g, '');
        if (!cleanPath) return "请在设置中配置播放器路径";
        
        const timeParam = startTime !== undefined ? ` /seek=${MediaUtils.fmt(startTime, {anchor: true})}` : '';
        const processedUrl = parsedUrl.startsWith('file://') 
            ? parsedUrl.substring(8).replace(/\//g, '\\') 
            : parsedUrl;
        
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
        return `播放失败: ${error instanceof Error ? error.message : String(error)}`;
    }
}

// 统一错误处理
export async function handleMediaError(
    error: any, 
    currentItem: any, 
    player: any, 
    config: any, 
    i18n?: any
): Promise<void> {
    try {
        // 处理B站错误
        if (currentItem?.type === 'bilibili' && currentItem.bvid && currentItem.cid) {
            // 尝试使用高质量设置重新获取流
            const streamInfo = await BilibiliParser.getProcessedVideoStream(
                currentItem.bvid, 
                currentItem.cid, 
                120, // 强制使用更高质量尝试修复播放
                config
            );
        
            if (player && streamInfo?.dash?.video?.length) {
                // 使用第一个视频流
                const videoUrl = streamInfo.dash.video[0].baseUrl;
                await player.play(videoUrl, {
                    headers: streamInfo.headers,
                    title: currentItem.title,
                    cid: currentItem.cid,
                    type: 'bilibili-dash',
                    biliDash: streamInfo.dash
                });
                return;
            }
        }
        
        // 通用错误处理
        showMsg(i18n?.mediaPlayerTab?.play?.failMessage || 
            `播放失败: ${error instanceof Error ? error.message : String(error)}`);
    } catch (e) {
        console.error('处理媒体错误失败:', e);
        showMsg(i18n?.mediaPlayerTab?.stream?.playbackError || "媒体播放出错");
    }
}

/**
 * 播放媒体 - 统一的媒体播放入口
 */
export async function playMedia(
    options: any,
    player: any,
    config: any,
    setCurrentItem: (item: any) => void,
    i18n?: any
): Promise<void> {
    if (!options?.url) {
        showMsg(i18n?.mediaPlayerTab?.play?.invalidOptions || "无效的播放选项");
        return;
    }

    try {
        // 创建媒体项并设置
        const currentItem = createMediaItemFromOptions(options);
        setCurrentItem(currentItem);
        
        // 检查是否使用外部播放器
        if (config.settings.playerType !== PlayerType.BUILT_IN) {
            const error = await openWithExternalPlayer(
                options.url, 
                config.settings.playerType as PlayerType, 
                config.settings.playerPath
            );
            if (error) showMsg(error);
            return;
        }

        // 获取实际播放URL
        let playUrl = options.url;
        if (options.source === 'alist' && options.sourcePath) {
            try {
                playUrl = await AListManager.getFileLink(options.sourcePath);
            } catch (error) {
                console.error('获取AList播放链接失败:', error);
                throw new Error('获取播放链接失败');
            }
        }

        // 使用内置播放器的播放配置
        const playConfig: any = {
            type: options.type || 'video',
            title: options.title || '未知视频',
            startTime: options.startTime,
            endTime: options.endTime,
            isLoop: options.isLoop,
            loopCount: options.loopCount,
            headers: options.headers,
            cid: options.cid,
            biliDash: options.biliDash
        };
        
        // 使用内置播放器播放
        await player.play(playUrl, playConfig);
    } catch (error) {
        await handleMediaError(error, options, player, config, i18n);
    }
}