import { showMessage } from "siyuan";
import type { ConfigManager } from "./config";
import { isSupportedMediaLink, parseMediaLink } from './utils';
import { PlayerType } from './types';

// 常量定义
const BROWSER_WINDOWS: { [key: string]: Window } = {};
let lastPotPlayerCommand = '';
const BILIBILI_VIDEO_REGEX = /bilibili\.com\/video\/(BV[\w]+)/i;
const IS_ELECTRON = window.navigator.userAgent.includes('Electron');

// 工具函数
const formatTime = (seconds: number): string => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    
    return [
        h > 0 ? h.toString().padStart(2, '0') : '00',
        m.toString().padStart(2, '0'),
        s.toString().padStart(2, '0')
    ].join(':');
};

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
            
            await this.handleMediaLink(url, e.ctrlKey);
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
            const playerType = forceBrowser ? PlayerType.BROWSER : config.settings.playerType;
            
            switch (playerType) {
                case PlayerType.POT_PLAYER:
                    await this.openWithPotPlayer(url, config.settings.playerPath);
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
            
            const { mediaUrl, startTime } = parseMediaLink(url);
            const timeStr = startTime ? formatTime(startTime) : '';
            
            // 处理文件路径
            const processedUrl = mediaUrl.startsWith('file:///')
                ? mediaUrl.substring(8).replace(/\//g, '\\')
                : mediaUrl;
            
            if (IS_ELECTRON) {
                this.executeElectronCommand(cleanPath, processedUrl, timeStr);
            } else {
                this.executeApiCommand(cleanPath, processedUrl, timeStr);
            }
        } catch (error) {
            console.error("打开PotPlayer失败:", error);
            showMessage(`打开失败: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    
    private executeElectronCommand(playerPath: string, url: string, timeStr: string): void {
        const { exec } = require('child_process');
        const os = require('os');
        let command = '';
        
        if (os.platform() === 'win32') {
            command = `"${playerPath}" "${url}"${timeStr ? ` /seek=${timeStr}` : ''} /current`;
            
            if (command === lastPotPlayerCommand) {
                console.log("跳过重复的PotPlayer命令");
                return;
            }
            
            lastPotPlayerCommand = command;
            exec(command, (error: any) => {
                if (error) {
                    console.error("PotPlayer命令执行失败:", error);
                    showMessage(`播放失败: ${error.message}`);
                    lastPotPlayerCommand = '';
                }
            });
        } else {
            command = os.platform() === 'darwin'
                ? `open -a "${playerPath}" "${url}"`
                : `"${playerPath}" "${url}"`;
            
            exec(command);
        }
    }
    
    private executeApiCommand(playerPath: string, url: string, timeStr: string): void {
        const command = `"${playerPath}" "${url}"${timeStr ? ` /seek=${timeStr}` : ''} /current`;
        
        fetch('/api/system/execCommand', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ command })
        }).catch(e => console.error("命令执行失败:", e));
    }

    /**
     * 在浏览器中打开媒体
     */
    private async openInBrowser(url: string): Promise<void> {
        try {
            if (IS_ELECTRON) {
                const { shell } = require('electron');
                await shell.openExternal(url);
                return;
            }
            
            const windowKey = url.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 30);
            
            // 尝试重用已打开的窗口
            const existingWindow = BROWSER_WINDOWS[windowKey];
            if (existingWindow && !existingWindow.closed) {
                try {
                    existingWindow.focus();
                    try {
                        if (existingWindow.location.href !== url) {
                            existingWindow.location.href = url;
                        }
                    } catch {}
                    return;
                } catch {}
            }
            
            // 创建新窗口
            const mediaWindow = window.open(url, windowKey);
            if (mediaWindow) BROWSER_WINDOWS[windowKey] = mediaWindow;
        } catch (error) {
            console.error("在浏览器中打开失败:", error);
            showMessage(`在浏览器中打开失败: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    /**
     * 在内置播放器中打开
     */
    private async openInBuiltPlayer(url: string): Promise<void> {
        // 确保播放器标签已打开
        if (!document.querySelector('.media-player-tab')) {
            this.openTabCallback();
            await this.waitForElement('.media-player-tab', 2000);
        }

        // 解析媒体URL和时间戳
        const { mediaUrl, startTime, endTime } = parseMediaLink(url);
        
        // 尝试使用全局对象进行顺滑跳转
        const siyuanPlayer = (window as any).siyuanMediaPlayer;
        if (siyuanPlayer?.getCurrentMedia && this.isSameMedia(siyuanPlayer.getCurrentMedia(), mediaUrl)) {
            console.info('[LinkHandler] 使用顺滑跳转');
            
            if (startTime !== undefined) {
                if (endTime !== undefined) {
                    siyuanPlayer.setLoopSegment?.(startTime, endTime);
                } else {
                    siyuanPlayer.seekTo?.(startTime);
                }
            }
            return;
        }
        
        // 添加到播放列表并播放
        this.playlist?.addMedia(url, { autoPlay: true });
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
     * 判断是否为同一个媒体
     */
    private isSameMedia(currentItem: any, mediaUrl: string): boolean {
        if (!currentItem) return false;
        
        // B站视频通过bvid比较
        if (currentItem.type === 'bilibili' && currentItem.bvid) {
            if (!mediaUrl.includes('bilibili.com/video')) return false;
            
            // 简化提取BV号
            const bvMatch = mediaUrl.match(/bilibili\.com\/video\/(BV[\w]+)/i);
            if (!bvMatch) return false;
            
            const urlBvid = bvMatch[1].toUpperCase();
            const currentBvid = currentItem.bvid.toUpperCase();
            
            // BV号必须相同
            if (urlBvid !== currentBvid) return false;
            
            // 获取URL中的分P信息
            let urlPartNum;
            try {
                const urlObj = new URL(mediaUrl);
                const pParam = urlObj.searchParams.get('p');
                if (pParam) urlPartNum = parseInt(pParam, 10);
            } catch {}
            
            // 获取当前项目的分P信息
            let currentPartNum;
            if (currentItem.id?.includes('-p')) {
                const partMatch = currentItem.id.match(/-p(\d+)$/);
                if (partMatch) currentPartNum = parseInt(partMatch[1], 10);
            }
            
            // URL中未指定分P，或者分P相同时才认为是同一视频
            return !urlPartNum || (urlPartNum === currentPartNum);
        }
        
        // 普通视频通过URL比较
        return currentItem.url === mediaUrl;
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