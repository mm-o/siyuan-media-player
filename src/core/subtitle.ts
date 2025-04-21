/**
 * 字幕处理工具类
 * 用于处理播放器的字幕功能
 */

/**
 * 字幕配置对象
 */
export interface SubtitleOptions {
    url: string;         // 字幕URL
    type?: string;       // 字幕类型 (vtt, srt, ass)
    encoding?: string;   // 字幕编码
    escape?: boolean;    // 是否转义HTML标签
}

/**
 * 字幕条目
 */
export interface SubtitleCue {
    startTime: number;    // 开始时间（秒）
    endTime: number;      // 结束时间（秒）
    text: string;         // 字幕文本
}

/**
 * 字幕处理工具类
 */
export class SubtitleManager {
    private static subtitleCache: Map<string, SubtitleCue[]> = new Map();
    private static currentSubtitles: SubtitleCue[] = [];
    private static supportedFormats = ['srt', 'vtt', 'ass'];

    /**
     * 获取当前加载的字幕
     */
    static getSubtitles(): SubtitleCue[] {
        return this.currentSubtitles;
    }

    /**
     * 设置当前字幕
     */
    static setSubtitles(subtitles: SubtitleCue[]): void {
        this.currentSubtitles = subtitles;
    }

    /**
     * 获取媒体文件对应的字幕
     */
    static async getSubtitleForMedia(mediaUrl: string): Promise<SubtitleOptions | null> {
        if (!mediaUrl?.startsWith('file://')) return null;
        
        try {
            // 解析URL获取文件信息
            const { pathname } = new URL(mediaUrl);
            const pathParts = pathname.split('/');
            const filename = pathParts.pop() || '';
            const fileBase = filename.substring(0, filename.lastIndexOf('.'));
            const dirPath = pathParts.join('/');
            
            if (!fileBase) return null;
            
            // 尝试不同格式的字幕文件
            for (const format of this.supportedFormats) {
                const subtitlePath = `${dirPath}/${fileBase}.${format}`;
                const subtitleUrl = `file://${subtitlePath}`;
                
                try {
                    const response = await fetch(subtitleUrl, { method: 'HEAD' });
                    if (response.ok) {
                        return { 
                            url: subtitleUrl, 
                            type: format,
                            encoding: 'utf-8',
                            escape: true 
                        };
                    }
                } catch {
                    continue;
                }
            }
            
            return null;
        } catch (error) {
            console.error('[字幕] 查找字幕文件失败:', error);
            return null;
        }
    }

    /**
     * 加载并解析字幕文件
     */
    static async loadSubtitle(url: string, type: string = 'srt'): Promise<SubtitleCue[]> {
        if (!url) return [];
        
        // 检查缓存
        if (this.subtitleCache.has(url)) {
            const cached = this.subtitleCache.get(url);
            this.currentSubtitles = cached || [];
            return this.currentSubtitles;
        }
        
        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error(`状态码：${response.status}`);
            
            const content = await response.text();
            let subtitles: SubtitleCue[] = [];
            
            // 根据类型解析
            switch (type.toLowerCase()) {
                case 'srt':
                    subtitles = this.parseSRT(content);
                    break;
                case 'vtt':
                    // 保留VTT解析支持，待实现
                    console.warn('[字幕] VTT解析尚未实现');
                    break;
                case 'ass':
                    // 保留ASS解析支持，待实现
                    console.warn('[字幕] ASS解析尚未实现');
                    break;
                default:
                    console.warn(`[字幕] 不支持的格式: ${type}`);
            }
            
            // 更新当前字幕和缓存
            this.currentSubtitles = subtitles;
            this.subtitleCache.set(url, subtitles);
            return subtitles;
        } catch (error) {
            console.error('[字幕] 加载失败:', error);
            return [];
        }
    }

    /**
     * 解析SRT字幕文本
     */
    static parseSRT(content: string): SubtitleCue[] {
        if (!content?.trim()) return [];
        
        try {
            // 优化正则表达式，一次性匹配字幕块
            const regex = /(\d+)\r?\n(\d{2}:\d{2}:\d{2},\d{3}) --> (\d{2}:\d{2}:\d{2},\d{3})\r?\n([\s\S]*?)(?=\r?\n\r?\n\d+\r?\n|\r?\n\r?\n$|$)/g;
            const subtitles: SubtitleCue[] = [];
            let match;
            
            while ((match = regex.exec(content)) !== null) {
                const [_, __, startTimeStr, endTimeStr, text] = match;
                
                if (!text?.trim()) continue;
                
                // 转换时间为秒
                const startTime = this.timeToSeconds(startTimeStr);
                const endTime = this.timeToSeconds(endTimeStr);
                
                subtitles.push({
                    startTime,
                    endTime,
                    text: text.replace(/\r?\n/g, ' ').trim()
                });
            }
            
            return subtitles;
        } catch (error) {
            console.error('[字幕] 解析失败:', error);
            return [];
        }
    }

    /**
     * 将时间字符串转换为秒
     */
    private static timeToSeconds(timeStr: string): number {
        // 优化：直接使用数组解构和数值转换
        const [h, m, s] = timeStr.split(':').map(part => 
            part.includes(',') 
                ? Number(part.split(',')[0]) + Number(part.split(',')[1]) / 1000
                : Number(part)
        );
        
        return h * 3600 + m * 60 + s;
    }

    /**
     * 格式化时间为 00:00 格式
     */
    static formatTime(seconds: number): string {
        if (isNaN(seconds) || seconds < 0) return '00:00';
        
        const minutes = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }

    /**
     * 清除字幕缓存
     */
    static clearCache(): void {
        this.subtitleCache.clear();
    }
} 