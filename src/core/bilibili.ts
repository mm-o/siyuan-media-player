import QRCode from 'qrcode';
import type { MediaInfo } from "./types";
import md5 from 'md5';

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
 * 视频流信息响应接口
 */
interface VideoStreamResponse {
    code: number;
    message: string;
    ttl: number;
    data: {
        quality: number;
        format: string;
        timelength: number;
        accept_format: string;
        accept_description: string[];
        accept_quality: number[];
        video_codecid: number;
        seek_param: string;
        seek_type: string;
        durl?: any[];
        dash?: any;
        support_formats: any[];
    };
}

/**
 * B站播放流信息
 */
interface VideoStream {
    video: {
        url: string;        // 视频流地址
        quality: number;    // 视频清晰度
        codecs: string;     // 视频编码格式
        bandwidth: number;  // 视频码率
        frameRate: string;  // 视频帧率
    };
    audio: {
        url: string;        // 音频流地址
        codecs: string;     // 音频编码格式
        bandwidth: number;  // 音频码率
    };
    headers: {             // 请求头信息
        [key: string]: string;
    };
}

/**
 * B站信息解析器
 * 负责处理B站相关的API请求和数据解析
 */
export class BilibiliParser {
    // API 常量定义
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

    private static readonly MIXIN_KEY_ENC_TAB = [
        46, 47, 18, 2, 53, 8, 23, 32, 15, 50, 10, 31, 58, 3, 45, 35, 27, 43, 5, 49,
        33, 9, 42, 19, 29, 28, 14, 39, 12, 38, 41, 13, 37, 48, 7, 16, 24, 55, 40,
        61, 26, 17, 0, 1, 60, 51, 30, 4, 22, 25, 54, 21, 56, 59, 6, 63, 57, 62, 11,
        36, 20, 34, 44, 52
    ];

    /**
     * 对 imgKey 和 subKey 进行字符顺序打乱编码
     */
    private static getMixinKey(orig: string): string {
        return this.MIXIN_KEY_ENC_TAB
            .map(n => orig[n])
            .join('')
            .slice(0, 32);
    }

    /**
     * 为请求参数进行 wbi 签名
     */
    static encWbi(params: Record<string, any>, imgKey: string, subKey: string): string {
        const mixinKey = this.getMixinKey(imgKey + subKey);
        const currTime = Math.round(Date.now() / 1000);
        const chrFilter = /[!'()*]/g;

        // 添加 wts 字段
        params = { ...params, wts: currTime };

        // 按照 key 重排参数并过滤特殊字符
        const query = Object.keys(params)
            .sort()
            .map(key => {
                const value = params[key].toString().replace(chrFilter, '');
                return `${encodeURIComponent(key)}=${encodeURIComponent(value)}`;
            })
            .join('&');

        // 计算 w_rid
        const wbiSign = md5(query + mixinKey);

        return query + '&w_rid=' + wbiSign;
    }

    /**
     * 从配置中获取 wbi keys
     */
    static getWbiKeysFromConfig(config: any): { imgKey: string; subKey: string } | null {
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
     * 发送代理请求
     * @param apiUrl B站API地址
     * @param headers 请求头
     * @returns API响应数据
     */
    private static async proxyRequest<T>(apiUrl: string, headers: Record<string, string> = {}): Promise<T> {
        try {
            const response = await fetch(this.API.PROXY, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    url: apiUrl,
                    method: 'GET',
                    timeout: 7000,
                    contentType: 'application/json',
                    headers: Object.entries(headers).map(([key, value]) => ({
                        [key]: value
                    }))
                })
            });
            
            const proxyResponse = await response.json();
            
            if (proxyResponse.code !== 0) {
                throw new Error('代理请求失败: ' + proxyResponse.msg);
            }
            
            return JSON.parse(proxyResponse.data.body);
        } catch (e) {
            console.error('代理请求失败:', e);
            throw new Error('代理请求失败');
        }
    }

    /**
     * 从B站视频URL中提取视频ID和分P信息
     */
    private static extractVideoId(url: string): {
        aid?: string;
        bvid?: string;
        p?: number;  // 添加分P参数
    } | null {
        try {
            const urlObj = new URL(url);
            
            // 处理短链接
            if (urlObj.hostname === 'b23.tv') {
                return null;
            }
            
            // 获取分P信息
            const p = parseInt(urlObj.searchParams.get('p') || '1');
            
            // 从路径中提取BV号
            const bvMatch = urlObj.pathname.match(/\/(BV[\w]+)/);
            if (bvMatch) {
                return { bvid: bvMatch[1], p };
            }
            
            // 从查询参数中提取
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

            if (response.code === 0 && Array.isArray(response.data)) {
                return response.data;
            }
            return [];
        } catch (e) {
            console.error('获取视频分P信息失败:', e);
            return [];
        }
    }

    /**
     * 格式化视频时长
     */
    private static formatDuration(seconds: number): string {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;

        return hours > 0
            ? `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
            : `${minutes}:${secs.toString().padStart(2, '0')}`;
    }

    /**
     * 生成二维码图片
     */
    private static async generateQRCode(text: string): Promise<string> {
        try {
            return await QRCode.toDataURL(text, {
                width: 200,
                margin: 2,
                color: {
                    dark: '#000000',
                    light: '#ffffff'
                }
            });
        } catch (e) {
            console.error('生成二维码失败:', e);
            throw new Error('生成二维码失败');
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

    // 公共方法
    /**
     * 获取视频信息
     */
    static async getVideoInfo(url: string): Promise<MediaInfo | null> {
        const videoId = this.extractVideoId(url);
        if (!videoId) return null;

        try {
            // 1. 获取视频基本信息
            const { p, ...params } = videoId;
            const response = await this.proxyRequest<BiliApiResponse>(
                `${this.API.VIDEO_INFO}?${new URLSearchParams(params).toString()}`
            );

            if (response.code === 0) {
                const data = response.data;
                
                // 2. 获取分P列表
                const pages = await this.getVideoPages(params);
                
                // 3. 根据分P参数获取正确的cid
                let cid = data.cid; // 默认使用第一P的cid
                if (pages.length > 0) {
                    const pageIndex = Math.min(Math.max(1, p || 1), pages.length) - 1;
                    cid = pages[pageIndex].cid;
                    
                    // 如果是分P视频，在标题中添加分P信息
                    if (pages.length > 1) {
                        data.title = `${data.title} - P${pageIndex + 1}${pages[pageIndex].part ? ': ' + pages[pageIndex].part : ''}`;
                    }
                }

                return {
                    url,
                    title: data.title,
                    artist: data.owner.name,
                    artistIcon: data.owner.face,
                    duration: this.formatDuration(data.duration),
                    thumbnail: data.pic,
                    aid: String(data.aid),
                    bvid: data.bvid,
                    cid: String(cid)  // 使用正确的分P cid
                };
            }
            return null;
        } catch (e) {
            console.error('获取视频信息失败:', e);
            return null;
        }
    }

    /**
     * 获取登录二维码
     */
    static async getLoginQRCode(): Promise<{qrcodeData: string, qrcode_key: string}> {
        try {
            const response = await this.proxyRequest<BiliApiResponse>(this.API.QR_LOGIN);
            
            if (response.code !== 0) {
                throw new Error('获取二维码失败: ' + response.message);
            }

            if (response.data) {
                const qrcodeData = await this.generateQRCode(response.data.url);
                return {
                    qrcodeData,
                    qrcode_key: response.data.qrcode_key
                };
            }
            throw new Error('获取二维码失败');
        } catch (e) {
            throw new Error('获取二维码失败');
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
            
            // 登录成功
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
            
            // 返回当前状态
            return {
                code: response.data.code,
                message: response.data.message || '未知状态'
            };
        } catch (e) {
            throw new Error('检查二维码状态失败');
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
        } catch (e) {
            throw new Error('获取用户信息失败');
        }
    }

    /**
     * 获取视频流信息
     * @param bvid - B站视频BV号
     * @param cid - 视频分P的cid
     * @param qn - 视频清晰度
     * @param config - 插件配置
     */
    static async getVideoUrl(bvid: string, cid: string, qn: number, config: any): Promise<VideoStreamResponse> {
        // 构造请求参数
        const params = {
            bvid,
            cid,
            qn,            // 清晰度
            fnval: 16,     // 返回 MP4 格式
            fnver: 0,
            fourk: 1,      // 允许4K视频
            platform: 'html5',  // 使用 HTML5 平台参数
            high_quality: 1    // 允许高清格式
        };

        // 获取WBI签名密钥
        const wbiKeys = this.getWbiKeysFromConfig(config);
        if (!wbiKeys) {
            throw new Error('无法获取WBI签名密钥');
        }

        // 生成签名参数
        const signedParams = this.encWbi(params, wbiKeys.imgKey, wbiKeys.subKey);
        console.log('[思源媒体播放器] 视频流API签名参数:', signedParams);

        try {
            // 从配置中获取登录信息
            const sessdata = config.bilibiliLogin?.url ? 
                this.extractSessData(config.bilibiliLogin.url) : null;

            // 构造请求头
            const headers = {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                'Referer': 'https://www.bilibili.com',
                'Origin': 'https://www.bilibili.com'
            };

            // 如果有登录信息，添加到请求头
            if (sessdata) {
                headers['Cookie'] = `SESSDATA=${sessdata}`;
            }

            // 使用思源代理发送请求
            const response = await this.proxyRequest<VideoStreamResponse>(
                `${this.API.VIDEO_STREAM}?${signedParams}`,
                headers
            );

            // 修改视频流处理逻辑
            if (response.data.durl) {
                // 处理直接返回的 MP4 链接
                response.data.dash = {
                    video: [{
                        id: response.data.quality,
                        baseUrl: decodeURIComponent(response.data.durl[0].url),
                        codecs: 'avc1.640032',
                        bandwidth: response.data.durl[0].size,
                        frameRate: '30',
                    }],
                    audio: [] // MP4 格式不需要单独的音频流
                };
            } else if (response.data.dash) {
                // 处理 DASH 格式
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

            console.log('[思源媒体播放器] 视频流信息:', {
                状态码: response.code,
                消息: response.message,
                视频信息: {
                    清晰度: response.data.quality,
                    格式: response.data.format,
                    时长: Math.floor(response.data.timelength / 1000) + '秒',
                    支持清晰度: response.data.accept_description,
                    视频编码: response.data.video_codecid,
                    DASH信息: {
                        视频流: response.data.dash?.video?.map(v => ({
                            清晰度: v.id,
                            编码格式: v.codecs,
                            带宽: v.bandwidth,
                            帧率: v.frameRate,
                            播放地址: v.baseUrl
                        })),
                        音频流: response.data.dash?.audio?.map(a => ({
                            编码格式: a.codecs,
                            带宽: a.bandwidth,
                            播放地址: a.baseUrl
                        }))
                    }
                }
            });

            return response;
        } catch (error) {
            console.error('[思源媒体播放器] 获取视频流失败:', error);
            throw error;
        }
    }

    /**
     * 智能选择最佳播放流
     */
    private static selectBestStream(streams: any[], currentQuality: number | null = null): any {
        if (!streams?.length) return null;
        
        // 按质量和带宽排序
        const sortedStreams = streams.sort((a, b) => {
            // 如果指定了期望质量，优先选择该质量
            if (currentQuality) {
                if (a.id === currentQuality) return -1;
                if (b.id === currentQuality) return 1;
            }
            // 否则按质量和带宽排序
            return b.id - a.id || b.bandwidth - a.bandwidth;
        });
        
        return sortedStreams[0];
    }

    /**
     * 获取并处理视频流信息
     */
    static async getProcessedVideoStream(bvid: string, cid: string, qn: number, config: any): Promise<VideoStream> {
        let currentVideoStream = null;
        let currentAudioStream = null;
        let retryCount = 0;
        const MAX_RETRIES = 3;

        while (retryCount < MAX_RETRIES) {
            try {
                const response = await this.getVideoUrl(bvid, cid, qn, config);
                
                if (!response.data.dash && !response.data.durl) {
                    throw new Error('不支持的视频格式');
                }

                if (response.data.durl) {
                    // 处理 MP4 格式
                    currentVideoStream = {
                        id: response.data.quality,
                        baseUrl: response.data.durl[0].url,
                        codecs: 'avc1.640032',
                        bandwidth: response.data.durl[0].size,
                        frameRate: '30'
                    };
                    currentAudioStream = null; // MP4 格式不需要单独的音频流
                } else {
                    // 处理 DASH 格式
                    const videoStreams = response.data.dash.video || [];
                    const audioStreams = response.data.dash.audio || [];

                    // 如果是重试，尝试选择较低质量的流
                    const targetQuality = retryCount > 0 ? null : qn;
                    
                    currentVideoStream = this.selectBestStream(videoStreams, targetQuality);
                    currentAudioStream = this.selectBestStream(audioStreams);
                }

                if (!currentVideoStream) {
                    throw new Error('无法获取合适的播放流');
                }

                // 构造请求头
                const headers = {
                    'Referer': `https://www.bilibili.com/video/${bvid}/`,
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
                };

                // 添加登录信息
                if (config.bilibiliLogin?.url) {
                    const loginUrl = new URL(config.bilibiliLogin.url);
                    const cookies = Array.from(loginUrl.searchParams.entries())
                        .filter(([key]) => key !== 'url')
                        .map(([key, value]) => `${key}=${value}`)
                        .join('; ');
                    
                    if (cookies) {
                        headers['Cookie'] = cookies;
                    }
                }

                return {
                    video: {
                        url: currentVideoStream.baseUrl,
                        quality: currentVideoStream.id,
                        codecs: currentVideoStream.codecs,
                        bandwidth: currentVideoStream.bandwidth,
                        frameRate: currentVideoStream.frameRate,
                    },
                    audio: currentAudioStream ? {
                        url: currentAudioStream.baseUrl,
                        codecs: currentAudioStream.codecs,
                        bandwidth: currentAudioStream.bandwidth,
                    } : undefined,
                    headers: {
                        ...headers,
                        'Origin': 'https://www.bilibili.com'
                    }
                };
            } catch (error) {
                console.error(`[思源媒体播放器] 获取播放流失败 (重试 ${retryCount + 1}/${MAX_RETRIES}):`, error);
                retryCount++;
                
                if (retryCount === MAX_RETRIES) {
                    throw new Error(`获取播放流失败: ${error.message}`);
                }
                
                await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
            }
        }

        throw new Error('无法获取播放流');
    }
}