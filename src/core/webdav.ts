import type { MediaItem } from './types';
import { EXT } from './player';

// ===== 接口定义 =====
export interface WebDAVConfig {
    server: string;
    username: string;
    password: string;
    token?: string;
    connected?: boolean;
}

export interface WebDAVFile {
    name: string;
    path: string;
    is_dir: boolean;
    size?: number;
    modified?: string;
    contentType?: string;
}

// ===== 工具函数 =====
const checkExt = (name: string, exts: string[]) => {
    const clean = name.toLowerCase().split('?')[0];
    return exts.some(ext => clean.endsWith(ext));
};
const media = {
    isAudioFile: (name: string) => checkExt(name, EXT.AUDIO),
    isMediaFile: (name: string) => checkExt(name, EXT.MEDIA),
    isSupported: (name: string) => checkExt(name, EXT.MEDIA)
};

// ===== WebDAV管理器 =====
export class WebDAVManager {
    private static config: WebDAVConfig | null = null;
    private static FILE_CACHE = new Map<string, {files: WebDAVFile[], timestamp: number}>();
    private static BLOB_CACHE = new Map<string, {url: string, timestamp: number}>();
    private static CACHE_EXPIRY = 5 * 60 * 1000; // 5分钟缓存

    // 工具方法 - 统一认证和URL构建
    private static getAuth = () => btoa(`${this.config!.username}:${this.config!.password}`);
    private static buildUrl = (path: string) => `${this.config!.server.replace(/\/$/, '')}${path.startsWith('/') ? path : '/' + path}`;
    private static checkConfig = () => { if (!this.config?.server || !this.config?.username || !this.config?.password) throw new Error("WebDAV未配置"); };

    // 连接验证
    static async checkConnection(config: WebDAVConfig): Promise<{connected: boolean, message: string}> {
        try {
            const auth = btoa(`${config.username}:${config.password}`);
            const res = await fetch(`${config.server.replace(/\/$/, '')}/`, {
                method: 'PROPFIND',
                headers: { 'Authorization': `Basic ${auth}`, 'Depth': '0', 'Content-Type': 'application/xml' },
                body: '<?xml version="1.0" encoding="utf-8"?><propfind xmlns="DAV:"><prop><resourcetype/></prop></propfind>'
            });

            if (res.ok) {
                this.config = {...config, connected: true};
                return {connected: true, message: "连接成功"};
            }
            return {connected: false, message: `连接失败: ${res.status} ${res.statusText}`};
        } catch (error) {
            return {connected: false, message: `连接失败: ${error instanceof Error ? error.message : String(error)}`};
        }
    }

    // WebDAV请求封装
    private static async webdavRequest(path: string, method = 'PROPFIND', body?: string): Promise<string> {
        this.checkConfig();
        const res = await fetch(this.buildUrl(path), {
            method,
            headers: { 'Authorization': `Basic ${this.getAuth()}`, 'Depth': '1', 'Content-Type': 'application/xml' },
            body: body || '<?xml version="1.0" encoding="utf-8"?><propfind xmlns="DAV:"><prop><resourcetype/><getcontentlength/><getlastmodified/><getcontenttype/></prop></propfind>'
        });
        if (!res.ok) throw new Error(`WebDAV请求失败: ${res.status} ${res.statusText}`);
        return await res.text();
    }

    // 解析WebDAV响应
    private static parseWebDAVResponse(xmlText: string, basePath: string): WebDAVFile[] {
        try {
            const parser = new DOMParser();
            const doc = parser.parseFromString(xmlText, 'text/xml');
            const responses = doc.querySelectorAll('response');
            const files: WebDAVFile[] = [];
            const serverBasePath = this.config?.server ? new URL(this.config.server).pathname : '/';
            const normalizedBasePath = basePath.endsWith('/') ? basePath : basePath + '/';

            responses.forEach(response => {
                const href = response.querySelector('href')?.textContent;
                if (!href) return;

                let decodedHref = decodeURIComponent(href);

                // 跳过当前目录
                if (decodedHref === basePath || decodedHref === normalizedBasePath ||
                    (basePath !== '/' && decodedHref === basePath.replace(/\/$/, ''))) return;

                // 处理完整URL
                if (decodedHref.startsWith('http')) {
                    try { decodedHref = new URL(decodedHref).pathname; } catch { return; }
                }

                // 移除服务器基础路径
                if (serverBasePath !== '/' && decodedHref.startsWith(serverBasePath)) {
                    decodedHref = decodedHref.substring(serverBasePath.length);
                    if (!decodedHref.startsWith('/')) decodedHref = '/' + decodedHref;
                }

                const name = decodedHref.split('/').filter(Boolean).pop();
                if (!name) return;

                const resourceType = response.querySelector('resourcetype collection');
                const contentLength = response.querySelector('getcontentlength')?.textContent;
                const lastModified = response.querySelector('getlastmodified')?.textContent;
                const contentType = response.querySelector('getcontenttype')?.textContent;

                files.push({
                    name, path: decodedHref, is_dir: !!resourceType,
                    size: contentLength ? parseInt(contentLength) : undefined,
                    modified: lastModified || undefined,
                    contentType: contentType || undefined
                });
            });

            return files;
        } catch { return []; }
    }

    // 获取目录内容
    static async getDirectoryContents(path = '/'): Promise<WebDAVFile[]> {
        const now = Date.now();
        this.cleanExpiredCache();

        // 检查缓存
        const cached = this.FILE_CACHE.get(path);
        if (cached && (now - cached.timestamp < this.CACHE_EXPIRY)) return cached.files;

        try {
            const xmlResponse = await this.webdavRequest(path);
            const files = this.parseWebDAVResponse(xmlResponse, path);
            this.FILE_CACHE.set(path, {files, timestamp: now});
            return files;
        } catch (error) {
            if (cached) return cached.files;
            throw error;
        }
    }

    // 清理过期缓存
    private static cleanExpiredCache(): void {
        const now = Date.now();

        this.BLOB_CACHE.forEach((cached, key) => {
            if (now - cached.timestamp >= this.CACHE_EXPIRY) {
                if (cached.url.startsWith('blob:')) URL.revokeObjectURL(cached.url);
                this.BLOB_CACHE.delete(key);
            }
        });

        this.FILE_CACHE.forEach((cached, key) => {
            if (now - cached.timestamp >= this.CACHE_EXPIRY) this.FILE_CACHE.delete(key);
        });
    }

    // URL解析 - 从URL解析WebDAV路径
    static parsePathFromUrl(url: string): string | null {
        try {
            if (!url || !media.isSupported(url)) return null;

            // 配置服务器地址匹配
            if (this.config?.server) {
                const serverBase = this.config.server.replace(/\/$/, '');
                if (url.startsWith(serverBase)) {
                    const pathPart = url.substring(serverBase.length).split(/[?#]/)[0];
                    return pathPart.startsWith('/') ? pathPart : `/${pathPart}`;
                }
            }

            // 通用WebDAV格式检测
            const patterns = [
                /https?:\/\/[^\/]+\/dav\/(.+)/i,
                /https?:\/\/[^\/]+\/webdav\/(.+)/i,
                /https?:\/\/[^\/]+\/remote\.php\/dav\/(.+)/i,
                /https?:\/\/[^\/]+\/remote\.php\/webdav\/(.+)/i
            ];

            for (const pattern of patterns) {
                const match = url.match(pattern);
                if (match && match[1]) return decodeURIComponent('/' + match[1].split(/[?#]/)[0]);
            }

            // 端口号服务器检测
            if (url.match(/https?:\/\/.*?:\d+\/[^?#]+\.\w+/i)) {
                try {
                    const urlObj = new URL(url);
                    if (urlObj.port && urlObj.pathname.length > 1 && media.isSupported(urlObj.pathname)) return urlObj.pathname;
                } catch {}
            }
        } catch (error) {
            console.warn('WebDAV URL解析失败:', error);
        }
        return null;
    }

    // 获取文件链接 - 创建Blob URL用于播放
    static async getFileLink(path: string): Promise<string> {
        this.checkConfig();
        const cleanPath = path.startsWith('/') ? path : '/' + path;
        const now = Date.now();

        // 检查缓存
        const cached = this.BLOB_CACHE.get(cleanPath);
        if (cached && (now - cached.timestamp < this.CACHE_EXPIRY)) return cached.url;

        // 创建Blob URL
        const response = await fetch(this.buildUrl(cleanPath), { headers: { 'Authorization': `Basic ${this.getAuth()}` } });
        if (!response.ok) throw new Error(`WebDAV文件访问失败: ${response.status}`);

        const blob = await response.blob();
        const blobUrl = URL.createObjectURL(blob);
        this.BLOB_CACHE.set(cleanPath, {url: blobUrl, timestamp: now});
        return blobUrl;
    }

    // 媒体链接处理 - 从链接直接播放
    static async handleWebDAVMediaLink(url: string, timeParams: { startTime?: number, endTime?: number } = {}): Promise<{success: boolean; mediaItem?: MediaItem; error?: string}> {
        try {
            this.checkConfig();
            const webdavPath = this.parsePathFromUrl(url);
            if (!webdavPath) return {success: false, error: "无法从链接解析WebDAV路径"};

            const mediaItem = await this.createMediaItemFromPath(webdavPath, timeParams);
            return {success: true, mediaItem};
        } catch (error) {
            return {success: false, error: error instanceof Error ? error.message : String(error)};
        }
    }

    // 获取原始URL - 用于时间戳链接
    static getOriginalUrl(path: string): string {
        this.checkConfig();
        return this.buildUrl(path);
    }

    // 创建媒体项基础信息
    private static createMediaBase(fileName: string, path: string, url: string) {
        const isAudio = media.isAudioFile(fileName);
        return {
            title: fileName,
            url, originalUrl: this.getOriginalUrl(path),
            type: isAudio ? 'audio' : 'video',
            source: 'webdav', sourcePath: path,
            thumbnail: `/plugins/siyuan-media-player/assets/images/${isAudio ? 'audio' : 'video'}.png`
        };
    }

    // 创建媒体项 - 从路径创建播放用媒体项
    static async createMediaItemFromPath(path: string, timeParams: { startTime?: number, endTime?: number } = {}): Promise<MediaItem> {
        this.checkConfig();
        const fileName = path.split('/').pop() || '未知文件';
        const base = this.createMediaBase(fileName, path, await this.getFileLink(path));

        return {
            id: `webdav-direct-${Date.now()}`,
            ...base,
            startTime: timeParams.startTime,
            endTime: timeParams.endTime,
            isLoop: timeParams.endTime !== undefined
        };
    }

    // 创建目录媒体项列表
    static async createMediaItemsFromDirectory(path = '/'): Promise<MediaItem[]> {
        this.checkConfig();
        const files = await this.getDirectoryContents(path);

        return files.map(file => {
            if (file.is_dir) {
                return {
                    id: `webdav-folder-${Date.now()}-${Math.random().toString(36).slice(2,5)}`,
                    title: file.name, type: 'folder', url: '#', source: 'webdav', sourcePath: file.path, is_dir: true,
                    thumbnail: '/plugins/siyuan-media-player/assets/images/folder.png'
                } as MediaItem;
            } else if (media.isMediaFile(file.name)) {
                const originalUrl = this.buildUrl(file.path);
                return {
                    id: `webdav-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
                    ...this.createMediaBase(file.name, file.path, originalUrl)
                } as MediaItem;
            }
            return null;
        }).filter(Boolean) as MediaItem[];
    }

    // 获取支持文件链接 - 查找同名辅助文件
    static async getSupportFileLink(mediaPath: string, extensions: string[]): Promise<string | null> {
        try {
            this.checkConfig();
            const baseName = mediaPath.split('/').pop()?.split('.')[0];
            if (!baseName) return null;

            const files = await this.getDirectoryContents(mediaPath.substring(0, mediaPath.lastIndexOf('/')));
            for (const ext of extensions) {
                const targetFile = files.find(f => !f.is_dir && f.name.toLowerCase() === `${baseName.toLowerCase()}${ext.toLowerCase()}`);
                if (targetFile) return await this.getFileLink(targetFile.path);
            }
        } catch {}
        return null;
    }

    // ===== 工具方法 =====
    static getConfig = () => this.config;
    static setConfig = (config: WebDAVConfig) => { this.config = config; };
    static clearConnection = () => {
        this.config = null;
        this.FILE_CACHE.clear();
        this.BLOB_CACHE.forEach(cached => { if (cached.url.startsWith('blob:')) URL.revokeObjectURL(cached.url); });
        this.BLOB_CACHE.clear();
    };

    // 从配置初始化
    static async initFromConfig(config: any): Promise<boolean> {
        const cfg = config?.settings?.webdavConfig;
        if (!cfg?.server || !cfg?.username || !cfg?.password) return false;
        try { return (await this.checkConnection(cfg)).connected; } catch { return false; }
    }
}