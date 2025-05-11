/**
 * AList API交互模块
 */
import type { MediaItem } from './types';
import { fmt } from './utils';
import { DEFAULT_THUMBNAILS } from './media';

// 接口定义
export interface AListConfig {
    server: string;
    username: string;
    password: string;
    token?: string;
    connected?: boolean;
}

export interface AListFile {
    name: string;
    path: string;
    size: number;
    is_dir: boolean;
    modified: string;
    thumb: string;
    type: number;
    sign?: string;
}

// 常量
const MEDIA_EXTENSIONS = ['.mp4', '.webm', '.mkv', '.avi', '.mov', '.flv', '.m4v', '.wmv', '.mp3', '.wav', '.ogg', '.flac', '.aac', '.m4a'];
const AUDIO_EXTENSIONS = ['.mp3', '.wav', '.ogg', '.flac', '.aac', '.m4a'];

/**
 * AList管理器
 */
export class AListManager {
    private static config: AListConfig | null = null;
    private static token: string | null = null;
    private static FILE_CACHE = new Map<string, {files: AListFile[], timestamp: number}>();
    private static CACHE_EXPIRY = 5 * 60 * 1000; // 5分钟缓存过期

    /**
     * 检查服务器连接
     */
    static async checkConnection(config: AListConfig): Promise<{connected: boolean, message: string}> {
        try {
            const res = await fetch(`${config.server}/api/auth/login`, {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({username: config.username, password: config.password})
            });
            
            const data = await res.json();
            if (data.code === 200) {
                this.token = data.data.token;
                this.config = {...config, token: this.token, connected: true};
                return {connected: true, message: "连接成功"};
            }
            return {connected: false, message: data.message || "认证失败"};
        } catch (error) {
            return {connected: false, message: `连接失败: ${error instanceof Error ? error.message : String(error)}`};
        }
    }

    /**
     * 获取文件下载链接
     */
    static async getFileLink(path: string): Promise<string> {
        if (!this.config?.token) {
            throw new Error("未连接到AList服务器");
        }
        
        if (!path || path === '' || path === '/') {
            throw new Error("无效的文件路径");
        }

        // 确保token有效
        if (!this.token || this.token.trim() === '') {
            const loginResult = await this.checkConnection(this.config);
            if (!loginResult.connected) {
                throw new Error(`登录失败: ${loginResult.message}`);
            }
        }
        
        const res = await fetch(`${this.config.server}/api/fs/get`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json', 
                'Authorization': this.token || ''
            },
            body: JSON.stringify({path, password: ''})
        });
    
        if (!res.ok) {
            throw new Error(`HTTP错误: ${res.status} ${res.statusText}`);
        }
            
        const data = await res.json();
            
        if (data.code === 200) {
            // 获取直接播放URL
            if (data.data.raw_url) return data.data.raw_url;
            if (data.data.sign) return `${this.config.server}/d${path}?sign=${data.data.sign}`;
            if (data.data.url) return data.data.url;
            throw new Error('无法从响应中获取URL');
        }
        
        // 处理令牌过期
        if (data.code === 401 || data.message?.includes('token') || data.message?.includes('认证')) {
            const loginResult = await this.checkConnection(this.config);
            if (loginResult.connected) {
                return this.getFileLink(path); // 重试
            }
        }
        
        throw new Error(data.message || "获取文件链接失败");
    }

    /**
     * 获取目录内容列表
     * @param path 目录路径
     * @returns 文件列表
     */
    static async getDirectoryContents(path: string = '/'): Promise<AListFile[]> {
        if (!this.config?.token) {
            throw new Error("未连接到AList服务器");
        }

        // 检查缓存
        const now = Date.now();
        const cached = this.FILE_CACHE.get(path);
        if (cached && (now - cached.timestamp < this.CACHE_EXPIRY)) {
            return cached.files;
        }

        try {
            const res = await fetch(`${this.config.server}/api/fs/list`, {
                method: 'POST',
                headers: {'Content-Type': 'application/json', 'Authorization': this.token},
                body: JSON.stringify({path, password: '', page: 1, per_page: 1000, refresh: false})
            });
            
            const data = await res.json();
            if (data.code === 200) {
                const files = data.data.content || [];
                this.FILE_CACHE.set(path, {files, timestamp: now});
                return files;
            }
            throw new Error(data.message || "获取文件列表失败");
        } catch (error) {
            if (cached) return cached.files; // 如果有缓存，使用缓存
            throw new Error(`获取文件列表失败: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    /**
     * 获取媒体流数据 - 与B站视频处理保持一致的格式
     * @param path AList路径
     * @returns VideoStream 结构，与B站视频格式一致
     */
    static async getVideoStream(path: string): Promise<import('./types').VideoStream> {
        if (!this.config?.token) {
            throw new Error("未连接到AList服务器");
        }

        try {
            // 获取文件播放链接
            const fileUrl = await this.getFileLink(path);
            
            // 返回与B站视频相同格式
            return {
                video: {
                    url: fileUrl
                }
            };
        } catch (error) {
            console.error("获取AList媒体流失败:", error);
            throw new Error(`无法获取媒体流: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    /**
     * 从URL解析AList路径
     * @param url AList URL，例如 http://localhost:5244/路径/文件.mp4?t=1.3
     * @returns 解析出的路径
     */
    static parsePathFromUrl(url: string): string | null {
        try {
            if (!url) return null;
            
            // 更简化的识别方式：检查是否包含媒体扩展名
            const mediaExt = /\.(mp4|webm|mkv|avi|mov|flv|m4v|wmv|mp3|wav|ogg|flac|aac|m4a)\b/i;
            if (!mediaExt.test(url)) return null;
            
            // 如果配置了AList服务器，优先通过服务器地址判断
            if (this.config?.server) {
                const serverDomain = this.config.server.replace(/^https?:\/\//, '').replace(/\/$/, '');
                if (url.includes(serverDomain)) {
                    // 移除服务器地址部分
                    const pathPart = url.replace(this.config.server, '');
                    // 去除查询参数
                    const cleanPath = pathPart.split(/[?#]/)[0];
                    return cleanPath.startsWith('/') ? cleanPath : `/${cleanPath}`;
                }
            }
            
            // 尝试从URL中检测是否为常见AList路径格式（例如包含端口5244）
            if (url.match(/:\d+\/.*\.(mp4|webm|mkv|avi|mp3|wav)/i)) {
                const urlObj = new URL(url);
                return urlObj.pathname;
            }
            
            return null;
        } catch (e) {
            console.error('[AListManager] 解析路径失败:', e);
            return null;
        }
    }

    /**
     * 判断是否为媒体文件
     */
    static isMediaFile(fileName: string): boolean {
        return !!fileName.match(/\.(mp4|webm|mkv|avi|mov|flv|m4v|wmv|mp3|wav|ogg|flac|aac|m4a)$/i);
    }

    /**
     * 判断是否为音频文件
     */
    static isAudioFile(fileName: string): boolean {
        return !!fileName.match(/\.(mp3|wav|ogg|flac|aac|m4a)$/i);
    }

    /**
     * 创建目录内的媒体项列表 - 用于播放列表展示
     * @param path 目录路径
     * @returns 媒体项列表
     */
    static async createMediaItemsFromDirectory(path: string): Promise<import('./types').MediaItem[]> {
        if (!this.config?.token) {
            throw new Error("未连接到AList服务器");
        }

        try {
            const files = await this.getDirectoryContents(path);
            const items: import('./types').MediaItem[] = [];

            for (const file of files) {
                if (file.is_dir) {
                    // 添加文件夹
                    items.push({
                        id: `alist-folder-${Date.now()}-${Math.random().toString(36).slice(2,5)}`,
                        title: file.name,
                        type: 'folder',
                        url: '#',
                        source: 'alist',
                        sourcePath: `${path === '/' ? '' : path}/${file.name}`,
                        is_dir: true,
                        thumbnail: DEFAULT_THUMBNAILS.folder
                    });
                } else if (this.isMediaFile(file.name)) {
                    // 添加媒体文件
                    const filePath = `${path === '/' ? '' : path}/${file.name}`;
                    const isAudio = this.isAudioFile(file.name);
                    
                    items.push({
                        id: `alist-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
                        title: file.name,
                        url: `${this.config.server}${filePath}`,
                        thumbnail: file.thumb || '/plugins/siyuan-media-player/thumbnails/default.svg',
                        type: isAudio ? 'audio' : 'video',
                        source: 'alist',
                        sourcePath: filePath
                    });
                }
            }

            return items;
        } catch (error) {
            console.error("获取AList媒体列表失败:", error);
            throw new Error(`获取媒体列表失败: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    /**
     * 创建媒体项 - 从AList路径创建媒体项用于播放
     * @param path AList路径
     * @param timeParams 可选的时间参数
     * @returns 媒体项，用于直接播放
     */
    static async createMediaItemFromPath(path: string, timeParams: { startTime?: number, endTime?: number } = {}): Promise<import('./types').MediaItem> {
        if (!this.config?.token) {
            throw new Error("未连接到AList服务器");
        }

        try {
            // 获取文件名
            const fileName = path.split('/').pop() || '未知文件';
            const isAudio = this.isAudioFile(fileName);
            
            // 创建媒体项 - 与B站视频处理保持一致，不再设置rawUrl
            return {
                id: `alist-direct-${Date.now()}`,
                title: fileName,
                url: `${this.config.server}${path}`,
                type: isAudio ? 'audio' : 'video',
                source: 'alist',
                sourcePath: path,
                startTime: timeParams.startTime,
                endTime: timeParams.endTime,
                isLoop: timeParams.endTime !== undefined,
                thumbnail: '/plugins/siyuan-media-player/thumbnails/default.svg'
            };
        } catch (error) {
            console.error("创建AList媒体项失败:", error);
            throw new Error(`创建媒体项失败: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    // 工具方法
    static getConfig = () => this.config;
    static setConfig = (config: AListConfig) => { this.config = config; };
    static clearConnection = () => { 
        this.config = null;
        this.token = null;
        this.FILE_CACHE.clear();
    };

    /**
     * 从配置中初始化AList
     */
    static async initFromConfig(config: any): Promise<boolean> {
        if (!config?.settings?.alistConfig?.server) return false;
        
        const alistConfig = config.settings.alistConfig;
        if (!alistConfig.server || !alistConfig.username || !alistConfig.password) return false;
        
        try {
            return (await this.checkConnection(alistConfig)).connected;
        } catch {
            return false;
        }
    }
} 