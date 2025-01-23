import { showMessage } from "siyuan";
import { BilibiliParser } from "./bilibili";
import type { ConfigManager } from "./config";
import type { MediaItem } from "./types";
import { MediaManager } from "./media";

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
     * 第一部分: 监听链接点击事件
     */
    public startListening() {
        if (this.isListening) return;
        
        this.clickHandler = async (e: MouseEvent) => {
            const target = e.target as HTMLElement;
            if (!target.matches('span[data-type="a"]')) return;
            
            // 阻止默认行为和事件传播
            e.preventDefault();
            e.stopPropagation();
            
            const url = target.getAttribute('data-href');
            if (!url) return;
            
            await this.handleMediaLink(url);
        };

        document.addEventListener('click', this.clickHandler, true);
        this.isListening = true;
    }

    /**
     * 第二部分: 解析媒体链接
     */
    private parseMediaLink(url: string): {
        url: string;
        startTime?: number;
        endTime?: number;
    } {
        try {
            // 解析URL对象
            const urlObj = new URL(url);
            let startTime: number | undefined;
            let endTime: number | undefined;

            // 处理时间参数
            const timeStr = urlObj.searchParams.get('t') || '';
            console.log("[LinkHandler] 解析时间参数:", { timeStr });

            if (timeStr && timeStr.includes('~')) {
                const [start, end] = timeStr.split('~').map(Number);
                if (!isNaN(start) && !isNaN(end) && start < end) {
                    startTime = start;
                    endTime = end;
                    console.log("[LinkHandler] 解析循环片段:", { startTime, endTime });
                }
            } else if (timeStr) {
                const time = Number(timeStr);
                if (!isNaN(time)) {
                    startTime = time;
                    console.log("[LinkHandler] 解析时间戳:", { startTime });
                }
            }

            return { url, startTime, endTime };
        } catch (error) {
            console.error("[LinkHandler] 解析链接失败:", error);
            return { url };  // 如果解析失败，只返回原始URL
        }
    }

    /**
     * 第三部分: 打开媒体播放器标签页
     */
    private async handleMediaLink(url: string) {
        try {
            // 确保播放列表已就绪
            if (!this.playlist) {
                // 打开新标签页
                this.openTabCallback();
                
                // 等待播放列表组件初始化
                let retries = 0;
                while (!this.playlist && retries < 10) {
                    await new Promise(resolve => setTimeout(resolve, 100));
                    retries++;
                }
                
                if (!this.playlist) {
                    throw new Error("播放列表组件初始化失败");
                }
            }

            // 解析链接和时间参数
            console.log("[LinkHandler] 开始处理链接:", url);
            const { url: mediaUrl, startTime, endTime } = this.parseMediaLink(url);
            console.log("[LinkHandler] 解析结果:", { mediaUrl, startTime, endTime });

            // 调用播放列表的处理方法
            await this.playlist.handleSubmit(mediaUrl, startTime, endTime);

        } catch (error) {
            console.error("[LinkHandler] 处理链接失败:", error);
            // 如果是播放列表未就绪，重新尝试打开标签页
            if (error.message === "播放列表组件初始化失败") {
                this.playlist = null;  // 清除可能的无效引用
                await this.handleMediaLink(url);  // 重试一次
                return;
            }
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