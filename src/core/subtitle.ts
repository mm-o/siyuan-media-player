/**
 * 字幕处理工具类
 * 用于处理播放器的字幕功能
 */
import { BILI_API, getBiliHeaders } from './bilibili';
import { MediaDetector } from './PlayList';

/**
 * 字幕配置对象
 */
export interface SubtitleOptions {
    url: string;         // 字幕URL
    type?: string;       // 字幕类型 (vtt, srt, ass)
    encoding?: string;   // 字幕编码
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
    private static cache = new Map<string, SubtitleCue[]>();
    private static current: SubtitleCue[] = [];
    private static formats = ['srt', 'vtt'];

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
        try {
            const url = await MediaDetector.findMediaSupportFile(mediaUrl, this.formats.map(f => `.${f}`));
            if (!url) return null;
            
            const type = url.split('.').pop()?.toLowerCase() || 'srt';
            return { url, type, encoding: 'utf-8' };
        } catch {
            return null;
        }
    }

    /**
     * 获取B站视频字幕
     */
    static async loadBilibiliSubtitle(bvid: string, cid: string, config?: any): Promise<SubtitleCue[]> {
        const key = `bili_${bvid}_${cid}`;
        if (this.cache.has(key)) return this.cache.get(key) || [];
        
        try {
            const headers = config ? getBiliHeaders(config, bvid) : {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Referer': `https://www.bilibili.com/video/${bvid}/`
            };
            
            const result = await fetch('/api/network/forwardProxy', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    url: `${BILI_API.VIDEO_SUBTITLE}?bvid=${bvid}&cid=${cid}`, 
                    method: 'GET', 
                    timeout: 7000,
                    headers: Object.entries(headers).map(([k, v]) => ({ [k]: v }))
                })
            }).then(r => r.json());
            
            if (result.code !== 0) return this.save(key, []);
            
            const data = JSON.parse(result.data.body);
            if (data.code !== 0) return this.save(key, []);
            
            const list = data.data?.subtitle?.list || data.data?.subtitle?.subtitles || [];
            if (!list.length) return this.save(key, []);
            
            const subtitleInfo = list.find(sub => sub.lan === 'zh-CN' || sub.lan === 'ai-zh') || list[0];
            const subtitleUrl = subtitleInfo.subtitle_url.startsWith('//') 
                ? `https:${subtitleInfo.subtitle_url}` 
                : subtitleInfo.subtitle_url;
            
            try {
                const content = await fetch(subtitleUrl).then(r => r.json());
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
            // 一步链式操作获取字幕文本
            const content = await fetch(url).then(r => r.text()).catch(() => '');
            if (!content?.trim()) return [];
            
            // 根据类型选择解析器
            const parser = {
                'srt': this.parseSRT,
                'vtt': this.parseVTT
            }[type.toLowerCase()];
            
            return this.save(url, parser ? parser(content) : []);
        } catch (e) {
            return [];
        }
    }

    /**
     * 解析字幕文本
     */
    private static parseSRT(content: string): SubtitleCue[] {
        const regex = /(\d+)\r?\n(\d{2}:\d{2}:\d{2},\d{3}) --> (\d{2}:\d{2}:\d{2},\d{3})\r?\n([\s\S]*?)(?=\r?\n\r?\n\d+\r?\n|\r?\n\r?\n$|$)/g;
        return SubtitleManager.parseWithRegex(content, regex, ',');
    }

    private static parseVTT(content: string): SubtitleCue[] {
        const body = content.replace(/^WEBVTT.*?(\r?\n\r?\n|\r?\n)/i, '');
        const regex = /(\d{2}:\d{2}:\d{2}\.\d{3}|\d{2}:\d{2}\.\d{3}) --> (\d{2}:\d{2}:\d{2}\.\d{3}|\d{2}:\d{2}\.\d{3}).*?\r?\n([\s\S]*?)(?=\r?\n\r?\n|\r?\n\s*\d{2}:\d{2}|\s*$)/g;
        return SubtitleManager.parseWithRegex(body, regex, '.');
    }

    /**
     * 使用正则表达式解析字幕
     */
    private static parseWithRegex(content: string, regex: RegExp, separator: string): SubtitleCue[] {
        try {
            const subtitles: SubtitleCue[] = [];
            let match;
            
            while ((match = regex.exec(content)) !== null) {
                // SRT格式有4个捕获组，VTT格式有3个捕获组
                const startTime = match[match.length === 5 ? 2 : 1];
                const endTime = match[match.length === 5 ? 3 : 2];
                const text = match[match.length === 5 ? 4 : 3]?.trim();
                
                if (!text) continue;
                
                subtitles.push({
                    startTime: SubtitleManager.parseTime(startTime, separator),
                    endTime: SubtitleManager.parseTime(endTime, separator),
                    text: text.replace(/\r?\n/g, ' ')
                });
            }
            
            return subtitles;
        } catch {
            return [];
        }
    }

    /**
     * 解析时间字符串为秒
     */
    private static parseTime(time: string, separator: string): number {
        try {
            if (separator === ':') { // ASS格式
                const [h, m, s] = time.split(':');
                return (Number(h) * 3600) + (Number(m) * 60) + Number(s);
            }
            
            // SRT/VTT格式
            const hasHours = time.split(':').length === 3;
            const [h, m, s] = hasHours ? time.split(':') : ['0', ...time.split(':')];
            const parts = (hasHours ? s : m).split(separator);
            const seconds = Number(parts[0]) + (parts[1] ? Number(parts[1]) / 1000 : 0);
        
            return (Number(h) * 3600) + (Number(hasHours ? m : h) * 60) + seconds;
        } catch {
            return 0;
        }
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
        this.current = [];
    }

    private static save(key: string, subtitles: SubtitleCue[]): SubtitleCue[] {
        this.current = subtitles;
        this.cache.set(key, subtitles);
        return subtitles;
    }
} 