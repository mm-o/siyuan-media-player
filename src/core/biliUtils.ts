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

/**
 * 生成B站登录二维码
 */
export const generateBiliQRCode = async (): Promise<{qrcodeData: string, qrcode_key: string}> => {
    try {
        const response = await biliRequest<any>(BILI_API.QR_LOGIN);
        if (response.code !== 0) throw new Error(`生成登录二维码失败: ${response.message}`);
        
        const qrcodeData = await QRCode.toDataURL(response.data.url, {
            width: 200, margin: 2, color: { dark: '#000000', light: '#ffffff' }
        });
        
        return { qrcodeData, qrcode_key: response.data.qrcode_key };
    } catch (error) {
        throw new Error(`生成登录二维码失败: ${error instanceof Error ? error.message : String(error)}`);
    }
};

/**
 * 检查二维码扫描状态
 * @param qrcode_key 二维码的key
 * @returns 登录状态
 */
export const checkBiliQRCodeStatus = async (qrcode_key: string): Promise<{
    code: number;
    message: string;
    url?: string;
    userInfo?: any;
}> => {
    try {
        const response = await biliRequest<any>(`${BILI_API.QR_POLL}?qrcode_key=${qrcode_key}`);
        
        // 已扫描并获取到URL
        if (response.code === 0 && response.data.url) {
            const sessdata = getSessData(response.data.url);
            const userInfo = sessdata ? await getBiliUserInfo(sessdata) : null;
            
            return {
                ...response.data,
                code: 0,
                message: '登录成功',
                userInfo: userInfo || undefined
            };
        }
        
        // 其他状态
        return {
            code: response.code || -1,
            message: response.message || '未知错误'
        };
    } catch (error) {
        return {
            code: -1,
            message: `检查二维码状态失败: ${error instanceof Error ? error.message : String(error)}`
        };
    }
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