/**
 * 字幕处理工具类
 * 用于处理播放器的字幕功能
 */
import { BILI_API, getBiliHeaders } from './biliUtils';

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
 * B站字幕数据结构
 */
interface BiliSubtitleData {
    from: number;        // 开始时间（秒）
    to: number;          // 结束时间（秒）
    content: string;     // 内容
}

/**
 * B站字幕响应
 */
interface BiliSubtitleResponse {
    code: number;
    message: string;
    data?: {
        subtitle?: {
            allow_submit: boolean;
            lan?: string;
            lan_doc?: string;
            list?: Array<{
                id: number;
                lan: string;
                lan_doc: string;
                is_lock: boolean;
                subtitle_url: string;
            }>;
            subtitles?: Array<{
                id: number | string;
                id_str?: string;
                lan: string;
                lan_doc: string;
                is_lock: boolean;
                subtitle_url: string;
                type?: number;
                ai_type?: number;
                ai_status?: number;
            }>;
        }
    };
}

/**
 * 字幕处理工具类
 */
export class SubtitleManager {
    private static cache = new Map<string, SubtitleCue[]>();
    private static current: SubtitleCue[] = [];
    private static formats = ['srt', 'vtt', 'ass'];

    /**
     * 获取当前加载的字幕
     */
    static getSubtitles = (): SubtitleCue[] => SubtitleManager.current;

    /**
     * 设置当前字幕
     */
    static setSubtitles = (subtitles: SubtitleCue[]): void => { SubtitleManager.current = subtitles; };

    /**
     * 获取媒体文件对应的字幕
     */
    static async getSubtitleForMedia(mediaUrl: string): Promise<SubtitleOptions | null> {
        if (!mediaUrl || mediaUrl.includes('bilibili.com/video/') || !mediaUrl.startsWith('file://')) return null;
        
        try {
            const { pathname } = new URL(mediaUrl);
            const parts = pathname.split('/');
            const filename = parts.pop() || '';
            const fileBase = filename.substring(0, filename.lastIndexOf('.'));
            const dirPath = parts.join('/');
            
            if (!fileBase) return null;
            
            for (const format of this.formats) {
                try {
                    const subtitleUrl = `file://${dirPath}/${fileBase}.${format}`;
                    const response = await fetch(subtitleUrl, { method: 'HEAD' });
                    if (response.ok) return { url: subtitleUrl, type: format, encoding: 'utf-8', escape: true };
                } catch {}
            }
        } catch (e) {
            console.error('[字幕] 查找失败:', e);
        }
        
        return null;
    }

    /**
     * 获取B站视频字幕
     * @param bvid B站视频BV号
     * @param cid B站视频分P的cid
     * @param config 配置信息，包含登录状态
     * @returns 字幕列表
     */
    static async loadBilibiliSubtitle(bvid: string, cid: string, config?: any): Promise<SubtitleCue[]> {
        const key = `bili_${bvid}_${cid}`;
        if (this.cache.has(key)) return this.cache.get(key) || [];
        
        try {
            // 获取字幕信息
            const headers = config ? getBiliHeaders(config, bvid) : {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                'Referer': `https://www.bilibili.com/video/${bvid}/`
            };
            
            const response = await fetch('/api/network/forwardProxy', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    url: `${BILI_API.VIDEO_SUBTITLE}?bvid=${bvid}&cid=${cid}`, 
                    method: 'GET', 
                    timeout: 7000,
                    headers: Object.entries(headers).map(([k, v]) => ({ [k]: v }))
                })
            });
            
            const result = await response.json();
            if (result.code !== 0) return this.save(key, []);
            
            const data = JSON.parse(result.data.body);
            if (data.code !== 0) return this.save(key, []);
            
            // 获取字幕列表并选择字幕
            const list = data.data?.subtitle?.list || data.data?.subtitle?.subtitles || [];
            if (!list.length) return this.save(key, []);
            
            const subtitleInfo = list.find(sub => sub.lan === 'zh-CN' || sub.lan === 'ai-zh') || list[0];
            const subtitleUrl = subtitleInfo.subtitle_url.startsWith('//') 
                ? `https:${subtitleInfo.subtitle_url}` 
                : subtitleInfo.subtitle_url;
            
            // 获取字幕内容
            try {
                const subtitleRes = await fetch(subtitleUrl);
                if (!subtitleRes.ok) return this.save(key, []);
                
                const content = await subtitleRes.json();
                if (!content?.body?.length) return this.save(key, []);
                
                return this.save(key, content.body.map(item => ({
                    startTime: item.from,
                    endTime: item.to,
                    text: item.content
                })));
            } catch {
                return this.save(key, []);
            }
        } catch {
            return [];
        }
    }

    /**
     * 加载并解析字幕文件
     */
    static async loadSubtitle(url: string, type: string = 'srt'): Promise<SubtitleCue[]> {
        if (!url) return [];
        if (this.cache.has(url)) return this.cache.get(url) || [];
        
        try {
            const response = await fetch(url);
            if (!response.ok) return [];
            
            const content = await response.text();
            if (type.toLowerCase() === 'srt') {
                return this.save(url, this.parseSRT(content));
            }
            
            console.warn(`[字幕] 不支持的格式: ${type}`);
            return [];
        } catch (e) {
            console.error('[字幕] 加载失败:', e);
            return [];
        }
    }

    /**
     * 解析SRT字幕文本
     */
    static parseSRT(content: string): SubtitleCue[] {
        if (!content?.trim()) return [];
        
        try {
            const regex = /(\d+)\r?\n(\d{2}:\d{2}:\d{2},\d{3}) --> (\d{2}:\d{2}:\d{2},\d{3})\r?\n([\s\S]*?)(?=\r?\n\r?\n\d+\r?\n|\r?\n\r?\n$|$)/g;
            const subtitles: SubtitleCue[] = [];
            let match;
            
            while ((match = regex.exec(content)) !== null) {
                const [_, __, startTime, endTime, text] = match;
                if (!text?.trim()) continue;
                
                subtitles.push({
                    startTime: this.timeToSeconds(startTime),
                    endTime: this.timeToSeconds(endTime),
                    text: text.replace(/\r?\n/g, ' ').trim()
                });
            }
            
            return subtitles;
        } catch {
            return [];
        }
    }

    /**
     * 将时间字符串转换为秒
     */
    private static timeToSeconds(time: string): number {
        const [h, m, s] = time.split(':').map(part => 
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
        const min = Math.floor(seconds / 60);
        const sec = Math.floor(seconds % 60);
        return `${min.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
    }

    /**
     * 清除字幕缓存
     */
    static clearCache(): void {
        this.cache.clear();
    }

    private static save(key: string, subtitles: SubtitleCue[]): SubtitleCue[] {
        this.current = subtitles;
        this.cache.set(key, subtitles);
        return subtitles;
    }
} 