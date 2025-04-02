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
    
    // B站链接快速判断
    if (urlLower.includes('bilibili.com')) return 'bilibili';
    
    // 通过扩展名识别媒体类型
    const isVideo = MEDIA_EXTENSIONS.VIDEO.some(ext => urlLower.endsWith(ext));
    if (isVideo) return 'video';
    
    const isAudio = MEDIA_EXTENSIONS.AUDIO.some(ext => urlLower.endsWith(ext));
    if (isAudio) return 'audio';
    
    // 默认为视频类型
    return 'video';
}

/**
 * 将本地路径转换为 file:// URL
 * @param path 本地文件路径或URL
 * @returns 标准化后的URL
 */
export function convertToFileUrl(path: string): string {
    // 已经是URL格式的直接返回
    if (/^(https?|file):\/\//.test(path)) return path;
    
    // Windows路径转换 (C:\path\to\file.mp4 -> file:///C:/path/to/file.mp4)
    if (/^[a-zA-Z]:\\/.test(path)) {
        return 'file:///' + path.replace(/\\/g, '/');
    }
    
    // Unix路径转换
    return 'file://' + path;
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
        // 移除扩展名并解码
        const title = decodeURIComponent(filename.split('.')[0]);
        return title || '未知标题';
    } catch {
        // URL解析失败时，尝试从字符串中提取文件名
        const parts = url.split(/[/\\]/);
        const lastPart = parts[parts.length - 1].split('.')[0];
        return lastPart || '未知标题';
    }
}

/**
 * 检查链接是否为支持的媒体链接
 * @param url 需要检查的链接
 * @returns 是否支持
 */
export function isSupportedMediaLink(url: string): boolean {
    // 空链接直接返回false
    if (!url) return false;
    
    const urlLower = url.toLowerCase();
    
    // 快速检查常见情况
    if (urlLower.includes('bilibili.com')) return true;
    if (MEDIA_KEYWORDS.some(kw => urlLower.includes(kw))) return true;
    if (urlLower.includes('t=')) return true; // 时间戳参数
    
    try {
        const urlObj = new URL(url);
        const urlPath = urlObj.pathname.toLowerCase();
        
        // 检查扩展名
        if (MEDIA_EXTENSIONS.ALL.some(ext => urlPath.endsWith(ext))) return true;
        
        // 本地文件特殊检查
        if (urlObj.protocol === 'file:') {
            return MEDIA_EXTENSIONS.ALL.some(ext => urlPath.endsWith(ext));
        }
        
        // 检查是否有时间参数
        return urlObj.searchParams.has('t');
    } catch {
        // URL解析失败，尝试检查字符串中的扩展名
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
    // 空链接处理
    if (!url) return { mediaUrl: '' };
    
    try {
        const urlObj = new URL(url);
        const timeParam = urlObj.searchParams.get('t');
        
        // 没有时间参数，直接返回原始链接
        if (!timeParam) return { mediaUrl: url };
        
        // 移除时间参数获取干净的URL
        urlObj.searchParams.delete('t');
        const mediaUrl = urlObj.toString();
        
        // 解析时间范围 (例如 t=10-30 表示从10秒到30秒)
        if (timeParam.includes('-')) {
            const [start, end] = timeParam.split('-').map(Number);
            return {
                mediaUrl,
                startTime: isNaN(start) ? undefined : start,
                endTime: isNaN(end) ? undefined : end
            };
        } 
        
        // 单一时间点 (例如 t=10 表示从10秒开始)
        const time = Number(timeParam);
        return {
            mediaUrl,
            startTime: isNaN(time) ? undefined : time
        };
    } catch {
        // URL解析失败，返回原始URL
        return { mediaUrl: url };
    }
} 