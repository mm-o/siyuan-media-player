/**
 * 通用工具函数
 */

/**
 * 格式化时间戳
 * @param seconds 秒数
 * @param isAnchorText 是否作为锚点文本（只显示整数秒数）
 * @returns 格式化后的时间字符串 (例如: "1:23" 或 "1:23.4")
 */
export function formatTime(seconds: number, isAnchorText = false): string {
    if (isNaN(seconds) || seconds < 0) return '0:00';
    
    const totalSecs = isAnchorText ? Math.round(seconds) : seconds;
    const hours = Math.floor(totalSecs / 3600);
    const minutes = Math.floor((totalSecs % 3600) / 60);
    const secs = isAnchorText 
        ? Math.floor(totalSecs % 60)
        : parseFloat((totalSecs % 60).toFixed(1));
    
    return hours > 0
        ? `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
        : `${minutes}:${secs.toString().padStart(2, '0')}`;
}

/**
 * 格式化媒体时长
 * 与formatTime不同，此函数始终显示整数秒
 * @param seconds 秒数
 * @returns 格式化后的时间字符串 (例如: "1:23")
 */
export function formatDuration(seconds: number): string {
    if (isNaN(seconds) || seconds < 0) return '0:00';
    
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    
    return hours > 0
        ? `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
        : `${minutes}:${secs.toString().padStart(2, '0')}`;
}

// 媒体文件扩展名
export const MEDIA_EXTENSIONS = {
    VIDEO: ['.mp4', '.webm', '.ogg', '.mov', '.m4v'],
    AUDIO: ['.mp3', '.wav', '.aac', '.m4a'],
    get ALL() { return [...this.VIDEO, ...this.AUDIO]; }
};

// 媒体关键字
export const MEDIA_KEYWORDS = ['mp3', 'mp4', 'webm', 'ogg', 'wav', 'm4v', 'mov', 'aac', 'm4a'];

/**
 * 判断媒体类型
 * @param url 媒体URL
 * @returns 'video' | 'audio' | 'bilibili'
 */
export function getMediaType(url: string): 'video' | 'audio' | 'bilibili' {
    const urlLower = url.toLowerCase();
    if (urlLower.includes('bilibili.com')) return 'bilibili';
    if (MEDIA_EXTENSIONS.VIDEO.some(ext => urlLower.endsWith(ext))) return 'video';
    if (MEDIA_EXTENSIONS.AUDIO.some(ext => urlLower.endsWith(ext))) return 'audio';
    return 'video';
}

/**
 * 转换路径为文件URL格式
 */
export function convertToFileUrl(path: string): string {
    path = path.replace(/^["']|["']$/g, '');
    if (/^(https?|file):\/\//.test(path)) return path;
    
    // Windows路径处理
    if (/^[a-zA-Z]:\\/.test(path)) {
        return 'file:///' + path.replace(/\\/g, '/').split('/').map((p, i) => i === 0 ? p : encodeURIComponent(p)).join('/');
    }
    
    // 其他路径
    return 'file://' + path.split('/').map(p => encodeURIComponent(p)).join('/');
}

/**
 * 从URL中提取标题
 * @param url 媒体URL
 * @returns 提取出的标题或默认标题
 */
export function extractTitleFromUrl(url: string): string {
    try {
        const urlObj = new URL(url);
        const pathSegments = urlObj.pathname.split('/');
        const filename = pathSegments[pathSegments.length - 1];
        return decodeURIComponent(filename.split('.')[0]) || '未知标题';
    } catch {
        const parts = url.split(/[/\\]/);
        return parts[parts.length - 1].split('.')[0] || '未知标题';
    }
}

/**
 * 检查链接是否为支持的媒体链接
 * @param url 需要检查的链接
 * @returns 是否支持
 */
export function isSupportedMediaLink(url: string): boolean {
    if (!url) return false;
    
    const urlLower = url.toLowerCase();
    const unsupportedProtocols = ['obsidian:', 'notion:', 'zotero:', 'evernote:', 'onenote:'];
    if (unsupportedProtocols.some(protocol => urlLower.startsWith(protocol))) return false;
    if (urlLower.includes('bilibili.com')) return true;
    
    const hasMediaKeyword = MEDIA_KEYWORDS.some(kw => {
        const pattern = new RegExp(`[/\\\\._-]${kw}[/\\\\._-]|[/\\\\._-]${kw}$|^${kw}[/\\\\._-]|^${kw}$`);
        return pattern.test(urlLower);
    });
    if (hasMediaKeyword) return true;
    
    try {
        const urlObj = new URL(url);
        const supportedProtocols = ['http:', 'https:', 'file:'];
        if (!supportedProtocols.includes(urlObj.protocol)) return false;
        
        const urlPath = urlObj.pathname.toLowerCase();
        if (MEDIA_EXTENSIONS.ALL.some(ext => urlPath.endsWith(ext))) return true;
        
        if (urlObj.protocol === 'file:') {
            return MEDIA_EXTENSIONS.ALL.some(ext => urlPath.endsWith(ext));
        }
        
        const tParam = urlObj.searchParams.get('t');
        return tParam ? /^(\d+(\.\d+)?(-\d+(\.\d+)?)?)$/.test(tParam) : false;
    } catch {
        return MEDIA_EXTENSIONS.ALL.some(ext => urlLower.endsWith(ext));
    }
}

/**
 * 解析媒体链接，提取原始链接和时间戳
 * @param url 包含时间戳的媒体链接
 * @returns 解析结果
 */
export function parseMediaLink(url: string): {
    mediaUrl: string;
    startTime?: number;
    endTime?: number;
} {
    if (!url) return { mediaUrl: '' };
    
    try {
        const urlObj = new URL(url);
        const timeParam = urlObj.searchParams.get('t');
        if (!timeParam) return { mediaUrl: url };
        
        urlObj.searchParams.delete('t');
        const mediaUrl = urlObj.toString();
        
        if (timeParam.includes('-')) {
            const [start, end] = timeParam.split('-').map(Number);
            return {
                mediaUrl,
                startTime: isNaN(start) ? undefined : start,
                endTime: isNaN(end) ? undefined : end
            };
        }
        
        const time = Number(timeParam);
        return {
            mediaUrl,
            startTime: isNaN(time) ? undefined : time
        };
    } catch {
        return { mediaUrl: url };
    }
}

/**
 * 检查Pro功能是否启用
 * @param config 配置对象
 * @returns boolean 是否启用Pro功能
 */
export function checkProEnabled(config: any): boolean {
    return config?.proEnabled === true;
}

/**
 * 显示Pro功能未启用的提示信息
 * @param i18n 国际化对象
 */
export function showProFeatureNotEnabledMessage(i18n?: any): void {
    const { showMessage } = require('siyuan');
    showMessage(i18n?.pro?.notEnabled || "此功能需要Pro版本，请在设置中启用Media Player Pro");
} 