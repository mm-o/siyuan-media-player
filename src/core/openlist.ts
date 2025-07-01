/**
 * OpenList API交互模块
 */
import type { MediaItem } from './types';
import { EXT } from './player';

// 接口定义
export interface OpenListConfig {
    server: string;
    username: string;
    password: string;
    token?: string;
    connected?: boolean;
}

export interface OpenListFile {
    name: string;
    path: string;
    size: number;
    is_dir: boolean;
    modified: string;
    thumb: string;
    type: number;
    sign?: string;
    raw_url?: string;
    url?: string;
}

// ===== 媒体检测工具 =====
const media = {
    isVideoFile: (name: string): boolean => 
        EXT.VIDEO.some(ext => name.toLowerCase().endsWith(ext) || name.toLowerCase().split('?')[0].endsWith(ext)),
    
    isAudioFile: (name: string): boolean => 
        EXT.AUDIO.some(ext => name.toLowerCase().endsWith(ext) || name.toLowerCase().split('?')[0].endsWith(ext)),
    
    isMediaFile: (name: string): boolean => 
        EXT.MEDIA.some(ext => name.toLowerCase().endsWith(ext) || name.toLowerCase().split('?')[0].endsWith(ext)),
    
    isSupported: (name: string): boolean => 
        EXT.MEDIA.some(ext => name.toLowerCase().endsWith(ext) || name.toLowerCase().split('?')[0].endsWith(ext))
};

/**
 * OpenList管理器
 */
export class OpenListManager {
    private static config: OpenListConfig | null = null;
    private static token: string | null = null;
    private static FILE_CACHE = new Map<string, {files: OpenListFile[], timestamp: number}>();
    private static CACHE_EXPIRY = 5 * 60 * 1000; // 5分钟缓存过期

    // 基础API方法
    /**
     * 连接到OpenList服务器并登录
     */
    static async checkConnection(config: OpenListConfig): Promise<{connected: boolean, message: string}> {
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
     * 确保有效的连接和令牌
     */
    private static async ensureConnection(): Promise<boolean> {
        if (!this.config) return false;
        
        if (!this.token?.trim()) {
            const result = await this.checkConnection(this.config);
            return result.connected;
        }
        return true;
    }

    /**
     * 执行OpenList API请求
     */
    private static async apiRequest<T>(
        endpoint: string, 
        body: any, 
        errorMessage: string
    ): Promise<T> {
        if (!this.config?.token) throw new Error("未连接到OpenList服务器");
        if (!await this.ensureConnection()) throw new Error("OpenList连接失败");
        
        const res = await fetch(`${this.config.server}${endpoint}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json', 
                'Authorization': this.token || ''
            },
            body: JSON.stringify(body)
        });
    
        if (!res.ok) throw new Error(`HTTP错误: ${res.status}`);
        
        const data = await res.json();
        
        if (data.code === 200) return data.data as T;
        if (data.code === 401) {
            // 令牌过期，重新连接
            if (await this.ensureConnection()) {
                return this.apiRequest(endpoint, body, errorMessage);
            }
        }
        
        throw new Error(data.message || errorMessage);
    }

    /**
     * 获取文件详情
     */
    static async getFileDetail(path: string): Promise<any> {
        if (!path || path === '/') throw new Error("无效的文件路径");
        
        // 处理路径编码
        const processedPath = path.includes('%') ? decodeURIComponent(path) : path;
        
        return this.apiRequest<any>(
            '/api/fs/get', 
            {path: processedPath, password: ''}, 
            "获取文件详情失败"
        );
    }

    /**
     * 获取文件下载链接
     */
    static async getFileLink(path: string): Promise<string> {
        const fileInfo = await this.getFileDetail(path);
        
        // 按优先级获取直接播放URL
        if (fileInfo.raw_url) return fileInfo.raw_url;
        if (fileInfo.sign) return `${this.config?.server}/d${path}?sign=${fileInfo.sign}`;
        if (fileInfo.url) return fileInfo.url;
        
        throw new Error('无法获取文件播放链接');
    }

    /**
     * 获取目录内容列表
     */
    static async getDirectoryContents(path: string = '/'): Promise<OpenListFile[]> {
        // 检查缓存
        const now = Date.now();
        const cached = this.FILE_CACHE.get(path);
        if (cached && (now - cached.timestamp < this.CACHE_EXPIRY)) {
            return cached.files;
        }

        try {
            const data = await this.apiRequest<{content: OpenListFile[]}>(
                '/api/fs/list', 
                {path, password: '', page: 1, per_page: 1000, refresh: false},
                "获取文件列表失败"
            );
            
            const files = data.content || [];
            this.FILE_CACHE.set(path, {files, timestamp: now});
            return files;
        } catch (error) {
            // 尝试使用缓存
            if (cached) return cached.files;
            throw error;
        }
    }

    /**
     * 从URL解析OpenList路径
     */
    static parsePathFromUrl(url: string): string | null {
        try {
            if (!url) return null;
            
            // 检查是否包含支持的扩展名
            if (!media.isSupported(url)) return null;
            
            // 如果配置了OpenList服务器，优先通过服务器地址判断
            if (this.config?.server) {
                const serverDomain = this.config.server.replace(/^https?:\/\//, '').replace(/\/$/, '');
                if (url.includes(serverDomain)) {
                    // 处理完整URL或相对路径
                    const pathPart = url.startsWith('http') 
                        ? url.replace(this.config.server, '').split(/[?#]/)[0]
                        : url.split(/[?#]/)[0];
                    
                    return pathPart.startsWith('/') ? pathPart : `/${pathPart}`;
                }
            }
            
            // 通用解析：判断是否为典型OpenList URL格式
            if (url.match(/https?:\/\/.*?:\d+\/[^?#]+\.\w+/i)) {
                try {
                    const urlObj = new URL(url);
                    if (urlObj.port && urlObj.pathname.length > 1) {
                        return urlObj.pathname;
                    }
                } catch {}
            }
            
            return null;
        } catch {
            return null;
        }
    }

    /**
     * 创建媒体项 - 从OpenList路径创建媒体项用于播放
     */
    static async createMediaItemFromPath(path: string, timeParams: { startTime?: number, endTime?: number } = {}): Promise<MediaItem> {
        if (!this.config?.token) throw new Error("未连接到OpenList服务器");

        const fileName = path.split('/').pop() || '未知文件';
        const isAudio = media.isAudioFile(fileName);
        const fileLink = await this.getFileLink(path);
        
        return {
            id: `openlist-direct-${Date.now()}`,
            title: fileName,
            url: fileLink,
            type: isAudio ? 'audio' : 'video',
            source: 'openlist',
            sourcePath: path,
            startTime: timeParams.startTime,
            endTime: timeParams.endTime,
            isLoop: timeParams.endTime !== undefined,
            thumbnail: isAudio ? '/plugins/siyuan-media-player/assets/images/audio.png' : '/plugins/siyuan-media-player/assets/images/video.png'
        };
    }

    /**
     * 处理OpenList媒体链接 - 从链接直接播放媒体
     */
    static async handleOpenListMediaLink(url: string, timeParams: { startTime?: number, endTime?: number } = {}): Promise<{success: boolean; mediaItem?: MediaItem; error?: string}> {
        if (!this.config?.token) {
            return {success: false, error: "未连接到OpenList服务器"};
        }
        
        // 尝试获取路径
        let openlistPath = this.parsePathFromUrl(url);
        if (!openlistPath && this.config.server && url.startsWith(this.config.server)) {
            openlistPath = url.substring(this.config.server.length).split('?')[0];
        }
        
        if (!openlistPath) {
            return {success: false, error: "无法从链接解析OpenList路径"};
        }
        
        try {
            const mediaItem = await this.createMediaItemFromPath(openlistPath, timeParams);
            return {success: true, mediaItem};
        } catch (error) {
            return {
                success: false, 
                error: error instanceof Error ? error.message : String(error)
            };
        }
    }

    /**
     * 创建目录内的媒体项列表 - 用于播放列表展示
     */
    static async createMediaItemsFromDirectory(path: string): Promise<MediaItem[]> {
        const files = await this.getDirectoryContents(path);
        
        return files.map(file => {
            if (file.is_dir) {
                // 文件夹项
                return {
                    id: `openlist-folder-${Date.now()}-${Math.random().toString(36).slice(2,5)}`,
                    title: file.name,
                    type: 'folder',
                    url: '#',
                    source: 'openlist',
                    sourcePath: `${path === '/' ? '' : path}/${file.name}`,
                    is_dir: true,
                    thumbnail: '/plugins/siyuan-media-player/assets/images/folder.png'
                } as MediaItem;
            } else if (media.isMediaFile(file.name)) {
                // 媒体文件项
                const filePath = `${path === '/' ? '' : path}/${file.name}`;
                return {
                    id: `openlist-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
                    title: file.name,
                    url: `${this.config!.server}${filePath}`,
                    thumbnail: file.thumb || (media.isAudioFile(file.name) ? '/plugins/siyuan-media-player/assets/images/audio.png' : '/plugins/siyuan-media-player/assets/images/video.png'),
                    type: media.isAudioFile(file.name) ? 'audio' : 'video',
                    source: 'openlist',
                    sourcePath: filePath
                } as MediaItem;
            }
            return null;
        }).filter(Boolean) as MediaItem[];
    }

    /**
     * 获取OpenList中同名文件的直接链接 (用于查找字幕/弹幕等辅助文件)
     */
    static async getSupportFileLink(mediaPath: string, extensions: string[]): Promise<string | null> {
        if (!this.config?.server || !this.token) return null;
        
        try {
            const lastSlash = mediaPath.lastIndexOf('/');
            const lastDot = mediaPath.lastIndexOf('.');
            if (lastDot === -1 || lastSlash === -1) return null;
            
            const dirPath = mediaPath.substring(0, lastSlash);
            const fileBase = mediaPath.substring(lastSlash + 1, lastDot);
            
            // 从缓存或API获取目录文件
            const files = await this.getDirectoryContents(dirPath).catch(() => []);
            
            // 查找匹配文件
            for (const ext of extensions) {
                const targetName = `${fileBase}${ext}`;
                const file = files.find(f => f.name.toLowerCase() === targetName.toLowerCase());
                if (!file) continue;
                
                // 获取直接链接
                if (file.sign) return `${this.config.server}/d${dirPath}/${file.name}?sign=${file.sign}`;
                if (file.raw_url) return file.raw_url;
                if (file.url) return file.url;
                
                return this.getFileLink(`${dirPath}/${file.name}`).catch(() => null);
            }
        } catch {}
        
        return null;
    }

    /**
     * 获取媒体流数据 - 与B站视频处理保持一致的格式
     */
    static async getVideoStream(path: string): Promise<import('./types').VideoStream> {
        return { video: { url: await this.getFileLink(path) } };
    }

    // 公共工具方法
    static getConfig = () => this.config;
    static setConfig = (config: OpenListConfig) => { this.config = config; };
    static clearConnection = () => { 
        this.config = null;
        this.token = null;
        this.FILE_CACHE.clear();
    };

    /**
     * 从配置中初始化OpenList
     */
    static async initFromConfig(config: any): Promise<boolean> {
        const openlistConfig = config?.settings?.openlistConfig;
        if (!openlistConfig?.server || !openlistConfig?.username || !openlistConfig?.password) return false;
        
        try {
            return (await this.checkConnection(openlistConfig)).connected;
        } catch {
            return false;
        }
    }
}