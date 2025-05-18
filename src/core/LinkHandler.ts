import { showMessage } from "siyuan";
import type { ConfigManager } from "./config";
import { url, isSupportedMediaLink } from './utils';
import { PlayerType } from './types';
import { AListManager } from './alist';
import { openWithExternalPlayer } from './media';

/**
 * 链接处理器 - 捕获并处理文档中的媒体链接
 */
export class LinkHandler {
    private playlist: any;
    private isListening = false;
    private clickHandler: ((e: MouseEvent) => void) | null = null;

    /**
     * 创建链接处理器
     */
    constructor(
        private configManager: ConfigManager,
        private openTabCallback: () => void
    ) {}

    /**
     * 设置播放列表组件
     */
    public setPlaylist(playlist: any): void {
        this.playlist = playlist;
    }

    /**
     * 开始监听链接点击事件
     */
    public startListening(): void {
        if (this.isListening) return;
        
        this.clickHandler = async (e: MouseEvent) => {
            const target = e.target as HTMLElement;
            if (!target.matches('span[data-type="a"]')) return;
            
            const urlStr = target.getAttribute('data-href');
            if (!urlStr || !isSupportedMediaLink(urlStr)) return;
            
            e.preventDefault();
            e.stopPropagation();
            await this.handleMediaLink(urlStr, e.ctrlKey);
        };

        document.addEventListener('click', this.clickHandler, true);
        this.isListening = true;
    }

    /**
     * 处理媒体链接
     */
    private async handleMediaLink(urlStr: string, forceBrowser = false): Promise<void> {
        try {
            const config = await this.configManager.getConfig();
            const playerType = forceBrowser ? PlayerType.BROWSER : config.settings.playerType;
            
            // 外部播放器直接打开
            if (playerType === PlayerType.POT_PLAYER || playerType === PlayerType.BROWSER) {
                const error = await openWithExternalPlayer(urlStr, playerType, config.settings.playerPath);
                if (error) showMessage(error);
                return;
            }
            
            // 内置播放器处理
            await this.playInBuiltInPlayer(urlStr);
        } catch (error) {
            showMessage("播放失败，请重试");
        }
    }

    /**
     * 在内置播放器中统一处理媒体
     */
    private async playInBuiltInPlayer(mediaUrl: string): Promise<void> {
        // 确保播放器标签已打开
        const playerTabExists = !!document.querySelector('.media-player-tab');
        if (!playerTabExists) {
            this.openTabCallback();
            await this.waitForElement('.media-player-tab', 2000);
            await new Promise(resolve => setTimeout(resolve, 500));
        }

        // 解析媒体URL和时间戳
        const { mediaUrl: parsedUrl, startTime, endTime } = url.parseTime(mediaUrl);
        const mediaInfo = url.getMediaInfo(parsedUrl);
        
        // 获取当前播放器和媒体
        const siyuanPlayer = (window as any).siyuanMediaPlayer;
        const currentMedia = siyuanPlayer?.getCurrentMedia?.();
            
        // 丝滑跳转处理 - 适用于所有媒体类型，包括AList
        if (currentMedia && startTime !== undefined) {
            if (url.isSameMedia(currentMedia, mediaUrl)) {
                console.log(`丝滑跳转中... 时间: ${startTime}${endTime ? `-${endTime}` : ''}, 媒体: ${currentMedia.type === 'alist' ? '(AList)' : ''} ${currentMedia.title}`);
                if (typeof siyuanPlayer.seekTo === 'function') {
                    siyuanPlayer.seekTo(startTime);
                    
                    if (endTime !== undefined && typeof siyuanPlayer.setLoopSegment === 'function') {
                        siyuanPlayer.setLoopSegment(startTime, endTime);
                    }
                    return;
                }
            }
        }
        
        // AList媒体特殊处理
        if (mediaInfo.source === 'alist') {
            const config = await this.configManager.getConfig();
            
            // 尝试初始化AList
            if (!await AListManager.initFromConfig(config)) {
                showMessage("未连接到AList服务器，请先在设置中配置AList");
                return;
            }
            
            // 使用AList统一处理媒体链接
            const result = await AListManager.handleAListMediaLink(parsedUrl, { startTime, endTime });
            if (result.success && result.mediaItem) {
                window.dispatchEvent(new CustomEvent('directMediaPlay', { detail: result.mediaItem }));
                return;
            } else if (result.error) {
                showMessage(`处理AList媒体失败: ${result.error}`);
                return;
            }
        }
        
        // 尝试获取播放列表组件
        if (!this.playlist) {
            this.findPlaylistComponent();
        }
        
        // 播放新媒体
        try {
            if (this.playlist?.addMedia) {
                this.playlist.addMedia(parsedUrl, { 
                    autoPlay: true,
                    startTime,
                    endTime
                });
            } else {
                const tempMediaItem = {
                    id: `direct-${Date.now()}`,
                    title: url.title(parsedUrl),
                    url: parsedUrl,
                    type: url.type(parsedUrl),
                    startTime,
                    endTime
                };
                window.dispatchEvent(new CustomEvent('directMediaPlay', { 
                    detail: tempMediaItem
                }));
            }
        } catch (error) {
            console.error("播放媒体失败:", error);
            showMessage("播放媒体失败，请重试");
        }
    }
    
    /**
     * 尝试从dockComponents中查找播放列表组件
     */
    private findPlaylistComponent(): void {
        try {
            const plugins = (window as any).siyuan?.plugins;
            if (!plugins) return;
            
            const mediaPlugin = plugins.find((p: any) => p.name === 'siyuan-media-player');
            if (!mediaPlugin) return;
            
            this.playlist = mediaPlugin.dockComponents?.playlist;
        } catch {}
    }

    /**
     * 停止监听链接点击事件
     */
    public stopListening(): void {
        if (this.clickHandler) {
            document.removeEventListener('click', this.clickHandler, true);
            this.clickHandler = null;
        }
        this.isListening = false;
    }

    private async waitForElement(selector: string, timeout = 2000): Promise<Element | null> {
        const element = document.querySelector(selector);
        if (element) return element;
        
        return new Promise<Element | null>(resolve => {
            const endTime = Date.now() + timeout;
            
            const checkInterval = setInterval(() => {
                const element = document.querySelector(selector);
                if (element || Date.now() > endTime) {
                    clearInterval(checkInterval);
                    resolve(element);
                }
            }, 50);
        });
    }
}