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
            console.error('[LinkHandler] 处理媒体链接错误:', error);
            showMessage("播放失败，请重试");
        }
    }

    /**
     * 在内置播放器中统一处理媒体
     * 整合了AList和普通媒体的顺滑跳转和播放逻辑
     */
    private async playInBuiltInPlayer(mediaUrl: string): Promise<void> {
        // 确保播放器标签已打开
        if (!document.querySelector('.media-player-tab')) {
            this.openTabCallback();
            await this.waitForElement('.media-player-tab', 2000);
        }

        // 解析媒体URL和时间戳
        const { mediaUrl: parsedUrl, startTime, endTime } = url.parseTime(mediaUrl);
        
        // 获取媒体源信息
        const mediaSource = url.getMediaInfo(mediaUrl).source;
        
        // 如果是AList链接，确保已连接
        if (mediaSource === 'alist') {
            console.info('[LinkHandler] 检测到AList媒体链接:', mediaUrl, '时间:', startTime);
            const config = await this.configManager.getConfig();
            if (!await AListManager.initFromConfig(config)) {
                showMessage("未连接到AList服务器，请先在设置中配置AList");
                return;
            }
        }

        // 获取当前播放器和媒体
        const siyuanPlayer = (window as any).siyuanMediaPlayer;
        const currentMedia = siyuanPlayer?.getCurrentMedia?.();
            
        // 顺滑跳转处理
        if (currentMedia && url.isSameMedia(currentMedia, mediaUrl) && startTime !== undefined) {
            console.info('[LinkHandler] 执行丝滑跳转，时间:', startTime);
            siyuanPlayer.seekTo?.(startTime);
            if (endTime !== undefined) {
                siyuanPlayer.setLoopSegment?.(startTime, endTime);
            }
            return;
        }
        
        // 播放新媒体
        if (mediaSource === 'alist' && url.getMediaInfo(mediaUrl).path) {
            // AList媒体直接播放
            const mediaItem = await AListManager.createMediaItemFromPath(url.getMediaInfo(mediaUrl).path, { startTime, endTime });
            window.dispatchEvent(new CustomEvent('directMediaPlay', { detail: mediaItem }));
        } else {
            // 其他媒体添加到播放列表并播放
            this.playlist?.addMedia(mediaUrl, { autoPlay: true });
        }
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
}