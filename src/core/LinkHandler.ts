import { showMessage } from "siyuan";
import type { ConfigManager } from "./config";

export class LinkHandler {
    private configManager: ConfigManager;
    private playlist: any; // Playlist 组件实例
    private isListening: boolean = false;
    private openTabCallback: () => void;

    // 支持的媒体文件扩展名
    private readonly MEDIA_EXTENSIONS = [
        // 视频格式
        '.mp4', '.webm', '.ogg', '.mov', '.m4v',
        // 音频格式
        '.mp3', '.wav', '.aac', '.m4a'
    ];

    constructor(configManager: ConfigManager, openTabCallback: () => void) {
        this.configManager = configManager;
        this.openTabCallback = openTabCallback;
    }

    /**
     * 开始监听链接点击事件
     */
    public startListening() {
        if (this.isListening) return;
        
        this.clickHandler = async (e: MouseEvent) => {
            const target = e.target as HTMLElement;
            if (!target.matches('span[data-type="a"]')) return;
            
            const url = target.getAttribute('data-href');
            if (!url) return;

            // 检查是否为支持的链接类型
            if (this.isSupportedLink(url)) {
                e.preventDefault();
                e.stopPropagation();
                await this.handleMediaLink(url);
            }
        };

        document.addEventListener('click', this.clickHandler, true);
        this.isListening = true;
    }

    /**
     * 检查是否为支持的链接类型
     */
    private isSupportedLink(url: string): boolean {
        try {
            const urlObj = new URL(url);
            const urlPath = urlObj.pathname.toLowerCase();
            const fullUrl = url.toLowerCase();
            
            // 检查是否为B站链接
            if (urlObj.hostname.includes('bilibili.com')) {
                return true;
            }

            // 检查是否包含媒体关键字
            const mediaKeywords = ['mp3', 'mp4', 'webm', 'ogg', 'wav', 'm4v', 'mov', 'aac', 'm4a'];
            if (mediaKeywords.some(keyword => fullUrl.includes(keyword))) {
                return true;
            }

            // 检查文件扩展名
            const isMediaFile = this.MEDIA_EXTENSIONS.some(ext => 
                urlPath.endsWith(ext)
            );
            
            // 检查是否为本地文件
            const isLocalFile = urlObj.protocol === 'file:' && (
                mediaKeywords.some(keyword => fullUrl.includes(keyword)) ||
                this.MEDIA_EXTENSIONS.some(ext => urlPath.endsWith(ext))
            );

            // 检查是否包含时间戳参数
            const hasTimeParam = urlObj.searchParams.has('t');

            return isMediaFile || isLocalFile || hasTimeParam;
            
        } catch (e) {
            // 如果 URL 解析失败，尝试直接检查字符串
            const urlLower = url.toLowerCase();
            return this.MEDIA_EXTENSIONS.some(ext => urlLower.includes(ext)) ||
                   urlLower.includes('bilibili.com') ||
                   urlLower.includes('t='); // 检查是否包含时间戳参数
        }
    }

    /**
     * 处理媒体链接
     */
    private async handleMediaLink(url: string) {
        try {
            // 检查播放器标签页是否已打开
            const playerTab = document.querySelector('.media-player-tab');
            if (!playerTab) {
                // 如果标签页未打开，先打开标签页
                this.openTabCallback();
                // 等待标签页打开
                await new Promise<void>((resolve) => {
                    const checkTab = () => {
                        const tab = document.querySelector('.media-player-tab');
                        if (tab) {
                            resolve();
                        } else {
                            setTimeout(checkTab, 100);
                        }
                    };
                    checkTab();
                });
            }
            
            // 等待一小段时间确保组件已完全初始化
            await new Promise(resolve => setTimeout(resolve, 200));
            
            // 通过播放列表处理链接
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