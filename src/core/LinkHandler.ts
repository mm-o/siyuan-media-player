import { showMessage } from "siyuan";
import type { ConfigManager } from "./config";

export class LinkHandler {
    private configManager: ConfigManager;
    private playlist: any; // Playlist 组件实例
    private isListening: boolean = false;
    private openTabCallback: () => void;

    constructor(configManager: ConfigManager, openTabCallback: () => void) {
        this.configManager = configManager;
        this.openTabCallback = openTabCallback;
    }

    /**
     * 监听链接点击事件
     */
    public startListening() {
        if (this.isListening) return;
        
        this.clickHandler = async (e: MouseEvent) => {
            const target = e.target as HTMLElement;
            // 检查是否为链接元素
            if (!target.matches('span[data-type="a"]')) return;
            
            // 阻止默认行为和事件传播
            e.preventDefault();
            e.stopPropagation();
            
            const url = target.getAttribute('data-href');
            if (!url) return;
            
            await this.handleMediaLink(url);
        };

        // 使用捕获阶段监听
        document.addEventListener('click', this.clickHandler, true);
        this.isListening = true;
    }

    /**
     * 处理媒体链接
     */
    private async handleMediaLink(url: string) {
        try {
            // 1. 打开媒体播放器标签页
            this.openTabCallback();
            
            // 2. 等待标签页打开
            await new Promise(resolve => setTimeout(resolve, 100));
            
            // 3. 通过播放列表处理链接
            if (this.playlist) {
                await this.playlist.handleSubmit(url);
            }

        } catch (error) {
            console.error("[LinkHandler] 处理链接失败:", error);
            showMessage(error.message || "播放失败，请重试");
        }
    }

    public setPlaylist(playlist: any) {
        this.playlist = playlist;
    }

    public stopListening() {
        if (this.clickHandler) {
            document.removeEventListener('click', this.clickHandler, true);
        }
        this.isListening = false;
    }

    private clickHandler: ((e: MouseEvent) => void) | null = null;
} 