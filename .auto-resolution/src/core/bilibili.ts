import QRCode from 'qrcode';
import md5 from 'md5';
import type { MediaInfo } from "./types";
import { VideoStream, VideoStreamResponse, selectBestStream, generateMPD } from './dash';
import { formatDuration } from './utils';

/**
 * B站API响应接口
 */
interface BiliApiResponse<T = any> {
    code: number;
    message: string;
    data: T;
}

/**
 * B站登录状态接口
 */
interface LoginStatus {
    code: number;
    message: string;
    url?: string;
    refresh_token?: string;
    timestamp?: number;
    userInfo?: {
        face: string;
        level_info: {
            current_level: number;
            current_min: number;
            current_exp: number;
            next_exp: string | number;
        };
        mid: number;
        uname: string;
        wbi_img?: {
            img_url: string;
            sub_url: string;
        };
    };
}

/**
 * B站信息解析器
 * 负责处理B站相关的API请求和数据解析
 */
export class BilibiliParser {
    // API常量定义
    private static readonly API = {
        BASE: "https://api.bilibili.com",
        PROXY: "/api/network/forwardProxy",
        QR_LOGIN: "https://passport.bilibili.com/x/passport-login/web/qrcode/generate",
        QR_POLL: "https://passport.bilibili.com/x/passport-login/web/qrcode/poll",
        USER_INFO: "https://api.bilibili.com/x/web-interface/nav",
        VIDEO_INFO: "https://api.bilibili.com/x/web-interface/view",
        VIDEO_PAGES: "https://api.bilibili.com/x/player/pagelist",
        VIDEO_STREAM: "https://api.bilibili.com/x/player/wbi/playurl"
    };

    // WBI 混淆表
    private static readonly MIXIN_KEY_ENC_TAB = [
        46, 47, 18, 2, 53, 8, 23, 32, 15, 50, 10, 31, 58, 3, 45, 35, 27, 43, 5, 49,
        33, 9, 42, 19, 29, 28, 14, 39, 12, 38, 41, 13, 37, 48, 7, 16, 24, 55, 40,
        61, 26, 17, 0, 1, 60, 51, 30, 4, 22, 25, 54, 21, 56, 59, 6, 63, 57, 62, 11,
        36, 20, 34, 44, 52
    ];

    /**
     * 对 imgKey 和 subKey 进行混淆编码
     */
    private static getMixinKey(orig: string): string {
        return this.MIXIN_KEY_ENC_TAB
            .map(n => orig[n])
            .join('')
            .slice(0, 32);
    }

    /**
     * 为请求参数生成 wbi 签名
     */
    private static encWbi(params: Record<string, any>, imgKey: string, subKey: string): string {
        const mixinKey = this.getMixinKey(imgKey + subKey);
        const currTime = Math.round(Date.now() / 1000);
        const chrFilter = /[!'()*]/g;

        params = { ...params, wts: currTime };
        const query = Object.keys(params)
            .sort()
            .map(key => {
                const value = params[key].toString().replace(chrFilter, '');
                return `${encodeURIComponent(key)}=${encodeURIComponent(value)}`;
            })
            .join('&');

        return query + '&w_rid=' + md5(query + mixinKey);
    }

    /**
     * 从配置中获取 WBI 密钥
     */
    private static getWbiKeysFromConfig(config: any): { imgKey: string; subKey: string } | null {
        if (!config?.bilibiliLogin?.userInfo?.wbi_img) {
            return null;
        }

        const { img_url, sub_url } = config.bilibiliLogin.userInfo.wbi_img;
        return {
            imgKey: img_url.split('/').pop()?.split('.')[0] || '',
            subKey: sub_url.split('/').pop()?.split('.')[0] || ''
        };
    }

    /**
     * 发送代理网络请求
     */
    private static async proxyRequest<T>(apiUrl: string, headers: Record<string, string> = {}): Promise<T> {
        try {
            const response = await fetch(this.API.PROXY, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    url: apiUrl,
                    method: 'GET',
                    timeout: 7000,
                    contentType: 'application/json',
                    headers: Object.entries(headers).map(([key, value]) => ({ [key]: value }))
                })
            });
            
            const proxyResponse = await response.json();
            if (proxyResponse.code !== 0) {
                throw new Error(`代理请求失败: ${proxyResponse.msg}`);
            }
            
            return JSON.parse(proxyResponse.data.body);
        } catch (error) {
            throw new Error(`代理请求失败: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    /**
     * 从B站视频URL提取视频ID和分P信息
     */
    private static extractVideoId(url: string): {
        aid?: string;
        bvid?: string;
        p?: number;
    } | null {
        try {
            const urlObj = new URL(url);
            if (urlObj.hostname === 'b23.tv') return null;
            
            const p = parseInt(urlObj.searchParams.get('p') || '1');
            const bvMatch = urlObj.pathname.match(/\/(BV[\w]+)/);
            
            if (bvMatch) return { bvid: bvMatch[1], p };
            
            const aid = urlObj.searchParams.get('aid');
            const bvid = urlObj.searchParams.get('bvid');
            
            if (aid) return { aid, p };
            if (bvid) return { bvid, p };
            
            return null;
        } catch {
            return null;
        }
    }

    /**
     * 获取视频分P信息
     */
    private static async getVideoPages(params: { aid?: string; bvid?: string }): Promise<any[]> {
        try {
            const response = await this.proxyRequest<BiliApiResponse>(
                `${this.API.VIDEO_PAGES}?${new URLSearchParams(params).toString()}`
            );
            return response.code === 0 && Array.isArray(response.data) ? response.data : [];
        } catch {
            return [];
        }
    }

    /**
     * 获取视频分P信息
     */
    private static async getVideoPages(params: { aid?: string; bvid?: string }): Promise<any[]> {
        try {
            const response = await this.proxyRequest<BiliApiResponse>(
                `${this.API.VIDEO_PAGES}?${new URLSearchParams(params).toString()}`
            );
            return response.code === 0 && Array.isArray(response.data) ? response.data : [];
        } catch {
            return [];
        }
    }

    /**
     * 生成登录二维码图片
     */
    private static async generateQRCode(text: string): Promise<string> {
        try {
            return await QRCode.toDataURL(text, {
                width: 200,
                margin: 2,
                color: { dark: '#000000', light: '#ffffff' }
            });
        } catch (error) {
            throw new Error(`生成二维码失败: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    /**
     * 从URL中提取SESSDATA
     */
    private static extractSessData(url: string): string | null {
        try {
            return new URL(url).searchParams.get('SESSDATA');
        } catch {
            return null;
        }
    }

    /**
     * 从配置中获取请求头
     */
    private static getRequestHeaders(config: any, bvid?: string): Record<string, string> {
        const headers: Record<string, string> = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            'Referer': bvid ? `https://www.bilibili.com/video/${bvid}/` : 'https://www.bilibili.com',
            'Origin': 'https://www.bilibili.com'
        };

        if (config.bilibiliLogin?.url) {
            const sessdata = this.extractSessData(config.bilibiliLogin.url);
            if (sessdata) {
                headers['Cookie'] = `SESSDATA=${sessdata}`;
            } else {
                const loginUrl = new URL(config.bilibiliLogin.url);
                const cookies = Array.from(loginUrl.searchParams.entries())
                    .filter(([key]) => key !== 'url')
                    .map(([key, value]) => `${key}=${value}`)
                    .join('; ');
                
                if (cookies) {
                    headers['Cookie'] = cookies;
                }
            }
        }

        return headers;
    }

    /**
     * 获取视频信息
     */
    static async getVideoInfo(url: string): Promise<MediaInfo | null> {
        const videoId = this.extractVideoId(url);
        if (!videoId) return null;

        try {
            const { p, ...params } = videoId;
            const response = await this.proxyRequest<BiliApiResponse>(
                `${this.API.VIDEO_INFO}?${new URLSearchParams(params).toString()}`
            );

            if (response.code === 0) {
                const data = response.data;
                const pages = await this.getVideoPages(params);
                
                let cid = data.cid;
                if (pages.length > 0) {
                    const pageIndex = Math.min(Math.max(1, p || 1), pages.length) - 1;
                    cid = pages[pageIndex].cid;
                    
                    if (pages.length > 1) {
                        data.title = `${data.title} - P${pageIndex + 1}${pages[pageIndex].part ? ': ' + pages[pageIndex].part : ''}`;
                    }
                }

                return {
                    url,
                    title: data.title,
                    artist: data.owner.name,
                    artistIcon: data.owner.face,
                    duration: formatDuration(data.duration),
                    thumbnail: data.pic,
                    aid: String(data.aid),
                    bvid: data.bvid,
                    cid: String(cid)
                };
            }
            return null;
        } catch {
            return null;
        }
    }

    /**
     * 获取登录二维码
     */
    static async getLoginQRCode(): Promise<{qrcodeData: string, qrcode_key: string}> {
        try {
            const response = await this.proxyRequest<BiliApiResponse>(this.API.QR_LOGIN);
            
            if (response.code !== 0 || !response.data) {
                throw new Error(`获取二维码失败: ${response.message}`);
            }

            const qrcodeData = await this.generateQRCode(response.data.url);
            return { qrcodeData, qrcode_key: response.data.qrcode_key };
        } catch (error) {
            throw new Error(`获取二维码失败: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    /**
     * 检查二维码扫描状态
     */
    static async checkQRCodeStatus(qrcode_key: string): Promise<LoginStatus> {
        try {
            const response = await this.proxyRequest<BiliApiResponse>(
                `${this.API.QR_POLL}?qrcode_key=${qrcode_key}`
            );
            
            if (response.code === 0 && response.data.code === 0) {
                const sessdata = this.extractSessData(response.data.url);
                const userInfo = sessdata ? await this.getUserInfo(sessdata) : null;

                return {
                    code: 0,
                    message: '登录成功',
                    url: response.data.url,
                    refresh_token: response.data.refresh_token,
                    timestamp: response.data.timestamp,
                    userInfo
                };
            }
            
            return {
                code: response.data.code,
                message: response.data.message || '未知状态'
            };
        } catch (error) {
            throw new Error(`检查二维码状态失败: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    /**
     * 获取用户信息
     */
    private static async getUserInfo(sessdata: string) {
        try {
            const response = await this.proxyRequest<BiliApiResponse>(
                this.API.USER_INFO,
                { 'Cookie': `SESSDATA=${sessdata}` }
            );
            
            if (response.code === 0) {
                const { face, level_info, mid, uname, wbi_img } = response.data;
                return {
                    face,
                    level_info,
                    mid,
                    uname,
                    wbi_img: wbi_img ? {
                        img_url: wbi_img.img_url,
                        sub_url: wbi_img.sub_url
                    } : undefined
                };
            }
            throw new Error(response.message || '获取用户信息失败');
        } catch (error) {
            throw new Error(`获取用户信息失败: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    /**
     * 获取视频流信息
     */
    static async getVideoUrl(bvid: string, cid: string, qn: number, config: any): Promise<VideoStreamResponse> {
        const params = {
            bvid,
            cid,
            qn,
            fnval: 16,
            fnver: 0,
            fourk: 1,
            platform: 'html5',
            high_quality: 1
        };

        const wbiKeys = this.getWbiKeysFromConfig(config);
        if (!wbiKeys) {
            throw new Error('无法获取WBI签名密钥');
        }

        const signedParams = this.encWbi(params, wbiKeys.imgKey, wbiKeys.subKey);
        const headers = this.getRequestHeaders(config, bvid);

        try {
            const response = await this.proxyRequest<VideoStreamResponse>(
                `${this.API.VIDEO_STREAM}?${signedParams}`,
                headers
            );

            // 处理视频流URL
            if (response.data.durl) {
                response.data.dash = {
                    video: [{
                        id: response.data.quality,
                        baseUrl: decodeURIComponent(response.data.durl[0].url),
                        codecs: 'avc1.640032',
                        bandwidth: response.data.durl[0].size,
                        frameRate: '30',
                    }],
                    audio: []
                };
            } else if (response.data.dash) {
                // 处理DASH格式
                if (response.data.dash.video) {
                    response.data.dash.video = response.data.dash.video.map(v => ({
                        ...v,
                        baseUrl: decodeURIComponent(v.baseUrl)
                    }));
                }
                if (response.data.dash.audio) {
                    response.data.dash.audio = response.data.dash.audio.map(a => ({
                        ...a,
                        baseUrl: decodeURIComponent(a.baseUrl)
                    }));
                }
            } else {
                throw new Error('不支持的视频格式');
            }

            return response;
        } catch (error) {
            throw new Error(`获取视频流失败: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    /**
     * 获取并处理视频流信息
     */
    static async getProcessedVideoStream(bvid: string, cid: string, qn: number, config: any): Promise<VideoStream> {
        const MAX_RETRIES = 3;
        let lastError;

        for (let retryCount = 0; retryCount < MAX_RETRIES; retryCount++) {
            try {
                const response = await this.getVideoUrl(bvid, cid, qn, config);
                
                if (!response.data.dash && !response.data.durl) {
                    throw new Error('不支持的视频格式');
                }

                let currentVideoStream = null;
                let mpdUrl = null;

                let currentVideoStream = null;
                let mpdUrl = null;

                if (response.data.durl) {
                    // 直接播放流
                    currentVideoStream = {
                        id: response.data.quality,
                        baseUrl: response.data.durl[0].url,
                        codecs: 'avc1.640032',
                        bandwidth: response.data.durl[0].size,
                        frameRate: '30'
                    };
                } else {
                    // DASH格式处理
                    const videoStreams = response.data.dash.video || [];
                    const targetQuality = retryCount > 0 ? null : qn;
                    currentVideoStream = selectBestStream(videoStreams, targetQuality);
                    
                    try {
                        // 生成MPD文件
                        const mpdContent = generateMPD(response);
                        const blob = new Blob([mpdContent], { type: 'application/dash+xml' });
                        mpdUrl = URL.createObjectURL(blob);
                    } catch (error) {
                        // MPD生成失败不影响视频播放
                    }
                }

                if (!currentVideoStream) {
                    throw new Error('无法获取合适的播放流');
                }

                return {
                    video: {
                        url: currentVideoStream.baseUrl,
                        quality: currentVideoStream.id,
                        codecs: currentVideoStream.codecs,
                        bandwidth: currentVideoStream.bandwidth,
                        frameRate: currentVideoStream.frameRate,
                    },
                    headers: this.getRequestHeaders(config, bvid),
                    mpdUrl
                };
            } catch (error) {
                lastError = error;
                
                if (retryCount === MAX_RETRIES - 1) {
                    throw new Error(`获取播放流失败: ${error instanceof Error ? error.message : String(error)}`);
                }
                
                // 指数退避重试
                await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, retryCount)));
            }
        }

        throw new Error('无法获取播放流');
    }

    /**
     * 获取视频分P列表
     * 通过bvid或aid获取视频的所有分P信息
     */
    static async getVideoPartsList(params: { aid?: string; bvid?: string }): Promise<any[]> {
        return this.getVideoPages(params);
    }
}