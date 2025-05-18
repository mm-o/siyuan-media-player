import QRCode from 'qrcode';

// B站API端点
export const BILI_API = {
    PROXY: "/api/network/forwardProxy",
    QR_LOGIN: "https://passport.bilibili.com/x/passport-login/web/qrcode/generate",
    QR_POLL: "https://passport.bilibili.com/x/passport-login/web/qrcode/poll",
    USER_INFO: "https://api.bilibili.com/x/web-interface/nav",
    VIDEO_INFO: "https://api.bilibili.com/x/web-interface/view",
    VIDEO_PAGES: "https://api.bilibili.com/x/player/pagelist",
    VIDEO_STREAM: "https://api.bilibili.com/x/player/wbi/playurl",
    VIDEO_SUBTITLE: "https://api.bilibili.com/x/player/wbi/v2",
    VIDEO_AI_SUMMARY: "https://api.bilibili.com/x/web-interface/view/conclusion/get",
    FAVORITE_LIST: "https://api.bilibili.com/x/v3/fav/resource/list", // 收藏夹内容明细列表
    FAVORITE_IDS: "https://api.bilibili.com/x/v3/fav/resource/ids",   // 收藏夹全部内容id
    FAVORITE_FOLDER_LIST: "https://api.bilibili.com/x/v3/fav/folder/created/list-all" // 用户创建的收藏夹列表
};

// 标准请求头
export const BILI_HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
    'Origin': 'https://www.bilibili.com'
};

// 从URL中提取SESSDATA
export const getSessData = (url: string): string | null => {
    try {
        return new URL(url).searchParams.get('SESSDATA');
    } catch {
        return null;
    }
};

/**
 * 解析B站视频URL
 * @param url B站视频URL
 * @returns 解析结果，包含bvid/aid和分P信息
 */
export const parseBiliUrl = (url: string): { bvid?: string; aid?: string; p?: number } | null => {
    try {
        const urlObj = new URL(url);
        if (urlObj.hostname === 'b23.tv') return null; // 短链接暂不支持
        
        const p = parseInt(urlObj.searchParams.get('p') || '1');
        
        // 从路径中提取BV号
        const bvMatch = urlObj.pathname.match(/\/(BV[\w]+)/);
        if (bvMatch) return { bvid: bvMatch[1], p };
        
        // 从查询参数获取aid或bvid
        const aid = urlObj.searchParams.get('aid');
        const bvid = urlObj.searchParams.get('bvid');
        
        return aid ? { aid, p } : bvid ? { bvid, p } : null;
    } catch {
        return null;
    }
};

/**
 * 通用请求工具
 */
export const biliRequest = async <T>(url: string, headers: Record<string, string> = {}): Promise<T> => {
    try {
        const response = await fetch(BILI_API.PROXY, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                url, method: 'GET', timeout: 7000,
                headers: Object.entries(headers).map(([k, v]) => ({ [k]: v }))
            })
        });
        
        const result = await response.json();
        if (result.code !== 0) throw new Error(`请求失败: ${result.msg}`);
        
        return JSON.parse(result.data.body);
    } catch (error) {
        throw new Error(`网络请求失败: ${error instanceof Error ? error.message : String(error)}`);
    }
};

// 二维码状态码映射
const QR_STATUS = {
    0: '登录成功',
    86038: '二维码已过期',
    86090: '已扫码，请确认',
    86101: '等待扫码'
} as const;

type QRStatus = keyof typeof QR_STATUS;

/**
 * 生成B站登录二维码
 */
export const generateBiliQRCode = async () => {
    const response = await biliRequest<any>(BILI_API.QR_LOGIN);
    if (response.code !== 0) throw new Error(response.message);
    
    const qrcodeData = await QRCode.toDataURL(response.data.url, {
        width: 200, margin: 2, color: { dark: '#000000', light: '#ffffff' }
    });
    
    return { qrcodeData, qrcode_key: response.data.qrcode_key };
};

/**
 * 检查二维码扫描状态
 */
export const checkBiliQRCodeStatus = async (qrcode_key: string) => {
    const response = await biliRequest<any>(`${BILI_API.QR_POLL}?qrcode_key=${qrcode_key}`);
    
    if (response.code === 0 && response.data.url) {
        const sessdata = getSessData(response.data.url);
        return {
            ...response.data,
            code: 0,
            message: QR_STATUS[0],
            userInfo: sessdata ? await getBiliUserInfo(sessdata) : undefined
        };
    }
    
    return {
        code: response.code || -1,
        message: QR_STATUS[response.code as QRStatus] || response.message || '未知错误'
    };
};

/**
 * 获取B站用户信息
 * @param sessdata 会话数据
 * @returns 用户信息
 */
export const getBiliUserInfo = async (sessdata: string): Promise<any | null> => {
    try {
        const response = await biliRequest<any>(
            BILI_API.USER_INFO, 
            { ...BILI_HEADERS, 'Cookie': `SESSDATA=${sessdata}` }
        );
        
        return response.code === 0 ? response.data : null;
    } catch {
        return null;
    }
};

/**
 * 获取B站请求头，包含登录信息
 * @param config 配置信息
 * @param bvid 可选的BV号，用于设置Referer
 * @returns 请求头
 */
export const getBiliHeaders = (config: any, bvid?: string): Record<string, string> => {
    const headers = { 
        ...BILI_HEADERS,
        'Referer': bvid ? `https://www.bilibili.com/video/${bvid}/` : 'https://www.bilibili.com'
    };

    if (!config.bilibiliLogin?.url) return headers;

    // 添加登录信息
    const sessdata = getSessData(config.bilibiliLogin.url);
    if (sessdata) {
        headers['Cookie'] = `SESSDATA=${sessdata}`;
        return headers;
    }
    
    try {
        const loginUrl = new URL(config.bilibiliLogin.url);
        const cookies = Array.from(loginUrl.searchParams.entries())
            .filter(([k]) => k !== 'url')
            .map(([k, v]) => `${k}=${v}`)
            .join('; ');
        
        if (cookies) headers['Cookie'] = cookies;
    } catch {}

    return headers;
};

/**
 * 生成B站视频MPD
 * @param dash B站dash数据
 * @returns data URL格式的MPD
 */
export const createBiliMPD = (dash: any): string => {
    if (!dash?.video?.length || !dash?.audio?.length) return '';
    
    try {
        const video = dash.video.find((v: any) => v.id >= 64) || dash.video[0];
        const audio = dash.audio[0];
        
        if (!video || !audio) return '';
        
        const duration = Math.floor(dash.duration || 3600);
        return `data:application/dash+xml;charset=utf-8,${encodeURIComponent(`<?xml version="1.0" encoding="UTF-8"?>
<MPD xmlns="urn:mpeg:dash:schema:mpd:2011" profiles="urn:mpeg:dash:profile:isoff-on-demand:2011" type="static" mediaPresentationDuration="PT${duration}S">
 <Period>
  <AdaptationSet mimeType="video/mp4" contentType="video">
   <Representation id="v${video.id}" bandwidth="${video.bandwidth}" codecs="${video.codecs}" width="${video.width}" height="${video.height}">
    <BaseURL>${video.baseUrl}</BaseURL>
    <SegmentBase indexRange="${video.segment_base?.index_range || '0-0'}"><Initialization range="${video.segment_base?.initialization || '0-0'}"/></SegmentBase>
   </Representation>
  </AdaptationSet>
  <AdaptationSet mimeType="audio/mp4" contentType="audio">
   <Representation id="a${audio.id}" bandwidth="${audio.bandwidth}" codecs="${audio.codecs}">
    <BaseURL>${audio.baseUrl}</BaseURL>
    <SegmentBase indexRange="${audio.segment_base?.index_range || '0-0'}"><Initialization range="${audio.segment_base?.initialization || '0-0'}"/></SegmentBase>
   </Representation>
  </AdaptationSet>
 </Period>
</MPD>`)}`;
    } catch {
        return '';
    }
};

/**
 * 二维码状态管理
 */
export class QRCodeManager {
    private timer: number | null = null;
    private configManager: any;
    private onStatusChange: (status: any) => void;
    private onLoginSuccess: (userInfo: any) => void;
    private qrcodeData: string = '';
    private qrcodeKey: string = '';

    constructor(configManager: any, onStatusChange: (status: any) => void, onLoginSuccess: (userInfo: any) => void) {
        this.configManager = configManager;
        this.onStatusChange = onStatusChange;
        this.onLoginSuccess = onLoginSuccess;
    }


    async startLogin() {
        const { qrcodeData, qrcode_key } = await generateBiliQRCode();
        this.qrcodeData = qrcodeData;
        this.qrcodeKey = qrcode_key;
        this.onStatusChange({ data: qrcodeData, key: qrcode_key, message: QR_STATUS[86101] });
        this.startPolling(qrcode_key);
        return { qrcodeData, qrcode_key };
    }


    private startPolling(qrcode_key: string) {
        if (this.timer) clearInterval(this.timer);
        this.timer = window.setInterval(async () => {
            try {
                const status = await checkBiliQRCodeStatus(qrcode_key);
                
                // 更新状态，保留二维码数据
                this.onStatusChange({ 
                    data: this.qrcodeData, 
                    key: this.qrcodeKey, 
                    message: status.message 
                });

                if (status.code === 0) {
                    this.stopPolling();
                    await this.handleLoginSuccess(status);
                } else if (status.code === 86038) {
                    this.stopPolling();
                    this.qrcodeData = '';
                    this.qrcodeKey = '';
                    this.onStatusChange({ data: '', key: '', message: status.message });
                }
            } catch {
                this.stopPolling();
            }
        }, 3000);
    }

    private async handleLoginSuccess(status: any) {
        const config = await this.configManager.getConfig();
        config.bilibiliLogin = {
            url: status.url,
            refresh_token: status.refresh_token,
            timestamp: status.timestamp,
            userInfo: status.userInfo
        };
        await this.configManager.save();
        this.onLoginSuccess(status.userInfo);
    }

    public stopPolling() {
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
    }
}

// 导出所有内容
export * from './biliUtils'; 