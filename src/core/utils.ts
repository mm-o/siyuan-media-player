/**
 * 思源媒体播放器核心工具
 */
import { showMessage } from 'siyuan';
import type { MediaItem } from './types';
import { AListManager } from './alist';

// ===== 媒体类型定义 =====
type MediaType = 'video' | 'audio' | 'bilibili';
type MediaSource = 'bilibili' | 'alist' | 'local' | 'standard';
type TimeOptions = { anchor?: boolean; duration?: boolean };

// ===== 媒体扩展名 =====
export const EXT = {
    VIDEO: ['.mp4', '.webm', '.ogg', '.mov', '.m4v', '.mkv', '.avi', '.flv', '.wmv'],
    AUDIO: ['.mp3', '.wav', '.aac', '.m4a', '.flac', '.ogg'],
    SUBTITLE: ['.srt', '.vtt'],
    DANMAKU: ['.xml', '.ass'],
    get ALL() { return [...this.VIDEO, ...this.AUDIO]; },
    get MEDIA() { return [...this.VIDEO, ...this.AUDIO]; },
    get SUPPORT() { return [...this.MEDIA, ...this.SUBTITLE, ...this.DANMAKU]; }
};

// ===== 正则表达式 =====
const REGEX = {
    BILIBILI: /bilibili\.com\/video\/|\/BV[a-zA-Z0-9]+/,
    BV: /\/BV[a-zA-Z0-9]+/,
    ALIST: /\/#\//,
    TIME: /[?&]t=([^&]+)/
};

// ===== 时间格式化 =====
/**
 * 格式化秒数为可读时间格式
 */
export const fmt = (sec: number, opts: TimeOptions = {}): string => {
    if (isNaN(sec) || sec < 0) return '0:00';
    
    const s = (opts.anchor || opts.duration) ? Math.round(sec) : sec;
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const ss = (opts.anchor || opts.duration) 
        ? Math.floor(s % 60).toString().padStart(2, '0')
        : (s % 60).toFixed(1);
    
    return h > 0 ? `${h}:${m.toString().padStart(2, '0')}:${ss}` : `${m}:${ss}`;
};

// ===== URL处理工具 =====
export const url = {
    /**
     * 判断媒体类型并获取来源信息
     */
    getMediaInfo: (u: string): { type: MediaType; source: MediaSource; path?: string } => {
        if (!u) return { type: 'video', source: 'standard' };
        
        const isAudio = EXT.AUDIO.some(ext => u.toLowerCase().endsWith(ext) || u.toLowerCase().split('?')[0].endsWith(ext));
        
        // B站视频
        if (REGEX.BILIBILI.test(u)) 
            return { type: 'bilibili', source: 'bilibili', path: u.match(REGEX.BV)?.[0]?.substring(1) };
        
        // AList媒体
        if (REGEX.ALIST.test(u) || AListManager?.parsePathFromUrl?.(u))
            return { 
                type: isAudio ? 'audio' : 'video', 
                source: 'alist', 
                path: REGEX.ALIST.test(u) ? u.split('/#/')[1]?.split('?')[0] : AListManager?.parsePathFromUrl?.(u)
            };
        
        // 本地文件
        if (u.startsWith('file://'))
            return { type: isAudio ? 'audio' : 'video', source: 'local', path: u.substring(7) };

        // 标准媒体
        return { type: isAudio ? 'audio' : 'video', source: 'standard' };
    },
    
    /**
     * 获取媒体类型
     */
    type: (u: string): MediaType => url.getMediaInfo(u).type,
    
    /**
     * 从URL提取标题
     */
    title: (u: string): string => {
        try {
            return decodeURIComponent(u.split('/').pop()?.split('?')[0]?.split('.')[0] || '') || '未知';
        } catch {
            return u.split(/[/\\]/).pop()?.split('.')[0] || '未知';
        }
    },
    
    /**
     * 解析URL中的时间参数
     */
    parseTime: (u: string): { mediaUrl: string; startTime?: number; endTime?: number } => {
        const match = u.match(REGEX.TIME);
        if (!match) return { mediaUrl: u };
        
        const timeParam = match[1];
        const cleanUrl = u.replace(/([?&])t=[^&]+&?/, '$1').replace(/[?&]$/,'');
        
        // 处理时间范围
        if (timeParam.includes('-')) {
            const [start, end] = timeParam.split('-').map(Number);
            return { 
                mediaUrl: cleanUrl, 
                startTime: isNaN(start) ? undefined : start, 
                endTime: isNaN(end) ? undefined : end 
            };
        }
        
        const time = Number(timeParam);
        return { mediaUrl: cleanUrl, startTime: isNaN(time) ? undefined : time };
    },
    
    /**
     * 添加时间戳到URL
     */
    withTime: (u: string, time?: number, endTime?: number): string => {
        if (!time) return u;
        const timeValue = endTime ? `${time.toFixed(1)}-${endTime.toFixed(1)}` : time.toFixed(1);
        return `${u}${u.includes('?') ? '&' : '?'}t=${timeValue}`;
    },
    
    /**
     * 判断两个媒体是否相同
     */
    isSameMedia: (curr: any, media: string): boolean => {
        if (!curr) return false;
        
        const mediaInfo = url.getMediaInfo(media);
        const parsedMediaUrl = url.parseTime(media).mediaUrl;
        
        switch (mediaInfo.source) {
            case 'bilibili': {
                // 比较B站视频BV号
                const bv = media.match(/BV[a-zA-Z0-9]+/)?.[0];
                if (!bv || !curr.bvid || bv.toUpperCase() !== curr.bvid.toUpperCase()) return false;
                
                // 比较分P
                try {
                    const urlPart = parseInt(media.match(/[\?&]p=(\d+)/)?.[1] || '1', 10);
                    const currPart = parseInt(curr.id?.match(/-p(\d+)$/)?.[1] || '1', 10);
                    return urlPart === currPart;
                } catch {
                    return true;
                }
            }
            
            case 'alist': {
                // 比较AList路径
                const currPath = curr.sourcePath;
                const mediaPath = mediaInfo.path;
                
                if (currPath && mediaPath) {
                    const decodedCurrPath = currPath.includes('%') ? decodeURIComponent(currPath) : currPath;
                    const decodedMediaPath = mediaPath.includes('%') ? decodeURIComponent(mediaPath) : mediaPath;
                    return decodedCurrPath === decodedMediaPath;
                }
                
                // 比较文件名
                if (curr.source === 'alist' && curr.url && parsedMediaUrl) {
                    const currFileName = curr.url.split('/').pop()?.split('?')[0] || '';
                    const mediaFileName = parsedMediaUrl.split('/').pop()?.split('?')[0] || '';
                    return currFileName && mediaFileName && currFileName === mediaFileName;
                }
                return false;
            }
                
            case 'local':
            case 'standard':
            default:
                // 移除查询参数后比较URL
                const currBaseUrl = (curr.url || '').split('?')[0].split('#')[0];
                const mediaBaseUrl = parsedMediaUrl.split('?')[0].split('#')[0];
                return currBaseUrl === mediaBaseUrl;
        }
    },
    
    /**
     * 获取规范化的媒体URL
     */
    getStandardUrl: (item: MediaItem, config?: any): string => {
        if (!item) return '';
        
        if (item.source === 'alist' && item.sourcePath && config?.settings?.alistConfig?.server)
            return `${config.settings.alistConfig.server}${item.sourcePath}`;
        
        if (item.type === 'bilibili' && item.bvid) {
            const partMatch = item.id?.match(/-p(\d+)$/);
            const part = partMatch ? parseInt(partMatch[1], 10) : 1;
            return `https://www.bilibili.com/video/${item.bvid}${part > 1 ? `?p=${part}` : ''}`;
        }
        
        return item.url || '';
    },
    
    /**
     * 转换为文件URL
     */
    toFile: (path?: string): string => {
        if (!path) return '';
        if (path.startsWith('http') || path.startsWith('file')) return path;
        return `file://${path.split('/').map(encodeURIComponent).join('/')}`;
    }
};

// ===== 媒体检测工具 =====
export const isSupportedMediaLink = (u: string): boolean => {
    if (!u) return false;
    
    // 检查B站链接
    if (REGEX.BILIBILI.test(u)) return true;
    
    // 检查文件扩展名
    const hasMediaExt = EXT.ALL.some(ext => u.split('?')[0].toLowerCase().endsWith(ext));
    
    // 本地文件或标准媒体链接
    return (u.startsWith('file://') && hasMediaExt) || hasMediaExt;
};

// ===== 媒体辅助文件查找 =====
export const findMediaSupportFile = async (mediaUrl: string, exts: string[]): Promise<string | null> => {
    if (!mediaUrl) return null;
    
    // 本地文件
    if (mediaUrl.startsWith('file://')) {
        const { pathname } = new URL(mediaUrl);
        const path = decodeURIComponent(pathname);
        const idx = path.lastIndexOf('.');
        if (idx === -1) return null;
        
        const dir = path.substring(0, path.lastIndexOf('/'));
        const base = path.substring(path.lastIndexOf('/') + 1, idx);
        
        for (const ext of exts) {
            const url = `file://${dir}/${encodeURIComponent(base)}${ext}`;
            try { 
                if ((await fetch(url, {method: 'HEAD'})).ok) return url; 
            } catch {}
        }
    }
    // AList媒体
    else if (AListManager.parsePathFromUrl(mediaUrl)) {
        const path = AListManager.parsePathFromUrl(mediaUrl);
        if (path) return AListManager.getSupportFileLink(path, exts);
    }
    
    return null;
};

/**
 * 数据库工具类
 * 用于处理与思源笔记属性视图数据库的交互
 */
export const database = {
    /**
     * 根据ID查找数据库块
     * @param databaseId 数据库块ID
     * @returns 数据库块信息
     */
    findDatabaseById: async (databaseId: string) => {
        try {
            const result = await fetch('/api/query/sql', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ stmt: `SELECT * FROM blocks WHERE id = "${databaseId}"` })
            }).then(r => r.json());
            
            if (result?.code !== 0 || !result?.data?.length) {
                throw new Error("未找到数据库块");
            }
            
            return result.data[0];
        } catch (error) {
            console.error("查找数据库块失败:", error);
            throw error;
        }
    },

    /**
     * 获取数据库JSON数据
     * @param databaseId 数据库块ID
     * @returns 数据库JSON对象
     */
    getDatabaseJson: async (databaseId: string) => {
        try {
            // 查询数据库块信息
            const blockData = await database.findDatabaseById(databaseId);
            
            // 从块内容中提取 avID
            const markdown = blockData.markdown || '';
            const avMatch = markdown.match(/data-av-id="([^"]+)"/);
            
            if (!avMatch || !avMatch[1]) {
                throw new Error("无法在数据库块中找到属性视图ID");
            }
            
            const avID = avMatch[1];
            const workspacePath = window.siyuan?.config?.system?.workspaceDir;
            
            if (!workspacePath) {
                throw new Error("无法获取工作空间路径");
            }
            
            // 获取数据库文件路径
            const fs = window.require('fs');
            const path = window.require('path');
            const dbFilePath = path.join(workspacePath, 'data', 'storage', 'av', `${avID}.json`);
            
            if (!fs.existsSync(dbFilePath)) {
                throw new Error(`数据库文件不存在: ${dbFilePath}`);
            }
            
            // 读取数据库文件
            const dbContent = fs.readFileSync(dbFilePath, 'utf-8');
            return JSON.parse(dbContent);
        } catch (error) {
            console.error("获取数据库JSON失败:", error);
            throw error;
        }
    },

    /**
     * 保存数据库JSON数据
     * @param databaseId 数据库块ID
     * @param jsonData 要保存的JSON数据
     */
    saveDatabaseJson: async (databaseId: string, jsonData: any) => {
        try {
            // 查询数据库块信息
            const blockData = await database.findDatabaseById(databaseId);
            
            // 从块内容中提取 avID
            const markdown = blockData.markdown || '';
            const avMatch = markdown.match(/data-av-id="([^"]+)"/);
            
            if (!avMatch || !avMatch[1]) {
                throw new Error("无法在数据库块中找到属性视图ID");
            }
            
            const avID = avMatch[1];
            const workspacePath = window.siyuan?.config?.system?.workspaceDir;
            
            if (!workspacePath) {
                throw new Error("无法获取工作空间路径");
            }
            
            const fs = window.require('fs');
            const path = window.require('path');
            const dbFilePath = path.join(workspacePath, 'data', 'storage', 'av', `${avID}.json`);
            
            fs.writeFileSync(dbFilePath, JSON.stringify(jsonData, null, 2), 'utf-8');
        } catch (error) {
            console.error("保存数据库JSON失败:", error);
            throw error;
        }
    },

    /**
     * 添加字段到数据库
     * @param jsonData 数据库JSON对象
     * @param fieldType 字段类型
     * @param fieldName 字段名称
     * @param options 可选参数
     * @returns 添加的字段对象
     */
    addField: (jsonData: any, fieldType: string, fieldName: string, options?: any) => {
        const field = {
            name: fieldName,
            type: fieldType,
            options: options || {}
        };
        jsonData.fields = jsonData.fields || [];
        jsonData.fields.push(field);
        return field;
    },

    /**
     * 设置字段值
     * @param jsonData 数据库JSON对象
     * @param blockId 行ID
     * @param fieldName 字段名
     * @param value 字段值
     */
    setFieldValue: (jsonData: any, blockId: string, fieldName: string, value: any) => {
        jsonData.rows = jsonData.rows || [];
        let row = jsonData.rows.find((r: any) => r.id === blockId);
        if (!row) {
            row = { id: blockId, values: {} };
            jsonData.rows.push(row);
        }
        row.values[fieldName] = value;
    },

    /**
     * 获取字段值
     * @param jsonData 数据库JSON对象
     * @param blockId 行ID
     * @param fieldName 字段名
     * @returns 字段值
     */
    getFieldValue: (jsonData: any, blockId: string, fieldName: string) => {
        const row = jsonData.rows?.find((r: any) => r.id === blockId);
        return row?.values?.[fieldName];
    },

    /**
     * 删除行数据
     * @param jsonData 数据库JSON对象
     * @param blockId 要删除的行ID
     * @returns 更新后的JSON对象
     */
    deleteRow: (jsonData: any, blockId: string) => {
        if (!jsonData.rows) return jsonData;
        jsonData.rows = jsonData.rows.filter((r: any) => r.id !== blockId);
        return jsonData;
    },

    /**
     * 更新字段值
     * @param jsonData 数据库JSON对象
     * @param blockId 行ID
     * @param fieldName 字段名
     * @param value 新值
     * @returns 更新后的JSON对象
     */
    updateFieldValue: (jsonData: any, blockId: string, fieldName: string, value: any) => {
        if (!jsonData.rows) return jsonData;
        const row = jsonData.rows.find((r: any) => r.id === blockId);
        if (row) {
            row.values = row.values || {};
            row.values[fieldName] = value;
        }
        return jsonData;
    },

    /**
     * 获取特定类型的所有字段
     * @param jsonData 数据库JSON对象
     * @param fieldType 字段类型
     * @returns 字段列表
     */
    getFieldsByType: (jsonData: any, fieldType: string) => {
        return (jsonData.fields || []).filter((f: any) => f.type === fieldType);
    },

    /**
     * 根据字段名获取字段
     * @param jsonData 数据库JSON对象
     * @param fieldName 字段名
     * @returns 字段对象
     */
    getFieldByName: (jsonData: any, fieldName: string) => {
        return (jsonData.fields || []).find((f: any) => f.name === fieldName);
    }
};
