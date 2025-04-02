import type { MediaItem, MediaInfo, PlaylistConfig } from "./types";
import { BilibiliParser } from "./bilibili";

/**
 * 媒体管理器
 */
export class MediaManager {
    /**
     * 默认音频缩略图
     */
    private static readonly DEFAULT_AUDIO_THUMBNAIL = `data:image/svg+xml;charset=utf-8,<svg viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg">
        <path d="M628.905386 769.860427 628.905386 482.261019l169.381759-27.464779C771.308637 311.811584 645.822916 203.633728 494.993179 203.633728c-170.51599 0-308.738475 138.222485-308.738475 308.738875 0 170.516989 138.222485 308.738875 308.738475 308.738875 16.540186 0 32.756191-1.34209 48.589456-3.839397 12.391598-20.573051 34.625524-37.084856 62.858182-44.145869C613.897561 771.276467 621.429455 770.182208 628.905386 769.860427zM551.718919 228.830645l-33.079572 144.922942-33.078373 0-23.62798-144.922942C496.589896 211.497397 551.718919 228.830645 551.718919 228.830645zM494.993179 626.995689c-63.300482 0-114.622086-51.317007-114.622086-114.622886 0-63.30348 51.321604-114.622486 114.622086-114.622486 63.306478 0 114.622486 51.319006 114.622486 114.622486C609.615665 575.678482 558.299457 626.995689 494.993179 626.995689zM494.993179 424.978057c-48.20112 0-87.394147 39.192827-87.394147 87.394546 0 48.20112 39.192827 87.395546 87.394147 87.395546 48.201719 0 87.395946-39.194226 87.395946-87.395546C582.389124 464.170884 543.194698 424.978057 494.993179 424.978057zM494.993179 574.79708c-34.421063 0-62.423477-28.002015-62.423477-62.424476 0-34.421662 28.011408-62.424076 62.423477-62.424076 34.432055 0 62.416082 28.002414 62.416082 62.424076C557.409061 546.795265 529.425034 574.79708 494.993179 574.79708zM534.528574 870.531771c1.499983 8.297374 4.789753 16.008146 9.524542 22.939447-16.073102 2.058604-32.429013 3.239803-49.050144 3.239803-211.934708 0-384.347812-172.417701-384.347812-384.338419 0-211.922716 172.413104-384.338419 384.338019-384.338419 188.118456 0 345.001689 135.905456 377.892189 314.664258l-37.310503 6.059292c-29.969681-160.790984-171.236502-282.919381-340.581686-282.919381-191.084445 0-346.53365 155.451604-346.53365 346.53425 0 191.080048 155.449205 346.53425 346.53365 346.53425 12.796724 0 25.414169-0.748493 37.859731-2.104573C532.968631 861.361189 533.461497 865.948079 534.528574 870.531771zM912.096583 463.425989l0 333.227272c0 27.59629-20.573051 49.609165-52.658098 57.716668-35.234911 8.736077-69.250848-6.021917-75.997274-33.022611-6.760416-27.057655 16.31294-56.065787 51.53386-64.879811 15.920206-3.931335 31.587384-3.128879 44.698494 1.494986L879.673565 557.20001l-180.148459 32.927675-0.834434 249.757065-0.036975 0c-0.156894 23.646767-21.482435 46.868223-52.156438 54.45388-34.814196 8.759061-71.280472-7.807706-75.193819-32.597899-6.691463-26.747865 16.124068-55.470191 51.00222-64.201272 15.699356-3.904353 31.039755-3.119885 43.933013 1.402049L666.238674 503.300354 912.096583 463.425989z" fill="currentColor" style="color:var(--b3-theme-primary)"/></svg>`;

    /**
     * 缓存过期时间 (24小时)
     */
    private static readonly CACHE_EXPIRY = 24 * 60 * 60 * 1000;

    /**
     * 将本地路径转换为 file:// URL
     */
    private static convertToFileUrl(path: string): string {
        if (path.startsWith('http://') || path.startsWith('https://') || path.startsWith('file://')) {
            return path;
        }
        
        // Windows 路径转换
        if (/^[a-zA-Z]:\\/.test(path)) {
            return 'file:///' + path.replace(/\\/g, '/');
        }
        // Unix 路径转换
        return 'file://' + path;
    }

    /**
     * 从缓存获取媒体信息
     */
    private static getCachedInfo(url: string): MediaInfo | null {
        try {
            const cached = localStorage.getItem(`media_info_${url}`);
            if (!cached) return null;
            
            const { timestamp, info } = JSON.parse(cached);
            // 检查缓存是否过期
            if (Date.now() - timestamp > this.CACHE_EXPIRY) {
                localStorage.removeItem(`media_info_${url}`);
                return null;
            }
            
            return info;
        } catch {
            return null;
        }
    }
    
    /**
     * 缓存媒体信息
     */
    private static cacheInfo(url: string, info: MediaInfo | null) {
        if (!info) return;
        
        try {
            localStorage.setItem(`media_info_${url}`, JSON.stringify({
                timestamp: Date.now(),
                info
            }));
        } catch (e) {
            console.error('Failed to cache media info:', e);
        }
    }

    /**
     * 清理过期缓存
     */
    static cleanupCache(): void {
        try {
            const now = Date.now();
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key?.startsWith('media_info_')) {
                    try {
                        const { timestamp } = JSON.parse(localStorage.getItem(key));
                        if (now - timestamp > this.CACHE_EXPIRY) {
                            localStorage.removeItem(key);
                        }
                    } catch {
                        localStorage.removeItem(key);
                    }
                }
            }
        } catch (e) {
            console.warn('Failed to cleanup cache:', e);
        }
    }

    /**
     * 创建临时媒体元素获取信息
     */
    private static async getMediaInfoFromElement(url: string, retryCount = 0): Promise<MediaInfo> {
        // 设置最大重试次数和超时时间
        const MAX_RETRIES = 2; // 最多重试2次（总共尝试3次）
        const TIMEOUT_MS = 20000; // 20秒超时（原来是10秒）
        
        return new Promise((resolve, reject) => {
            const mediaUrl = this.convertToFileUrl(url);

            const type = this.getMediaType(url);
            const mediaEl = document.createElement(type);
            mediaEl.style.display = 'none';
            document.body.appendChild(mediaEl);

            let timeoutId: number;

            const onMetadata = async () => {
                const duration = this.formatDuration(mediaEl.duration);
                let thumbnail = '';
                
                if (mediaEl instanceof HTMLVideoElement) {
                    try {
                        mediaEl.currentTime = mediaEl.duration / 2;
                        await new Promise(resolve => mediaEl.addEventListener('seeked', resolve, { once: true }));
                        
                        const canvas = document.createElement('canvas');
                        canvas.width = mediaEl.videoWidth;
                        canvas.height = mediaEl.videoHeight;
                        const ctx = canvas.getContext('2d');
                        ctx.drawImage(mediaEl, 0, 0, canvas.width, canvas.height);
                        thumbnail = canvas.toDataURL('image/jpeg', 0.7);
                    } catch (e) {
                        console.warn('Failed to get video thumbnail:', e);
                    }
                }

                cleanup();
                resolve({
                    title: this.extractTitleFromUrl(url),
                    duration,
                    thumbnail,
                    artist: '',
                    artistIcon: ''
                });
            };

            const onError = () => {
                cleanup();
                
                // 如果还有重试次数，则重试
                if (retryCount < MAX_RETRIES) {
                    console.warn(`媒体加载失败，正在重试 (${retryCount + 1}/${MAX_RETRIES})...`);
                    // 递归调用，增加重试计数
                    resolve(this.getMediaInfoFromElement(url, retryCount + 1));
                } else {
                    reject(new Error('Failed to load media after multiple attempts'));
                }
            };

            const cleanup = () => {
                mediaEl.removeEventListener('loadedmetadata', onMetadata);
                mediaEl.removeEventListener('error', onError);
                if (mediaEl.parentNode) {
                    mediaEl.parentNode.removeChild(mediaEl);
                }
                if (timeoutId) {
                    clearTimeout(timeoutId);
                }
            };

            timeoutId = window.setTimeout(() => {
                cleanup();
                
                // 如果超时但还有重试次数，则重试
                if (retryCount < MAX_RETRIES) {
                    console.warn(`媒体加载超时，正在重试 (${retryCount + 1}/${MAX_RETRIES})...`);
                    // 递归调用，增加重试计数
                    resolve(this.getMediaInfoFromElement(url, retryCount + 1));
                } else {
                    reject(new Error('Media load timeout after multiple attempts'));
                }
            }, TIMEOUT_MS);

            mediaEl.addEventListener('loadedmetadata', onMetadata);
            mediaEl.addEventListener('error', onError);
            mediaEl.src = mediaUrl;
            mediaEl.load();
        });
    }

    /**
     * 从URL中提取标题
     */
    private static extractTitleFromUrl(url: string): string {
        try {
            const urlObj = new URL(url);
            const pathSegments = urlObj.pathname.split('/');
            const filename = pathSegments[pathSegments.length - 1];
            return decodeURIComponent(filename.split('.')[0]) || '未知标题';
        } catch {
            return '未知标题';
        }
    }

    /**
     * 格式化时长
     */
    private static formatDuration(seconds: number): string {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = Math.floor(seconds % 60);
        
        if (hours > 0) {
            return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        }
        return `${minutes}:${secs.toString().padStart(2, '0')}`;
    }

    /**
     * 判断媒体类型
     */
    private static getMediaType(url: string): 'video' | 'audio' {
        const videoExts = ['.mp4', '.webm', '.ogg', '.mov'];
        const audioExts = ['.mp3', '.wav', '.aac', '.m4a'];
        
        if (videoExts.some(e => url.toLowerCase().endsWith(e))) {
            return 'video';
        } else if (audioExts.some(e => url.toLowerCase().endsWith(e))) {
            return 'audio';
        }
        
        return 'video';
    }

    /**
     * 创建媒体项
     */
    static async createMediaItem(url: string, savedInfo?: { aid?: string; bvid?: string; cid?: string }): Promise<MediaItem | null> {
        try {
            // 转换本地路径为 file:// URL
            const mediaUrl = this.convertToFileUrl(url);
            
            // 首先尝试从缓存获取
            let mediaInfo = this.getCachedInfo(mediaUrl);
            
            if (!mediaInfo) {
                // 对于B站视频，使用BilibiliParser获取信息
                if (mediaUrl.includes('bilibili.com')) {
                    // 如果有保存的信息，优先使用
                    if (savedInfo?.aid || savedInfo?.bvid) {
                        mediaInfo = {
                            ...await BilibiliParser.getVideoInfo(mediaUrl),
                            ...savedInfo
                        };
                    } else {
                        mediaInfo = await BilibiliParser.getVideoInfo(mediaUrl);
                    }
                } else {
                    mediaInfo = await this.getMediaInfoFromElement(mediaUrl);
                }
                
                // 缓存新获取的信息
                if (mediaInfo) {
                    this.cacheInfo(mediaUrl, mediaInfo);
                }
            }
            
            if (!mediaInfo) {
                return null;
            }

            // 确定媒体类型
            const type = mediaUrl.includes('bilibili.com') ? 'bilibili' : this.getMediaType(mediaUrl);
            
            return {
                id: `media-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                title: mediaInfo.title,
                artist: mediaInfo.artist,
                artistIcon: mediaInfo.artistIcon,
                duration: mediaInfo.duration,
                thumbnail: mediaInfo.thumbnail || (type === 'audio' ? this.DEFAULT_AUDIO_THUMBNAIL : ''),
                url: mediaUrl,
                type: type,
                isPinned: false,
                isFavorite: false,
                aid: mediaInfo.aid,
                bvid: mediaInfo.bvid,
                cid: mediaInfo.cid
            };
        } catch (e) {
            console.error('Failed to create media item:', e);
            return null;
        }
    }

    /**
     * 从媒体项数组中提取媒体信息
     */
    static getMediaInfoFromItems(items: MediaItem[]): PlaylistConfig['items'] {
        return items.map(item => ({
            url: item.url,
            ...(item.aid ? { aid: item.aid } : {}),
            ...(item.bvid ? { bvid: item.bvid } : {}),
            ...(item.cid ? { cid: item.cid } : {})
        }));
    }

    /**
     * 批量创建媒体项
     */
    static async createMediaItems(items: PlaylistConfig['items']): Promise<MediaItem[]> {
        const mediaItems = await Promise.all(
            items.map(item => this.createMediaItem(item.url, item))
        );
        return mediaItems.filter((item): item is MediaItem => item !== null);
    }
} 