import type { MediaItem, MediaInfo, PlaylistConfig } from "./types";
import { BilibiliParser } from "./bilibili";
import { formatDuration, getMediaType, convertToFileUrl, extractTitleFromUrl } from './utils';

// 常量定义
const CACHE_EXPIRY = 24 * 60 * 60 * 1000; // 24小时缓存有效期
const CACHE_PREFIX = 'media_info_';
const MAX_RETRIES = 2;
const LOAD_TIMEOUT = 15000; // 15秒超时

// 默认音频缩略图
const DEFAULT_AUDIO_THUMBNAIL = `data:image/svg+xml;charset=utf-8,<svg viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg"><path d="M628.905386 769.860427 628.905386 482.261019l169.381759-27.464779C771.308637 311.811584 645.822916 203.633728 494.993179 203.633728c-170.51599 0-308.738475 138.222485-308.738475 308.738875 0 170.516989 138.222485 308.738875 308.738475 308.738875 16.540186 0 32.756191-1.34209 48.589456-3.839397 12.391598-20.573051 34.625524-37.084856 62.858182-44.145869C613.897561 771.276467 621.429455 770.182208 628.905386 769.860427zM551.718919 228.830645l-33.079572 144.922942-33.078373 0-23.62798-144.922942C496.589896 211.497397 551.718919 228.830645 551.718919 228.830645zM494.993179 626.995689c-63.300482 0-114.622086-51.317007-114.622086-114.622886 0-63.30348 51.321604-114.622486 114.622086-114.622486 63.306478 0 114.622486 51.319006 114.622486 114.622486C609.615665 575.678482 558.299457 626.995689 494.993179 626.995689zM494.993179 424.978057c-48.20112 0-87.394147 39.192827-87.394147 87.394546 0 48.20112 39.192827 87.395546 87.394147 87.395546 48.201719 0 87.395946-39.194226 87.395946-87.395546C582.389124 464.170884 543.194698 424.978057 494.993179 424.978057zM494.993179 574.79708c-34.421063 0-62.423477-28.002015-62.423477-62.424476 0-34.421662 28.011408-62.424076 62.423477-62.424076 34.432055 0 62.416082 28.002414 62.416082 62.424076C557.409061 546.795265 529.425034 574.79708 494.993179 574.79708zM534.528574 870.531771c1.499983 8.297374 4.789753 16.008146 9.524542 22.939447-16.073102 2.058604-32.429013 3.239803-49.050144 3.239803-211.934708 0-384.347812-172.417701-384.347812-384.338419 0-211.922716 172.413104-384.338419 384.338019-384.338419 188.118456 0 345.001689 135.905456 377.892189 314.664258l-37.310503 6.059292c-29.969681-160.790984-171.236502-282.919381-340.581686-282.919381-191.084445 0-346.53365 155.451604-346.53365 346.53425 0 191.080048 155.449205 346.53425 346.53365 346.53425 12.796724 0 25.414169-0.748493 37.859731-2.104573C532.968631 861.361189 533.461497 865.948079 534.528574 870.531771zM912.096583 463.425989l0 333.227272c0 27.59629-20.573051 49.609165-52.658098 57.716668-35.234911 8.736077-69.250848-6.021917-75.997274-33.022611-6.760416-27.057655 16.31294-56.065787 51.53386-64.879811 15.920206-3.931335 31.587384-3.128879 44.698494 1.494986L879.673565 557.20001l-180.148459 32.927675-0.834434 249.757065-0.036975 0c-0.156894 23.646767-21.482435 46.868223-52.156438 54.45388-34.814196 8.759061-71.280472-7.807706-75.193819-32.597899-6.691463-26.747865 16.124068-55.470191 51.00222-64.201272 15.699356-3.904353 31.039755-3.119885 43.933013 1.402049L666.238674 503.300354 912.096583 463.425989z" fill="currentColor" style="color:var(--b3-theme-primary)"/></svg>`;

/**
 * 媒体资源管理器
 */
export class MediaManager {
    // 缓存管理
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
                timestamp: Date.now(),
                info
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
    private static async getMediaInfoFromElement(url: string, retryCount = 0): Promise<MediaInfo> {
        return new Promise((resolve, reject) => {
            const mediaUrl = convertToFileUrl(url);
            const type = getMediaType(url);
            const mediaEl = document.createElement(type === 'audio' ? 'audio' : 'video');
            mediaEl.style.display = 'none';
            document.body.appendChild(mediaEl);

            let timeoutId: number;

            const cleanup = () => {
                clearTimeout(timeoutId);
                mediaEl.removeEventListener('loadedmetadata', handleMetadata);
                mediaEl.removeEventListener('error', handleError);
                mediaEl.parentNode?.removeChild(mediaEl);
            };

            const handleMetadata = async () => {
                const duration = formatDuration(mediaEl.duration);
                let thumbnail = '';
                
                if (mediaEl instanceof HTMLVideoElement) {
                    try {
                        mediaEl.currentTime = Math.min(5, mediaEl.duration / 2);
                        await new Promise(resolve => {
                            const onSeeked = () => {
                                mediaEl.removeEventListener('seeked', onSeeked);
                                resolve(null);
                            };
                            mediaEl.addEventListener('seeked', onSeeked);
                        });
                        
                        const canvas = document.createElement('canvas');
                        canvas.width = mediaEl.videoWidth;
                        canvas.height = mediaEl.videoHeight;
                        canvas.getContext('2d')?.drawImage(mediaEl, 0, 0, canvas.width, canvas.height);
                        thumbnail = canvas.toDataURL('image/jpeg', 0.7);
                    } catch {}
                }

                cleanup();
                resolve({
                    id: '', // 将在createMediaItem中生成
                    title: extractTitleFromUrl(url),
                    duration,
                    thumbnail,
                    artist: '',
                    artistIcon: '',
                    url: mediaUrl,
                    type: getMediaType(url)
                });
            };

            const handleError = () => {
                cleanup();
                if (retryCount < MAX_RETRIES) {
                    resolve(this.getMediaInfoFromElement(url, retryCount + 1));
                } else {
                    reject(new Error('媒体加载失败'));
                }
            };

            timeoutId = window.setTimeout(() => {
                cleanup();
                if (retryCount < MAX_RETRIES) {
                    resolve(this.getMediaInfoFromElement(url, retryCount + 1));
                } else {
                    reject(new Error('媒体加载超时'));
                }
            }, LOAD_TIMEOUT);

            mediaEl.addEventListener('loadedmetadata', handleMetadata);
            mediaEl.addEventListener('error', handleError);
            mediaEl.src = mediaUrl;
            mediaEl.load();
        });
    }

    // 媒体项管理
    static async createMediaItem(url: string, savedInfo?: { aid?: string; bvid?: string; cid?: string }): Promise<MediaItem | null> {
        try {
            // 转换为文件URL格式，确保正确处理特殊字符
            const mediaUrl = convertToFileUrl(url);
            
            // 尝试从缓存获取媒体信息
            let mediaInfo = this.getCachedInfo(mediaUrl);
            
            if (!mediaInfo) {
                // 判断是否为B站视频
                const isBilibili = mediaUrl.includes('bilibili.com');
                
                // 根据媒体类型获取信息
                mediaInfo = isBilibili 
                    ? await BilibiliParser.getVideoInfo(mediaUrl)
                    : await this.getMediaInfoFromElement(mediaUrl);
                
                // 合并保存的信息
                if (mediaInfo && savedInfo) {
                    mediaInfo = { ...mediaInfo, ...savedInfo };
                }
                
                // 缓存媒体信息
                this.cacheInfo(mediaUrl, mediaInfo);
            }
            
            // 如果无法获取媒体信息，返回null
            if (!mediaInfo) return null;

            // 生成唯一ID
            const id = `media-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
            const type = getMediaType(mediaUrl);
            
            // 创建媒体项
            return {
                id,
                title: mediaInfo.title,
                artist: mediaInfo.artist,
                artistIcon: mediaInfo.artistIcon,
                duration: mediaInfo.duration,
                thumbnail: mediaInfo.thumbnail || (type === 'audio' ? DEFAULT_AUDIO_THUMBNAIL : ''),
                url: mediaUrl,
                type,
                isPinned: false,
                isFavorite: false,
                aid: mediaInfo.aid,
                bvid: mediaInfo.bvid,
                cid: mediaInfo.cid
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
            ...(item.aid ? { aid: item.aid } : {}),
            ...(item.bvid ? { bvid: item.bvid } : {}),
            ...(item.cid ? { cid: item.cid } : {})
        }));
    }

    static async createMediaItems(items: PlaylistConfig['items']): Promise<MediaItem[]> {
        const results = await Promise.all(items.map(item => this.createMediaItem(item.url, item)));
        return results.filter((item): item is MediaItem => item !== null);
    }
}