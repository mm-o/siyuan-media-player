/**
 * B站弹幕处理模块
 * 用于获取和转换B站弹幕为artplayer-plugin-danmuku支持的格式
 */
import { BILI_API, getBiliHeaders } from './biliUtils';
import artplayerPluginDanmuku from 'artplayer-plugin-danmuku';

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
    /**
     * 获取B站视频弹幕
     * @param cid 视频CID
     * @param config 配置信息
     * @returns 处理后的弹幕数组
     */
    static async getBiliDanmaku(cid: string, config: any): Promise<ArtPlayerDanmaku[]> {
        try {
            const xmlUrl = `https://comment.bilibili.com/${cid}.xml`;
            const headers = getBiliHeaders(config);
            let xmlText = '';
            
            // 尝试直接请求
            try {
                const resp = await fetch(xmlUrl, { method: 'GET', headers });
                if (resp.ok) xmlText = await resp.text();
            } catch { /* 直接请求失败，继续使用代理 */ }
            
            // 如果直接请求失败，使用代理API
            if (!xmlText) {
                const resp = await fetch(BILI_API.PROXY, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        url: xmlUrl,
                        method: 'GET',
                        timeout: 10000,
                        headers: Object.entries(headers).map(([k, v]) => ({ [k]: v }))
                    })
                });
                
                if (resp.ok) {
                    const result = await resp.json();
                    if (result.code === 0 && result.data) {
                        xmlText = typeof result.data === 'string' 
                            ? result.data 
                            : (typeof result.data.body === 'string' ? result.data.body : '');
                    }
                }
            }
            
            return xmlText ? this.parseXmlDanmaku(xmlText) : this.generateTestDanmaku();
        } catch (error) {
            console.error('[弹幕] 获取失败:', error);
            return this.generateTestDanmaku();
        }
    }
    
    /**
     * 解析XML格式的弹幕数据
     */
    private static parseXmlDanmaku(xmlText: string): ArtPlayerDanmaku[] {
        if (!xmlText?.trim() || xmlText.trim().startsWith('{')) return this.generateTestDanmaku();
        
        try {
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(xmlText, 'text/xml');
            
            if (xmlDoc.getElementsByTagName('parsererror').length > 0) return this.generateTestDanmaku();
            
            const elements = xmlDoc.getElementsByTagName('d');
            if (!elements?.length) return this.generateTestDanmaku();
            
            const danmakuList: ArtPlayerDanmaku[] = [];
            
            for (const element of elements) {
                const p = element.getAttribute('p');
                const text = element.textContent;
                
                if (!p || !text) continue;
                
                const parts = p.split(',');
                if (parts.length < 4) continue;
                
                // 提取基本信息: 时间,类型,字号,颜色
                const time = parseFloat(parts[0]);
                const mode = parseInt(parts[1]);
                const fontSize = parseInt(parts[2]);
                
                // 处理颜色 - 十进制转十六进制
                const colorInt = parseInt(parts[3]);
                const color = !isNaN(colorInt) ? `#${colorInt.toString(16).padStart(6, '0')}` : '#ffffff';
                
                danmakuList.push({ text, time, color, mode, size: fontSize });
            }
            
            return danmakuList.length ? danmakuList : this.generateTestDanmaku();
        } catch (e) {
            return this.generateTestDanmaku();
        }
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
     * 生成B站弹幕XML URL
     */
    static generateDanmakuUrl(danmakuList: ArtPlayerDanmaku[]): string {
        return `data:application/xml;charset=utf-8,${encodeURIComponent(this.convertToXML(danmakuList))}`;
    }
    
    /**
     * 将B站弹幕数据转换为XML格式
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
     * 为播放器加载弹幕
     * @param cid B站视频的CID
     * @param config 配置信息
     * @returns 弹幕URL或null（如果加载失败）
     */
    static async loadBiliDanmaku(cid: string, config: any): Promise<string | null> {
        try {
            const danmakuList = await this.getBiliDanmaku(cid, config);
            return danmakuList?.length ? this.generateDanmakuUrl(danmakuList) : null;
        } catch (e) {
            console.error('[弹幕] 加载失败:', e);
            return null;
        }
    }
    
    /**
     * 创建弹幕插件
     * @param url 弹幕URL
     * @param options 插件选项
     * @returns 弹幕插件实例
     */
    static createDanmakuPlugin(url: string, options: DanmakuOptions = {}): any {
        return artplayerPluginDanmuku({
            danmuku: url,
            ...DEFAULT_OPTIONS,
            ...options
        });
    }

    /**
     * 创建空弹幕插件
     * @param options 插件选项
     * @returns 空弹幕插件实例
     */
    static createEmptyDanmakuPlugin(options: DanmakuOptions = {}): any {
        const emptyXml = '<?xml version="1.0" encoding="UTF-8"?>\n<i>\n</i>';
        const emptyUrl = `data:application/xml;charset=utf-8,${encodeURIComponent(emptyXml)}`;
        return this.createDanmakuPlugin(emptyUrl, options);
    }
    
    /**
     * 从播放器插件中提取弹幕数据
     * @param plugin 弹幕插件实例
     * @returns 弹幕数据数组
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
} 