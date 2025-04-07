import md5 from 'md5';
import type { MediaInfo } from "./types";
import { VideoStream, VideoStreamResponse, selectBestStream, generateMPD } from './dash';
import { formatDuration } from './utils';
import { 
    BILI_API,
    biliRequest,
    parseBiliUrl,
    getBiliHeaders,
    extractFavMediaId,
    generateBiliQRCode,
    checkBiliQRCodeStatus
} from './biliUtils';

// WBI混淆表，用于生成API请求签名
const MIXIN_KEY_ENC_TAB = [
    46, 47, 18, 2, 53, 8, 23, 32, 15, 50, 10, 31, 58, 3, 45, 35, 27, 43, 5, 49,
    33, 9, 42, 19, 29, 28, 14, 39, 12, 38, 41, 13, 37, 48, 7, 16, 24, 55, 40,
    61, 26, 17, 0, 1, 60, 51, 30, 4, 22, 25, 54, 21, 56, 59, 6, 63, 57, 62, 11,
    36, 20, 34, 44, 52
];

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
 * B站解析器，处理B站相关API请求和数据解析
 */
export class BilibiliParser {
    /**
     * 混淆密钥生成
     */
    private static mixinKey(orig: string): string {
        return MIXIN_KEY_ENC_TAB.map(n => orig[n]).join('').slice(0, 32);
    }

    /**
     * 签名参数
     */
    private static sign(params: Record<string, any>, imgKey: string, subKey: string): string {
        const key = this.mixinKey(imgKey + subKey);
        params = { ...params, wts: Math.round(Date.now() / 1000) };
        
        const query = Object.keys(params)
            .sort()
            .map(k => `${encodeURIComponent(k)}=${encodeURIComponent(params[k].toString().replace(/[!'()*]/g, ''))}`)
            .join('&');

        return `${query}&w_rid=${md5(query + key)}`;
    }

    /**
     * 获取WBI密钥
     */
    private static getWbiKeys(config: any): { imgKey: string; subKey: string } {
        const wbiImg = config?.bilibiliLogin?.userInfo?.wbi_img;
        if (!wbiImg) throw new Error('未找到WBI密钥信息');

        return {
            imgKey: wbiImg.img_url.split('/').pop()?.split('.')[0] || '',
            subKey: wbiImg.sub_url.split('/').pop()?.split('.')[0] || ''
        };
    }

    /**
     * 获取视频信息
     */
    static async getVideoInfo(url: string): Promise<MediaInfo | null> {
        const videoId = parseBiliUrl(url);
        if (!videoId) return null;

        try {
            const { p, ...params } = videoId;
            // 获取视频基本信息
            const info = await biliRequest<BiliApiResponse>(
                `${BILI_API.VIDEO_INFO}?${new URLSearchParams(params).toString()}`
            );
            if (info.code !== 0) return null;
            
            // 获取视频分P列表
            const pages = await this.getVideoParts(params);
            
            // 确定当前分P的cid
            let cid = info.data.cid;
            if (pages.length > 0) {
                const pageIndex = Math.min(Math.max(1, p || 1), pages.length) - 1;
                cid = pages[pageIndex].cid;
                
                // 多P视频标题添加分P信息
                if (pages.length > 1) {
                    const part = pages[pageIndex].part;
                    info.data.title = `${info.data.title} - P${pageIndex + 1}${part ? ': ' + part : ''}`;
                }
            }

            // 返回规范化的媒体信息
            return {
                url,
                title: info.data.title,
                artist: info.data.owner.name,
                artistIcon: info.data.owner.face,
                duration: formatDuration(info.data.duration),
                thumbnail: info.data.pic,
                aid: String(info.data.aid),
                bvid: info.data.bvid,
                cid: String(cid)
            };
        } catch {
            return null;
        }
    }

    /**
     * 获取视频分P列表
     */
    static async getVideoParts(params: { aid?: string; bvid?: string }): Promise<any[]> {
        try {
            const response = await biliRequest<BiliApiResponse>(
                `${BILI_API.VIDEO_PAGES}?${new URLSearchParams(params).toString()}`
            );
            return response.code === 0 && Array.isArray(response.data) ? response.data : [];
        } catch {
            return [];
        }
    }

    /**
     * 获取视频流信息
     */
    static async getVideoStream(bvid: string, cid: string, qn: number, config: any): Promise<VideoStreamResponse> {
        const params = {
            bvid,
            cid,
            qn,
            fnval: 16,  // 开启DASH格式
            fnver: 0,
            fourk: 1,   // 允许4K
            platform: 'html5',
            high_quality: 1  // 允许高质量
        };

        try {
            // 获取WBI签名
            const wbiKeys = this.getWbiKeys(config);
            const signedParams = this.sign(params, wbiKeys.imgKey, wbiKeys.subKey);
            const headers = getBiliHeaders(config, bvid);

            // 请求视频流
            const response = await biliRequest<VideoStreamResponse>(
                `${BILI_API.VIDEO_STREAM}?${signedParams}`,
                headers
            );

            // 处理非DASH格式视频
            if (response.data.durl) {
                response.data.dash = {
                    video: [{
                        id: response.data.quality,
                        baseUrl: decodeURIComponent(response.data.durl[0].url),
                        codecs: 'avc1.640032',
                        bandwidth: response.data.durl[0].size,
                        frameRate: '30',
                        width: 1920,
                        height: 1080
                    }],
                    audio: []
                };
            } 
            // 处理DASH格式，解码URL
            else if (response.data.dash) {
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
            }

            return response;
        } catch (error) {
            throw new Error(`获取视频流失败: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    /**
     * 获取处理后的最佳播放流
     */
    static async getProcessedVideoStream(bvid: string, cid: string, qn: number, config: any): Promise<VideoStream> {
        try {
            // 获取视频流数据
            const streamData = await this.getVideoStream(bvid, cid, qn, config);
            const headers = getBiliHeaders(config, bvid);
            
            if (!streamData.data.dash?.video?.length) {
                throw new Error('未找到可用的视频流');
            }
            
            // 选择最佳视频流
            const bestVideo = selectBestStream(streamData.data.dash.video);
            const videoUrl = bestVideo.baseUrl;
            
            // 获取音频流
            const audioUrl = streamData.data.dash?.audio?.[0]?.baseUrl;
            const duration = Math.floor(streamData.data.timelength / 1000);
            
            // 复杂视频流 - 生成MPD
            if (audioUrl && streamData.data.dash.video.length > 1) {
                const mpdContent = generateMPD(
                    streamData.data.dash.video,
                    streamData.data.dash.audio || [],
                    duration
                );
                
                return {
                    video: { url: videoUrl },
                    audio: { url: audioUrl },
                    headers,
                    mpdUrl: `data:application/dash+xml;charset=utf-8,${encodeURIComponent(mpdContent)}`
                };
            }
            
            // 简单视频流
            return {
                video: { url: videoUrl },
                audio: audioUrl ? { url: audioUrl } : undefined,
                headers
            };
        } catch (error) {
            throw new Error(`处理视频流失败: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    /**
     * 获取登录二维码
     */
    static async getLoginQRCode(): Promise<{qrcodeData: string, qrcode_key: string}> {
        return generateBiliQRCode();
    }

    /**
     * 检查二维码扫描状态
     */
    static async checkQRCodeStatus(qrcode_key: string): Promise<LoginStatus> {
        return checkBiliQRCodeStatus(qrcode_key);
    }

    /**
     * 获取收藏夹内容
     * @param mediaId 收藏夹ID
     * @param config 配置信息
     * @returns 收藏夹标题和视频列表
     */
    static async getFavoritesList(mediaId: string, config: any): Promise<{title: string, items: {bvid: string}[]}> {
        try {
            // 并行发送两个请求以提高效率
            const [infoResponse, idsResponse] = await Promise.all([
                // 获取收藏夹信息（标题等）
                biliRequest<BiliApiResponse>(
                    `${BILI_API.FAVORITE_LIST}?media_id=${mediaId}&platform=web&ps=20&pn=1`,
                    getBiliHeaders(config)
                ),
                // 获取收藏夹内容ID列表
                biliRequest<BiliApiResponse>(
                    `${BILI_API.FAVORITE_IDS}?media_id=${mediaId}&platform=web`,
                    getBiliHeaders(config)
                )
            ]);
            
            // 提取收藏夹标题
            const title = infoResponse.data?.info?.title || '未命名收藏夹';
            
            // 过滤出视频类型的项目
            const videoItems = Array.isArray(idsResponse.data) 
                ? idsResponse.data.filter(item => item.type === 2 && item.bvid)
                : [];
            
            return { title, items: videoItems };
        } catch (error) {
            console.error('获取收藏夹内容失败：', error);
            throw error;
        }
    }

    /**
     * 从收藏夹URL中提取媒体ID
     * @param url 收藏夹URL
     * @returns 媒体ID
     */
    static extractMediaIdFromUrl(url: string): string | null {
        return extractFavMediaId(url);
    }
}