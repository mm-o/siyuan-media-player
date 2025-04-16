import { showMessage } from "siyuan";
import type { ConfigManager } from "./config";
import { isSupportedMediaLink, parseMediaLink } from './utils';
import { PlayerType } from './types';

// 保存打开的窗口引用
const BROWSER_WINDOWS: { [key: string]: Window } = {};
// 记录PotPlayer启动状态
let lastPotPlayerCommand = '';

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
            
            const url = target.getAttribute('data-href');
            if (!url || !isSupportedMediaLink(url)) return;
            
            e.preventDefault();
            e.stopPropagation();
            
            // 如果按住Ctrl键，则强制使用浏览器打开
            const forceBrowser = e.ctrlKey;
            await this.handleMediaLink(url, forceBrowser);
        };

        document.addEventListener('click', this.clickHandler, true);
        this.isListening = true;
    }

    /**
     * 处理媒体链接
     */
    private async handleMediaLink(url: string, forceBrowser = false): Promise<void> {
        try {
            const config = await this.configManager.getConfig();
            
            // 如果强制使用浏览器（按住Ctrl键），覆盖配置
            const playerType = forceBrowser ? PlayerType.BROWSER : config.settings.playerType;
            const { playerPath } = config.settings;
            
            // 根据播放器类型选择处理方式
            switch (playerType) {
                case PlayerType.POT_PLAYER:
                    await this.openWithPotPlayer(url, playerPath);
                    break;
                case PlayerType.BROWSER:
                    await this.openInBrowser(url);
                    break;
                default:
                    await this.openInBuiltPlayer(url);
            }
        } catch (error) {
            console.error("[LinkHandler] 处理链接失败:", error);
            showMessage("播放失败，请重试");
        }
    }

    /**
     * 使用PotPlayer打开媒体
     */
    private async openWithPotPlayer(url: string, playerPath: string): Promise<void> {
        try {
            const cleanPath = (playerPath || '').replace(/^["']|["']$/g, '');
            
            if (!cleanPath) {
                showMessage("请在设置中配置PotPlayer路径");
                return;
            }
            
            const isElectron = window.navigator.userAgent.includes('Electron');
            
            // 提取媒体URL和时间戳
            const { mediaUrl, startTime } = parseMediaLink(url);
            const timeStr = startTime ? this.formatTime(startTime) : '';
            
            // 构建命令 - 始终使用/current参数强制在当前实例打开
            let command = '';
            
            if (isElectron) {
                const { exec } = require('child_process');
                const os = require('os');
                
                if (os.platform() === 'win32') {
                    // 在Windows上使用最简单的方法，确保使用/current参数
                    if (startTime) {
                        command = `"${cleanPath}" "${mediaUrl}" /seek=${timeStr} /current`;
                    } else {
                        command = `"${cleanPath}" "${mediaUrl}" /current`;
                    }
                    
                    console.log("执行PotPlayer命令:", command);
                    
                    // 记录命令以避免重复执行相同命令
                    if (command === lastPotPlayerCommand) {
                        console.log("跳过重复的PotPlayer命令");
                        return;
                    }
                    
                    lastPotPlayerCommand = command;
                    
                    // 执行命令
                    exec(command, (error: any) => {
                        if (error) {
                            console.error("PotPlayer命令执行失败:", error);
                            showMessage(`播放失败: ${error.message}`);
                            lastPotPlayerCommand = ''; // 重置命令记录
                        }
                    });
                } else {
                    // 其他平台
                    if (os.platform() === 'darwin') {
                        command = `open -a "${cleanPath}" "${mediaUrl}"`;
                    } else {
                        command = `"${cleanPath}" "${mediaUrl}"`;
                    }
                    
                    exec(command);
                }
            } else {
                // 非Electron环境
                if (startTime) {
                    command = `"${cleanPath}" "${mediaUrl}" /seek=${timeStr} /current`;
                } else {
                    command = `"${cleanPath}" "${mediaUrl}" /current`;
                }
                
                fetch('/api/system/execCommand', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ command })
                }).catch(e => console.error("命令执行失败:", e));
            }
        } catch (error) {
            console.error("打开PotPlayer失败:", error);
            showMessage(`打开失败: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    /**
     * 在浏览器中打开媒体
     */
    private async openInBrowser(url: string): Promise<void> {
        try {
            const isElectron = window.navigator.userAgent.includes('Electron');
            
            if (isElectron) {
                // Electron环境使用shell打开
                const { shell } = require('electron');
                await shell.openExternal(url);
                return;
            }
            
            // 非Electron环境，使用固定窗口名称策略
            const windowKey = url.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 30);
            
            // 检查是否已经有窗口打开
            if (BROWSER_WINDOWS[windowKey] && !BROWSER_WINDOWS[windowKey].closed) {
                try {
                    // 尝试聚焦现有窗口
                    BROWSER_WINDOWS[windowKey].focus();
                    
                    // 如果当前URL与目标URL不同，则更新
                    try {
                        if (BROWSER_WINDOWS[windowKey].location.href !== url) {
                            BROWSER_WINDOWS[windowKey].location.href = url;
                        }
                    } catch (e) {
                        // 跨域问题，忽略
                        console.log("无法访问窗口location，可能是跨域限制");
                    }
                    
                    return;
                } catch (e) {
                    // 窗口可能无法访问，创建新窗口
                    console.log("现有窗口无法访问:", e);
                }
            }
            
            // 创建新窗口
            const mediaWindow = window.open(url, windowKey);
            if (mediaWindow) {
                BROWSER_WINDOWS[windowKey] = mediaWindow;
            }
        } catch (error) {
            console.error("在浏览器中打开失败:", error);
            showMessage(`在浏览器中打开失败: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    /**
     * 格式化时间为PotPlayer格式
     */
    private formatTime(seconds: number): string {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = Math.floor(seconds % 60);
        
        return [
            h > 0 ? h.toString().padStart(2, '0') : '00',
            m.toString().padStart(2, '0'),
            s.toString().padStart(2, '0')
        ].join(':');
    }

    /**
     * 在内置播放器中打开
     */
    private async openInBuiltPlayer(url: string): Promise<void> {
        if (!document.querySelector('.media-player-tab')) {
            this.openTabCallback();
            await new Promise<void>((resolve) => {
                const checkExist = setInterval(() => {
                    if (document.querySelector('.media-player-tab')) {
                        clearInterval(checkExist);
                        resolve();
                    }
                }, 100);
            });
            // 等待组件初始化
            await new Promise(resolve => setTimeout(resolve, 200));
        }
        
        if (this.playlist) {
            await this.playlist.addMedia(url, { autoPlay: true });
        }
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