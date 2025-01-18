import { showMessage } from "siyuan";
import { BilibiliParser } from "./bilibili";
import type { ConfigManager } from "./config";
import type { MediaItem } from "./types";
import { MediaManager } from "./media";

export class LinkHandler {
    private configManager: ConfigManager;
    private openMediaPlayerTab: Function;
    private player: any;
    private isListening: boolean = false;
    private currentMediaItem: MediaItem | null = null;

    constructor(configManager: ConfigManager, openMediaPlayerTab: Function) {
        this.configManager = configManager;
        this.openMediaPlayerTab = openMediaPlayerTab;
    }

    /**
     * 启动链接监听
     */
    public startListening() {
        if (this.isListening) return;
        document.addEventListener("click", this.handleClick, true);
        this.isListening = true;
        console.log("[LinkHandler] 开始监听链接点击");
    }

    /**
     * 停止链接监听
     */
    public stopListening() {
        document.removeEventListener("click", this.handleClick, true);
        this.isListening = false;
        console.log("[LinkHandler] 停止监听链接点击");
    }

    /**
     * 设置播放器实例引用
     */
    public setPlayer(player: any) {
        this.player = player;
        if (!player) {
            this.currentMediaItem = null;
        }
    }

    /**
     * 检查是否为相同媒体
     */
    private isSameMedia(url: string): boolean {
        if (!this.currentMediaItem) return false;

        // 如果是B站视频，比较BV号
        if (this.currentMediaItem.type === 'bilibili') {
            const bvMatch = url.match(/\/video\/(BV[\w]+)/);
            return bvMatch && this.currentMediaItem.bvid === bvMatch[1];
        }

        // 普通媒体，比较URL（忽略时间戳）
        const cleanUrl = (url: string) => url.split('#')[0];
        return cleanUrl(url) === cleanUrl(this.currentMediaItem.url);
    }

    /**
     * 提取并验证时间戳
     */
    private extractTimestamp(url: string): number | null {
        try {
            let timestamp: number | null = null;

            // 处理B站时间戳格式 (?t=xxx)
            if (url.includes('bilibili.com/video/')) {
                const params = new URLSearchParams(url.split('?')[1]);
                const biliTime = params.get('t');
                if (biliTime) {
                    timestamp = parseFloat(biliTime);
                }
            } else {
                // 处理标准媒体时间戳格式 (#t=xxx)
                // 对于本地文件和普通链接，直接查找 #t= 标记
                const timeMatch = url.match(/#t=(\d+\.?\d*)/);
                if (timeMatch) {
                    timestamp = parseFloat(timeMatch[1]);
                }
            }

            // 验证时间戳的有效性
            if (timestamp !== null) {
                if (!Number.isFinite(timestamp) || timestamp < 0) {
                    console.warn('[LinkHandler] 无效的时间戳:', timestamp);
                    return null;
                }
                return timestamp;
            }

            return null;
        } catch (error) {
            console.error('[LinkHandler] 解析时间戳失败:', error);
            return null;
        }
    }

    /**
     * 检查是否为媒体链接
     */
    private async isMediaLink(url: string): Promise<boolean> {
        try {
            // 检查是否为B站链接
            if (url.includes('bilibili.com/video/')) return true;

            // 移除时间戳部分后检查扩展名
            const cleanUrl = url.split('#')[0];
            const mediaExtensions = ['.mp4', '.mp3', '.webm', '.ogg', '.wav', '.m4v'];
            
            // 处理本地文件、本地路径和网络链接
            if (cleanUrl.startsWith('file://')) {
                // 本地文件：直接检查扩展名
                return mediaExtensions.some(ext => cleanUrl.toLowerCase().endsWith(ext));
            } else if (cleanUrl.startsWith('http')) {
                // 网络链接：检查扩展名
                const urlPath = new URL(cleanUrl).pathname;
                return mediaExtensions.some(ext => urlPath.toLowerCase().endsWith(ext));
            } else {
                // 可能是本地路径：检查是否为Windows或Unix路径格式
                const isWindowsPath = /^[a-zA-Z]:\\/.test(cleanUrl);
                const isUnixPath = cleanUrl.startsWith('/');
                if (isWindowsPath || isUnixPath) {
                    return mediaExtensions.some(ext => cleanUrl.toLowerCase().endsWith(ext));
                }
            }

            return false;
        } catch (error) {
            console.error('[LinkHandler] 检查媒体链接失败:', error);
            return false;
        }
    }

    /**
     * 处理链接点击事件
     */
    private handleClick = async (e: MouseEvent) => {
        const target = e.target as HTMLElement;
        if (!target.dataset?.type === "a" || !target.dataset?.href) return;

        try {
            let url = target.dataset.href;
            
            // 检查是否为媒体链接
            if (await this.isMediaLink(url)) {
                e.preventDefault();
                e.stopPropagation();

                // 提取时间戳
                const timestamp = this.extractTimestamp(url);
                
                // 移除时间戳部分，获取原始媒体URL
                let originalUrl = url.split('#')[0];

                // 如果是本地路径，转换为 file:// URL
                if (!originalUrl.startsWith('http') && !originalUrl.startsWith('file://')) {
                    originalUrl = MediaManager.convertToFileUrl(originalUrl);
                }

                // 如果是同一个视频且播放器已就绪，直接跳转时间
                if (this.isSameMedia(originalUrl) && this.player) {
                    if (timestamp !== null) {
                        this.player.seek(timestamp);
                        console.log("[LinkHandler] 相同视频跳转到:", timestamp);
                    }
                    return;
                }
                
                // 不是同一个视频，处理新的媒体链接
                await this.handleMediaLink(originalUrl, timestamp);
            }
        } catch (error) {
            console.error("[LinkHandler] 处理链接失败:", error);
            showMessage("处理链接失败");
        }
    };

    /**
     * 处理媒体链接
     */
    private async handleMediaLink(url: string, timestamp: number | null) {
        try {
            // 创建媒体项
            const mediaItem = await MediaManager.createMediaItem(url);
            if (!mediaItem) {
                showMessage("无法解析媒体链接");
                return;
            }

            // 如果是B站视频，获取播放流
            if (mediaItem.type === 'bilibili' && mediaItem.bvid && mediaItem.cid) {
                const config = await this.configManager.getConfig();
                const streamInfo = await BilibiliParser.getProcessedVideoStream(
                    mediaItem.bvid,
                    mediaItem.cid,
                    0,
                    config
                );

                const biliMediaItem: MediaItem = {
                    ...mediaItem,
                    url: streamInfo.video.url,
                    audioUrl: streamInfo.audio?.url,
                    headers: streamInfo.headers
                };

                // 更新当前播放项
                this.currentMediaItem = biliMediaItem;
                await this.playMedia(biliMediaItem, timestamp);
            } else {
                // 普通媒体直接播放
                this.currentMediaItem = mediaItem;
                await this.playMedia(mediaItem, timestamp);
            }
        } catch (error) {
            console.error("[LinkHandler] 处理媒体链接失败:", error);
            showMessage("处理媒体链接失败");
            this.currentMediaItem = null;
        }
    }

    /**
     * 播放媒体
     */
    private async playMedia(mediaItem: MediaItem, timestamp: number | null) {
        try {
            // 打开或获取焦点到播放器标签页
            await this.openMediaPlayerTab();

            // 等待播放器实例就绪，最多重试5次
            let retries = 0;
            while (!this.player && retries < 5) {
                await new Promise(resolve => setTimeout(resolve, 500));
                retries++;
            }

            if (!this.player) {
                showMessage("播放器初始化失败，请重试");
                return;
            }

            // 验证时间戳
            let validatedTime = null;
            if (timestamp !== null) {
                if (Number.isFinite(timestamp) && timestamp >= 0) {
                    validatedTime = timestamp;
                } else {
                    console.warn('[LinkHandler] 跳过无效的时间戳:', timestamp);
                }
            }

            // 获取配置
            const config = await this.configManager.getConfig();

            // 创建播放选项
            const playOptions = {
                startTime: validatedTime || 0,
                autoplay: config.settings?.autoplay,
                originalUrl: mediaItem.originalUrl || mediaItem.url,
                ...(mediaItem.type === 'bilibili' ? {
                    type: 'bilibili',
                    bvid: mediaItem.bvid,
                    audioUrl: mediaItem.audioUrl,
                    headers: mediaItem.headers,
                    title: mediaItem.title
                } : {})
            };

            // 开始播放
            await this.player.play(mediaItem.url, playOptions);

            console.log("[LinkHandler] 媒体播放成功", {
                标题: mediaItem.title,
                时间戳: timestamp,
                类型: mediaItem.type
            });

        } catch (error) {
            console.error("[LinkHandler] 播放失败:", error);
            showMessage("播放失败，请重试");
        }
    }
} 