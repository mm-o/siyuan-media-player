/**
 * AList API交互模块
 */
import type { MediaItem } from './types';
import { formatDuration } from './utils';

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
const CACHE_EXPIRY = 5 * 60 * 1000; // 5分钟缓存过期

/**
 * AList管理器
 */
export class AListManager {
    private static config: AListConfig | null = null;
    private static token: string | null = null;
    private static FILE_CACHE = new Map<string, {files: AListFile[], timestamp: number}>();
    private static LINK_CACHE = new Map<string, {url: string, timestamp: number}>();

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
     * 获取目录内容
     */
    static async listFiles(path: string = '/'): Promise<AListFile[]> {
        if (!this.config?.token) throw new Error("未连接到AList服务器");

        // 检查缓存
        const now = Date.now();
        const cached = this.FILE_CACHE.get(path);
        if (cached && (now - cached.timestamp < CACHE_EXPIRY)) {
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
            if (cached) return cached.files;
            throw new Error(`获取文件列表失败: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    /**
     * 获取文件下载链接
     */
    static async getFileLink(path: string): Promise<string> {
        if (!this.config?.token) throw new Error("未连接到AList服务器");
        
        // 检查链接缓存
        const now = Date.now();
        const cached = this.LINK_CACHE.get(path);
        if (cached && (now - cached.timestamp < CACHE_EXPIRY)) {
            return cached.url;
        }

        try {
            const res = await fetch(`${this.config.server}/api/fs/get`, {
                method: 'POST',
                headers: {'Content-Type': 'application/json', 'Authorization': this.token},
                body: JSON.stringify({path, password: ''})
            });
            
            const data = await res.json();
            if (data.code === 200) {
                const url = data.data.raw_url || `${this.config.server}/d${path}?sign=${data.data.sign}`;
                this.LINK_CACHE.set(path, {url, timestamp: now});
                return url;
            }
            throw new Error(data.message || "获取文件链接失败");
        } catch (error) {
            if (cached) return cached.url;
            throw new Error(`获取文件链接失败: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    /**
     * 创建媒体项
     */
    static async createMediaItem(file: AListFile, basePath: string): Promise<MediaItem | null> {
        if (!this.isMediaFile(file)) return null;

        try {
            const filePath = `${basePath === '/' ? '' : basePath}/${file.name}`;
            const fileUrl = await this.getFileLink(filePath);
            const extension = file.name.toLowerCase().split('.').pop() || '';
            const isAudio = AUDIO_EXTENSIONS.some(ext => extension.endsWith(ext.substring(1)));
            
            return {
                id: `alist-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
                title: file.name,
                url: fileUrl,
                thumbnail: file.thumb || '/plugins/siyuan-media-player/thumbnails/default.svg',
                type: isAudio ? 'audio' : 'video',
                duration: formatDuration(Math.floor(file.size / 1024 / 1024)),
                source: 'alist',
                sourcePath: filePath,
                size: file.size
            };
        } catch (error) {
            console.error("创建媒体项失败:", error);
            return null;
        }
    }

    // 工具方法
    static isMediaFile = (file: AListFile): boolean => !file.is_dir && MEDIA_EXTENSIONS.some(ext => file.name.toLowerCase().endsWith(ext));
    static getConfig = () => this.config;
    static setConfig = (config: AListConfig) => { this.config = config; };
    static clearConnection = () => { 
        this.config = null;
        this.token = null;
        this.FILE_CACHE.clear();
        this.LINK_CACHE.clear();
    };
    static refreshFolder = async (path: string) => { 
        this.FILE_CACHE.delete(path); 
        return this.listFiles(path); 
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