/**
 * AList API交互模块
 * 用于处理与AList服务器的通信和文件访问
 */
import type { MediaItem } from './types';
import { formatDuration } from './utils';

// AList配置接口
export interface AListConfig {
    server: string;    // 服务器地址 
    username: string;  // 用户名
    password: string;  // 密码
    token?: string;    // 认证令牌
    connected?: boolean; // 连接状态
}

// AList文件项接口
export interface AListFile {
    name: string;       // 文件名
    path: string;       // 路径
    size: number;       // 文件大小
    is_dir: boolean;    // 是否是目录
    modified: string;   // 修改时间
    thumb: string;      // 缩略图
    type: number;       // 文件类型
    sign?: string;      // 文件签名(用于下载)
}

// 媒体文件扩展名
const MEDIA_EXTENSIONS = [
    // 视频格式
    '.mp4', '.webm', '.mkv', '.avi', '.mov', '.flv', '.m4v', '.wmv',
    // 音频格式
    '.mp3', '.wav', '.ogg', '.flac', '.aac', '.m4a'
];

/**
 * AList管理器
 * 处理与AList服务器的所有交互
 */
export class AListManager {
    private static config: AListConfig | null = null;
    private static token: string | null = null;
    private static FILE_CACHE = new Map<string, AListFile[]>();

    /**
     * 检查服务器连接
     */
    static async checkConnection(config: AListConfig): Promise<{connected: boolean, message: string}> {
        try {
            const response = await fetch(`${config.server}/api/auth/login`, {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({
                    username: config.username,
                    password: config.password
                })
            });
            
            const data = await response.json();
            
            if (data.code === 200) {
                this.token = data.data.token;
                this.config = {...config, token: this.token, connected: true};
                return {connected: true, message: "连接成功"};
            } else {
                return {connected: false, message: data.message || "认证失败"};
            }
        } catch (error) {
            return {connected: false, message: `连接失败: ${error instanceof Error ? error.message : String(error)}`};
        }
    }

    /**
     * 获取目录内容
     */
    static async listFiles(path: string = '/'): Promise<AListFile[]> {
        if (!this.config?.token) {
            throw new Error("未连接到AList服务器");
        }

        // 检查缓存
        if (this.FILE_CACHE.has(path)) {
            return this.FILE_CACHE.get(path)!;
        }

        try {
            const response = await fetch(`${this.config.server}/api/fs/list`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': this.token
                },
                body: JSON.stringify({
                    path: path,
                    password: '',
                    page: 1,
                    per_page: 1000,
                    refresh: false
                })
            });
            
            const data = await response.json();
            
            if (data.code === 200) {
                const files = data.data.content || [];
                this.FILE_CACHE.set(path, files);
                return files;
            } else {
                throw new Error(data.message || "获取文件列表失败");
            }
        } catch (error) {
            throw new Error(`获取文件列表失败: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    /**
     * 获取文件下载链接
     */
    static async getFileLink(path: string): Promise<string> {
        if (!this.config?.token) {
            throw new Error("未连接到AList服务器");
        }

        try {
            const response = await fetch(`${this.config.server}/api/fs/get`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': this.token
                },
                body: JSON.stringify({
                    path: path,
                    password: ''
                })
            });
            
            const data = await response.json();
            
            if (data.code === 200) {
                const rawUrl = data.data.raw_url;
                // 对于直链返回直接使用
                if (rawUrl) return rawUrl;
                
                // 否则构建代理链接
                return `${this.config.server}/d${path}?sign=${data.data.sign}`;
            } else {
                throw new Error(data.message || "获取文件链接失败");
            }
        } catch (error) {
            throw new Error(`获取文件链接失败: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    /**
     * 检查文件是否为媒体文件
     */
    static isMediaFile(file: AListFile): boolean {
        if (file.is_dir) return false;
        
        const lowerName = file.name.toLowerCase();
        return MEDIA_EXTENSIONS.some(ext => lowerName.endsWith(ext));
    }

    /**
     * 将AList文件夹转换为媒体文件夹
     */
    static async createFolderItem(folderPath: string, folderName?: string): Promise<{
        id: string,
        name: string,
        path: string,
        files: MediaItem[]
    }> {
        // 获取文件夹中的文件
        const files = await this.listFiles(folderPath);
        const mediaFiles = files.filter(file => this.isMediaFile(file));
        
        // 创建媒体项
        const mediaItems = await Promise.all(
            mediaFiles.map(async file => this.createMediaItem(file, folderPath))
        );
        
        // 生成文件夹ID
        const timestamp = Date.now();
        const id = `alist-folder-${timestamp}`;
        
        return {
            id,
            name: folderName || folderPath.split('/').pop() || '根目录',
            path: folderPath,
            files: mediaItems.filter(Boolean) as MediaItem[]
        };
    }

    /**
     * 将AList文件转换为媒体项
     */
    static async createMediaItem(file: AListFile, basePath: string): Promise<MediaItem | null> {
        if (!this.isMediaFile(file)) return null;

        try {
            const filePath = `${basePath === '/' ? '' : basePath}/${file.name}`;
            const fileUrl = await this.getFileLink(filePath);
            
            // 确定媒体类型
            const extension = file.name.toLowerCase().split('.').pop() || '';
            const isAudio = ['.mp3', '.wav', '.ogg', '.flac', '.aac', '.m4a'].some(ext => 
                extension.endsWith(ext.substring(1))
            );
            
            return {
                id: `alist-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
                title: file.name,
                url: fileUrl,
                thumbnail: file.thumb || '/plugins/siyuan-media-player/thumbnails/default.svg',
                type: isAudio ? 'audio' : 'video',
                // 使用文件大小作为虚拟时长
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

    /**
     * 刷新文件夹内容
     */
    static async refreshFolder(path: string): Promise<AListFile[]> {
        this.FILE_CACHE.delete(path);
        return await this.listFiles(path);
    }

    /**
     * 获取配置
     */
    static getConfig(): AListConfig | null {
        return this.config;
    }

    /**
     * 设置配置
     */
    static setConfig(config: AListConfig): void {
        this.config = config;
    }

    /**
     * 清除连接
     */
    static clearConnection(): void {
        this.config = null;
        this.token = null;
        this.FILE_CACHE.clear();
    }

    /**
     * 从配置中初始化AList
     * 用于应用启动时从保存的配置中加载
     */
    static async initFromConfig(config: any): Promise<boolean> {
        if (!config?.settings?.alistConfig?.server) return false;
        
        const alistConfig = config.settings.alistConfig;
        if (alistConfig.connected && alistConfig.token) {
            this.config = alistConfig;
            this.token = alistConfig.token;
            return true;
        }
        
        // 如果有配置但没有token，尝试重新连接
        if (alistConfig.server && alistConfig.username && alistConfig.password) {
            try {
                const result = await this.checkConnection(alistConfig);
                return result.connected;
            } catch {
                return false;
            }
        }
        
        return false;
    }
} 