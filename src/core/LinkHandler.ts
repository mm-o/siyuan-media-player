import { showMessage } from "siyuan";
import type { ConfigManager } from "./config";
import { isSupportedMediaLink } from './utils';

/**
 * 链接处理器 - 捕获并处理文档中的媒体链接
 */
export class LinkHandler {
    private playlist: any;
    private isListening = false;
    private clickHandler: ((e: MouseEvent) => void) | null = null;

    /**
     * 创建链接处理器
     * @param configManager 配置管理器
     * @param openTabCallback 打开标签页的回调函数
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
            // 只处理思源笔记链接元素
            if (!target.matches('span[data-type="a"]')) return;
            
            const url = target.getAttribute('data-href');
            if (!url) return;

            // 检查是否为支持的媒体链接
            if (isSupportedMediaLink(url)) {
                e.preventDefault();
                e.stopPropagation();
                await this.handleMediaLink(url);
            }
        };

        document.addEventListener('click', this.clickHandler, true);
        this.isListening = true;
    }

    /**
     * 处理媒体链接
     */
    private async handleMediaLink(url: string): Promise<void> {
        try {
            // 确保播放器标签页已打开
            if (!document.querySelector('.media-player-tab')) {
                // 打开标签页
                this.openTabCallback();
                // 等待标签页加载完成
                await this.waitForElement('.media-player-tab');
            }
            
            // 等待组件初始化
            await new Promise(resolve => setTimeout(resolve, 200));
            
            // 通过播放列表处理链接
            if (this.playlist) {
                await this.playlist.handleMediaItem(url);
            }
        } catch (error) {
            console.error("[LinkHandler] 处理链接失败:", error);
            showMessage(error instanceof Error 
                ? error.message 
                : "播放失败，请重试");
        }
    }

    /**
     * 等待元素出现
     */
    private async waitForElement(selector: string, timeout = 5000): Promise<Element> {
        const startTime = Date.now();
        
        while (Date.now() - startTime < timeout) {
            const element = document.querySelector(selector);
            if (element) return element;
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        throw new Error(`等待元素超时: ${selector}`);
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