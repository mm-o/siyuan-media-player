/**
 * B站弹幕处理模块
 * 用于获取和转换B站弹幕为artplayer-plugin-danmuku支持的格式
 */
import { getBiliAPI, getBiliHeaders } from './bilibili';
import artplayerPluginDanmuku from 'artplayer-plugin-danmuku';
import { Media } from './player';

/**
 * artplayer弹幕格式
 */
interface ArtPlayerDanmaku {
    text: string;        // 弹幕文本
    time: number;        // 出现时间(秒)
    color: string;       // 颜色(十六进制)
    border?: boolean;    // 是否有边框
    mode: number;        // 弹幕模式
    size?: number;       // 字体大小
}

/**
 * 弹幕插件配置
 */
interface DanmakuOptions {
    speed?: number;      // 弹幕速度
    opacity?: number;    // 透明度
    fontSize?: number;   // 字体大小
    margin?: [number | `${number}%`, number | `${number}%`]; // 上下边距
    synchronousPlayback?: boolean; // 同步播放
}

/**
 * 弹幕配置对象，与字幕配置对象保持一致的结构
 */
export interface DanmakuFileOptions {
    url: string;         // 弹幕URL
    type?: string;       // 弹幕类型 (xml, ass)
    encoding?: string;   // 弹幕编码
}

/**
 * 默认弹幕配置
 */
const DEFAULT_OPTIONS = {
    speed: 5,
    opacity: 0.9,
    fontSize: 25,
    margin: [10, '25%'] as [number, `${number}%`],
    synchronousPlayback: true
};

/**
 * B站弹幕处理类
 */
export class DanmakuManager {
    private static cache = new Map<string, ArtPlayerDanmaku[]>();
    private static formats = ['xml', 'ass'];
    
    /**
     * 获取媒体文件对应的弹幕
     */
    static async getDanmakuFileForMedia(mediaUrl: string): Promise<DanmakuFileOptions | null> {
        try {
            const url = await Media.findSupportFile(mediaUrl, this.formats.map(f => `.${f}`));
            if (!url) return null;
            
            const type = url.split('.').pop()?.toLowerCase() || 'xml';
            return { url, type, encoding: 'utf-8' };
        } catch {
            return null;
        }
    }

    /**
     * 获取B站视频弹幕
     */
    static async getBiliDanmaku(cid: string, config: any): Promise<ArtPlayerDanmaku[]> {
        const key = `bili_${cid}`;
        if (this.cache.has(key)) return this.cache.get(key) || [];

        try {
            const api = getBiliAPI();
            if (!api) return [];

            const xmlUrl = `https://comment.bilibili.com/${cid}.xml`;
            const headers = getBiliHeaders(config);

            let xmlText = await fetch(xmlUrl, { method: 'GET', headers })
                .then(r => r.ok ? r.text() : Promise.reject())
                .catch(() => fetch(api.PROXY, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        url: xmlUrl, method: 'GET', timeout: 10000,
                        headers: Object.entries(headers).map(([k, v]) => ({ [k]: v }))
                    })
                })
                .then(r => r.json())
                .then(result => {
                    if (result.code !== 0 || !result.data) return '';
                    return typeof result.data === 'string'
                            ? result.data
                            : (typeof result.data.body === 'string' ? result.data.body : '');
                })
                .catch(() => ''));
            
            const danmakuList = xmlText ? this.parseXmlDanmaku(xmlText) : [];
            return this.save(key, danmakuList.length ? danmakuList : this.generateTestDanmaku());
        } catch {
            return this.generateTestDanmaku();
        }
    }
    
    /**
     * 解析XML格式的弹幕数据
     */
    private static parseXmlDanmaku(xmlText: string): ArtPlayerDanmaku[] {
        if (!xmlText?.trim() || xmlText.trim().startsWith('{')) return [];
        
        try {
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(xmlText, 'text/xml');
            
            if (xmlDoc.getElementsByTagName('parsererror').length > 0) return [];
            
            const elements = xmlDoc.getElementsByTagName('d');
            if (!elements?.length) return [];
            
            const danmakuList = [];
            
            for (const element of elements) {
                const p = element.getAttribute('p');
                const text = element.textContent;
                
                if (!p || !text) continue;
                
                const parts = p.split(',');
                if (parts.length < 4) continue;
                
                const time = parseFloat(parts[0]);
                const mode = parseInt(parts[1]);
                const fontSize = parseInt(parts[2]);
                const colorInt = parseInt(parts[3]);
                const color = !isNaN(colorInt) ? `#${colorInt.toString(16).padStart(6, '0')}` : '#ffffff';
                
                danmakuList.push({ text, time, color, mode, size: fontSize });
            }
            
            return danmakuList;
        } catch {
            return [];
        }
    }
    
    /**
     * 解析ASS格式弹幕
     */
    private static parseAssDanmaku(content: string): ArtPlayerDanmaku[] {
        if (!content?.trim()) return [];
        
        return content.split(/\r?\n/)
            .filter(line => line.startsWith('Dialogue:'))
            .map(line => {
                const parts = line.split(',');
                if (parts.length < 10) return null;
                
                const text = parts.slice(9).join(',').replace(/\{[^}]*\}|\\N/g, ' ').trim();
                if (!text) return null;
                
                const [h, m, s] = parts[1].trim().split(':').map(Number);
                return { text, time: (h * 3600) + (m * 60) + s, color: '#ffffff', mode: 1, size: 25 };
            })
            .filter(Boolean) as ArtPlayerDanmaku[];
    }
    
    /**
     * 生成测试弹幕数据
     */
    private static generateTestDanmaku(): ArtPlayerDanmaku[] {
        const texts = ['测试弹幕', 'B站弹幕测试', '欢迎使用思源播放器', '弹幕功能测试', '思源笔记真好用'];
        const colors = ['#ffffff', '#ff0000', '#00ff00', '#0000ff', '#ffff00']; 
        const modes = [1, 1, 5, 4, 1]; // 1=滚动, 5=顶部, 4=底部
        
        return Array(20).fill(0).map(() => ({
            text: texts[Math.floor(Math.random() * texts.length)],
            time: Math.random() * 30,
            color: colors[Math.floor(Math.random() * colors.length)],
            mode: modes[Math.floor(Math.random() * modes.length)],
            size: Math.random() > 0.8 ? 30 : 25
        })).sort((a, b) => a.time - b.time);
    }
    
    /**
     * 解析弹幕文件
     */
    static async loadDanmaku(url: string, type: string = 'xml'): Promise<ArtPlayerDanmaku[]> {
        if (!url) return [];
        if (this.cache.has(url)) return this.cache.get(url) || [];
        
        try {
            const content = await fetch(url).then(r => r.text()).catch(() => '');
            if (!content?.trim()) return [];
            
            // 根据类型选择解析器
            const parser = {
                'xml': this.parseXmlDanmaku,
                'ass': this.parseAssDanmaku
            }[type.toLowerCase()];
            
            return this.save(url, parser ? parser(content) : []);
        } catch (e) {
            return [];
        }
    }
    
    /**
     * 为播放器加载B站弹幕，并转换为URL格式（简化后的方法）
     */
    static async loadBiliDanmakuUrl(cid: string, config: any): Promise<string | null> {
        const danmakuList = await this.getBiliDanmaku(cid, config);
        return danmakuList?.length ? this.generateDanmakuUrl(danmakuList) : null;
    }
    
    /**
     * 生成弹幕URL数据
     */
    static generateDanmakuUrl(danmakuList: ArtPlayerDanmaku[]): string {
        return `data:application/xml;charset=utf-8,${encodeURIComponent(this.convertToXML(danmakuList))}`;
    }
    
    /**
     * 将弹幕数据转换为XML格式
     */
    static convertToXML(danmakuList: ArtPlayerDanmaku[]): string {
        let xml = '<?xml version="1.0" encoding="UTF-8"?>\n<i>\n';
        danmakuList.forEach(({ text, time, color, mode }) => {
            xml += `<d p="${time},${mode},25,${color.replace('#', '')},0,0,0,0">${this.escapeXml(text)}</d>\n`;
        });
        return xml + '</i>';
    }
    
    /**
     * 转义XML特殊字符
     */
    private static escapeXml(text: string): string {
        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&apos;');
    }
    
    /**
     * 创建弹幕插件
     */
    static createDanmakuPlugin(url: string, options: DanmakuOptions = {}): any {
        return artplayerPluginDanmuku({
            danmuku: url,
            ...DEFAULT_OPTIONS,
            ...options
        });
    }

    /**
     * 创建一个空弹幕插件
     */
    static createEmptyDanmakuPlugin(options: DanmakuOptions = {}): any {
        const emptyUrl = this.generateDanmakuUrl([]);
        return this.createDanmakuPlugin(emptyUrl, options);
    }
    
    /**
     * 从播放器插件中提取弹幕数据
     */
    static extractDanmakuData(plugin: any): any[] {
        if (!plugin?.danmus) return [];
        
        return plugin.danmus.map((item: any) => ({
            text: item.text,
            time: item.time,
            color: item.color || '#ffffff',
            mode: item.mode || 1,
            user: ''
        }));
    }

    /**
     * 清除弹幕缓存
     */
    static clearCache(): void {
        this.cache.clear();
    }

    /**
     * 保存弹幕到缓存
     */
    private static save(key: string, danmakus: ArtPlayerDanmaku[]): ArtPlayerDanmaku[] {
        this.cache.set(key, danmakus);
        return danmakus;
    }
}