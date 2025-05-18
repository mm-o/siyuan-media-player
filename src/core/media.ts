import { MediaItem, MediaInfo, PlaylistConfig, PlayerType } from "./types";
import { BilibiliParser } from "./bilibili";
import { fmt, url } from './utils';
import { AListManager } from './alist';

// 常量
const CACHE_PREFIX = 'media_info_';
const CACHE_EXPIRY = 24 * 60 * 60 * 1000; // 24小时
const MAX_RETRIES = 2;
const LOAD_TIMEOUT = 15000; // 15秒

// 默认缩略图
export const DEFAULT_THUMBNAILS = {
    audio: `data:image/svg+xml;charset=utf-8,<svg viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg"><path d="M628.905386 769.860427 628.905386 482.261019l169.381759-27.464779C771.308637 311.811584 645.822916 203.633728 494.993179 203.633728c-170.51599 0-308.738475 138.222485-308.738475 308.738875 0 170.516989 138.222485 308.738875 308.738475 308.738875 16.540186 0 32.756191-1.34209 48.589456-3.839397 12.391598-20.573051 34.625524-37.084856 62.858182-44.145869C613.897561 771.276467 621.429455 770.182208 628.905386 769.860427zM551.718919 228.830645l-33.079572 144.922942-33.078373 0-23.62798-144.922942C496.589896 211.497397 551.718919 228.830645 551.718919 228.830645zM494.993179 626.995689c-63.300482 0-114.622086-51.317007-114.622086-114.622886 0-63.30348 51.321604-114.622486 114.622086-114.622486 63.306478 0 114.622486 51.319006 114.622486 114.622486C609.615665 575.678482 558.299457 626.995689 494.993179 626.995689zM494.993179 424.978057c-48.20112 0-87.394147 39.192827-87.394147 87.394546 0 48.20112 39.192827 87.395546 87.394147 87.395546 48.201719 0 87.395946-39.194226 87.395946-87.395546C582.389124 464.170884 543.194698 424.978057 494.993179 424.978057zM494.993179 574.79708c-34.421063 0-62.423477-28.002015-62.423477-62.424476 0-34.421662 28.011408-62.424076 62.423477-62.424076 34.432055 0 62.416082 28.002414 62.416082 62.424076C557.409061 546.795265 529.425034 574.79708 494.993179 574.79708zM534.528574 870.531771c1.499983 8.297374 4.789753 16.008146 9.524542 22.939447-16.073102 2.058604-32.429013 3.239803-49.050144 3.239803-211.934708 0-384.347812-172.417701-384.347812-384.338419 0-211.922716 172.413104-384.338419 384.338019-384.338419 188.118456 0 345.001689 135.905456 377.892189 314.664258l-37.310503 6.059292c-29.969681-160.790984-171.236502-282.919381-340.581686-282.919381-191.084445 0-346.53365 155.451604-346.53365 346.53425 0 191.080048 155.449205 346.53425 346.53365 346.53425 12.796724 0 25.414169-0.748493 37.859731-2.104573C532.968631 861.361189 533.461497 865.948079 534.528574 870.531771zM912.096583 463.425989l0 333.227272c0 27.59629-20.573051 49.609165-52.658098 57.716668-35.234911 8.736077-69.250848-6.021917-75.997274-33.022611-6.760416-27.057655 16.31294-56.065787 51.53386-64.879811 15.920206-3.931335 31.587384-3.128879 44.698494 1.494986L879.673565 557.20001l-180.148459 32.927675-0.834434 249.757065-0.036975 0c-0.156894 23.646767-21.482435 46.868223-52.156438 54.45388-34.814196 8.759061-71.280472-7.807706-75.193819-32.597899-6.691463-26.747865 16.124068-55.470191 51.00222-64.201272 15.699356-3.904353 31.039755-3.119885 43.933013 1.402049L666.238674 503.300354 912.096583 463.425989z" fill="currentColor" style="color:var(--b3-theme-primary)"/></svg>`,
    video: `data:image/svg+xml;charset=utf-8,<svg viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg"><path d="M512 74.666667C270.933333 74.666667 74.666667 270.933333 74.666667 512S270.933333 949.333333 512 949.333333 949.333333 753.066667 949.333333 512 753.066667 74.666667 512 74.666667z m0 810.666666c-204.8 0-373.333333-168.533333-373.333333-373.333333S307.2 138.666667 512 138.666667 885.333333 307.2 885.333333 512 716.8 885.333333 512 885.333333z" fill="currentColor" style="color:var(--b3-theme-primary)"></path><path d="M512 320c-14.933333 0-32 4.266667-44.8 12.8L298.666667 458.666667c-29.866667 19.2-38.4 59.733333-19.2 89.6 4.266667 8.533333 12.8 14.933333 19.2 19.2l168.533333 125.866666c12.8 8.533333 29.866667 12.8 44.8 12.8 42.666667 0 76.8-34.133333 76.8-76.8V396.8c0-42.666667-34.133333-76.8-76.8-76.8z m12.8 308.266667c0 8.533333-4.266667 12.8-12.8 12.8-2.133333 0-4.266667 0-6.4-2.133334l-168.533333-125.866666c-4.266667-4.266667-6.4-10.666667-2.133334-17.066667 0-2.133333 2.133333-4.266667 2.133334-4.266667l168.533333-125.866666c2.133333-2.133333 4.266667-2.133333 6.4-2.133334 8.533333 0 12.8 4.266667 12.8 12.8v251.733334z" fill="currentColor" style="color:var(--b3-theme-primary)"></path></svg>`,
    folder: `data:image/svg+xml;charset=utf-8,<svg viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg"><path d="M810.666667 213.333333H631.893333L631.04 212.373333C617.706667 196.48 598.933333 186.666667 578.346667 186.666667H444.16C423.573333 186.666667 404.8 196.48 391.466667 212.373333L390.613333 213.333333H213.333333C177.92 213.333333 149.333333 241.92 149.333333 277.333333V746.666667C149.333333 782.08 177.92 810.666667 213.333333 810.666667H810.666667C846.08 810.666667 874.666667 782.08 874.666667 746.666667V277.333333C874.666667 241.92 846.08 213.333333 810.666667 213.333333zM213.333333 277.333333H432L432.746667 276.48C439.04 269.973333 446.613333 266.666667 454.4 266.666667H568.32C576.106667 266.666667 583.68 269.973333 589.973333 276.48L590.826667 277.333333H810.666667V426.666667H213.333333V277.333333z m597.333334 469.333334H213.333333V501.333333H810.666667V746.666667z" fill="currentColor" style="color:var(--b3-theme-primary)"></path></svg>`
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
            const fileUrl = url.toFile(mediaUrl);
            const type = url.type(mediaUrl);
            const mediaEl = document.createElement(type === 'audio' ? 'audio' : 'video');
            mediaEl.style.display = 'none';
            document.body.appendChild(mediaEl);

            let timeoutId: number;
            
            // 基本信息（用于超时或错误情况）
            const basicInfo = {
                id: '',
                title: url.title(mediaUrl),
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
                const duration = fmt(mediaEl.duration);
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
                        thumbnail = canvas.toDataURL('image/jpeg', 0.7);
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
            const { mediaUrl: clean, startTime, endTime } = url.parseTime(mediaUrl);
            
            const fileUrl = url.toFile(clean);
            const isBili = fileUrl.includes('bilibili.com');
            const type = url.type(fileUrl);
                
            // 获取媒体信息
            let info = this.getCachedInfo(fileUrl) || 
                (isBili ? await BilibiliParser.getVideoInfo(fileUrl) 
                      : await this.getMediaInfoFromElement(clean));
                
            // 合并信息并缓存
            if (!info) return null;
            if (savedInfo) info = { ...info, ...savedInfo };
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
                isFavorite: false,
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
        const { mediaUrl: parsedUrl, startTime } = url.parseTime(mediaUrl);
        
        // 浏览器打开
        if (playerType === PlayerType.BROWSER) {
            const urlWithTimestamp = startTime !== undefined ? url.withTime(parsedUrl, startTime) : parsedUrl;
            
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
        
        const timeParam = startTime !== undefined ? ` /seek=${fmt(startTime, {anchor: true})}` : '';
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
    configManager: any, 
    i18n?: any
): Promise<void> {
    try {
        // 处理B站错误
        if (currentItem?.type === 'bilibili' && currentItem.bvid && currentItem.cid) {
            const config = await configManager.getConfig();
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
    configManager: any,
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
        
        const config = await configManager.getConfig();
        
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
        await handleMediaError(error, options, player, configManager, i18n);
    }
}